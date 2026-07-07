import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authApiKey } from "@/lib/apikey"

export const dynamic = "force-dynamic"

const TYPES = ["FULLTIME", "PARTTIME", "INTERNSHIP", "CONTRACT", "FREELANCE"]
function normType(t?: string): string {
  const s = (t || "").toUpperCase().replace(/[^A-Z]/g, "")
  if (TYPES.includes(s)) return s
  if (s.includes("PART")) return "PARTTIME"
  if (s.includes("INTERN")) return "INTERNSHIP"
  if (s.includes("CONTRACT")) return "CONTRACT"
  if (s.includes("FREELANCE") || s.includes("GIG")) return "FREELANCE"
  return "FULLTIME"
}

// POST -> create one job or many. Body: a job object, an array, or { jobs: [...] }.
// Auth: Authorization: Bearer vk_live_… (the company's key; the company is auto-created
// when the key is issued, so no missing employer). Accepts every job field.
export async function POST(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key. Use 'Authorization: Bearer vk_live_…'." }, { status: 401 })

  const employer = await prisma.user.findUnique({ where: { id: ctx.employerId }, select: { name: true } })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }
  const list: any[] = Array.isArray(body) ? body : Array.isArray(body?.jobs) ? body.jobs : [body]
  if (!list.length) return NextResponse.json({ error: "No jobs provided" }, { status: 400 })

  const created: any[] = [], errors: any[] = []
  for (const j of list) {
    if (!j || !j.title) { errors.push({ input: j?.title || null, error: "title is required" }); continue }
    try {
      const job = await prisma.job.create({
        data: {
          title: String(j.title).slice(0, 200),
          description: String(j.description || j.title),
          company: String(j.company || employer?.name || "Company"),
          industry: String(j.industry || "General"),
          location: String(j.location || "Remote"),
          type: normType(j.type || j.employmentType),
          salary: j.salary ? String(j.salary) : null,
          remote: !!(j.remote ?? /remote/i.test(j.location || "")),
          active: j.active !== false,
          postedById: ctx.employerId,
        },
        select: { id: true, title: true },
      })
      created.push(job)
    } catch (e: any) { errors.push({ input: j.title, error: e.message }) }
  }
  return NextResponse.json({ ok: true, created: created.length, jobs: created, errors }, { status: created.length ? 201 : 400 })
}

// GET -> list this company's jobs.
export async function GET(req: NextRequest) {
  const ctx = await authApiKey(req)
  if (!ctx) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 })
  const jobs = await prisma.job.findMany({
    where: { postedById: ctx.employerId },
    orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, title: true, company: true, location: true, type: true, salary: true, remote: true, active: true, createdAt: true, _count: { select: { applications: true } } },
  })
  return NextResponse.json({ count: jobs.length, jobs })
}
