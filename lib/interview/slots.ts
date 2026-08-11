/**
 * Slot generation and conflict detection (Calendly / Google-appointment class).
 * PURE — the caller passes `now`, availability, and existing bookings; no I/O, no clock.
 *
 * Nothing like this existed: a recruiter typed one datetime into a form, there was no
 * availability model, no candidate self-scheduling, and no double-booking protection.
 */
import { offsetMinutes, utcToZonedParts, zonedTimeToUtc, zonedDayKey } from "./timezone"

/** Weekly recurring availability, expressed in the OWNER's zone. */
export interface AvailabilityRule {
  /** 0 = Sunday … 6 = Saturday, in the owner's zone. */
  weekday: number
  /** Minutes from midnight, owner's local time. */
  startMinute: number
  endMinute: number
}

/** A one-off block (holiday, PTO, an already-busy calendar event). */
export interface BusyInterval {
  start: Date
  end: Date
}

export interface SlotConfig {
  /** Interview length. */
  durationMinutes: number
  /** Gap enforced before AND after every booking. */
  bufferMinutes?: number
  /** Slot start granularity, e.g. 15 => :00, :15, :30, :45. */
  granularityMinutes?: number
  /** Candidates cannot book closer than this to now. */
  minNoticeMinutes?: number
  /** How far ahead booking is allowed. */
  maxAdvanceDays?: number
}

export interface Slot {
  start: Date
  end: Date
}

export const DEFAULT_SLOT_CONFIG: Required<Omit<SlotConfig, "durationMinutes">> = {
  bufferMinutes: 10,
  granularityMinutes: 15,
  minNoticeMinutes: 120,
  maxAdvanceDays: 60,
}

/** Two half-open intervals [aStart,aEnd) and [bStart,bEnd) overlap? */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime()
}

/**
 * Does a candidate slot collide with anything already booked, once buffers are applied?
 * The buffer is added to the EXISTING booking on both sides, so back-to-back interviews
 * always keep a gap.
 */
export function conflicts(slot: Slot, busy: BusyInterval[], bufferMinutes = 0): boolean {
  const b = Math.max(0, bufferMinutes) * 60000
  return busy.some((x) =>
    overlaps(slot.start, slot.end, new Date(x.start.getTime() - b), new Date(x.end.getTime() + b)),
  )
}

/**
 * Generate bookable slots between `from` and `to`.
 *
 * Availability is defined in the owner's LOCAL wall clock and expanded per local day, so a
 * "09:00–17:00 Monday" rule stays 09:00–17:00 across a DST change rather than drifting an
 * hour. Everything returned is a UTC instant.
 */
export function generateSlots(opts: {
  from: Date
  to: Date
  now: Date
  timezone: string
  rules: AvailabilityRule[]
  busy?: BusyInterval[]
  config: SlotConfig
}): Slot[] {
  const cfg = { ...DEFAULT_SLOT_CONFIG, ...opts.config }
  const duration = Math.max(1, Math.floor(cfg.durationMinutes))
  const gran = Math.max(1, Math.floor(cfg.granularityMinutes))
  const busy = opts.busy ?? []

  const earliest = new Date(opts.now.getTime() + cfg.minNoticeMinutes * 60000)
  const latest = new Date(opts.now.getTime() + cfg.maxAdvanceDays * 86400000)
  const windowStart = new Date(Math.max(opts.from.getTime(), earliest.getTime()))
  const windowEnd = new Date(Math.min(opts.to.getTime(), latest.getTime()))
  if (windowStart >= windowEnd || !opts.rules.length) return []

  const out: Slot[] = []
  const seen = new Set<number>()

  // Walk local days. Start one day early and end one day late so a rule that straddles a
  // zone offset near the window edge is not clipped.
  const dayCursor = new Date(windowStart.getTime() - 86400000)
  const lastDay = new Date(windowEnd.getTime() + 86400000)

  for (let d = dayCursor; d <= lastDay; d = new Date(d.getTime() + 86400000)) {
    const local = utcToZonedParts(d, opts.timezone)
    const dayKey = zonedDayKey(d, opts.timezone)
    for (const rule of opts.rules) {
      if (rule.weekday !== local.weekday) continue
      if (rule.endMinute <= rule.startMinute) continue

      for (let m = rule.startMinute; m + duration <= rule.endMinute; m += gran) {
        const [y, mo, da] = dayKey.split("-").map(Number)
        const start = zonedTimeToUtc(
          { year: y, month: mo, day: da, hour: Math.floor(m / 60), minute: m % 60 },
          opts.timezone,
        )
        if (seen.has(start.getTime())) continue
        const end = new Date(start.getTime() + duration * 60000)

        if (start < windowStart || end > windowEnd) continue
        if (start < earliest) continue
        if (conflicts({ start, end }, busy, cfg.bufferMinutes)) continue

        seen.add(start.getTime())
        out.push({ start, end })
      }
    }
  }

  out.sort((a, b) => a.start.getTime() - b.start.getTime())
  return out
}

/** Is a specific requested slot actually bookable? Used server-side at booking time. */
export function isSlotBookable(opts: {
  start: Date
  now: Date
  timezone: string
  rules: AvailabilityRule[]
  busy?: BusyInterval[]
  config: SlotConfig
}): { ok: true } | { ok: false; reason: string } {
  const cfg = { ...DEFAULT_SLOT_CONFIG, ...opts.config }
  const end = new Date(opts.start.getTime() + cfg.durationMinutes * 60000)

  if (opts.start.getTime() < opts.now.getTime()) return { ok: false, reason: "That time is in the past." }
  if (opts.start.getTime() < opts.now.getTime() + cfg.minNoticeMinutes * 60000) {
    return { ok: false, reason: `Please choose a time at least ${cfg.minNoticeMinutes} minutes from now.` }
  }
  if (opts.start.getTime() > opts.now.getTime() + cfg.maxAdvanceDays * 86400000) {
    return { ok: false, reason: `Bookings open only ${cfg.maxAdvanceDays} days ahead.` }
  }
  if (conflicts({ start: opts.start, end }, opts.busy ?? [], cfg.bufferMinutes)) {
    return { ok: false, reason: "That time is no longer available." }
  }

  // Must fall inside a weekly availability rule, in the owner's local wall clock.
  const local = utcToZonedParts(opts.start, opts.timezone)
  const startMinute = local.hour * 60 + local.minute
  const fits = opts.rules.some(
    (r) => r.weekday === local.weekday && startMinute >= r.startMinute && startMinute + cfg.durationMinutes <= r.endMinute,
  )
  if (!fits) return { ok: false, reason: "That time is outside the interviewer's availability." }
  return { ok: true }
}

/**
 * Round-robin pick: the eligible interviewer with the fewest bookings, ties broken
 * deterministically by id so the result is reproducible and testable.
 */
export function roundRobinPick(candidates: { id: string; load: number }[]): string | null {
  if (!candidates.length) return null
  return candidates.slice().sort((a, b) => a.load - b.load || a.id.localeCompare(b.id))[0].id
}

/** Slots where EVERY panelist is free — panel scheduling. */
export function intersectAvailability(perPanelist: Slot[][]): Slot[] {
  if (!perPanelist.length) return []
  const [first, ...rest] = perPanelist
  return first.filter((s) =>
    rest.every((other) => other.some((o) => o.start.getTime() === s.start.getTime() && o.end.getTime() === s.end.getTime())),
  )
}

export { offsetMinutes }
