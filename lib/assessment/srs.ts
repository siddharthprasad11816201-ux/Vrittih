/**
 * Spaced repetition (the Duolingo/Anki retention mechanic) — a faithful SM-2.
 * PURE: given the current card state and a grade, returns the next state. No clock reads
 * (the caller passes `now`), so scheduling is fully deterministic and testable.
 */

export interface Card {
  repetitions: number   // consecutive successful reviews
  intervalDays: number  // days until the next review
  ease: number          // SM-2 ease factor (>= 1.3)
}

export const NEW_CARD: Card = { repetitions: 0, intervalDays: 0, ease: 2.5 }

/** SM-2 grade: 0-2 = failed recall, 3 = hard, 4 = good, 5 = easy. */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5

export const MIN_EASE = 1.3

export interface Scheduled extends Card { dueAt: Date }

export function review(card: Card, grade: Grade, now: Date): Scheduled {
  const g = Math.max(0, Math.min(5, Math.round(grade))) as Grade
  let { repetitions, intervalDays, ease } = card

  if (g < 3) {
    // Failed: the card restarts, but the ease penalty persists so hard items come back often.
    repetitions = 0
    intervalDays = 1
  } else {
    repetitions = repetitions + 1
    if (repetitions === 1) intervalDays = 1
    else if (repetitions === 2) intervalDays = 6
    else intervalDays = Math.round(intervalDays * ease)
  }

  // Standard SM-2 ease update, floored so a card can never become impossibly frequent.
  ease = ease + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02))
  if (ease < MIN_EASE) ease = MIN_EASE

  const dueAt = new Date(now.getTime() + Math.max(1, intervalDays) * 86400000)
  return { repetitions, intervalDays, ease: +ease.toFixed(3), dueAt }
}

/** Cards due for review at `now`, soonest-due first. */
export function dueCards<T extends { dueAt: Date | string }>(cards: T[], now: Date): T[] {
  return cards
    .filter((c) => new Date(c.dueAt).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
}

/** Map a raw test outcome to an SM-2 grade — wrong answers become failures worth re-drilling. */
export function gradeFromAnswer(correct: boolean, difficulty = 3): Grade {
  if (!correct) return 2
  // A correct answer on a harder item demonstrates stronger recall.
  return (difficulty >= 4 ? 5 : difficulty <= 2 ? 4 : 4) as Grade
}
