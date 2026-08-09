/* Phase 13 — automation dispatcher. Registered once as a wildcard ("*") handler on
 * the AIOS event bus; every recorded PlatformEvent whose type is a known trigger is
 * matched against enabled rules, and matching rules' actions run + are audited. */
import { prisma } from "@/lib/prisma"
import { on } from "@/lib/aios/events"
import { TRIGGER_KEYS } from "./triggers"
import { evaluateConditions, parseConditions } from "./engine"
import { runAction } from "./actions"

let registered = false
export function registerAutomation() {
  if (registered) return
  registered = true
  on("*", automationHandler)
}

async function automationHandler(payload: any, meta: { id: string; type?: string; actorId?: string | null }) {
  const type = meta?.type
  if (!type || !TRIGGER_KEYS.has(type)) return
  const rules = await prisma.automationRule.findMany({ where: { trigger: type, enabled: true }, take: 200 }).catch(() => [] as any[])
  for (const rule of rules) {
    try {
      if (!evaluateConditions(parseConditions(rule.conditions), payload)) { await audit(rule.id, "skipped", "conditions not met"); continue }
      let config: any = {}; try { config = JSON.parse(rule.actionConfig || "{}") } catch {}
      const res = await runAction(rule.actionType, config, { ownerId: rule.ownerId, eventType: type, payload })
      await prisma.automationRule.update({ where: { id: rule.id }, data: { runs: { increment: 1 }, lastRunAt: new Date() } }).catch(() => {})
      await audit(rule.id, res.ok ? "ok" : "error", res.detail)
    } catch (e: any) {
      await audit(rule.id, "error", String(e?.message).slice(0, 200))
    }
  }
}

async function audit(ruleId: string, status: string, detail?: string) {
  await prisma.automationRun.create({ data: { ruleId, status, detail: detail ? detail.slice(0, 500) : null } }).catch(() => {})
}
