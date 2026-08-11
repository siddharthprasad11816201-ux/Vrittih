/**
 * Assessment integrity (the TOEFL bar): per-attempt question/option randomization and
 * SERVER-side time enforcement. PURE — no I/O, no clock reads (the caller passes `now`).
 *
 * Randomization is SEEDED BY THE ATTEMPT ID, not by Math.random, so a candidate who
 * refreshes sees the same order (no free reshuffle to hunt for easier items) while two
 * different candidates get different orders (harder to share answers by position).
 */

/** Deterministic PRNG (mulberry32) — same idiom as lib/career/train. */
function prng(seed: number) {
  let a = seed >>> 0
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** Stable 32-bit hash of a string, so an attempt id becomes a numeric seed. */
export function seedFrom(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < String(s).length; i++) { h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** Fisher-Yates using a seeded PRNG. Returns a NEW array; input is untouched. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice()
  const rnd = prng(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export interface PreparedQuestion { id: string; options?: string[] | null; [k: string]: any }

/**
 * Prepare a question list for one attempt: optionally sample N, shuffle the questions,
 * and shuffle each question's options. All derived from the attempt id, so it is
 * reproducible for that attempt and different across attempts.
 */
export function prepareQuestions<T extends PreparedQuestion>(
  questions: T[],
  attemptId: string,
  opts: { shuffleQuestions?: boolean; shuffleOptions?: boolean; sampleN?: number | null } = {},
): T[] {
  const seed = seedFrom(attemptId)
  let out = questions.slice()

  if (opts.shuffleQuestions) out = seededShuffle(out, seed)
  if (opts.sampleN && opts.sampleN > 0 && opts.sampleN < out.length) {
    // Sample AFTER shuffling so the subset is random, not just the first N.
    out = (opts.shuffleQuestions ? out : seededShuffle(out, seed)).slice(0, opts.sampleN)
  }
  if (opts.shuffleOptions) {
    out = out.map((q, i) =>
      Array.isArray(q.options) && q.options.length > 1
        // Offset the seed per question so every question shuffles differently.
        ? { ...q, options: seededShuffle(q.options, seed + i + 1) }
        : q,
    )
  }
  return out
}

/* ---- server-side timing ----
 * The client timer is advisory only; this is the authority. A small grace window absorbs
 * network latency and clock skew so an honest last-second submit is not thrown away. */
export const SUBMIT_GRACE_SECONDS = 30

export interface TimingVerdict { expired: boolean; elapsedSeconds: number; limitSeconds: number }

export function checkTiming(startedAt: Date | string, durationMinutes: number, now: Date): TimingVerdict {
  const start = new Date(startedAt).getTime()
  const elapsedSeconds = Math.max(0, Math.round((now.getTime() - start) / 1000))
  const limitSeconds = Math.max(0, Math.round(durationMinutes * 60))
  // duration 0 = untimed
  const expired = limitSeconds > 0 && elapsedSeconds > limitSeconds + SUBMIT_GRACE_SECONDS
  return { expired, elapsedSeconds, limitSeconds }
}
