/**
 * Vrittih gamification — XP, levels, streaks (the Duolingo retention axis).
 *
 * PURE and deterministic: no clock reads inside the math (the caller passes "today" as a
 * "YYYY-MM-DD" UTC string), so every function is trivially unit-testable and reproducible.
 * Zero third-party deps — the mechanic is owned outright.
 */

export interface ProgressState {
  xp: number
  level: number
  streakDays: number
  longestStreak: number
  freezes: number
  lastActiveDay: string | null // "YYYY-MM-DD" (UTC)
}

export const ZERO_PROGRESS: ProgressState = {
  xp: 0, level: 1, streakDays: 0, longestStreak: 0, freezes: 0, lastActiveDay: null,
}

/* ---- day helpers (UTC, string-based so there is no timezone drift) ---- */

/** UTC "YYYY-MM-DD" for a Date (defaults to now). */
export function dayString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Whole days from day a to day b (b - a). Negative if b precedes a. Pure integer math. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number)
  const [by, bm, bd] = b.split("-").map(Number)
  const ta = Date.UTC(ay, am - 1, ad)
  const tb = Date.UTC(by, bm - 1, bd)
  return Math.round((tb - ta) / 86400000)
}

/* ---- levels ----
 * Cumulative XP needed to REACH level L is 50*L*(L-1): L1=0, L2=100, L3=300, L4=600, L5=1000…
 * A gently super-linear curve — early levels come fast, later ones take real work. */
export function totalXpForLevel(level: number): number {
  const L = Math.max(1, Math.floor(level))
  return 50 * L * (L - 1)
}

export function levelForXp(xp: number): number {
  const x = Math.max(0, xp)
  let L = 1
  while (totalXpForLevel(L + 1) <= x) L++
  return L
}

/** XP still needed to reach the next level, and progress within the current level. */
export function levelProgress(xp: number): { level: number; intoLevel: number; span: number; toNext: number } {
  const level = levelForXp(xp)
  const base = totalXpForLevel(level)
  const next = totalXpForLevel(level + 1)
  const span = next - base
  const intoLevel = Math.max(0, xp - base)
  return { level, intoLevel, span, toNext: Math.max(0, next - xp) }
}

/* ---- streak ----
 * Rolls the daily streak when activity happens on `today`:
 *  - same day as last active     -> no change (already counted today)
 *  - exactly the next day        -> streak + 1
 *  - a one-day gap with a freeze  -> consume a freeze, keep (not extend) the streak
 *  - any larger gap / no freeze   -> streak resets to 1
 *  - first ever activity          -> streak = 1
 */
export function rollStreak(state: ProgressState, today: string): ProgressState {
  const last = state.lastActiveDay
  let streakDays = state.streakDays
  let freezes = state.freezes

  if (!last) {
    streakDays = 1
  } else {
    const gap = daysBetween(last, today)
    if (gap <= 0) {
      return state // same day (or clock skew) — nothing to roll
    } else if (gap === 1) {
      streakDays = streakDays + 1
    } else if (gap === 2 && freezes > 0) {
      freezes = freezes - 1 // a freeze covers the single missed day; streak preserved
    } else {
      streakDays = 1 // streak broken
    }
  }

  const longestStreak = Math.max(state.longestStreak, streakDays)
  return { ...state, streakDays, longestStreak, freezes, lastActiveDay: today }
}

/* ---- combined award ----
 * Add XP and roll the streak for an activity that happened on `today`. Returns the new state
 * plus what changed, so callers can show "+40 XP", "Level up!", "5-day streak". */
export interface AwardResult { state: ProgressState; xpAwarded: number; leveledUp: boolean; newLevel: number }

export function awardXp(state: ProgressState, amount: number, today: string): AwardResult {
  const add = Math.max(0, Math.round(amount))
  const rolled = rollStreak(state, today)
  const xp = Math.max(0, rolled.xp + add)
  const newLevel = levelForXp(xp)
  const leveledUp = newLevel > state.level
  return {
    state: { ...rolled, xp, level: newLevel },
    xpAwarded: add,
    leveledUp,
    newLevel,
  }
}

/* ---- XP earned for finishing a test ----
 * Deterministic and modest: a completion base, a pass bonus, and a small per-correct reward,
 * all bounded. No fabrication — it is a pure function of the real result. */
export function testXp(opts: { passed: boolean; scorePct: number; correctCount: number; proctored?: boolean }): number {
  const base = 20
  const pass = opts.passed ? 30 : 0
  const perCorrect = Math.min(50, Math.max(0, Math.round(opts.correctCount)) * 5)
  const scoreBonus = Math.round(Math.max(0, Math.min(100, opts.scorePct)) * 0.2) // up to +20
  const proctorBonus = opts.proctored ? 10 : 0
  return base + pass + perCorrect + scoreBonus + proctorBonus
}
