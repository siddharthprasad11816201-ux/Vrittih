/* Unified opportunity model — role/title normalization.  PURE, testable.
 *
 * Employers advertise the same job under wildly different titles. This maps a free-
 * text posting to a canonical role identity so equivalent roles across companies
 * collapse together — while the original posting is never mutated.
 *
 *   "Software Engineer" · "Software Development Engineer" · "Backend Engineer" ·
 *   "Platform Engineer" · "Application Developer" · "Systems Engineer" ·
 *   "Member of Technical Staff"  →  all recognised as the same software-engineering
 *   cluster (each keeps its specific roleKey + label).
 *
 * Built on the owned taxonomy (lib/career/taxonomy.ts skills) and role families
 * (lib/career/roles.ts). No external services, no ML — deterministic rules.
 */
import { canonical, categoryOf, type Category } from "@/lib/career/taxonomy"

export const SENIORITY = ["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD", "EXECUTIVE"] as const
export type Seniority = (typeof SENIORITY)[number]

export const SENIORITY_LABEL: Record<Seniority, string> = {
  INTERN: "Internship", JUNIOR: "Junior", MID: "Mid-level", SENIOR: "Senior", LEAD: "Lead / Staff", EXECUTIVE: "Executive",
}

// A canonical role. `cluster` is the broad group equivalent titles collapse into;
// `keywords` are lowercased title phrases (most specific matched first).
export interface RoleDef {
  key: string
  label: string
  cluster: string
  category: Category
  coreSkills: string[]
  keywords: string[]
}

export const CLUSTER_LABEL: Record<string, string> = {
  "software-engineering": "Software Engineering",
  "data-ai": "Data & AI",
  "product": "Product",
  "design": "Design",
  "engineering-management": "Engineering Leadership",
  "security": "Security",
  "quality": "Quality & Test",
  "other": "Other roles",
}

/* Order matters: earlier, more specific roles win over the generic "swe" catch-all. */
export const ROLE_DEFS: RoleDef[] = [
  { key: "data-scientist", label: "Data Scientist", cluster: "data-ai", category: "data-ml",
    coreSkills: ["Machine Learning", "Python", "Statistics"],
    keywords: ["data scientist", "machine learning engineer", "ml engineer", "ai engineer", "deep learning", "research scientist", "applied scientist", "mlops"] },
  { key: "data-engineer", label: "Data Engineer", cluster: "data-ai", category: "data-ml",
    coreSkills: ["Python", "SQL", "ETL", "Data Engineering"],
    keywords: ["data engineer", "etl", "data platform", "analytics engineer"] },
  { key: "data-analyst", label: "Data Analyst", cluster: "data-ai", category: "data-ml",
    coreSkills: ["SQL", "Data Analysis", "Statistics"],
    keywords: ["data analyst", "business analyst", "business intelligence", "bi analyst", "analytics"] },
  { key: "security", label: "Security Engineer", cluster: "security", category: "security",
    coreSkills: ["Security", "Networking", "Linux"],
    keywords: ["security engineer", "cybersecurity", "cyber security", "infosec", "application security", "appsec", "security analyst", "penetration"] },
  { key: "qa", label: "QA / Test Engineer", cluster: "quality", category: "testing",
    coreSkills: ["Testing", "Automation"],
    keywords: ["qa engineer", "quality engineer", "sdet", "test engineer", "test automation", "quality assurance", "automation engineer"] },
  { key: "platform", label: "Platform / DevOps Engineer", cluster: "software-engineering", category: "devops",
    coreSkills: ["Kubernetes", "CI/CD", "Cloud", "Linux"],
    keywords: ["platform engineer", "devops", "site reliability", "sre", "infrastructure engineer", "cloud engineer", "reliability engineer"] },
  { key: "mobile", label: "Mobile Developer", cluster: "software-engineering", category: "mobile",
    coreSkills: ["Mobile"],
    keywords: ["mobile developer", "mobile engineer", "ios developer", "ios engineer", "android developer", "android engineer", "react native", "flutter"] },
  { key: "frontend", label: "Frontend Engineer", cluster: "software-engineering", category: "frontend",
    coreSkills: ["Frontend", "JavaScript", "HTML", "CSS"],
    keywords: ["frontend", "front end", "front-end", "ui engineer", "ui developer", "web developer", "javascript developer", "react developer"] },
  { key: "backend", label: "Backend Engineer", cluster: "software-engineering", category: "backend",
    coreSkills: ["Backend", "REST API", "SQL"],
    keywords: ["backend", "back end", "back-end", "server engineer", "api engineer", "services engineer"] },
  { key: "fullstack", label: "Full-Stack Engineer", cluster: "software-engineering", category: "backend",
    coreSkills: ["Backend", "Frontend", "REST API"],
    keywords: ["full stack", "fullstack", "full-stack"] },
  { key: "engineering-manager", label: "Engineering Manager", cluster: "engineering-management", category: "soft",
    coreSkills: ["Leadership", "Project Management", "Communication"],
    keywords: ["engineering manager", "engineering lead", "tech lead", "technical lead", "team lead", "development manager", "director of engineering", "head of engineering", "vp engineering", "vp of engineering"] },
  { key: "product", label: "Product Manager", cluster: "product", category: "domain",
    coreSkills: ["Product Management", "Communication", "Data Analysis"],
    keywords: ["product manager", "product owner", "program manager", "technical product", "product lead", "head of product"] },
  { key: "designer", label: "Product Designer", cluster: "design", category: "design",
    coreSkills: ["UI/UX", "Figma"],
    keywords: ["ux designer", "ui designer", "product designer", "ux/ui", "ui/ux", "interaction designer", "visual designer", "experience designer"] },
  // Generic catch-all for software roles — MUST stay last among software matchers.
  { key: "swe", label: "Software Engineer", cluster: "software-engineering", category: "backend",
    coreSkills: ["Backend", "REST API", "Git", "Testing"],
    keywords: ["software engineer", "software developer", "software development engineer", "sde", "application developer", "applications developer", "member of technical staff", "systems engineer", "programmer", "software programmer", "computer engineer", "developer", "engineer"] },
]

const ROLE_BY_KEY: Record<string, RoleDef> = Object.fromEntries(ROLE_DEFS.map(r => [r.key, r]))
export function roleDef(key: string): RoleDef | undefined { return ROLE_BY_KEY[key] }

function lc(s?: string | null): string { return (s || "").toLowerCase() }

/* Extract seniority from title (preferred) then description. Handles I/II/III and
 * common seniority words. Default MID. */
export function extractSeniority(title?: string | null, description?: string | null): Seniority {
  const t = lc(title)
  const d = lc(description).slice(0, 600) // only the lede of the JD influences seniority
  const hay = t + " • " + d
  // Executive first (strongest signal), then lead/staff, senior, junior, intern.
  if (/\b(chief|c[tef]o|cxo|vice president|\bvp\b|president|managing director|partner)\b/.test(hay)) return "EXECUTIVE"
  if (/\bdirector\b/.test(t)) return "EXECUTIVE"
  // "staff" only signals seniority as "staff <role>" — NOT "member of technical staff"
  // (a generic engineer title). "lead"/"principal"/"head of" are unambiguous.
  if (/\b(principal|distinguished|head of|lead|staff (engineer|software|developer|scientist|designer|data|platform|frontend|backend|mobile|ml|sre|qa|architect))\b/.test(t)) return "LEAD"
  if (/\b(senior|sr\.?|iii|iv)\b/.test(t)) return "SENIOR"
  if (/\b(intern|internship|trainee|apprentice|co-?op)\b/.test(hay)) return "INTERN"
  if (/\b(junior|jr\.?|entry[- ]?level|graduate|new grad|associate|\bi\b|\bii?\b)\b/.test(t)) {
    // "II" is mid, "I" is junior; associate/junior/grad are junior.
    if (/\bii\b/.test(t) && !/\biii\b/.test(t)) return "MID"
    return "JUNIOR"
  }
  return "MID"
}

/* Pick the canonical role for a posting. Scans specific roles first, generic last. */
export function classifyRole(title?: string | null, description?: string | null): { def: RoleDef; matched: string[]; confidence: number } {
  const t = lc(title)
  const d = lc(description).slice(0, 400)
  // Pass 1: ANY title match wins over any description-only match. The title is the
  // strong signal — a role whose keyword is in the title must beat an earlier, more
  // specific def that only appears in the description.
  for (const def of ROLE_DEFS) {
    const inTitle = def.keywords.filter(k => t.includes(k))
    if (inTitle.length) {
      const specific = def.key !== "swe" && def.keywords[0] !== "developer"
      const conf = Math.min(1, 0.7 + 0.1 * inTitle.length + (specific ? 0.1 : 0) + (def.key !== "swe" ? 0.05 : 0))
      return { def, matched: inTitle, confidence: def.key === "swe" ? Math.min(conf, 0.72) : conf }
    }
  }
  // Pass 2: no title match anywhere — fall back to the first specific def matched in
  // the description (never the generic swe catch-all on description alone).
  for (const def of ROLE_DEFS) {
    if (def.key === "swe") continue
    const inDesc = def.keywords.filter(k => d.includes(k))
    if (inDesc.length) return { def, matched: inDesc, confidence: 0.5 }
  }
  // Nothing matched: treat as generic software / other with low confidence.
  return { def: ROLE_BY_KEY.swe, matched: [], confidence: 0.3 }
}

export interface NormalizedRole {
  roleKey: string
  roleLabel: string
  cluster: string
  clusterLabel: string
  category: Category
  seniority: Seniority
  seniorityLabel: string
  aliasesMatched: string[]
  confidence: number
}

export interface JobInput {
  id?: string
  title?: string | null
  description?: string | null
  skills?: string[] | null      // JobSkill names, if available
  type?: string | null          // employment type free text; can hint INTERN
}

/* Normalize a posting into its canonical capability profile. */
export function normalizeJob(job: JobInput): NormalizedRole {
  const { def, matched, confidence } = classifyRole(job.title, job.description)
  let seniority = extractSeniority(job.title, job.description)
  // Employment type "internship" is authoritative for seniority.
  if (/\bintern/.test(lc(job.type))) seniority = "INTERN"

  // Category: prefer the dominant category of the posting's tagged skills, else the
  // role's default category. This grounds the role in real required skills.
  let category = def.category
  const skillCats: Record<string, number> = {}
  for (const s of job.skills || []) {
    const canon = canonical(s) || s
    const c = categoryOf(canon)
    if (c) skillCats[c] = (skillCats[c] || 0) + 1
  }
  const top = Object.entries(skillCats).sort((a, b) => b[1] - a[1])[0]
  if (top && top[1] >= 2) category = top[0] as Category

  return {
    roleKey: def.key,
    roleLabel: def.label,
    cluster: def.cluster,
    clusterLabel: CLUSTER_LABEL[def.cluster] || def.cluster,
    category,
    seniority,
    seniorityLabel: SENIORITY_LABEL[seniority],
    aliasesMatched: matched,
    confidence,
  }
}
