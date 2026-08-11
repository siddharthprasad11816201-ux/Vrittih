/**
 * Timezone handling for scheduling. PURE — no clock reads, no I/O.
 *
 * THE BUG THIS FIXES: the schedule form posted a bare `datetime-local` string
 * ("2026-08-11T10:00") and the server did `new Date(...)` on it. A string with no offset
 * is parsed in the SERVER's zone (UTC on Vercel), so a recruiter in IST who typed 10:00
 * got an interview stored at 10:00Z = 15:30 IST. Every downstream surface — the .ics feed,
 * reminders, the candidate's calendar — then faithfully propagated the wrong instant.
 *
 * The rule from here on:
 *   - store ONE canonical instant (UTC Date),
 *   - store the IANA zone the human meant it in,
 *   - format per viewer at the edges.
 * A wall-clock string is never stored, and never parsed without an explicit zone.
 */

/** Minimal IANA validation — we never guess a zone, we reject an unknown one. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const DEFAULT_TIMEZONE = "UTC"

export function normalizeTimeZone(tz: string | null | undefined): string {
  return tz && isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE
}

/**
 * Offset of `zone` from UTC at a given instant, in minutes (east positive).
 * Uses Intl rather than a hardcoded table, so DST is handled correctly for every zone.
 */
export function offsetMinutes(instant: Date, zone: string): number {
  const tz = normalizeTimeZone(zone)
  // Format the instant in the target zone, re-read it as if it were UTC, and the
  // difference is the offset. This is the standard Intl-only technique.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
  const parts = dtf.formatToParts(instant)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  let hour = get("hour")
  if (hour === 24) hour = 0            // some ICU versions emit 24 for midnight
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"))
  return Math.round((asUtc - instant.getTime()) / 60000)
}

/**
 * Convert a wall-clock time IN A ZONE to the correct UTC instant.
 * This is what the scheduling form must call — never `new Date(localString)`.
 *
 * DST is handled by resolving the offset twice: the offset at the naive guess can be wrong
 * across a transition, so we re-evaluate at the corrected instant.
 */
export function zonedTimeToUtc(
  wall: { year: number; month: number; day: number; hour: number; minute: number },
  zone: string,
): Date {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0)
  let instant = new Date(naive - offsetMinutes(new Date(naive), zone) * 60000)
  // Second pass: if the first guess landed on the other side of a DST boundary the offset
  // changes, so recompute once. (A second pass is sufficient for all real-world rules.)
  const corrected = new Date(naive - offsetMinutes(instant, zone) * 60000)
  if (corrected.getTime() !== instant.getTime()) instant = corrected
  return instant
}

/** Parse an ISO-ish local string ("2026-08-11T10:00") as wall-clock in `zone`. */
export function parseLocalInZone(local: string, zone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(local || "").trim())
  if (!m) return null
  return zonedTimeToUtc(
    { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5] },
    zone,
  )
}

/**
 * Accept a scheduling input safely. An explicit offset or trailing Z is already
 * unambiguous and is respected; a bare wall-clock string is interpreted in `zone`.
 */
export function resolveScheduledAt(input: string, zone: string): Date | null {
  const s = String(input || "").trim()
  if (!s) return null
  const hasExplicitOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s)
  if (hasExplicitOffset) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }
  return parseLocalInZone(s, zone)
}

/** Wall-clock fields of an instant as seen in a zone. */
export function utcToZonedParts(instant: Date, zone: string): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const tz = normalizeTimeZone(zone)
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short",
  })
  const parts = dtf.formatToParts(instant)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  let hour = Number(get("hour"))
  if (hour === 24) hour = 0
  return {
    year: Number(get("year")), month: Number(get("month")), day: Number(get("day")),
    hour, minute: Number(get("minute")), weekday: WD[get("weekday")] ?? 0,
  }
}

/** "YYYY-MM-DD" for an instant as seen in a zone (used for per-day slot generation). */
export function zonedDayKey(instant: Date, zone: string): string {
  const p = utcToZonedParts(instant, zone)
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

/**
 * Human-readable time for a SPECIFIC viewer. Notifications previously hardcoded
 * `toLocaleString("en-IN")` on the server, so every user worldwide saw Indian-locale times
 * in the server's zone.
 */
export function formatForViewer(instant: Date, zone: string, locale = "en-GB"): string {
  // NOTE: dateStyle/timeStyle cannot be combined with timeZoneName — Intl throws
  // "Invalid option". Explicit components are used so the zone abbreviation can be shown,
  // which matters: a reminder without a zone is ambiguous for a remote candidate.
  return new Intl.DateTimeFormat(locale, {
    timeZone: normalizeTimeZone(zone),
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZoneName: "short",
  }).format(instant)
}

/** Minutes between two instants (b - a). */
export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000)
}
