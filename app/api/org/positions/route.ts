import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { POSITION_STATES, temporalOf, type PositionState } from "@/lib/org/graph"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }
const canEdit = (role: string) => ["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(role)

/**
 * Role slots. Each row carries its DERIVED temporal bucket so a consumer can never
 * accidentally treat forecast demand as approved headcount (§57).
 */
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canEdit(payload.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const orgUnitId = url.searchParams.get("orgUnitId")
  const state = url.searchParams.get("state")
  const now = new Date()

  const rows = await (prisma as any).position.findMany({
    where: {
      employerId: payload.userId,
      ...(orgUnitId ? { orgUnitId } : {}),
      ...(state && (POSITION_STATES as readonly string[]).includes(state) ? { state } : {}),
    },
    orderBy: [{ state: "asc" }, { title: "asc" }],
    take: 500,
  })

  return NextResponse.json({
    positions: rows.map((p: any) => ({
      id: p.id, title: p.title, level: p.level, state: p.state, headcount: p.headcount,
      orgUnitId: p.orgUnitId, effectiveFrom: p.effectiveFrom, effectiveTo: p.effectiveTo,
      skills: safeArr(p.skills), competencies: safeArr(p.competencies),
      jobId: p.jobId, employeeId: p.employeeId,
      temporal: temporalOf(p, now),
    })),
  })
}

export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canEdit(payload.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const body = await req.json()
    const title = String(body?.title || "").trim().slice(0, 160)
    if (!title) return NextResponse.json({ error: "title is required." }, { status: 400 })

    const state = String(body?.state || "PLANNED").toUpperCase() as PositionState
    if (!(POSITION_STATES as readonly string[]).includes(state)) {
      return NextResponse.json({ error: `state must be one of: ${POSITION_STATES.join(", ")}.` }, { status: 400 })
    }
    // A FILLED slot must say who fills it, or headcount reporting becomes fiction.
    if (state === "FILLED" && !body?.employeeId) {
      return NextResponse.json({ error: "A FILLED position must reference the employee who fills it." }, { status: 400 })
    }

    const orgUnitId = body?.orgUnitId ? String(body.orgUnitId) : null
    if (orgUnitId) {
      const unit = await (prisma as any).orgUnit.findFirst({ where: { id: orgUnitId, employerId: payload.userId }, select: { id: true } })
      if (!unit) return NextResponse.json({ error: "Org unit not found." }, { status: 404 })
    }

    const from = body?.effectiveFrom ? new Date(body.effectiveFrom) : null
    const to = body?.effectiveTo ? new Date(body.effectiveTo) : null
    if (from && isNaN(from.getTime())) return NextResponse.json({ error: "Invalid effectiveFrom." }, { status: 400 })
    if (to && isNaN(to.getTime())) return NextResponse.json({ error: "Invalid effectiveTo." }, { status: 400 })
    if (from && to && to <= from) return NextResponse.json({ error: "effectiveTo must be after effectiveFrom." }, { status: 400 })

    const pos = await (prisma as any).position.create({
      data: {
        employerId: payload.userId, orgUnitId, title,
        level: body?.level ? String(body.level).slice(0, 40) : null,
        state,
        headcount: Math.max(1, Math.min(9999, Math.floor(Number(body?.headcount ?? 1)) || 1)),
        effectiveFrom: from, effectiveTo: to,
        skills: JSON.stringify(cleanList(body?.skills)),
        competencies: JSON.stringify(cleanList(body?.competencies)),
        employeeId: body?.employeeId ? String(body.employeeId) : null,
        jobId: body?.jobId ? String(body.jobId) : null,
      },
    })
    return NextResponse.json({ ok: true, position: { id: pos.id, temporal: temporalOf(pos, new Date()) } }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canEdit(payload.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const body = await req.json()
    const id = String(body?.id || "")
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 })

    const data: any = {}
    if (body?.state !== undefined) {
      const state = String(body.state).toUpperCase()
      if (!(POSITION_STATES as readonly string[]).includes(state)) {
        return NextResponse.json({ error: `state must be one of: ${POSITION_STATES.join(", ")}.` }, { status: 400 })
      }
      if (state === "FILLED" && !body?.employeeId) {
        const cur = await (prisma as any).position.findFirst({ where: { id, employerId: payload.userId }, select: { employeeId: true } })
        if (!cur?.employeeId) return NextResponse.json({ error: "A FILLED position must reference the employee who fills it." }, { status: 400 })
      }
      data.state = state
      // Closing a slot stamps its end date, so it leaves CURRENT immediately.
      if (state === "CLOSED" && body?.effectiveTo === undefined) data.effectiveTo = new Date()
    }
    if (body?.title !== undefined) data.title = String(body.title).trim().slice(0, 160)
    if (body?.headcount !== undefined) data.headcount = Math.max(1, Math.min(9999, Math.floor(Number(body.headcount)) || 1))
    if (body?.skills !== undefined) data.skills = JSON.stringify(cleanList(body.skills))
    if (body?.competencies !== undefined) data.competencies = JSON.stringify(cleanList(body.competencies))
    if (body?.employeeId !== undefined) data.employeeId = body.employeeId ? String(body.employeeId) : null
    if (body?.effectiveFrom !== undefined) data.effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : null
    if (body?.effectiveTo !== undefined) data.effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null

    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    const r = await (prisma as any).position.updateMany({ where: { id, employerId: payload.userId }, data })
    if (!r.count) return NextResponse.json({ error: "Position not found." }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

function cleanList(v: any): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.map((x) => String(x || "").trim()).filter(Boolean))].slice(0, 50)
}
function safeArr(v: any): string[] {
  try { const a = JSON.parse(v || "[]"); return Array.isArray(a) ? a.map(String) : [] } catch { return [] }
}
