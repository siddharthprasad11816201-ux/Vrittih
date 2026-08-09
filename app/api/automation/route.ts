import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { TRIGGERS, TRIGGER_KEYS } from "@/lib/automation/triggers"
import { ACTION_TYPES, ACTION_KEYS } from "@/lib/automation/actions"
import { OPS, type Condition } from "@/lib/automation/engine"

export const dynamic = "force-dynamic"

/* GET /api/automation — the caller's rules + the builder catalogs (triggers, ops, actions). */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const rules = await prisma.automationRule.findMany({ where: { ownerId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 200 })
  return NextResponse.json({
    rules: rules.map(shape),
    catalog: { triggers: TRIGGERS, ops: OPS, actions: ACTION_TYPES },
  })
}

/* POST /api/automation — create a rule. Validates trigger + action against the real
 * catalogs; conditions/actionConfig are stored as JSON. */
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const name = String(b.name || "").trim()
  if (name.length < 3) return NextResponse.json({ error: "A rule name (3+ chars) is required." }, { status: 400 })
  if (!TRIGGER_KEYS.has(String(b.trigger))) return NextResponse.json({ error: "Unknown trigger." }, { status: 400 })
  if (!ACTION_KEYS.has(String(b.actionType))) return NextResponse.json({ error: "Unknown action." }, { status: 400 })
  const conditions: Condition[] = Array.isArray(b.conditions)
    ? b.conditions.filter((c: any) => c && c.field && c.op).map((c: any) => ({ field: String(c.field).slice(0, 80), op: c.op, value: c.value != null ? String(c.value).slice(0, 200) : undefined })).slice(0, 10)
    : []
  const actionConfig = b.actionConfig && typeof b.actionConfig === "object" ? JSON.stringify(b.actionConfig).slice(0, 4000) : "{}"

  const rule = await prisma.automationRule.create({
    data: {
      ownerId: ctx.userId, name: name.slice(0, 120), trigger: String(b.trigger),
      conditions: JSON.stringify(conditions), actionType: String(b.actionType), actionConfig,
      enabled: b.enabled !== false,
    },
  })
  return NextResponse.json({ success: true, id: rule.id }, { status: 201 })
}

function shape(r: any) {
  let conditions: any[] = []; try { conditions = JSON.parse(r.conditions) } catch {}
  let actionConfig: any = {}; try { actionConfig = JSON.parse(r.actionConfig) } catch {}
  return {
    id: r.id, name: r.name, enabled: r.enabled, trigger: r.trigger, conditions,
    actionType: r.actionType, actionConfig, runs: r.runs, lastRunAt: r.lastRunAt, createdAt: r.createdAt,
  }
}
