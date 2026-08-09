import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { ACTION_KEYS } from "@/lib/automation/actions"
import { TRIGGER_KEYS } from "@/lib/automation/triggers"

export const dynamic = "force-dynamic"

async function own(id: string, userId: string) {
  const r = await prisma.automationRule.findUnique({ where: { id }, select: { id: true, ownerId: true } })
  return r && r.ownerId === userId ? r : null
}

/* PATCH — toggle enabled or update fields (owner only). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!(await own(params.id, ctx.userId))) return NextResponse.json({ error: "Not your rule." }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const data: any = {}
  if (typeof b.enabled === "boolean") data.enabled = b.enabled
  if (b.name) data.name = String(b.name).slice(0, 120)
  if (b.trigger && TRIGGER_KEYS.has(String(b.trigger))) data.trigger = String(b.trigger)
  if (b.actionType && ACTION_KEYS.has(String(b.actionType))) data.actionType = String(b.actionType)
  if (Array.isArray(b.conditions)) data.conditions = JSON.stringify(b.conditions.slice(0, 10))
  if (b.actionConfig && typeof b.actionConfig === "object") data.actionConfig = JSON.stringify(b.actionConfig).slice(0, 4000)
  await prisma.automationRule.update({ where: { id: params.id }, data })
  return NextResponse.json({ success: true })
}

/* DELETE — owner removes a rule (its run log cascades). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!(await own(params.id, ctx.userId))) return NextResponse.json({ error: "Not your rule." }, { status: 403 })
  await prisma.automationRule.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
