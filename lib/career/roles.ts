/* ICIRE §19 — curated professional role ladders. In-house knowledge, no LLM. Each
 * family has an IC ladder, a management branch and breadth pivots; nodes carry the
 * real skills the role screens for (used to compute honest gaps via match.ts) and
 * title keywords (used to bind to REAL Job listings for CHF salary). */

export type Track = "ic" | "management" | "breadth"
export type RoleNode = { key: string; title: string; level: number; coreSkills: string[]; titleKeywords: string[] }
export type RoleFamily = { key: string; label: string; ic: RoleNode[]; management: RoleNode[]; breadth: RoleNode[] }

const N = (key: string, title: string, level: number, coreSkills: string[], titleKeywords: string[]): RoleNode => ({ key, title, level, coreSkills, titleKeywords })

export const FAMILIES: Record<string, RoleFamily> = {
  backend: {
    key: "backend", label: "Backend",
    ic: [
      N("be_mid", "Backend Engineer", 2, ["Backend", "REST API", "SQL", "Git", "Testing"], ["backend", "software engineer", "developer"]),
      N("be_senior", "Senior Backend Engineer", 3, ["System Design", "PostgreSQL", "Docker", "Microservices", "Testing"], ["senior backend", "senior software"]),
      N("be_staff", "Staff Engineer", 4, ["Distributed Systems", "Kubernetes", "Scalability", "Architecture"], ["staff engineer", "staff software"]),
      N("be_principal", "Principal Engineer", 5, ["Architecture", "Distributed Systems", "Leadership", "Mentoring"], ["principal engineer", "architect"]),
    ],
    management: [
      N("be_em", "Engineering Manager", 4, ["Leadership", "Project Management", "Mentoring", "Communication"], ["engineering manager", "team lead"]),
      N("be_director", "Director of Engineering", 5, ["Leadership", "Strategy", "People Management"], ["director of engineering", "head of engineering"]),
    ],
    breadth: [
      N("be_fullstack", "Full-Stack Engineer", 3, ["React", "JavaScript", "Frontend"], ["full stack", "fullstack"]),
      N("be_platform", "Platform / DevOps Engineer", 3, ["Kubernetes", "CI/CD", "Cloud", "Linux"], ["platform engineer", "devops", "sre"]),
    ],
  },
  frontend: {
    key: "frontend", label: "Frontend",
    ic: [
      N("fe_mid", "Frontend Engineer", 2, ["Frontend", "JavaScript", "HTML", "CSS", "Git"], ["frontend", "front end", "ui engineer"]),
      N("fe_senior", "Senior Frontend Engineer", 3, ["React", "TypeScript", "Testing", "System Design"], ["senior frontend", "senior front end"]),
      N("fe_staff", "Staff Frontend Engineer", 4, ["Architecture", "TypeScript", "Accessibility"], ["staff frontend", "principal frontend"]),
      N("fe_principal", "Principal Engineer", 5, ["Architecture", "Leadership", "Mentoring"], ["principal engineer"]),
    ],
    management: [
      N("fe_em", "Engineering Manager", 4, ["Leadership", "Project Management", "Mentoring"], ["engineering manager", "frontend lead"]),
      N("fe_director", "Director of Engineering", 5, ["Leadership", "Strategy", "People Management"], ["director of engineering"]),
    ],
    breadth: [
      N("fe_fullstack", "Full-Stack Engineer", 3, ["Backend", "REST API", "SQL"], ["full stack", "fullstack"]),
      N("fe_mobile", "Mobile Developer", 3, ["Mobile"], ["mobile developer", "react native", "ios", "android"]),
    ],
  },
  data: {
    key: "data", label: "Data & ML",
    ic: [
      N("da_analyst", "Data Analyst", 2, ["Python", "SQL", "Data Analysis", "Statistics"], ["data analyst", "analytics"]),
      N("ds_ds", "Data Scientist", 3, ["Machine Learning", "Python", "Statistics"], ["data scientist"]),
      N("ds_senior", "Senior ML Engineer", 4, ["Deep Learning", "MLOps", "System Design"], ["machine learning engineer", "ml engineer", "senior data scientist"]),
      N("ds_staff", "Staff ML Engineer", 5, ["Distributed Systems", "MLOps", "Architecture"], ["staff", "principal", "lead data"]),
    ],
    management: [
      N("da_manager", "Data Science Manager", 4, ["Leadership", "Project Management", "Communication"], ["data science manager", "analytics manager"]),
    ],
    breadth: [
      N("da_mle", "ML Engineer", 3, ["Docker", "Kubernetes", "Backend"], ["ml engineer", "mlops"]),
    ],
  },
  infra: {
    key: "infra", label: "Cloud & DevOps",
    ic: [
      N("do_devops", "DevOps Engineer", 2, ["Linux", "Docker", "CI/CD", "Cloud", "Git"], ["devops", "site reliability", "sre"]),
      N("do_senior", "Senior DevOps / SRE", 3, ["Kubernetes", "Terraform", "Monitoring", "Scalability"], ["senior devops", "senior sre", "platform"]),
      N("do_staff", "Staff Platform Engineer", 4, ["Distributed Systems", "Architecture", "Security"], ["staff platform", "principal platform"]),
    ],
    management: [
      N("do_manager", "Infrastructure Manager", 4, ["Leadership", "Project Management", "People Management"], ["infrastructure manager", "platform lead"]),
    ],
    breadth: [
      N("do_backend", "Backend Engineer", 3, ["Backend", "REST API", "System Design"], ["backend", "software engineer"]),
    ],
  },
  mobile: {
    key: "mobile", label: "Mobile",
    ic: [
      N("mo_mid", "Mobile Developer", 2, ["Mobile", "Git"], ["mobile developer", "ios", "android"]),
      N("mo_senior", "Senior Mobile Engineer", 3, ["Architecture", "Testing", "System Design"], ["senior mobile", "senior ios", "senior android"]),
      N("mo_staff", "Staff Mobile Engineer", 4, ["Architecture", "Leadership"], ["staff mobile", "principal mobile"]),
    ],
    management: [
      N("mo_em", "Engineering Manager", 4, ["Leadership", "Project Management", "Mentoring"], ["engineering manager", "mobile lead"]),
    ],
    breadth: [
      N("mo_fullstack", "Full-Stack Engineer", 3, ["Backend", "REST API", "Frontend"], ["full stack", "fullstack"]),
    ],
  },
}

// DNA macro bucket -> role family. Falls back to backend (the broadest ladder).
export function familyForBucket(bucket?: string): RoleFamily {
  if (bucket && FAMILIES[bucket]) return FAMILIES[bucket]
  if (bucket === "security" || bucket === "quality") return FAMILIES.backend
  return FAMILIES.backend
}

// Seniority band (from DNA) -> current IC level.
export function levelForBand(band?: string): number {
  switch (band) {
    case "Principal / Staff": return 4
    case "Senior": return 3
    case "Mid": return 2
    case "Junior": return 2
    default: return 1
  }
}
