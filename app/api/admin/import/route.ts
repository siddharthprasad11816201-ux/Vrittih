import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { hashPassword } from "@/lib/hash"
import { requireAdmin, logAction } from "@/lib/admin"
import { parseCSVObjects } from "@/lib/csv"

export const dynamic = "force-dynamic"

// Column aliases so we tolerate small header differences between Indeed exports.
const COL = (r: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (r[k] != null && r[k] !== "") return r[k]
  return ""
}

// Indeed status / interest -> our pipeline vocabulary.
function mapStatus(status: string, interest: string): string {
  const s = (status + " " + interest).toLowerCase()
  if (/reject/.test(s)) return "REJECTED"
  if (/withdraw/.test(s)) return "WITHDRAWN"
  if (/hire|offer/.test(s)) return "HIRED"
  if (/interview/.test(s)) return "INTERVIEW"
  if (/shortlist|review|interested|maybe|active/.test(s)) return "SHORTLISTED"
  return "APPLIED"
}

const cleanPhone = (p: string) => p.replace(/^['`\s]+/, "").trim()

// GET -> employers the admin can assign imported positions to.
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  const employers = await prisma.user.findMany({
    where: { role: { in: ["EMPLOYER", "ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: "asc" },
  })
  const importedCount = await prisma.user.count({ where: { source: "indeed" } })
  return NextResponse.json({ employers, importedCount })
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  try {
    const body = await req.json()
    const csv: string = body.csv || ""
    const dryRun: boolean = !!body.dryRun
    let ownerId: string = body.ownerId || ""
    const companyOverride: string = (body.company || "").trim()

    if (!csv.trim()) return NextResponse.json({ error: "No CSV data provided." }, { status: 400 })
    if (csv.length > 8_000_000) return NextResponse.json({ error: "File too large (max ~8MB)." }, { status: 413 })

    const rows = parseCSVObjects(csv)
    if (rows.length === 0) return NextResponse.json({ error: "No rows found. Check the header line is present." }, { status: 400 })
    if (rows.length > 20000) return NextResponse.json({ error: "Too many rows (max 20,000 per import)." }, { status: 400 })

    // Resolve the owner employer for imported positions.
    if (!ownerId) {
      const firstEmployer = await prisma.user.findFirst({ where: { role: "EMPLOYER" }, select: { id: true }, orderBy: { createdAt: "asc" } })
      ownerId = firstEmployer?.id || admin.userId
    }
    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, name: true } })
    if (!owner) return NextResponse.json({ error: "Selected owner not found." }, { status: 400 })

    // --- Normalise rows -------------------------------------------------
    type Cand = { name: string; email: string; phone: string; location: string; headline: string; education: string; title: string; jobLocation: string; status: string; interest: string; date: string; sourceLabel: string }
    const cands: Cand[] = []
    let skippedNoEmail = 0
    for (const r of rows) {
      const email = COL(r, "email", "candidate email", "e-mail").toLowerCase().trim()
      const title = COL(r, "job title", "position", "job", "title").trim()
      if (!email || !title) { skippedNoEmail++; continue }
      cands.push({
        name: COL(r, "name", "candidate name", "full name").trim() || email.split("@")[0],
        email,
        phone: cleanPhone(COL(r, "phone", "phone number", "mobile")),
        location: COL(r, "candidate location", "location").trim(),
        headline: COL(r, "relevant experience", "experience", "current title", "headline").trim(),
        education: COL(r, "education", "qualification").trim(),
        title,
        jobLocation: COL(r, "job location").trim() || "—",
        status: COL(r, "status").trim(),
        interest: COL(r, "interest level", "interest").trim(),
        date: COL(r, "date", "applied date", "date applied").trim(),
        sourceLabel: COL(r, "source").trim() || "Indeed",
      })
    }
    if (cands.length === 0) return NextResponse.json({ error: "No valid rows (every row needs an email and a job title)." }, { status: 400 })

    // Distinct positions (by title), carrying company/location from first sighting.
    const posMap = new Map<string, { title: string; location: string }>()
    for (const c of cands) if (!posMap.has(c.title)) posMap.set(c.title, { title: c.title, location: c.jobLocation })

    if (dryRun) {
      const byPos = [...posMap.keys()].map(t => ({ title: t, count: cands.filter(c => c.title === t).length }))
      const uniqueEmails = new Set(cands.map(c => c.email)).size
      return NextResponse.json({
        dryRun: true, owner: owner.name,
        totalRows: rows.length, valid: cands.length, skippedNoEmail,
        uniqueCandidates: uniqueEmails, positions: byPos,
      })
    }

    // --- 1. Ensure Jobs exist for every position -----------------------
    const existingJobs = await prisma.job.findMany({ where: { postedById: ownerId }, select: { id: true, title: true } })
    const jobIdByTitle = new Map<string, string>(existingJobs.map(j => [j.title, j.id]))
    let positionsCreated = 0
    for (const [title, info] of posMap) {
      if (jobIdByTitle.has(title)) continue
      const job = await prisma.job.create({
        data: {
          title,
          description: "Position imported from Indeed. Applicants migrated into Vrittih.",
          company: companyOverride || owner.name || "Company",
          industry: "General",
          location: info.location,
          type: "Full-time",
          postedById: ownerId,
          active: true,
        },
        select: { id: true },
      })
      jobIdByTitle.set(title, job.id)
      positionsCreated++
    }

    // --- 2. Upsert candidate users (batched) ---------------------------
    const emails = [...new Set(cands.map(c => c.email))]
    const existingUsers = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } })
    const userIdByEmail = new Map<string, string>(existingUsers.map(u => [u.email, u.id]))

    // One shared random hash for all placeholders — login stays impossible (plaintext unknown).
    const placeholderHash = await hashPassword(randomBytes(24).toString("hex"))

    const newByEmail = new Map<string, Cand>()
    for (const c of cands) if (!userIdByEmail.has(c.email) && !newByEmail.has(c.email)) newByEmail.set(c.email, c)

    if (newByEmail.size > 0) {
      await prisma.user.createMany({
        data: [...newByEmail.values()].map(c => ({
          name: c.name,
          email: c.email,
          password: placeholderHash,
          phone: c.phone || null,
          location: c.location || null,
          headline: c.headline || null,
          bio: c.education ? `Education: ${c.education}` : null,
          role: "JOBSEEKER",
          source: "indeed",
          paid: false,
        })),
      })
      const created = await prisma.user.findMany({ where: { email: { in: [...newByEmail.keys()] } }, select: { id: true, email: true } })
      for (const u of created) userIdByEmail.set(u.email, u.id)
    }
    const candidatesCreated = newByEmail.size
    const candidatesExisting = emails.length - candidatesCreated

    // --- 3. Create applications (deduped by user+job) ------------------
    const jobIds = [...jobIdByTitle.values()]
    const existingApps = await prisma.application.findMany({ where: { jobId: { in: jobIds } }, select: { userId: true, jobId: true } })
    const seen = new Set(existingApps.map(a => a.userId + "|" + a.jobId))

    const appData: any[] = []
    let applicationsSkipped = 0
    for (const c of cands) {
      const uid = userIdByEmail.get(c.email)
      const jid = jobIdByTitle.get(c.title)
      if (!uid || !jid) { applicationsSkipped++; continue }
      const key = uid + "|" + jid
      if (seen.has(key)) { applicationsSkipped++; continue }
      seen.add(key)
      const appliedAt = c.date && !isNaN(Date.parse(c.date)) ? new Date(c.date) : new Date()
      const noteParts = [
        "Imported from Indeed.",
        c.sourceLabel && c.sourceLabel.toLowerCase() !== "indeed" ? `Channel: ${c.sourceLabel}.` : "",
        c.interest ? `Interest: ${c.interest}.` : "",
        c.education ? `Education: ${c.education}.` : "",
        c.headline ? `Experience: ${c.headline}.` : "",
      ].filter(Boolean)
      appData.push({
        userId: uid, jobId: jid,
        status: mapStatus(c.status, c.interest),
        appliedAt,
        notes: noteParts.join(" "),
        source: "indeed",
      })
    }
    if (appData.length > 0) await prisma.application.createMany({ data: appData })

    await logAction(admin.userId, "import.indeed", { rows: rows.length, positionsCreated, candidatesCreated, applications: appData.length }, req)

    return NextResponse.json({
      ok: true,
      owner: owner.name,
      totalRows: rows.length,
      skippedNoEmail,
      positionsCreated,
      positionsTotal: posMap.size,
      candidatesCreated,
      candidatesExisting,
      applicationsCreated: appData.length,
      applicationsSkipped,
    })
  } catch (err: any) {
    console.error("[IMPORT]", err)
    return NextResponse.json({ error: err.message || "Import failed." }, { status: 500 })
  }
}
