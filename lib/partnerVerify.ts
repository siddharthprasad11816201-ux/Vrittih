import crypto from "crypto"
import { promises as dns } from "dns"
import { prisma } from "@/lib/prisma"

/* Partner domain verification — proves a company controls the domain its jobs
 * link to, so the board can't be filled with fake listings. Two methods:
 *   dns : add a TXT record  vrittih-verify=<token>  on the domain
 *   file: serve  https://<domain>/.well-known/vrittih-verify.txt  containing the token
 * A job posted via the API only goes public if (a) the company is admin-approved
 * AND (b) its apply link is on a verified domain. */

export function domainToken(): string {
  return "vrf_" + crypto.randomBytes(20).toString("hex")
}

// Normalise user input ("https://Acme.com/x", "www.acme.com") to a bare host.
export function normalizeDomain(input: string): string | null {
  let s = String(input || "").trim().toLowerCase()
  if (!s) return null
  s = s.replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "")
  if (s.startsWith("www.")) s = s.slice(4)
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return null
  return s
}

export function hostFromUrl(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, "") } catch { return null }
}

// Does `host` belong to the registered `domain` (exact or a subdomain)?
export function hostMatchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain)
}

const RECORD = (token: string) => `vrittih-verify=${token}`

// Attempt verification now. Returns { ok, detail }.
export async function checkDomain(domain: string, token: string, method: string): Promise<{ ok: boolean; detail: string }> {
  const want = RECORD(token)
  if (method === "file") {
    const url = `https://${domain}/.well-known/vrittih-verify.txt`
    try {
      const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "user-agent": "VrittihBot/1.0" } })
      if (!res.ok) return { ok: false, detail: `fetched ${url} → HTTP ${res.status}` }
      const text = (await res.text()).trim()
      if (text.includes(token) || text.includes(want)) return { ok: true, detail: "file verified" }
      return { ok: false, detail: `token not found at ${url}` }
    } catch (e: any) {
      return { ok: false, detail: `could not fetch ${url}: ${String(e?.message || e).slice(0, 120)}` }
    }
  }
  // default: DNS TXT
  try {
    const records = await dns.resolveTxt(domain)
    const flat = records.map((chunks) => chunks.join("")).map((r) => r.trim())
    if (flat.some((r) => r === want || r.includes(token))) return { ok: true, detail: "TXT verified" }
    return { ok: false, detail: `TXT record ${want} not found on ${domain}` }
  } catch (e: any) {
    return { ok: false, detail: `DNS lookup failed for ${domain}: ${String(e?.message || e).slice(0, 120)}` }
  }
}

// The instructions to show a partner for a given domain/token/method.
export function verifyInstructions(domain: string, token: string) {
  return {
    dns: { type: "TXT", host: domain, value: RECORD(token), note: `Add this TXT record to ${domain}'s DNS, then verify.` },
    file: { url: `https://${domain}/.well-known/vrittih-verify.txt`, content: token, note: "Serve this file with exactly the token as its content, then verify." },
  }
}

/* Can this employer publish a job whose apply link is `applyUrl`?
 * Admins/super-admins bypass. Otherwise the company must be approved and the
 * apply host must be on one of its verified domains. Returns a reason if not. */
export async function canPublishApply(employer: { id: string; role: string; apiApproved: boolean }, applyUrl: string | null | undefined): Promise<{ ok: boolean; reason?: string }> {
  if (employer.role === "ADMIN" || employer.role === "SUPER_ADMIN") return { ok: true }
  if (!employer.apiApproved) return { ok: false, reason: "Company not yet approved for public posting (pending Vrittih review)." }
  const host = hostFromUrl(applyUrl || "")
  if (!host) return { ok: false, reason: "A valid applyUrl on your verified domain is required." }
  const domains = await prisma.partnerDomain.findMany({ where: { employerId: employer.id, verified: true }, select: { domain: true } })
  if (domains.some((d) => hostMatchesDomain(host, d.domain))) return { ok: true }
  return { ok: false, reason: `applyUrl host "${host}" is not on a verified domain. Verify it under Developers → Domains.` }
}
