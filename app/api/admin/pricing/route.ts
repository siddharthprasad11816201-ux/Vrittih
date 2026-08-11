import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { PLANS, ADDONS } from "@/lib/plans"
import { getPricing, setPlanPrice, resetPlanPrice, validatePrice } from "@/lib/pricing"

export const dynamic = "force-dynamic"

// Local admin check (needs the admin's name for the audit trail). Mirrors lib/admin:
// privilege is read from the DB per request and banned accounts are rejected, so a
// demoted or banned admin cannot keep acting on a still-valid 7-day token.
async function requireAdmin(req: NextRequest) {
  const t = req.cookies.get("er_token")?.value
  const id = t ? verifyToken(t)?.userId : null
  if (!id) return null
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, role: true, banned: true } })
  return u && !u.banned && (u.role === "ADMIN" || u.role === "SUPER_ADMIN") ? u : null
}

// GET -> current effective prices alongside the shipped defaults, so the admin
// can see at a glance what has been changed and what it was originally.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 })

  const { plans, addons } = await getPricing()
  return NextResponse.json({
    plans: plans.map(p => {
      const def = PLANS.find(d => d.id === p.id)!
      return { id: p.id, name: p.name, audience: p.audience, tagline: p.tagline,
        priceCHF: p.priceCHF, defaultCHF: def.priceCHF, overridden: p.priceCHF !== def.priceCHF }
    }),
    addons: addons.map(a => {
      const def = ADDONS.find(d => d.id === a.id)!
      return { id: a.id, name: a.name, unit: a.unit,
        priceCHF: a.priceCHF, defaultCHF: def.priceCHF, overridden: a.priceCHF !== def.priceCHF }
    }),
  })
}

// PUT { changes: [{ id, priceCHF }] } or { reset: id }
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 })

  const body = await req.json()

  if (body.reset) {
    await resetPlanPrice(String(body.reset))
    await audit(admin, `reset price for ${body.reset} to the shipped default`)
    return NextResponse.json({ ok: true, reset: body.reset })
  }

  const changes: any[] = Array.isArray(body.changes) ? body.changes : []
  if (!changes.length) return NextResponse.json({ error: "No changes supplied" }, { status: 400 })

  const applied: any[] = [], rejected: any[] = []
  for (const c of changes) {
    const id = String(c?.id || "")
    const known = PLANS.some(p => p.id === id) || ADDONS.some(a => a.id === id)
    if (!known) { rejected.push({ id, error: "Unknown plan" }); continue }
    const v = validatePrice(c?.priceCHF)
    if (!v.ok) { rejected.push({ id, error: v.error }); continue }
    await setPlanPrice(id, v.value)
    applied.push({ id, priceCHF: v.value })
  }

  // Money changes get an audit trail — who changed what, and when.
  if (applied.length) {
    await audit(admin, "set " + applied.map(a => `${a.id}=${a.priceCHF} CHF`).join(", "))
  }

  return NextResponse.json({ ok: true, applied, rejected }, { status: rejected.length && !applied.length ? 400 : 200 })
}

async function audit(admin: { id: string; name: string }, message: string) {
  try {
    await prisma.activityLog.create({
      data: { userId: admin.id, action: "pricing.change", meta: JSON.stringify({ by: admin.name, message }) },
    })
  } catch { /* audit must never block the change itself */ }
}
