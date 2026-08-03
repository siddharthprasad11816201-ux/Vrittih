/* In-house iCalendar (RFC 5545) + calendar deep-links. No third-party libraries,
 * no API keys: a .ics file imports into ANY calendar (Google, Outlook, Apple),
 * the deep-links one-click add to Google/Outlook, and a subscribable feed keeps a
 * calendar in sync. Pure + unit-tested. */

export type CalEvent = {
  uid: string
  title: string
  start: Date
  durationMin: number
  description?: string
  location?: string
  url?: string
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED"
}

/** UTC stamp: YYYYMMDDTHHMMSSZ */
export function icsDate(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0")
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

function esc(s: string): string {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

/** Fold lines to 75 octets per RFC 5545 (continuation lines start with a space). */
function fold(line: string): string {
  if (line.length <= 75) return line
  const out: string[] = []
  let s = line
  out.push(s.slice(0, 75)); s = s.slice(75)
  while (s.length) { out.push(" " + s.slice(0, 74)); s = s.slice(74) }
  return out.join("\r\n")
}

function vevent(e: CalEvent, now: Date): string {
  const end = new Date(e.start.getTime() + e.durationMin * 60000)
  const desc = [e.description, e.url ? `Join: ${e.url}` : ""].filter(Boolean).join("\n")
  const lines = [
    "BEGIN:VEVENT",
    `UID:${esc(e.uid)}`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(e.title)}`,
    desc ? `DESCRIPTION:${esc(desc)}` : "",
    e.location || e.url ? `LOCATION:${esc(e.location || e.url || "")}` : "",
    e.url ? `URL:${esc(e.url)}` : "",
    `STATUS:${e.status || "CONFIRMED"}`,
    "END:VEVENT",
  ].filter(Boolean)
  return lines.map(fold).join("\r\n")
}

/** A full VCALENDAR document for one or more events. `now` is injectable (tests). */
export function buildICS(events: CalEvent[], opts: { name?: string; now?: Date } = {}): string {
  const now = opts.now || new Date()
  const head = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vrittih//Vrittih Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    opts.name ? `X-WR-CALNAME:${esc(opts.name)}` : "",
  ].filter(Boolean)
  const body = events.map((e) => vevent(e, now))
  return [...head, ...body, "END:VCALENDAR"].join("\r\n") + "\r\n"
}

/** Build a CalEvent from an interview record (pure — caller passes plain fields). */
export function interviewToEvent(
  iv: { id: string; title?: string | null; scheduledAt: Date; duration?: number | null; notes?: string | null; roomCode: string; status?: string | null },
  baseUrl: string,
): CalEvent {
  const room = `${baseUrl.replace(/\/$/, "")}/interviews/${iv.roomCode}`
  return {
    uid: `interview-${iv.id}@vrittih.online`,
    title: iv.title || "Vrittih interview",
    start: new Date(iv.scheduledAt),
    durationMin: iv.duration || 60,
    description: iv.notes || "Interview scheduled on Vrittih.",
    location: room,
    url: room,
    status: iv.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED",
  }
}

/** "Add to Google Calendar" URL (no API key needed). */
export function googleCalUrl(e: CalEvent): string {
  const end = new Date(e.start.getTime() + e.durationMin * 60000)
  const details = [e.description, e.url ? `Join: ${e.url}` : ""].filter(Boolean).join("\n")
  const p = new URLSearchParams({
    action: "TEMPLATE", text: e.title, dates: `${icsDate(e.start)}/${icsDate(end)}`,
  })
  if (details) p.set("details", details)
  if (e.location || e.url) p.set("location", e.location || e.url || "")
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

/** "Add to Outlook" (Office 365) compose deep-link. */
export function outlookCalUrl(e: CalEvent): string {
  const end = new Date(e.start.getTime() + e.durationMin * 60000)
  const details = [e.description, e.url ? `Join: ${e.url}` : ""].filter(Boolean).join("\n")
  const p = new URLSearchParams({
    path: "/calendar/action/compose", rru: "addevent", subject: e.title,
    startdt: e.start.toISOString(), enddt: end.toISOString(),
  })
  if (details) p.set("body", details)
  if (e.location || e.url) p.set("location", e.location || e.url || "")
  return `https://outlook.office.com/calendar/0/deeplink/compose?${p.toString()}`
}
