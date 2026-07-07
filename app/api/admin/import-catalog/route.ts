import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAction } from "@/lib/admin"
import { hashPassword } from "@/lib/hash"
import { randomBytes } from "crypto"
import { ROLE_CATALOG, CATALOG_DEPARTMENTS } from "@/lib/roleCatalog"

export const dynamic = "force-dynamic"

const TYPE: Record<string, string> = { "Full-Time": "FULLTIME", "Internship": "INTERNSHIP", "Apprenticeship": "INTERNSHIP" }

// Imports the EduRankAI hiring catalog as fully-active Vrittih job posts.
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  // Dedicated employer that owns the catalog jobs (auto-created).
  const email = "careers@edurankai.in"
  let employer = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!employer) {
    employer = await prisma.user.create({
      data: { name: "EduRankAI", email, password: await hashPassword(randomBytes(24).toString("hex")), role: "EMPLOYER", paid: true, paidAt: new Date(), idVerified: true, source: "catalog" },
      select: { id: true },
    })
  }
  const deptName = Object.fromEntries(CATALOG_DEPARTMENTS.map((d: any) => [d.id, d.name]))

  const existing = await prisma.job.findMany({ where: { postedById: employer.id }, select: { title: true } })
  const have = new Set(existing.map(j => j.title))

  let created = 0, skipped = 0
  for (const r of ROLE_CATALOG as any[]) {
    if (have.has(r.title)) { skipped++; continue }
    const desc = [
      r.about,
      r.responsibilities?.length ? "\n\nWhat you'll do:\n" + r.responsibilities.map((x: string) => "• " + x).join("\n") : "",
      r.skills?.length ? "\n\nSkills:\n" + r.skills.join(" · ") : "",
      r.eligibility?.length ? "\n\nEligibility:\n" + r.eligibility.map((x: string) => "• " + x).join("\n") : "",
      r.duration ? `\n\nDuration: ${r.duration}` : "",
    ].filter(Boolean).join("")
    await prisma.job.create({
      data: {
        title: r.title,
        description: desc || r.title,
        company: "EduRankAI",
        industry: deptName[r.departmentId] || r.function || "Technology",
        location: r.location || "Remote",
        type: TYPE[r.engagementType] || "FULLTIME",
        salary: r.salary || null,
        remote: /remote/i.test(r.location || ""),
        active: true,
        postedById: employer.id,
      },
    })
    created++
  }

  await logAction(admin.userId, "import.catalog", { created, skipped }, req)
  return NextResponse.json({ ok: true, created, skipped, total: ROLE_CATALOG.length, employer: "EduRankAI" })
}
