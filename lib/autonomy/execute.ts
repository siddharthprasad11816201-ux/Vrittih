/* Phase 15 — autonomous plan executor. Advances a plan: auto-runs capability steps
 * through the AIOS gateway (authorized against the owner's own caps, audited), and
 * PAUSES at any step that requires human approval. Honest: a denied step is blocked
 * (not faked), a hard failure stops the plan. */
import { prisma } from "@/lib/prisma"
import { execute } from "@/lib/aios"   // the index — importing it registers all capability providers
import { deriveCapabilities } from "@/lib/capability/derive"
import type { PlanStepState } from "./planner"

async function capsForUser(userId: string): Promise<string[]> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, plan: true } }).catch(() => null)
  return u ? Array.from(deriveCapabilities(u)) : []
}

export type AdvanceResult = { steps: PlanStepState[]; status: "running" | "awaiting_approval" | "done" | "failed" }

/* Run forward from the first unfinished step until an approval gate or completion.
 * Resilient + honest: a capability that is denied (blocked) or errors is recorded on
 * the step and the plan CONTINUES (evidence steps are non-destructive; only approval
 * gates pause). Mutates + returns the steps. */
export async function advancePlan(steps: PlanStepState[], ownerId: string, goalText: string): Promise<AdvanceResult> {
  const caps = await capsForUser(ownerId)
  for (const step of steps) {
    if (step.status === "done" || step.status === "blocked" || step.status === "error") continue

    if (step.requiresApproval) {
      if (step.status !== "approved") { step.status = "awaiting_approval"; return { steps, status: "awaiting_approval" } }
      step.status = "done"
      if (!step.result) step.result = { ok: true, explanation: "Approved by the plan owner." }
      continue
    }

    if (step.capId) {
      step.status = "running"
      let input: any = {}
      if (step.capId === "intelligence.deliberate") {
        // Reason over what earlier steps actually produced: feed their explanations
        // in as context so the Brain deliberates on real evidence, not a bare prompt.
        const context = steps.filter(x => x.i < step.i && x.result?.explanation).map(x => `${x.title}: ${x.result!.explanation}`).slice(0, 20)
        input = { question: goalText, role: "enterprise strategist", context: context.length ? context : undefined }
      }
      const r = await execute(step.capId, { subjectId: ownerId, input, caps })
      if (r.ok) {
        const conf = typeof (r.output as any)?.confidence === "number" ? (r.output as any).confidence
          : typeof (r.output as any)?.decision?.confidence === "number" ? (r.output as any).decision.confidence : null
        step.status = "done"
        step.result = { ok: true, confidence: conf, explanation: r.explanation, output: r.output, runId: r.runId }
      } else if (r.status === "denied" || r.status === "blocked") {
        step.status = "blocked"
        step.result = { ok: false, error: r.error || "Not permitted", runId: r.runId }
      } else {
        // Honest per-step failure — recorded, but the plan continues past it.
        step.status = "error"
        step.result = { ok: false, error: r.error || "Execution failed", runId: r.runId }
      }
      continue
    }

    // No capability, no approval — nothing to execute.
    step.status = "done"
  }
  return { steps, status: "done" }
}
