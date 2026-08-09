import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { ROLE_TYPES } from "@/lib/recruitment/fulfillment"

export const dynamic = "force-dynamic"
const str = (v: any, n = 200) => String(v ?? "").slice(0, n)
const arr = (v: any): string[] => Array.isArray(v) ? v.map(x => str(x, 60)).filter(Boolean).slice(0, 40) : String(v || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 40)
// HR/recruiter operators who fulfil requests across the platform.
const isHr = (ctx: any) => ctx.has("admin.access")   // platform staff only (Vrittih HR) — employers see only their own

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const scope = req.nextUrl.searchParams.get("scope")
  // HR sees the whole fulfilment queue; an employer sees only their own requirements.
  const where = (isHr(ctx) && scope !== "mine") ? {} : { employerId: ctx.userId }
  const requests = await prisma.talentRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { candidates: true } } } })
  return NextResponse.json({ requests, isHr: isHr(ctx), roleTypes: ROLE_TYPES })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const title = str(b.title).trim()
  if (!title) return NextResponse.json({ error: "Role title required (e.g. Backend Engineer)." }, { status: 400 })
  const roleType = (ROLE_TYPES as readonly string[]).includes(String(b.roleType)) ? String(b.roleType) : "FULLTIME"
  const created = await prisma.talentRequest.create({
    data: {
      employerId: ctx.userId, title, roleType,
      skills: JSON.stringify(arr(b.skills)),
      seniority: b.seniority ? str(b.seniority, 40) : null,
      headcount: Math.max(1, Math.min(1000, Math.round(Number(b.headcount) || 1))),
      minYears: Math.max(0, Math.min(50, Math.round(Number(b.minYears) || 0))),
      budget: b.budget != null && b.budget !== "" ? Math.max(0, Number(b.budget) || 0) : null,
      currency: str(b.currency || "CHF", 3).toUpperCase(),
      location: b.location ? str(b.location, 120) : null,
      remote: !!b.remote,
      deadline: b.deadline ? new Date(b.deadline) : null,
      notes: b.notes ? str(b.notes, 4000) : null,
      status: "OPEN",
    },
  })
  return NextResponse.json({ success: true, id: created.id }, { status: 201 })
}
