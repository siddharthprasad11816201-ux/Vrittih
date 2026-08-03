/* AIOS §4/§32 — the AI Execution Gateway. Every AI capability executes through
 * execute(): capability resolution -> safe-evolution gate -> authorization
 * (capability/permission/context, never role) -> provider invocation -> audit
 * (AiRun) -> event. Fail-closed. No AI module may bypass this (DDR-005).
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md §4, §32. */
import { getCapability } from "./registry"
import { writeAiRun, inputsHash } from "./audit"
import { emit } from "./events"

export type ExecCtx = { subjectId?: string | null; input?: any; agentId?: string | null; caps?: string[] }
export type ProviderResult = { output: any; confidence?: number; explanation?: string; modelId?: string }
export type Provider = (ctx: ExecCtx, spec: { capId: string; modelId?: string }) => Promise<ProviderResult>
export type ExecResult = { ok: boolean; runId: string | null; status: string; output?: any; explanation?: string; error?: string }

const PROVIDERS = new Map<string, Provider>()
export function registerProvider(providerKey: string, fn: Provider) { PROVIDERS.set(providerKey, fn) }
export function providerKeys() { return [...PROVIDERS.keys()] }

export async function execute(capId: string, ctx: ExecCtx): Promise<ExecResult> {
  const t0 = Date.now()
  const ih = inputsHash(ctx.input)
  const audit = (o: Partial<Parameters<typeof writeAiRun>[0]>) =>
    writeAiRun({ capId, subjectId: ctx.subjectId ?? null, agentId: ctx.agentId ?? null, inputsHash: ih, latencyMs: Date.now() - t0, ...o } as any)

  const cap = await getCapability(capId)
  if (!cap || !cap.enabled) return fail(await audit({ status: "error", error: "unknown_capability" }), "error", "Unknown or disabled capability")

  // §27 safe-evolution: forbidden-auto capabilities never run automatically.
  if (cap.safetyClass === "forbidden-auto") return fail(await audit({ status: "blocked", error: "requires_human_approval" }), "blocked", "This action requires human approval")

  // §9 authorization — capability/permission/context driven (never role).
  if (cap.permissions?.includes("auth") && !ctx.subjectId) return fail(await audit({ status: "denied", error: "not_authenticated" }), "denied", "Not authenticated")

  const provider = PROVIDERS.get(cap.provider)
  if (!provider) return fail(await audit({ status: "error", error: "no_provider" }), "error", "No provider registered for capability")

  try {
    const res = await provider(ctx, { capId, modelId: cap.modelId })
    const runId = await audit({ status: "ok", modelId: res.modelId || cap.modelId || null, outputs: res.output, confidence: res.confidence ?? null, explanation: res.explanation ?? null })
    emit("ai.executed", { capId, modelId: res.modelId || cap.modelId, status: "ok" }, { actorId: ctx.subjectId || undefined }).catch(() => {})
    return { ok: true, runId, status: "ok", output: res.output, explanation: res.explanation }
  } catch (e: any) {
    return fail(await audit({ status: "error", error: String(e?.message).slice(0, 300) }), "error", "Execution failed")
  }
}

function fail(runId: string | null, status: string, error: string): ExecResult { return { ok: false, runId, status, error } }
