/* Phase 13 — Automation actions (the IO side). Each action does real work:
 *  - notify: writes a real Notification to the rule owner
 *  - run-capability: executes an AIOS capability through the gateway (audited, and
 *    authorized against the OWNER's own capabilities — no privilege escalation)
 *  - webhook: POSTs the event to an external URL (validated + timed out) */
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notify"
import { execute } from "@/lib/aios/execute"
import { deriveCapabilities } from "@/lib/capability/derive"
import { safeExternalUrl } from "@/lib/url"
import { interpolate } from "./engine"

export const ACTION_TYPES = [
  { key: "notify", label: "Send a notification", fields: [{ key: "title", label: "Title (supports {{field}})" }, { key: "body", label: "Body (supports {{field}})" }] },
  { key: "run-capability", label: "Run an AI capability", fields: [{ key: "capId", label: "Capability id (e.g. intelligence.deliberate)" }] },
  { key: "webhook", label: "POST to a webhook URL", fields: [{ key: "url", label: "HTTPS URL" }] },
]
export const ACTION_KEYS = new Set(ACTION_TYPES.map(a => a.key))

async function capsForUser(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, plan: true } }).catch(() => null)
  return user ? Array.from(deriveCapabilities(user)) : []
}

export type ActionCtx = { ownerId: string; eventType: string; payload: any }

export async function runAction(actionType: string, config: any, ctx: ActionCtx): Promise<{ ok: boolean; detail: string }> {
  const { ownerId, payload, eventType } = ctx
  if (actionType === "notify") {
    const title = (interpolate(config.title || "Automation triggered", payload).slice(0, 140)) || "Automation triggered"
    const body = interpolate(config.body || `Triggered by ${eventType}`, payload).slice(0, 400)
    await createNotification({ userId: ownerId, title, body, link: "/automation", sendEmail: false })
    return { ok: true, detail: `notified: ${title}` }
  }
  if (actionType === "run-capability") {
    const capId = String(config.capId || "").trim()
    if (!capId) return { ok: false, detail: "no capability configured" }
    const caps = await capsForUser(ownerId)
    const r = await execute(capId, { subjectId: ownerId, input: payload, caps })
    return { ok: r.ok, detail: r.ok ? `ran ${capId} (run ${r.runId})` : `capability ${r.status}: ${r.error || "failed"}` }
  }
  if (actionType === "webhook") {
    const url = safeExternalUrl(config.url)
    if (!url) return { ok: false, detail: "invalid or unsafe URL" }
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: eventType, payload }), signal: controller.signal }).finally(() => clearTimeout(timer))
      return { ok: res.ok, detail: `POST ${url} → ${res.status}` }
    } catch (e: any) {
      return { ok: false, detail: `webhook failed: ${String(e?.message).slice(0, 120)}` }
    }
  }
  return { ok: false, detail: `unknown action ${actionType}` }
}
