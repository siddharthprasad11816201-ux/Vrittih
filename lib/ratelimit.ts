// In-memory limiter. NOTE: single-instance only — for multi-instance/horizontal
// scale, back this with Redis (see checkRateLimit signature, which is drop-in).
// A periodic sweep + hard cap prevent unbounded memory growth under load.
const attempts = new Map<string, { count: number; resetAt: number }>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const MAX_KEYS = 50_000

function sweep(now: number) {
  for (const [k, v] of attempts) if (now > v.resetAt) attempts.delete(k)
  // hard cap: if still oversized (e.g. a flood of unique keys), drop the oldest-expiring
  if (attempts.size > MAX_KEYS) {
    const sorted = [...attempts.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
    for (let i = 0; i < sorted.length - MAX_KEYS; i++) attempts.delete(sorted[i][0])
  }
}
let lastSweep = 0

export function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  if (now - lastSweep > 60_000 || attempts.size > MAX_KEYS) { sweep(now); lastSweep = now }
  const record = attempts.get(key)

  if (!record || now > record.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetAt: now + WINDOW_MS }
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }

  record.count++
  return { allowed: true, remaining: MAX_ATTEMPTS - record.count, resetAt: record.resetAt }
}

export function resetRateLimit(key: string) {
  attempts.delete(key)
}
