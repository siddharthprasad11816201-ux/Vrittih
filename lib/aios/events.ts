/* AIOS §23 — event-driven learning. Platform events are recorded (PlatformEvent)
 * and fanned out to registered, idempotent, replayable handlers that update
 * knowledge/memory/recommendations/indexes/analytics. Recording never overwrites
 * history. Handlers run inline-safe (best-effort) and can be re-run from cron. */
import { prisma } from "@/lib/prisma"

export type PlatformEventType =
  | "job.created" | "job.updated" | "application.submitted" | "interview.completed"
  | "offer.accepted" | "project.delivered" | "research.published" | "course.completed"
  | "promotion" | "performance.review" | "policy.updated" | "document.updated"
  | "recommendation.feedback" | "knowledge.updated" | string

export type Handler = (payload: any, meta: { id: string; type: string; actorId?: string | null; subjectId?: string | null }) => Promise<void>
const HANDLERS: Record<string, Handler[]> = {}

export function on(type: PlatformEventType, handler: Handler) {
  (HANDLERS[type] ||= []).push(handler)
}

/** Record an event and best-effort process its handlers now. Returns event id. */
export async function emit(type: PlatformEventType, payload: any, opts: { actorId?: string; subjectId?: string } = {}): Promise<string | null> {
  let ev: { id: string } | null = null
  try {
    ev = await prisma.platformEvent.create({
      data: { type, actorId: opts.actorId ?? null, subjectId: opts.subjectId ?? null, payload: JSON.stringify(payload ?? {}).slice(0, 40000) },
      select: { id: true },
    })
  } catch (e: any) { console.error("[AIOS.emit]", e?.message); return null }
  await process(ev.id).catch(() => {})
  return ev.id
}

/** Process one recorded event through its handlers (idempotent + replayable). */
export async function process(eventId: string): Promise<boolean> {
  const ev = await prisma.platformEvent.findUnique({ where: { id: eventId } }).catch(() => null)
  if (!ev || ev.processed) return false
  const payload = safe(ev.payload)
  const log: { handler: string; ok: boolean; error?: string }[] = []
  // Type-specific handlers plus wildcard ("*") handlers (Phase 13 automation subscribes here).
  const meta = { id: ev.id, type: ev.type, actorId: ev.actorId, subjectId: ev.subjectId }
  for (const h of [...(HANDLERS[ev.type] || []), ...(HANDLERS["*"] || [])]) {
    try { await h(payload, meta); log.push({ handler: h.name || "anon", ok: true }) }
    catch (e: any) { log.push({ handler: h.name || "anon", ok: false, error: String(e?.message).slice(0, 200) }) }
  }
  await prisma.platformEvent.update({ where: { id: ev.id }, data: { processed: true, processedAt: new Date(), handlers: JSON.stringify(log) } }).catch(() => {})
  return true
}

/** Replay unprocessed events (cron entrypoint). */
export async function drain(limit = 200): Promise<number> {
  const pending = await prisma.platformEvent.findMany({ where: { processed: false }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true } }).catch(() => [])
  let n = 0
  for (const e of pending) if (await process(e.id).catch(() => false)) n++
  return n
}

function safe(s: string) { try { return JSON.parse(s) } catch { return {} } }
