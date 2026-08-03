import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { generateJD } from "@/lib/jobarch/jd"

export const dynamic = "force-dynamic"

/* EROS Module 3 — in-house JD Assistant (stateless preview). Capability-gated. */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!ctx.has("jobs.post") && !ctx.has("admin.access")) return NextResponse.json({ error: "You need recruiter access." }, { status: 403 })
  const b = await req.json()
  if (!String(b.title || "").trim()) return NextResponse.json({ error: "A role title is required." }, { status: 400 })
  const jd = generateJD({
    title: String(b.title).slice(0, 200), family: b.family, level: b.level,
    skills: Array.isArray(b.skills) ? b.skills.slice(0, 40).map((s: any) => String(s)) : [],
    responsibilities: Array.isArray(b.responsibilities) ? b.responsibilities.slice(0, 20).map((s: any) => String(s)) : [],
    companyName: b.companyName ? String(b.companyName).slice(0, 160) : undefined,
    employmentType: b.employmentType, remote: !!b.remote,
  })
  return NextResponse.json({ jd })
}
