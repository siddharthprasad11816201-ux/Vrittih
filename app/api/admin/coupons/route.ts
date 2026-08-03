import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAction } from "@/lib/admin"
import { normalizeCode } from "@/lib/coupon"

export const dynamic = "force-dynamic"

/* Admin coupon management. Create/list/edit/disable/delete discount + waiver
 * codes. Admin-gated (requireAdmin) and audited (logAction). All checkout
 * enforcement lives server-side in lib/coupon + the payment routes. */

const KINDS = new Set(["percent", "fixed", "waiver"])
const AUDIENCES = new Set(["all", "individual", "employer"])

function clean(body: any) {
  const kind = KINDS.has(body?.kind) ? body.kind : "percent"
  const audience = AUDIENCES.has(body?.audience) ? body.audience : "all"
  let value = Number(body?.value)
  if (!Number.isFinite(value) || value < 0) value = 0
  if (kind === "percent") value = Math.min(100, value)
  if (kind === "waiver") value = 100
  const num = (v: any) => (v === null || v === undefined || v === "" ? null : Math.max(0, Math.floor(Number(v))))
  const date = (v: any) => (v ? new Date(v) : null)
  return {
    description: body?.description ? String(body.description).slice(0, 200) : null,
    kind, value, audience,
    planId: body?.planId ? String(body.planId) : null,
    maxRedemptions: num(body?.maxRedemptions),
    perUserLimit: body?.perUserLimit === undefined ? 1 : (num(body?.perUserLimit) ?? 0),
    active: body?.active === undefined ? true : !!body.active,
    startsAt: date(body?.startsAt),
    expiresAt: date(body?.expiresAt),
  }
}

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  })
  return NextResponse.json({ coupons })
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const code = normalizeCode(body?.code)
  if (!code || code.length < 3) return NextResponse.json({ error: "Code must be at least 3 characters." }, { status: 400 })
  const existing = await prisma.coupon.findUnique({ where: { code } })
  if (existing) return NextResponse.json({ error: "A coupon with this code already exists." }, { status: 409 })

  const data = clean(body)
  const coupon = await prisma.coupon.create({ data: { code, createdBy: admin.userId, ...data } })
  await logAction(admin.userId, "coupon.created", { code, kind: data.kind, value: data.value }, req)
  return NextResponse.json({ coupon })
}

export async function PATCH(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const id = String(body?.id || "")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const current = await prisma.coupon.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: "Coupon not found." }, { status: 404 })

  // Quick toggle path
  if (Object.keys(body).length === 2 && "active" in body) {
    const coupon = await prisma.coupon.update({ where: { id }, data: { active: !!body.active } })
    await logAction(admin.userId, "coupon.toggled", { code: current.code, active: !!body.active }, req)
    return NextResponse.json({ coupon })
  }

  const data = clean({ ...current, ...body })
  const coupon = await prisma.coupon.update({ where: { id }, data })
  await logAction(admin.userId, "coupon.updated", { code: current.code }, req)
  return NextResponse.json({ coupon })
}

export async function DELETE(req: NextRequest) {
  const admin = requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const id = String(body?.id || "")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const c = await prisma.coupon.findUnique({ where: { id } })
  if (!c) return NextResponse.json({ error: "Coupon not found." }, { status: 404 })
  await prisma.coupon.delete({ where: { id } })
  await logAction(admin.userId, "coupon.deleted", { code: c.code }, req)
  return NextResponse.json({ success: true })
}
