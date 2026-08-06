/* AIOS §5/§7/§9/§21/§22 — the registries (models, capabilities, agents, tools,
 * prompts). The SEED constants below are the in-house source of truth an admin can
 * override in the DB; loaders read the DB and fall back to seeds so the platform
 * works before/after seeding. Foundation "models" are in-house deterministic
 * providers (DDR-002) — an external/multimodal model is just a future DB row.
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md. */
import { prisma } from "@/lib/prisma"

export type ModelSeed = { modelId: string; task: string; capabilities: string[]; provider?: string; securityClass?: string }
export type CapabilitySeed = { capId: string; name: string; provider: string; modelId?: string; safetyClass?: "standard" | "sensitive" | "forbidden-auto"; permissions?: string[] }
export type AgentSeed = { agentId: string; name: string; purpose: string; capabilities: string[]; memoryScope?: string }

// §5 — in-house deterministic foundation providers.
export const MODELS: ModelSeed[] = [
  { modelId: "tfidf-embed-v1", task: "embedding", capabilities: ["semantic-index", "semantic-search"] },
  { modelId: "icire-rank-v1", task: "ranking", capabilities: ["job-match", "job-rank", "career-frontier"] },
  { modelId: "intent-classify-v1", task: "classification", capabilities: ["intent"] },
  { modelId: "outcome-calibrate-v1", task: "prediction", capabilities: ["hiring-probability", "recommendation-calibration"] },
  { modelId: "doc-extract-v1", task: "extraction", capabilities: ["pdf-extract", "docx-extract"] },
  { modelId: "career-dna-v1", task: "reasoning", capabilities: ["career-dna"] },
  // §10/§11/§19/§25/§18 — the cognitive engines (in-house deterministic).
  { modelId: "reason-engine-v1", task: "reasoning", capabilities: ["argumentation", "forward-chaining"] },
  { modelId: "plan-engine-v1", task: "planning", capabilities: ["goal-planning"] },
  { modelId: "reflect-engine-v1", task: "reflection", capabilities: ["self-critique"] },
  { modelId: "evaluate-engine-v1", task: "evaluation", capabilities: ["rubric-scoring"] },
  { modelId: "recommend-engine-v1", task: "recommendation", capabilities: ["ranking", "recommendation-calibration"] },
  // Phase 5/6 — operational intelligence (in-house deterministic).
  { modelId: "project-manager-v1", task: "planning", capabilities: ["project-forecast", "project-risk", "resource-allocation"] },
  { modelId: "finance-advisor-v1", task: "prediction", capabilities: ["cash-flow", "ar-aging", "budget-forecast"] },
]

// §9 — capabilities (authorization derives from these, never role names).
export const CAPABILITIES: CapabilitySeed[] = [
  { capId: "knowledge.search", name: "Semantic knowledge search", provider: "semindex.search", modelId: "tfidf-embed-v1", safetyClass: "standard" },
  { capId: "career.rank", name: "Rank jobs for a candidate", provider: "career.rank", modelId: "icire-rank-v1", safetyClass: "standard", permissions: ["auth"] },
  { capId: "career.dna", name: "Compute Career DNA", provider: "career.dna", modelId: "career-dna-v1", safetyClass: "standard", permissions: ["auth"] },
  { capId: "career.frontier", name: "Market skill frontier", provider: "career.frontier", modelId: "icire-rank-v1", safetyClass: "standard", permissions: ["auth"] },
  { capId: "recruit.copilot", name: "Recruiter copilot — next best actions", provider: "recruit.copilot", modelId: "recruit-copilot-v1", safetyClass: "standard", permissions: ["auth"] },
  { capId: "learning.tutor", name: "In-house AI Tutor", provider: "learning.tutor", modelId: "tutor-v1", safetyClass: "standard", permissions: ["auth"] },
  { capId: "research.assistant", name: "Research AI Assistant", provider: "research.assistant", modelId: "research-assistant-v1", safetyClass: "standard", permissions: ["auth"] },
  { capId: "career.coach.answer", name: "AI Career Coach answer", provider: "career.coach.answer", modelId: "intent-classify-v1", safetyClass: "standard", permissions: ["auth"] },
  // §10/§11/§19/§25/§18 — cognitive engines, gateway-executable + audited.
  { capId: "reasoning.infer", name: "Reasoning (argumentation + inference)", provider: "reasoning.infer", modelId: "reason-engine-v1", safetyClass: "standard", permissions: ["auth"] },
  { capId: "planning.plan", name: "Goal planning", provider: "planning.plan", modelId: "plan-engine-v1", safetyClass: "standard", permissions: ["auth"] },
  { capId: "reflection.reflect", name: "Reflection / self-critique", provider: "reflection.reflect", modelId: "reflect-engine-v1", safetyClass: "standard", permissions: ["auth"] },
  { capId: "evaluation.evaluate", name: "Rubric evaluation", provider: "evaluation.evaluate", modelId: "evaluate-engine-v1", safetyClass: "standard", permissions: ["auth"] },
  { capId: "recommendation.rank", name: "Recommendation ranking + calibration", provider: "recommendation.rank", modelId: "recommend-engine-v1", safetyClass: "standard", permissions: ["auth"] },
  // Phase 5/6 — AI Project Manager + Finance advisor (in-house, audited).
  { capId: "project.manager", name: "AI Project Manager — portfolio standup", provider: "project.manager", modelId: "project-manager-v1", safetyClass: "standard", permissions: ["auth"] },
  { capId: "finance.advisor", name: "Financial Intelligence advisor", provider: "finance.advisor", modelId: "finance-advisor-v1", safetyClass: "standard", permissions: ["auth"] },
]

// §7 — registered agents. The Career Coach is the first.
export const AGENTS: AgentSeed[] = [
  { agentId: "agent:career-coach", name: "AI Career Coach", purpose: "Answer career questions from the applicant's real profile and live roles", capabilities: ["career.coach.answer", "career.rank", "career.dna", "career.frontier", "knowledge.search"], memoryScope: "user" },
]

// ---- cached loaders (5-min) ----
const cache = new Map<string, { v: any; at: number }>()
const TTL = 5 * 60 * 1000
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.v
  const v = await load().catch(() => null as any)
  if (v != null) cache.set(key, { v, at: Date.now() })
  return v
}
export function clearRegistryCache() { cache.clear() }

export async function getCapability(capId: string) {
  const seed = CAPABILITIES.find((c) => c.capId === capId)
  const row = await cached(`cap:${capId}`, () => prisma.capability.findUnique({ where: { capId } }).catch(() => null))
  if (row) return { capId: row.capId, name: row.name, provider: row.provider, modelId: seed?.modelId, safetyClass: row.safetyClass, permissions: safeArr(row.permissions), enabled: row.enabled }
  return seed ? { capId: seed.capId, name: seed.name, provider: seed.provider, modelId: seed.modelId, safetyClass: seed.safetyClass || "standard", permissions: seed.permissions || [], enabled: true } : null
}

export async function getModel(modelId: string) {
  const row = await cached(`model:${modelId}`, () => prisma.modelRegistry.findUnique({ where: { modelId } }).catch(() => null))
  if (row) return row
  return MODELS.find((m) => m.modelId === modelId) || null
}

export async function getAgent(agentId: string) {
  const row = await cached(`agent:${agentId}`, () => prisma.agentDef.findUnique({ where: { agentId } }).catch(() => null))
  if (row) return row
  return AGENTS.find((a) => a.agentId === agentId) || null
}

function safeArr(s: string): string[] { try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] } }
