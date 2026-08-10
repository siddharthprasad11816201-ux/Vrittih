/* Spec §15 — Candidate Knowledge Graph. In-house, deterministic (no LLM): represent
 * the candidate as nodes (candidate, skills, companies, schools) and edges
 * (possesses / worked_at / studied_at / demonstrated_at). A skill links to a company
 * when it actually appears in that role's text — so "React → demonstrated_at → Acme"
 * is an explainable, evidence-backed edge, not an assertion. Pure → unit-tested. */
import { canonical, categoryOf, type Category } from "@/lib/career/taxonomy"
import { relatedness } from "@/lib/career/semantic"

export type GNode = { id: string; type: "candidate" | "skill" | "company" | "school"; label: string; category?: Category }
export type GEdge = { from: string; to: string; rel: "possesses" | "worked_at" | "studied_at" | "demonstrated_at" | "related_to"; weight?: number }
export type CandidateGraph = { nodes: GNode[]; edges: GEdge[]; stats: { skills: number; demonstrated: number; companies: number; schools: number; related: number } }

export type GraphInput = {
  name?: string
  skills: string[]
  experiences: { title?: string; company?: string; description?: string }[]
  education: { school?: string; degree?: string }[]
}

const safeCat = (s: string): Category => { try { return categoryOf(s) } catch { return "domain" } }

export function buildCandidateGraph(input: GraphInput, opts?: { related?: boolean }): CandidateGraph {
  const withRelated = opts?.related !== false
  const nodes: GNode[] = []
  const edges: GEdge[] = []
  const CAND = "c:self"
  nodes.push({ id: CAND, type: "candidate", label: input.name || "Candidate" })

  // Skills the candidate possesses (ontology-normalized, de-duped).
  const skillIds = new Map<string, string>()   // lowercase canonical -> node id
  const skillList: { key: string; canon: string; id: string }[] = []
  for (const raw of input.skills || []) {
    const c = canonical(raw) || raw
    const key = c.toLowerCase()
    if (!c || skillIds.has(key)) continue
    const id = "s:" + key
    skillIds.set(key, id)
    skillList.push({ key, canon: c, id })
    nodes.push({ id, type: "skill", label: c, category: safeCat(c) })
    edges.push({ from: CAND, to: id, rel: "possesses" })
  }

  // Companies + demonstrated_at edges (a skill shown in that role's text).
  const companyIds = new Map<string, string>()
  const demonstratedSkills = new Set<string>()
  for (const e of input.experiences || []) {
    const co = (e.company || "").trim()
    if (!co) continue
    const cKey = co.toLowerCase()
    let coId = companyIds.get(cKey)
    if (!coId) {
      coId = "co:" + cKey
      companyIds.set(cKey, coId)
      nodes.push({ id: coId, type: "company", label: co })
      edges.push({ from: CAND, to: coId, rel: "worked_at" })
    }
    const txt = [e.title, e.company, e.description].filter(Boolean).join(" ").toLowerCase()
    for (const [key, id] of skillIds) {
      if (txt.includes(key)) { edges.push({ from: id, to: coId, rel: "demonstrated_at" }); demonstratedSkills.add(key) }
    }
  }

  // Education.
  const schoolIds = new Set<string>()
  for (const ed of input.education || []) {
    const sc = (ed.school || "").trim()
    if (!sc) continue
    const id = "sch:" + sc.toLowerCase()
    if (schoolIds.has(id)) continue
    schoolIds.add(id)
    nodes.push({ id, type: "school", label: sc })
    edges.push({ from: CAND, to: id, rel: "studied_at" })
  }

  // related_to edges among the candidate's OWN skills, from the self-trained semantic
  // model — reveals skill clusters. Top 2 strongest per skill (weight >= 0.5), deduped.
  let relatedCount = 0
  if (withRelated) {
    const seen = new Set<string>()
    for (const a of skillList) {
      const top = skillList
        .filter((b) => b.id !== a.id)
        .map((b) => ({ b, w: relatedness(a.canon, b.canon) }))
        .filter((x) => x.w >= 0.5)
        .sort((x, y) => y.w - x.w)
        .slice(0, 2)
      for (const { b, w } of top) {
        const key = [a.id, b.id].sort().join("~")
        if (seen.has(key)) continue
        seen.add(key)
        edges.push({ from: a.id, to: b.id, rel: "related_to", weight: Math.round(w * 100) / 100 })
        relatedCount++
      }
    }
  }

  return { nodes, edges, stats: { skills: skillIds.size, demonstrated: demonstratedSkills.size, companies: companyIds.size, schools: schoolIds.size, related: relatedCount } }
}
