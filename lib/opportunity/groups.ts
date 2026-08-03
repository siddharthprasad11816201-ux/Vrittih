/* Related opportunity groups — PURE, testable.
 *
 * Clusters live postings into groups of equivalent roles across employers, so a
 * candidate reviews "Backend Engineering — Mid-level (5 companies)" rather than five
 * near-identical postings. Grouping key = normalized cluster + seniority; each job
 * keeps its own title, employer and requirements.
 *
 * Built on lib/opportunity/normalize.ts. No external services — deterministic.
 */
import { normalizeJob, CLUSTER_LABEL, SENIORITY_LABEL, type JobInput, type NormalizedRole } from "@/lib/opportunity/normalize"
import { canonical } from "@/lib/career/taxonomy"

export interface GroupJobInput extends JobInput {
  id: string
  company?: string | null
}

export interface GroupJob {
  id: string
  title: string
  company: string
  skills: string[]
  normalized: NormalizedRole
}

export interface OpportunityGroup {
  key: string                // `${cluster}:${seniority}`
  cluster: string
  clusterLabel: string
  seniority: string
  seniorityLabel: string
  roleLabels: string[]       // distinct specific roles inside, e.g. ["Backend Engineer","Software Engineer"]
  employers: string[]        // distinct company names
  size: number
  sharedSkills: string[]     // skills common to ≥ half the jobs (the group's spine)
  cohesion: number           // 0..1 — how tightly the jobs share skills
  jobs: GroupJob[]
}

function skillSet(job: JobInput): Set<string> {
  const out = new Set<string>()
  for (const s of job.skills || []) out.add(canonical(s) || s)
  return out
}

/* Cluster postings into related opportunity groups. */
export function buildGroups(jobs: GroupJobInput[], opts?: { minSize?: number }): OpportunityGroup[] {
  const minSize = opts?.minSize ?? 1
  const buckets = new Map<string, GroupJob[]>()

  for (const j of jobs) {
    const normalized = normalizeJob(j)
    const key = `${normalized.cluster}:${normalized.seniority}`
    const gj: GroupJob = {
      id: j.id,
      title: j.title || "Untitled role",
      company: j.company || "—",
      skills: Array.from(skillSet(j)),
      normalized,
    }
    const arr = buckets.get(key) || []
    arr.push(gj)
    buckets.set(key, arr)
  }

  const groups: OpportunityGroup[] = []
  for (const [key, gjobs] of buckets) {
    if (gjobs.length < minSize) continue
    const [cluster, seniority] = key.split(":")

    // Shared skills: appear in a real majority. For multi-job groups require a skill in
    // ≥2 jobs (else a 2-job group with disjoint skills would call every skill "shared"
    // and report cohesion 1.0 — see review finding). Single-job groups keep threshold 1.
    const freq = new Map<string, number>()
    for (const g of gjobs) for (const s of new Set(g.skills)) freq.set(s, (freq.get(s) || 0) + 1)
    const half = gjobs.length > 1 ? Math.max(2, Math.ceil(gjobs.length / 2)) : 1
    const sharedSkills = Array.from(freq.entries())
      .filter(([, n]) => n >= half && n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([s]) => s)

    // Cohesion: mean fraction of each job's skills that are group-shared.
    let cohSum = 0, cohN = 0
    const sharedSet = new Set(sharedSkills)
    for (const g of gjobs) {
      if (!g.skills.length) continue
      cohSum += g.skills.filter(s => sharedSet.has(s)).length / g.skills.length
      cohN++
    }
    const cohesion = cohN ? +(cohSum / cohN).toFixed(3) : (gjobs.length > 1 ? 0.5 : 1)

    groups.push({
      key,
      cluster,
      clusterLabel: CLUSTER_LABEL[cluster] || cluster,
      seniority,
      seniorityLabel: SENIORITY_LABEL[seniority as keyof typeof SENIORITY_LABEL] || seniority,
      roleLabels: Array.from(new Set(gjobs.map(g => g.normalized.roleLabel))),
      employers: Array.from(new Set(gjobs.map(g => g.company).filter(c => c && c !== "—"))),
      size: gjobs.length,
      sharedSkills: sharedSkills.slice(0, 8),
      cohesion,
      jobs: gjobs,
    })
  }

  // Biggest, most-employer-diverse groups first.
  groups.sort((a, b) => b.size - a.size || b.employers.length - a.employers.length)
  return groups
}
