import crypto from "crypto"
import dns from "dns/promises"
export { PLATFORMS, PLATFORM_BY_KEY, type Platform } from "@/lib/social/platforms"

/* Professional-link ownership verification. The user places a token we issue on
 * the public page; we fetch the page server-side and confirm the token is present.
 * SERVER ONLY. Hardened against SSRF: only http/https, and the target host must
 * not resolve to a private/loopback/link-local/metadata address. NO third-party
 * service — plain fetch + a token check. Platform catalog lives in ./platforms
 * (pure) so client components can import it without pulling in node built-ins. */

export function makeToken(): string { return "vrittih-verify-" + crypto.randomBytes(9).toString("hex") }

/** Normalize + validate a user URL. Throws on anything unusable. */
export function normalizeUrl(raw: string): string {
  let s = String(raw || "").trim()
  if (!s) throw new Error("Enter a URL")
  if (!/^https?:\/\//i.test(s)) s = "https://" + s
  const u = new URL(s)                       // throws if malformed
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Only http(s) links are allowed")
  return u.toString()
}

/** Reject IPs that must never be fetched server-side (SSRF). */
function isPrivateIp(ip: string): boolean {
  if (/^127\./.test(ip) || ip === "0.0.0.0" || /^10\./.test(ip) || /^192\.168\./.test(ip)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true
  if (/^169\.254\./.test(ip)) return true                 // link-local + cloud metadata
  const l = ip.toLowerCase()
  if (l === "::1" || l.startsWith("fe80:") || l.startsWith("fc") || l.startsWith("fd")) return true
  return false
}

/** Confirm a hostname resolves only to public addresses. */
async function assertPublicHost(hostname: string): Promise<void> {
  const bad = ["localhost", "ip6-localhost", "metadata.google.internal"]
  if (bad.includes(hostname.toLowerCase()) || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("blocked host")
  // Literal IP?
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) { if (isPrivateIp(hostname)) throw new Error("blocked host"); return }
  const addrs = await dns.lookup(hostname, { all: true }).catch(() => [])
  if (!addrs.length) throw new Error("Could not resolve that domain")
  for (const a of addrs) if (isPrivateIp(a.address)) throw new Error("blocked host")
}

export type VerifyResult = { verified: boolean; reason?: string }

/** Fetch the page and check the token is present. */
export async function verifyOwnership(url: string, token: string): Promise<VerifyResult> {
  let target: URL
  try { target = new URL(normalizeUrl(url)) } catch { return { verified: false, reason: "That URL looks invalid." } }
  try { await assertPublicHost(target.hostname) } catch { return { verified: false, reason: "We can't fetch that address." } }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 7000)
  try {
    const res = await fetch(target.toString(), {
      signal: ac.signal, redirect: "follow",
      headers: { "User-Agent": "VrittihLinkVerifier/1.0 (+https://vrittih.online)", "Accept": "text/html,*/*" },
    })
    if (!res.ok) return { verified: false, reason: `The page returned ${res.status}. Make sure it's public.` }
    const reader = res.body?.getReader()
    let text = ""
    if (reader) {
      let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.length
        text += Buffer.from(value).toString("utf8")
        if (total > 600_000) break                          // cap 600KB
      }
    } else { text = await res.text() }
    return text.toLowerCase().includes(token.toLowerCase())
      ? { verified: true }
      : { verified: false, reason: "We fetched the page but couldn't find your token. Add it to the page (or bio), then verify again." }
  } catch (e: any) {
    return { verified: false, reason: e?.name === "AbortError" ? "The page took too long to respond." : "We couldn't reach that page (some sites block automated checks — e.g. LinkedIn)." }
  } finally { clearTimeout(timer) }
}
