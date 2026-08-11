/**
 * Interview reminder scheduling. PURE — the caller supplies `now` and what has already
 * been sent.
 *
 * WHAT WAS BROKEN: the daily 08:00 UTC cron sent ONE in-app reminder for anything in the
 * next 24h, with no dedupe column and no log. Any retry (a Vercel cron retry, or a manual
 * x-worker-secret call) re-notified everyone. Anything scheduled under ~24h out could get
 * zero reminders, or one firing minutes before the call. There was no 1-hour tier at all.
 */

/** Tiers, furthest out first. `key` is the idempotency key stored per interview. */
export const REMINDER_TIERS = [
  { key: "T24H", minutesBefore: 24 * 60, label: "24 hours" },
  { key: "T1H", minutesBefore: 60, label: "1 hour" },
  { key: "T15M", minutesBefore: 15, label: "15 minutes" },
] as const

export type ReminderKey = (typeof REMINDER_TIERS)[number]["key"]

/**
 * A tier fires once its lead time has been reached and the interview has not started.
 * `graceMinutes` lets an infrequent cron still catch a tier it slept through, without
 * firing tiers that are no longer meaningful.
 */
export function dueReminders(opts: {
  scheduledAt: Date
  now: Date
  alreadySent: string[]
  /** How late a tier may still fire after its ideal moment. */
  graceMinutes?: number
}): ReminderKey[] {
  const grace = opts.graceMinutes ?? 6 * 60
  const sent = new Set(opts.alreadySent || [])
  const minutesUntil = (opts.scheduledAt.getTime() - opts.now.getTime()) / 60000

  // Already started (or past) — no reminder is useful any more.
  if (minutesUntil <= 0) return []

  const due: ReminderKey[] = []
  for (const tier of REMINDER_TIERS) {
    if (sent.has(tier.key)) continue
    // Fire when we are inside the lead time, but not so far past it that the tier is stale.
    if (minutesUntil <= tier.minutesBefore && minutesUntil > tier.minutesBefore - grace) {
      due.push(tier.key)
    }
  }
  // A late-created interview can be inside several windows at once; send only the most
  // urgent so the candidate does not get three notifications in one minute.
  return due.length ? [due[due.length - 1]] : []
}

export function tierLabel(key: string): string {
  return REMINDER_TIERS.find((t) => t.key === key)?.label ?? key
}

/** Idempotency key for one reminder of one interview — unique-constrained in the DB. */
export function reminderKey(interviewId: string, tier: string): string {
  return `${interviewId}:${tier}`
}

/**
 * Reminder copy. The time is rendered in the RECIPIENT's zone by the caller and passed in,
 * because the previous implementation formatted server-side with a hardcoded locale.
 */
export function reminderCopy(opts: { title: string; tier: string; localTime: string; roomCode?: string }): { title: string; body: string } {
  return {
    title: `Interview in ${tierLabel(opts.tier)} — ${opts.title}`,
    body: `Your interview is scheduled for ${opts.localTime}.${opts.roomCode ? ` Room: ${opts.roomCode}.` : ""}`,
  }
}
