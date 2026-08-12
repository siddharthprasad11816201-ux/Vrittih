/**
 * Candidate identity normalization. PURE — no I/O.
 *
 * Everything here exists to answer one question safely: "are these two records the same
 * person?" Getting that wrong in either direction is expensive — a false merge fuses two
 * strangers' hiring histories (a privacy incident), and a missed merge fragments one
 * person across every source they applied from.
 *
 * So identifiers are normalized to a canonical form BEFORE comparison, and the strength of
 * each identifier is explicit: matching a verified email is near-proof; matching a name is
 * not evidence at all.
 */

export type IdentityKind = "email" | "phone" | "linkedin" | "github" | "national_id" | "external"

/**
 * How much a match on this identifier tells us. Deliberately conservative.
 * A NAME is not in this list — see nameSimilarity, which is only ever corroborating.
 */
export const IDENTITY_STRENGTH: Record<IdentityKind, number> = {
  national_id: 1.0,   // strongest, when a jurisdiction allows collecting it
  email: 0.9,
  phone: 0.85,
  linkedin: 0.8,
  github: 0.7,
  external: 0.5,      // an ATS/job-board id — only meaningful within that source
}

/** Verified identifiers count fully; unverified ones are discounted (anyone can type an email). */
export const UNVERIFIED_DISCOUNT = 0.65

/* ---------------- normalizers ---------------- */

/**
 * Canonical email. Case is insignificant, and for Gmail-family domains dots and +tags are
 * ignored because they all deliver to one mailbox. Other providers are NOT dot-folded —
 * doing so would wrongly merge distinct people at most domains.
 */
export function normalizeEmail(raw: string): string | null {
  const s = String(raw || "").trim().toLowerCase()
  const m = /^([^\s@]+)@([^\s@]+\.[^\s@]+)$/.exec(s)
  if (!m) return null
  let [, local, domain] = m
  if (domain === "googlemail.com") domain = "gmail.com"
  if (domain === "gmail.com") {
    local = local.split("+")[0].replace(/\./g, "")
  } else {
    local = local.split("+")[0]
  }
  if (!local) return null
  return `${local}@${domain}`
}

/**
 * Digits-only phone with a leading +. Without a country code we cannot safely compare
 * across countries, so a bare national number keeps its digits and is compared by suffix.
 */
export function normalizePhone(raw: string, defaultCountryCode?: string): string | null {
  const s = String(raw || "").trim()
  if (!s) return null
  const hasPlus = s.trim().startsWith("+") || /^00\d/.test(s.replace(/[^\d+]/g, ""))
  let digits = s.replace(/\D/g, "")
  if (/^00\d/.test(digits)) digits = digits.slice(2)
  if (digits.length < 7 || digits.length > 15) return null
  if (!hasPlus && defaultCountryCode) {
    const cc = String(defaultCountryCode).replace(/\D/g, "")
    if (cc && !digits.startsWith(cc)) digits = cc + digits
  }
  return "+" + digits
}

/**
 * Two phone numbers match if they are identical, or if one is a national number whose
 * digits are the suffix of the other's international form (>= 8 significant digits, so a
 * short extension can never collide).
 */
export function phonesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const da = a.replace(/\D/g, ""), db = b.replace(/\D/g, "")
  const [short, long] = da.length <= db.length ? [da, db] : [db, da]
  return short.length >= 8 && long.endsWith(short)
}

/** Canonical LinkedIn profile slug — the stable part of the URL. */
export function normalizeLinkedIn(raw: string): string | null {
  const s = String(raw || "").trim().toLowerCase()
  if (!s) return null
  const m = /(?:linkedin\.com\/(?:in|pub)\/)([a-z0-9\-_%]+)/.exec(s)
  const slug = m ? m[1] : /^[a-z0-9\-_%]+$/.test(s) ? s : null
  if (!slug) return null
  return slug.replace(/\/+$/, "")
}

export function normalizeGithub(raw: string): string | null {
  const s = String(raw || "").trim().toLowerCase()
  if (!s) return null
  const m = /(?:github\.com\/)([a-z0-9\-]+)/.exec(s)
  const user = m ? m[1] : /^[a-z0-9\-]+$/.test(s) ? s : null
  if (!user || user === "orgs" || user === "settings") return null
  return user
}

/** Normalize any identifier by kind. Returns null when the value is unusable. */
export function normalizeIdentity(kind: IdentityKind, value: string, defaultCountryCode?: string): string | null {
  switch (kind) {
    case "email": return normalizeEmail(value)
    case "phone": return normalizePhone(value, defaultCountryCode)
    case "linkedin": return normalizeLinkedIn(value)
    case "github": return normalizeGithub(value)
    case "national_id": {
      const s = String(value || "").replace(/[\s-]/g, "").toUpperCase()
      return s.length >= 5 ? s : null
    }
    case "external": {
      const s = String(value || "").trim()
      return s ? s.slice(0, 200) : null
    }
    default: return null
  }
}

/* ---------------- names (corroborating only) ---------------- */

/**
 * Strip accents and case so "José O'Neill" and "jose oneill" compare equal.
 *
 * Intra-word punctuation (apostrophes, periods) is REMOVED rather than turned into a
 * space, so "O'Neill" and "ONeill" produce the same token. Separators (hyphens, slashes)
 * do become spaces, so "Oneill-Smith" and "Oneill Smith" also agree.
 */
export function normalizeName(raw: string): string {
  return String(raw || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.`]/g, "")        // joiners: O'Neill -> oneill
    .replace(/[^a-z\s]/g, " ")     // separators: hyphens etc. -> space
    .replace(/\s+/g, " ")
    .trim()
}

/** Token-set similarity, so "Priya Sharma" and "Sharma Priya" match. 0..1. */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeName(a).split(" ").filter(Boolean))
  const tb = new Set(normalizeName(b).split(" ").filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return +(shared / Math.max(ta.size, tb.size)).toFixed(3)
}

/**
 * Very common names must not corroborate strongly — "John Smith" matching "John Smith"
 * says almost nothing in a large candidate pool.
 */
const COMMON_TOKENS = new Set([
  "john", "smith", "david", "michael", "maria", "jose", "kumar", "singh", "sharma", "patel",
  "wang", "li", "zhang", "chen", "liu", "khan", "ali", "ahmed", "mohamed", "garcia", "silva",
])

export function nameDistinctiveness(name: string): number {
  const tokens = normalizeName(name).split(" ").filter(Boolean)
  if (!tokens.length) return 0
  const common = tokens.filter((t) => COMMON_TOKENS.has(t)).length
  return +Math.max(0.2, 1 - common / tokens.length).toFixed(3)
}
