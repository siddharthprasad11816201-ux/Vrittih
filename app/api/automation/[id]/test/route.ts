import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { triggerByKey } from "@/lib/automation/triggers"
import { evaluateConditions, parseConditions } from "@/lib/automation/engine"
import { runAction } from "@/lib/automation/actions"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/* POST /api/automation/[id]/test — run the rule NOW against the trigger's sample
 * payload (or a supplied one). Evaluates conditions and, if matched, actually runs
 * the action (real) so the owner can confirm it works. Audited as a run. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const rule = await prisma.automationRule.findUnique({ where: { id: params.id } })
  if (!rule || rule.ownerId !== ctx.userId) return NextResponse.json({ error: "Not your rule." }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const payload = body.payload && typeof body.payload === "object" ? body.payload : (triggerByKey(rule.trigger)?.sample ?? {})
  const matched = evaluateConditions(parseConditions(rule.conditions), payload)

  let actionResult: { ok: boolean; detail: string } | null = null
  if (matched) {
    let config: any = {}; try { config = JSON.parse(rule.actionConfig || "{}") } catch {}
    actionResult = await runAction(rule.actionType, config, { ownerId: ctx.userId, eventType: rule.trigger, payload })
    await prisma.automationRule.update({ where: { id: rule.id }, data: { runs: { increment: 1 }, lastRunAt: new Date() } }).catch(() => {})
  }
  await prisma.automationRun.create({ data: { ruleId: rule.id, status: matched ? (actionResult?.ok ? "ok" : "error") : "skipped", detail: `[test] ${matched ? actionResult?.detail : "conditions not met"}`.slice(0, 500) } }).catch(() => {})

  return NextResponse.json({ matched, actionResult, payload })
}
