/* Spec §31 — recruiter natural-language talent query → structured retrieval spec.
 * In-house, deterministic (no LLM): detects ontology skills in free text, splits
 * must vs preferred by intent markers, reads seniority, and flags when the recruiter
 * wants DEMONSTRATED (real/production) experience. Pure → unit-tested. */
import { SKILLS } from "@/lib/career/taxonomy"

export type Seniority = "Junior" | "Mid" | "Senior"
export type TalentQuery = {
  must: string[]
  preferred: string[]
  seniority?: Seniority
  requireEvidence: boolean
  interpretation: string
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
// canonical + alias matchers, longest first (so "Node.js" wins over "Node").
const MATCHERS: { re: RegExp; canon: string }[] = (() => {
  const out: { re: RegExp; canon: string }[] = []
  for (const [canon, def] of Object.entries(SKILLS)) {
    for (const nm of [canon, ...(def.aliases || [])]) {
      if (!nm || nm.length < 2) continue
      out.push({ re: new RegExp("(?<![A-Za-z0-9+#.])" + escapeRe(nm) + "(?![A-Za-z0-9+#])", "i"), canon })
    }
  }
  return out.sort((a, b) => b.re.source.length - a.re.source.length)
})()

const PREF_MARKER = /\b(prefer(?:ably|red)?|nice to have|good to have|bonus|ideally|a plus|plus if|would be great)\b/i
const EVIDENCE = /\b(real|genuine|hands[- ]?on|production|demonstrated|proven|actual|shipped|deployed|built|deep|solid|strong track record)\b/i

export function parseTalentQuery(text: string): TalentQuery {
  const t = (text || "").trim()
  const low = t.toLowerCase()
  const prefAt = (() => { const m = PREF_MARKER.exec(low); return m ? m.index : -1 })()

  const must: string[] = [], preferred: string[] = []
  const seen = new Set<string>()
  for (const { re, canon } of MATCHERS) {
    if (seen.has(canon)) continue
    const m = re.exec(t)
    if (!m) continue
    seen.add(canon)
    if (prefAt >= 0 && m.index > prefAt) preferred.push(canon)
    else must.push(canon)
  }

  const seniority: Seniority | undefined =
    /\b(senior|sr\.?|lead|principal|staff|head|architect|director)\b/i.test(low) ? "Senior"
      : /\b(junior|jr\.?|entry|graduate|fresher|intern|trainee)\b/i.test(low) ? "Junior"
        : /\b(mid|intermediate)\b/i.test(low) ? "Mid" : undefined
  const requireEvidence = EVIDENCE.test(low)

  const parts: string[] = []
  if (must.length) parts.push(`${must.join(", ")} (required)`)
  if (preferred.length) parts.push(`${preferred.join(", ")} (preferred)`)
  if (seniority) parts.push(`${seniority} level`)
  if (requireEvidence) parts.push("demonstrated in real work")
  return { must, preferred, seniority, requireEvidence, interpretation: parts.join(" · ") || "no specific skills detected — try naming skills, e.g. Python, React" }
}
