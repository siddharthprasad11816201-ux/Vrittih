// Normalise a user-supplied external link.
// Returns an http(s) URL or null — never javascript:/data:/file:, which would be
// an XSS vector once rendered as an <a href>. Bare hosts get https:// prepended.
export function safeExternalUrl(v: unknown): string | null {
  if (typeof v !== "string") return null
  let s = v.trim()
  if (!s) return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "")
  try {
    const u = new URL(s)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    if (!u.hostname.includes(".")) return null
    return u.toString().slice(0, 500)
  } catch {
    return null
  }
}

// Short, human label for an external link: "recruitment.gov.in"
export function hostLabel(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return "external site" }
}
