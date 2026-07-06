/**
 * Vrittih in-house durable background job queue — no Redis, no BullMQ.
 *
 * Jobs are persisted in the `BackgroundJob` table and processed by a worker
 * loop (server/worker.js). Supports delayed jobs, priority, exponential
 * backoff retries, and a dead-letter terminal state. Zero third-party deps.
 */
import { prisma } from "@/lib/prisma"

export type JobHandler = (payload: any) => Promise<any>
const handlers = new Map<string, JobHandler>()

/** Register a handler for a job type (called at worker startup). */
export function registerHandler(type: string, fn: JobHandler) {
  handlers.set(type, fn)
}
export function registeredTypes(): string[] {
  return [...handlers.keys()]
}

/** Enqueue a job. `delayMs` schedules it for the future; higher priority runs first. */
export async function enqueue(type: string, payload: Record<string, unknown> = {}, opts: { delayMs?: number; maxAttempts?: number; priority?: number } = {}) {
  return prisma.backgroundJob.create({
    data: {
      type,
      payload: JSON.stringify(payload),
      runAt: new Date(Date.now() + (opts.delayMs ?? 0)),
      maxAttempts: opts.maxAttempts ?? 5,
      priority: opts.priority ?? 0,
    },
    select: { id: true, type: true, status: true, runAt: true },
  })
}

// Backoff schedule (seconds) per attempt, then capped.
const BACKOFF = [1, 5, 15, 60, 300]
const backoffMs = (attempt: number) => (BACKOFF[Math.min(attempt, BACKOFF.length - 1)]) * 1000

/**
 * Claim and process at most one due job. Returns a small status object.
 * Claiming is guarded against a stuck worker via a lock timeout (2 min).
 */
export async function processOnce(now = new Date()): Promise<{ ran: boolean; id?: string; type?: string; outcome?: string; error?: string }> {
  const staleLock = new Date(now.getTime() - 2 * 60_000)

  // Find the next runnable job: queued & due, OR active but lock-expired (crashed worker).
  const candidate = await prisma.backgroundJob.findFirst({
    where: {
      OR: [
        { status: "queued", runAt: { lte: now } },
        { status: "active", lockedAt: { lt: staleLock } },
      ],
    },
    orderBy: [{ priority: "desc" }, { runAt: "asc" }],
    select: { id: true },
  })
  if (!candidate) return { ran: false }

  // Atomically claim it (optimistic: only if still not freshly locked).
  const claim = await prisma.backgroundJob.updateMany({
    where: { id: candidate.id, OR: [{ status: "queued" }, { status: "active", lockedAt: { lt: staleLock } }] },
    data: { status: "active", lockedAt: now, attempts: { increment: 1 } },
  })
  if (claim.count === 0) return { ran: false } // lost the race to another worker

  const job = await prisma.backgroundJob.findUnique({ where: { id: candidate.id } })
  if (!job) return { ran: false }

  const handler = handlers.get(job.type)
  if (!handler) {
    await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "dead", lastError: `No handler for type "${job.type}"` } })
    return { ran: true, id: job.id, type: job.type, outcome: "dead", error: "no handler" }
  }

  try {
    const result = await handler(JSON.parse(job.payload))
    await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "done", result: JSON.stringify(result ?? null), lockedAt: null, lastError: null } })
    return { ran: true, id: job.id, type: job.type, outcome: "done" }
  } catch (err: any) {
    const msg = String(err?.message || err)
    if (job.attempts >= job.maxAttempts) {
      await prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "dead", lastError: msg, lockedAt: null } })
      return { ran: true, id: job.id, type: job.type, outcome: "dead", error: msg }
    }
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: { status: "queued", lastError: msg, lockedAt: null, runAt: new Date(now.getTime() + backoffMs(job.attempts)) },
    })
    return { ran: true, id: job.id, type: job.type, outcome: "retry", error: msg }
  }
}

/** Drain all currently-due jobs (used by tests and by the worker tick). */
export async function drain(max = 100): Promise<number> {
  let n = 0
  for (let i = 0; i < max; i++) {
    const r = await processOnce()
    if (!r.ran) break
    n++
  }
  return n
}

/** Queue depth snapshot for observability / admin. */
export async function queueStats() {
  const rows = await prisma.backgroundJob.groupBy({ by: ["status"], _count: true })
  return Object.fromEntries(rows.map((r) => [r.status, r._count]))
}
