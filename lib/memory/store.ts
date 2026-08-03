/* AIOS §17 — enterprise memory. Hierarchical, structured, versioned memory that
 * updates STRUCTURED state (never model weights). Personal (user/session) memory
 * is never mixed with organizational memory — callers pass an explicit scope +
 * ownerId. Privacy: users can export and delete their own memory.
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md §17. */
import { prisma } from "@/lib/prisma"

export type MemoryScope = "working" | "session" | "conversation" | "agent" | "user" | "org" | "knowledge" | "collective" | "archive"

export async function setMemory(scope: MemoryScope, ownerId: string, kind: string, key: string, value: unknown, opts: { confidence?: number; source?: string; verified?: boolean; expiresAt?: Date | null } = {}) {
  const valueJson = JSON.stringify(value ?? null)
  const existing = await prisma.memoryEntry.findUnique({ where: { scope_ownerId_kind_key: { scope, ownerId, kind, key } }, select: { id: true, version: true } }).catch(() => null)
  return prisma.memoryEntry.upsert({
    where: { scope_ownerId_kind_key: { scope, ownerId, kind, key } },
    update: { valueJson, confidence: opts.confidence ?? undefined, source: opts.source ?? undefined, verified: opts.verified ?? undefined, expiresAt: opts.expiresAt ?? undefined, version: (existing?.version ?? 1) + 1 },
    create: { scope, ownerId, kind, key, valueJson, confidence: opts.confidence ?? 0.5, source: opts.source ?? "system", verified: opts.verified ?? false, expiresAt: opts.expiresAt ?? null },
    select: { id: true, version: true },
  })
}

export async function getMemory(scope: MemoryScope, ownerId: string, filter: { kind?: string } = {}) {
  const now = new Date()
  const rows = await prisma.memoryEntry.findMany({
    where: { scope, ownerId, ...(filter.kind ? { kind: filter.kind } : {}), OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: { updatedAt: "desc" },
  })
  return rows.map((r) => ({ kind: r.kind, key: r.key, value: safe(r.valueJson), confidence: r.confidence, verified: r.verified, source: r.source, updatedAt: r.updatedAt }))
}

/** Privacy (§17): delete a specific memory or all of a subject's memory. */
export async function forgetMemory(scope: MemoryScope, ownerId: string, kind?: string, key?: string) {
  return prisma.memoryEntry.deleteMany({ where: { scope, ownerId, ...(kind ? { kind } : {}), ...(key ? { key } : {}) } })
}

export async function exportMemory(ownerId: string) {
  const rows = await prisma.memoryEntry.findMany({ where: { ownerId }, orderBy: [{ scope: "asc" }, { kind: "asc" }] })
  return rows.map((r) => ({ scope: r.scope, kind: r.kind, key: r.key, value: safe(r.valueJson), confidence: r.confidence, verified: r.verified, updatedAt: r.updatedAt }))
}

function safe(s: string) { try { return JSON.parse(s) } catch { return null } }
