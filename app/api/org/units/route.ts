import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { canNest, wouldCycle, pathOf, ORG_UNIT_KINDS, POSITION_STATES, type OrgUnitKind, type UnitNode } from "@/lib/org/graph"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }
const canEdit = (role: string) => ["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(role)

// The org tree, plus each unit's root-first path so a UI can render breadcrumbs.
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canEdit(payload.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const units: UnitNode[] = await (prisma as any).orgUnit.findMany({
    where: { employerId: payload.userId, active: true },
    select: { id: true, parentId: true, kind: true, name: true },
    orderBy: { name: "asc" }, take: 1000,
  })
  return NextResponse.json({
    units: units.map((u) => ({ ...u, path: pathOf(units, u.id).map((p) => p.name) })),
    kinds: ORG_UNIT_KINDS, positionStates: POSITION_STATES,
  })
}

// Create a unit. Nesting is validated so the tree cannot become a soup.
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canEdit(payload.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const body = await req.json()
    const kind = String(body?.kind || "DEPARTMENT").toUpperCase() as OrgUnitKind
    if (!(ORG_UNIT_KINDS as readonly string[]).includes(kind)) {
      return NextResponse.json({ error: `kind must be one of: ${ORG_UNIT_KINDS.join(", ")}.` }, { status: 400 })
    }
    const name = String(body?.name || "").trim().slice(0, 120)
    if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 })

    const parentId = body?.parentId ? String(body.parentId) : null
    let parentKind: OrgUnitKind | null = null
    if (parentId) {
      // Ownership is checked here: a unit can only be nested under YOUR own tree.
      const parent = await (prisma as any).orgUnit.findFirst({ where: { id: parentId, employerId: payload.userId }, select: { kind: true } })
      if (!parent) return NextResponse.json({ error: "Parent unit not found." }, { status: 404 })
      parentKind = parent.kind
    }
    const nest = canNest(kind, parentKind)
    if (!nest.ok) return NextResponse.json({ error: nest.reason }, { status: 400 })

    const unit = await (prisma as any).orgUnit.create({
      data: { employerId: payload.userId, parentId, kind, name, headId: body?.headId ? String(body.headId) : null },
      select: { id: true, kind: true, name: true, parentId: true },
    })
    return NextResponse.json({ ok: true, unit }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

// Rename or re-parent. Re-parenting is cycle-checked — a unit cannot become its own ancestor.
export async function PATCH(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!canEdit(payload.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const body = await req.json()
    const id = String(body?.id || "")
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 })

    const units: UnitNode[] = await (prisma as any).orgUnit.findMany({
      where: { employerId: payload.userId }, select: { id: true, parentId: true, kind: true, name: true }, take: 1000,
    })
    const self = units.find((u) => u.id === id)
    if (!self) return NextResponse.json({ error: "Unit not found." }, { status: 404 })

    const data: any = {}
    if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 120)
    if (body?.headId !== undefined) data.headId = body.headId ? String(body.headId) : null
    if (body?.active !== undefined) data.active = !!body.active

    if (body?.parentId !== undefined) {
      const parentId = body.parentId ? String(body.parentId) : null
      if (parentId) {
        const parent = units.find((u) => u.id === parentId)
        if (!parent) return NextResponse.json({ error: "Parent unit not found." }, { status: 404 })
        // A cycle would make every tree walk infinite; refuse rather than corrupt the graph.
        if (wouldCycle(units, id, parentId)) {
          return NextResponse.json({ error: "That move would make the unit its own ancestor." }, { status: 400 })
        }
        const nest = canNest(self.kind as OrgUnitKind, parent.kind as OrgUnitKind)
        if (!nest.ok) return NextResponse.json({ error: nest.reason }, { status: 400 })
      } else {
        const nest = canNest(self.kind as OrgUnitKind, null)
        if (!nest.ok) return NextResponse.json({ error: nest.reason }, { status: 400 })
      }
      data.parentId = parentId
    }

    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
    const r = await (prisma as any).orgUnit.updateMany({ where: { id, employerId: payload.userId }, data })
    if (!r.count) return NextResponse.json({ error: "Unit not found." }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
