import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { PLACEMENT_STAGES } from "@/lib/recruitment/fulfillment"

export const dynamic = "force-dynamic"
const isHr = (ctx: any) => ctx.has("admin.access") || ctx.has("candidates.view") || ctx.has("pipeline.manage") || ctx.has("jobs.post")

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const request = await prisma.talentRequest.findUnique({ where: { id: params.id } })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (request.employerId !== ctx.userId && !isHr(ctx)) return NextResponse.json({ error: "Not your requirement." }, { status: 403 })
  const cands = await prisma.placementCandidate.findMany({ where: { requestId: params.id }, orderBy: [{ stage: "asc" }, { score: "desc" }], take: 200 })
  const users = cands.length ? await prisma.user.findMany({ where: { id: { in: cands.map(c => c.candidateId) } }, select: { id: true, name: true, email: true, headline: true, avatar: true } }) : []
  const uMap = new Map(users.map(u => [u.id, u]))
  const candidates = cands.map(c => {
    let rationale: any = null; try { rationale = c.rationale ? JSON.parse(c.rationale) : null } catch {}
    return { id: c.id, candidateId: c.candidateId, stage: c.stage, score: c.score, verdict: c.verdict, rationale, user: uMap.get(c.candidateId) || null }
  })
  return NextResponse.json({ request: { ...request, skills: safeArr(request.skills) }, candidates, stages: PLACEMENT_STAGES })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const request = await prisma.talentRequest.findUnique({ where: { id: params.id }, select: { employerId: true } })
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (request.employerId !== ctx.userId && !isHr(ctx)) return NextResponse.json({ error: "Not your requirement." }, { status: 403 })
  const b = await req.json()

  if (b.candidateRowId && b.stage) {
    const stage = String(b.stage)
    if (!(PLACEMENT_STAGES as readonly string[]).includes(stage)) return NextResponse.json({ error: "Invalid stage." }, { status: 400 })
    const row = await prisma.placementCandidate.findUnique({ where: { id: String(b.candidateRowId) }, select: { requestId: true } })
    if (!row || row.requestId !== params.id) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.placementCandidate.update({ where: { id: String(b.candidateRowId) }, data: { stage } })
    return NextResponse.json({ success: true })
  }
  if (b.status) {
    const s = String(b.status)
    if (!["OPEN", "IN_PROGRESS", "SHORTLISTED", "DELIVERED", "CLOSED"].includes(s)) return NextResponse.json({ error: "Invalid status." }, { status: 400 })
    await prisma.talentRequest.update({ where: { id: params.id }, data: { status: s } })
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
}

function safeArr(s: string): string[] { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : [] } catch { return [] } }
