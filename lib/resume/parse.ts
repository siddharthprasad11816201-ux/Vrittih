/* In-house résumé field parser — deterministic, no LLM, no third-party libs.
 * Consumes plain text (from lib/career/parseDocument extractText) and returns
 * structured profile fields: identity, contact, links, summary, skills, and
 * best-effort experience + education. Skills are normalized against the in-house
 * ontology (lib/career/taxonomy) and classified explicit / demonstrated / inferred
 * with an evidence snippet + provenance (spec §7–9, §20–21). Pure + unit-tested. */
import { SKILLS, categoryOf, IMPLY, canonical, type Category } from "@/lib/career/taxonomy"

export type ParsedExperience = { title?: string; company?: string; start?: string; end?: string }
export type ParsedEducation = { school?: string; degree?: string; year?: string }
export type SkillStatus = "explicit" | "demonstrated" | "inferred"
export type ParsedSkill = { skill: string; status: SkillStatus; category: Category; evidence?: string; section?: string }
export type ParsedResume = {
  name?: string
  email?: string
  phone?: string
  location?: string
  headline?: string
  summary?: string
  links: { linkedin?: string; github?: string; twitter?: string; website?: string }
  skills: string[]                 // explicit + demonstrated, ontology-normalized (for the profile)
  skillsDetailed: ParsedSkill[]    // each with status + evidence + provenance (spec §8–9)
  experience: ParsedExperience[]
  education: ParsedEducation[]
  confidence: number
  fieldsFound: string[]
}

// Ontology matchers: canonical names + aliases → canonical, longest first so
// "Node.js" wins over "Node". Word-ish boundaries that tolerate C++, C#, .NET.
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const SKILL_MATCHERS: { re: RegExp; canon: string }[] = (() => {
  const out: { re: RegExp; canon: string }[] = []
  for (const [canon, def] of Object.entries(SKILLS)) {
    for (const nm of [canon, ...(def.aliases || [])]) {
      if (!nm || nm.length < 2) continue
      out.push({ re: new RegExp("(?<![A-Za-z0-9+#.])" + escapeRe(nm) + "(?![A-Za-z0-9+#])", "i"), canon })
    }
  }
  return out.sort((a, b) => b.re.source.length - a.re.source.length)
})()
const catOf = (s: string): Category => { try { return categoryOf(s) } catch { return "domain" } }

/** Detect ontology skills present in free text → canonical skill → first evidence line. */
function detectSkills(text: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const line of text.split("\n")) {
    const l = line.trim()
    if (l.length < 2 || l.length > 400) continue
    for (const { re, canon } of SKILL_MATCHERS) { if (!found.has(canon) && re.test(l)) found.set(canon, l.slice(0, 160)) }
  }
  return found
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
// Phone: international / Indian, 7-15 digits with common separators.
const PHONE_RE = /(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?){2,5}\d{2,4}/
const URL_RE = /((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s,)]*)?)/gi

const SECTION_HEADERS: Record<string, RegExp> = {
  summary: /^(professional\s+summary|summary|profile|objective|about(?:\s+me)?)\b/i,
  experience: /^(work\s+experience|professional\s+experience|experience|employment(?:\s+history)?|work\s+history|career\s+history)\b/i,
  education: /^(education|academic(?:\s+background)?|qualifications)\b/i,
  skills: /^(technical\s+skills|core\s+competencies|skills(?:\s*&?\s*(?:tools|technologies))?|competencies|technologies)\b/i,
  projects: /^(projects|selected\s+projects|personal\s+projects)\b/i,
  certifications: /^(certifications?|licenses?|courses?)\b/i,
}
const ANY_HEADER = /^(professional\s+summary|summary|profile|objective|about|work\s+experience|professional\s+experience|experience|employment|work\s+history|career\s+history|education|academic|qualifications|technical\s+skills|core\s+competencies|skills|competencies|technologies|projects|certifications?|licenses?|courses?|awards|publications|interests|references|languages)\b/i

const DEGREE_RE = /\b(b\.?tech|b\.?e\.?|b\.?sc|b\.?a\.?|b\.?com|bca|bba|m\.?tech|m\.?e\.?|m\.?sc|m\.?a\.?|mba|mca|ph\.?d|doctorate|bachelor|master|diploma|hsc|ssc|12th|10th)\b/i
const SCHOOL_RE = /\b(university|college|institute|school|academy|polytechnic|iit|nit|iiit|iim)\b/i
const DATE_RANGE_RE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*)?(\d{4})\s*(?:[-–—]|to)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*)?(\d{4}|present|current|now|ongoing)/i
const YEAR_RE = /\b(19|20)\d{2}\b/

const TITLE_WORDS = /(engineer|developer|manager|designer|analyst|scientist|consultant|architect|lead|director|officer|specialist|administrator|intern|associate|executive|coordinator|head|founder|president|vp|cto|ceo|cfo|marketer|recruiter|accountant|teacher|nurse|doctor|researcher|writer|editor|strategist|advisor|technician|operator|supervisor|principal|partner)/i

const clean = (s: string) => s.replace(/\s+/g, " ").trim()
const cap = (a: string[], n: number) => a.slice(0, n)

function normLink(u: string): string { return u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "") }

export function parseResume(raw: string): ParsedResume {
  const text = (raw || "").replace(/\r\n?/g, "\n")
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const out: ParsedResume = { links: {}, skills: [], skillsDetailed: [], experience: [], education: [], confidence: 0, fieldsFound: [] }

  // --- contact ---
  const email = text.match(EMAIL_RE)?.[0]
  if (email) out.email = email.toLowerCase()

  // --- links (scan text with emails removed, so an email local part like
  // "aarav.sharma" is never mistaken for a website domain) ---
  const scanText = text.replace(new RegExp(EMAIL_RE.source, "gi"), " ")
  const urls = new Set<string>()
  let m: RegExpExecArray | null
  const ure = new RegExp(URL_RE.source, "gi")
  while ((m = ure.exec(scanText))) urls.add(m[1])
  for (const u of urls) {
    const l = u.toLowerCase()
    if (/linkedin\.com\/(in|pub)\//.test(l) && !out.links.linkedin) out.links.linkedin = "https://" + normLink(u)
    else if (/github\.com\//.test(l) && !/github\.io/.test(l) && !out.links.github) out.links.github = "https://" + normLink(u)
    else if (/(twitter\.com|x\.com)\//.test(l) && !out.links.twitter) out.links.twitter = "https://" + normLink(u)
    else if (!out.links.website) {
      // Real website only: a multi-char first label, a plausible alphabetic TLD, not
      // a provider/handle and not a degree token like "B.Tech" (tech is a real TLD).
      const host = normLink(u).split("/")[0]
      const parts = host.split(".")
      const label = parts[0] || "", tld = parts[parts.length - 1] || ""
      const bad = /(linkedin|github|twitter|x\.com|gmail|yahoo|outlook|hotmail|example)\./.test(l) || l.includes("@")
      if (!bad && label.length >= 2 && /^[a-z]{2,24}$/.test(tld) && !DEGREE_RE.test(host)) out.links.website = "https://" + normLink(u)
    }
  }

  // --- phone (avoid matching inside a date range or a year list) ---
  for (const l of lines.slice(0, 12)) {
    if (DATE_RANGE_RE.test(l)) continue
    const p = l.match(PHONE_RE)?.[0]
    if (p && (p.replace(/\D/g, "").length >= 8)) { out.phone = clean(p); break }
  }

  // --- name: first plausible line at the top ---
  for (const l of lines.slice(0, 6)) {
    if (EMAIL_RE.test(l) || /\d/.test(l) || l.includes("@") || /https?:|www\.|\.com/i.test(l)) continue
    if (ANY_HEADER.test(l)) continue
    const words = l.split(/\s+/)
    if (words.length >= 1 && words.length <= 4 && l.length <= 40 && /^[A-Za-z][A-Za-z.'-]*(\s+[A-Za-z][A-Za-z.'-]*)*$/.test(l)) { out.name = clean(l); break }
  }

  // --- section split ---
  const sections: Record<string, string[]> = {}
  let current = "_head"
  sections[current] = []
  for (const l of lines) {
    let matched = ""
    for (const [key, re] of Object.entries(SECTION_HEADERS)) if (re.test(l) && l.length <= 42) { matched = key; break }
    if (!matched && ANY_HEADER.test(l) && l.length <= 42 && l.split(/\s+/).length <= 4) matched = "_other"
    if (matched) { current = matched === "_other" ? `_other_${l.toLowerCase()}` : matched; sections[current] = []; continue }
    ;(sections[current] ||= []).push(l)
  }

  // --- summary ---
  if (sections.summary?.length) out.summary = clean(sections.summary.join(" ")).slice(0, 600)

  // --- skills (ontology-normalized; explicit / demonstrated / inferred) ---
  // Detect ontology skills across the WHOLE résumé so skills populate even when a
  // two-column / unusual layout breaks section detection. A skill is "demonstrated"
  // when it appears in the experience/projects text, otherwise "explicit" (listed).
  const expText = [
    ...(sections.experience || []), ...(sections.projects || []),
    ...Object.entries(sections).filter(([k]) => k.startsWith("_other")).flatMap(([, v]) => v),
  ].join("\n")
  const demo = detectSkills(expText)
  const anywhere = detectSkills(text)
  // Explicit tokens from a real Skills section (canonicalized) — catches skills the
  // ontology may not know about.
  const explicitTokens = new Set<string>()
  if (sections.skills?.length) {
    const toks = sections.skills.join("\n").split(/[,•·|/\n;]+|\s{2,}/).map((s) => clean(s.replace(/^[-*]\s*/, "")))
      .filter((s) => s && s.length >= 2 && s.length <= 32 && !/^\d+$/.test(s) && s.split(" ").length <= 4)
    for (const t of toks) explicitTokens.add(canonical(t) || t)
  }
  const detailed: ParsedSkill[] = []
  const flat = new Set<string>()
  for (const [s, ev] of demo) { flat.add(s); detailed.push({ skill: s, status: "demonstrated", category: catOf(s), evidence: ev, section: "experience" }) }
  for (const s of explicitTokens) { if (flat.has(s)) continue; flat.add(s); detailed.push({ skill: s, status: "explicit", category: catOf(s), evidence: anywhere.get(s), section: "skills" }) }
  for (const [s, ev] of anywhere) { if (flat.has(s)) continue; flat.add(s); detailed.push({ skill: s, status: "explicit", category: catOf(s), evidence: ev, section: "resume" }) }
  // Inferred (implied, bounded 1 hop) — surfaced as suggestions, NOT auto-added to the profile.
  const implied = new Set<string>()
  for (const s of flat) for (const imp of (IMPLY[s] || [])) if (!flat.has(imp) && !implied.has(imp)) { implied.add(imp); detailed.push({ skill: imp, status: "inferred", category: catOf(imp), section: "implied" }) }
  out.skills = cap(Array.from(flat), 60)
  out.skillsDetailed = detailed.slice(0, 160)

  // --- experience (best-effort: date-range lines anchor entries) ---
  const expLines = sections.experience || []
  for (let i = 0; i < expLines.length; i++) {
    const l = expLines[i]
    const dm = l.match(DATE_RANGE_RE)
    if (!dm) continue
    const start = (dm[1] ? dm[1].trim() + " " : "") + dm[2]
    const end = (dm[3] ? dm[3].trim() + " " : "") + dm[4]
    // Title/company: this line minus the date, or the previous line.
    const stripped = clean(l.replace(dm[0], "").replace(/[|,–—-]\s*$/, ""))
    const source = stripped.length > 2 ? stripped : (expLines[i - 1] ? clean(expLines[i - 1]) : "")
    let title = source, company = ""
    const sep = source.split(/\s+(?:at|@|[-–—|,])\s+/)
    if (sep.length >= 2) { title = clean(sep[0]); company = clean(sep.slice(1).join(" ")) }
    out.experience.push({ title: title || undefined, company: company || undefined, start, end: /present|current|now|ongoing/i.test(end) ? "Present" : end })
    if (out.experience.length >= 12) break
  }
  // Fallback: section detection missed the experience block (e.g. two-column layout) —
  // scan the whole résumé for date-range-anchored roles. The title/role guard keeps
  // education date-ranges (a degree's "2018–2022") from being mistaken for jobs.
  if (!out.experience.length) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (ANY_HEADER.test(l)) continue
      const dm = l.match(DATE_RANGE_RE); if (!dm) continue
      const start = (dm[1] ? dm[1].trim() + " " : "") + dm[2]
      const end = (dm[3] ? dm[3].trim() + " " : "") + dm[4]
      const stripped = clean(l.replace(dm[0], "").replace(/[|,–—-]\s*$/, ""))
      const prev = lines[i - 1] && !ANY_HEADER.test(lines[i - 1]) ? clean(lines[i - 1]) : ""
      const source = stripped.length > 2 ? stripped : prev
      if (!source) continue
      if (!TITLE_WORDS.test(source) && !/\s(?:at|@)\s/i.test(l) && !DEGREE_RE.test(l)) continue   // looks like a role
      if (DEGREE_RE.test(source) || SCHOOL_RE.test(source)) continue                              // skip education entries
      let title = source, company = ""
      const sep = source.split(/\s+(?:at|@|[-–—|,])\s+/)
      if (sep.length >= 2) { title = clean(sep[0]); company = clean(sep.slice(1).join(" ")) }
      out.experience.push({ title: title || undefined, company: company || undefined, start, end: /present|current|now|ongoing/i.test(end) ? "Present" : end })
      if (out.experience.length >= 12) break
    }
  }

  // --- education (require a real signal + dedupe; a collapsed section otherwise
  //     over-counts stray "institute"/"academy" mentions) ---
  const eduLines = sections.education?.length ? sections.education : lines
  const eduSeen = new Set<string>()
  for (let i = 0; i < eduLines.length; i++) {
    const l = eduLines[i]
    const window = [l, eduLines[i + 1] || ""].join(" ")
    const degree = window.match(DEGREE_RE)?.[0]
    const year = window.match(YEAR_RE)?.[0]
    const school = SCHOOL_RE.test(l) ? clean(l) : (SCHOOL_RE.test(eduLines[i + 1] || "") ? clean(eduLines[i + 1]) : undefined)
    // Real education needs a degree, OR a school named alongside a year.
    if (!degree && !(school && year)) continue
    const key = `${(school || "").toLowerCase()}|${(degree || "").toLowerCase()}|${year || ""}`
    if (eduSeen.has(key)) continue
    eduSeen.add(key)
    out.education.push({ degree: degree || undefined, school: school ? school.slice(0, 120) : undefined, year })
    if (out.education.length >= 6) break
  }

  // --- location: a line with "City, State"/"City, Country" near the top ---
  for (const l of lines.slice(0, 10)) {
    if (EMAIL_RE.test(l) || /https?:|www\./i.test(l)) continue
    const mm = l.match(/([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)?),\s*([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)?)/)
    if (mm && !TITLE_WORDS.test(l) && l.length <= 48) { out.location = clean(mm[0]); break }
  }

  // --- headline: line after the name that reads like a role, else latest title ---
  if (out.name) {
    const idx = lines.findIndex((l) => l === out.name)
    for (let k = idx + 1; k < Math.min(idx + 4, lines.length); k++) {
      const l = lines[k]
      if (l && TITLE_WORDS.test(l) && l.length <= 60 && !EMAIL_RE.test(l)) { out.headline = clean(l); break }
    }
  }
  if (!out.headline && out.experience[0]?.title) out.headline = out.experience[0].title

  // --- confidence + fieldsFound ---
  const found: string[] = []
  for (const k of ["name", "email", "phone", "location", "headline", "summary"] as const) if (out[k]) found.push(k)
  if (out.skills.length) found.push("skills")
  if (out.experience.length) found.push("experience")
  if (out.education.length) found.push("education")
  if (Object.keys(out.links).length) found.push("links")
  out.fieldsFound = found
  out.confidence = Math.min(1, found.length / 8)
  return out
}
