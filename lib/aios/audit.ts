/* AIOS §4/§32 — execution audit. Every AIOS.execute() call writes one immutable
 * AiRun row. Inputs are hashed (no PII persisted). Best-effort: auditing must
 * never break the action, but a failed audit is logged. */
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export const inputsHash = (input: unknown) => crypto.createHash("sha256").update(JSON.stringify(input ?? null)).digest("hex").slice(0, 32)

export type AiRunRow = {
  subjectId?: string | null
  agentId?: string | null
  capId: string
  modelId?: string | null
  inputsHash: string
  outputs?: unknown
  status?: "ok" | "denied" | "error" | "blocked"
  latencyMs?: number
  cost?: number
  confidence?: number | null
  explanation?: string | null
  steps?: unknown
  error?: string | null
}

export async function writeAiRun(row: AiRunRow): Promise<string | null> {
  try {
    const r = await prisma.aiRun.create({
      data: {
        subjectId: row.subjectId ?? null,
        agentId: row.agentId ?? null,
        capId: row.capId,
        modelId: row.modelId ?? null,
        inputsHash: row.inputsHash,
        outputs: JSON.stringify(row.outputs ?? {}).slice(0, 20000),
        status: row.status ?? "ok",
        latencyMs: row.latencyMs ?? 0,
        cost: row.cost ?? 0,
        confidence: row.confidence ?? null,
        explanation: row.explanation ?? null,
        steps: JSON.stringify(row.steps ?? []).slice(0, 20000),
        error: row.error ?? null,
      },
      select: { id: true },
    })
    return r.id
  } catch (e: any) {
    console.error("[AIOS.audit]", e?.message)
    return null
  }
}
