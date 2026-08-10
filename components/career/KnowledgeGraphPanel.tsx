"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

/* ICIRE §15 — the candidate knowledge graph, drawn in-house with plain SVG (no chart
 * libraries). Candidate at the centre; skills on an inner ring coloured by category;
 * companies + schools on an outer ring. Edges: possesses / worked_at / studied_at
 * (faint), demonstrated_at (a skill shown in that role's text — highlighted), and
 * related_to (skill↔skill, from the self-trained semantic model — dashed). Deterministic
 * layout, so the same profile always draws the same graph. */

type GNode = { id: string; type: "candidate" | "skill" | "company" | "school"; label: string; category?: string }
type GEdge = { from: string; to: string; rel: string; weight?: number }
type Graph = { nodes: GNode[]; edges: GEdge[]; stats: { skills: number; demonstrated: number; companies: number; schools: number; related: number } }

// Category palette — distinct, tasteful, legible in the card.
const CAT: Record<string, string> = {
  language: "#6366F1", frontend: "#0EA5E9", backend: "#10B981", database: "#F59E0B",
  cloud: "#06B6D4", devops: "#8B5CF6", "data-ml": "#EC4899", mobile: "#F97316",
  security: "#EF4444", testing: "#14B8A6", design: "#A855F7", domain: "#64748B", soft: "#94A3B8",
}
const catColor = (c?: string) => (c && CAT[c]) || "#64748B"

const W = 820, H = 560, CX = W / 2, CY = H / 2

export default function KnowledgeGraphPanel() {
  const [g, setG] = useState<Graph | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "empty" | "anon" | "error">("loading")

  const load = () => {
    setState("loading")
    fetch("/api/career/graph")
      .then((r) => (r.status === 401 ? "anon" : r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        if (j === "anon") { setState("anon"); return }
        const graph: Graph | undefined = j?.graph
        if (!graph || graph.stats.skills === 0) { setG(graph || null); setState("empty"); return }
        setG(graph); setState("ready")
      })
      .catch(() => setState("error"))
  }
  useEffect(() => { load() }, [])

  if (state === "anon") return null
  if (state === "loading") return <section style={S.card}><div style={S.title}>Your knowledge graph</div><p style={S.muted}>Mapping your skills, roles and evidence…</p></section>
  if (state === "error") return <section style={S.card}><div style={S.title}>Your knowledge graph</div><p style={S.muted}>Couldn&apos;t build your graph just now. <button onClick={load} style={S.retry}>Retry</button></p></section>
  if (state === "empty" || !g) return (
    <section style={S.card}>
      <div style={S.title}>Your knowledge graph</div>
      <p style={S.muted}>Add your skills, experience or a résumé and we&apos;ll map how they connect — skills, employers, and which skills you actually demonstrated where. <Link href="/profile/edit" style={S.link}>Update your profile →</Link></p>
    </section>
  )

  // --- deterministic layout ---
  const pos = new Map<string, { x: number; y: number }>()
  pos.set("c:self", { x: CX, y: CY })
  const skills = g.nodes.filter((n) => n.type === "skill").sort((a, b) => (a.category || "").localeCompare(b.category || "") || a.label.localeCompare(b.label))
  const orgs = g.nodes.filter((n) => n.type === "company" || n.type === "school")
  skills.forEach((n, i) => {
    const a = (i / Math.max(1, skills.length)) * 2 * Math.PI - Math.PI / 2
    pos.set(n.id, { x: CX + Math.cos(a) * 250, y: CY + Math.sin(a) * 172 })
  })
  orgs.forEach((n, i) => {
    const a = (i / Math.max(1, orgs.length)) * 2 * Math.PI - Math.PI / 2 + 0.35
    pos.set(n.id, { x: CX + Math.cos(a) * 372, y: CY + Math.sin(a) * 250 })
  })
  const P = (id: string) => pos.get(id)
  const label = (n: GNode) => (n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label)

  // draw edges behind nodes; demonstrated_at + related_to on top of the faint ones
  const order: Record<string, number> = { possesses: 0, worked_at: 0, studied_at: 0, related_to: 1, demonstrated_at: 2 }
  const edges = g.edges.slice().sort((a, b) => (order[a.rel] ?? 0) - (order[b.rel] ?? 0))

  return (
    <section style={S.card}>
      <div style={S.head}>
        <div>
          <div style={S.title}>Your knowledge graph</div>
          <div style={S.sub}>{g.stats.skills} skills · {g.stats.demonstrated} demonstrated · {g.stats.companies} employer{g.stats.companies === 1 ? "" : "s"} · {g.stats.related} learned links</div>
        </div>
      </div>

      <div style={S.scroll}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560, display: "block" }} role="img" aria-label="Your skills and how they connect to your experience and education">
          {/* edges */}
          {edges.map((e, i) => {
            const a = P(e.from), b = P(e.to)
            if (!a || !b) return null
            if (e.rel === "demonstrated_at") return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#334EAC" strokeWidth={1.6} strokeOpacity={0.55} />
            if (e.rel === "related_to") return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#EC4899" strokeWidth={1} strokeOpacity={Math.min(0.5, 0.2 + (e.weight || 0) * 0.4)} strokeDasharray="3 3" />
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#CBD5E1" strokeWidth={1} strokeOpacity={0.5} />
          })}

          {/* org nodes */}
          {orgs.map((n) => {
            const p = P(n.id)!; const right = p.x >= CX
            return (
              <g key={n.id}>
                <rect x={p.x - 6} y={p.y - 6} width={12} height={12} rx={3} fill={n.type === "company" ? "#1F2937" : "#7C6FD8"} />
                <text x={right ? p.x + 10 : p.x - 10} y={p.y + 4} textAnchor={right ? "start" : "end"} style={S.orgLabel}>{label(n)}</text>
              </g>
            )
          })}

          {/* skill nodes */}
          {skills.map((n) => {
            const p = P(n.id)!; const right = p.x >= CX; const col = catColor(n.category)
            return (
              <g key={n.id}>
                <circle cx={p.x} cy={p.y} r={6} fill={col} />
                <text x={right ? p.x + 9 : p.x - 9} y={p.y + 3.5} textAnchor={right ? "start" : "end"} style={S.skillLabel}>{label(n)}</text>
              </g>
            )
          })}

          {/* candidate */}
          <circle cx={CX} cy={CY} r={22} fill="#334EAC" />
          <text x={CX} y={CY + 4} textAnchor="middle" style={S.meLabel}>You</text>
        </svg>
      </div>

      <div style={S.legend}>
        <span style={S.leg}><span style={{ ...S.dot, background: "#334EAC" }} /> demonstrated in a role</span>
        <span style={S.leg}><span style={{ ...S.dash, borderColor: "#EC4899" }} /> learned skill link</span>
        <span style={S.leg}><span style={{ ...S.sq, background: "#1F2937" }} /> employer</span>
        <span style={S.leg}><span style={{ ...S.sq, background: "#7C6FD8" }} /> school</span>
      </div>
    </section>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", margin: "0 0 20px" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  title: { font: "600 17px var(--font-sans)", color: "#1F2937", letterSpacing: "-.01em" },
  sub: { font: "400 12.5px var(--font-sans)", color: "#94A3B8", marginTop: 3 },
  muted: { font: "400 13.5px/1.6 var(--font-sans)", color: "#64748B", margin: "6px 0 0" },
  link: { color: "#334EAC", fontWeight: 600, textDecoration: "none" },
  retry: { background: "none", border: "none", color: "#334EAC", font: "inherit", fontWeight: 600, cursor: "pointer", textDecoration: "underline", padding: 0 },
  scroll: { overflowX: "auto", margin: "8px -6px 0" },
  skillLabel: { font: "500 10.5px var(--font-sans)", fill: "#334155" },
  orgLabel: { font: "600 10.5px var(--font-sans)", fill: "#1F2937" },
  meLabel: { font: "700 12px var(--font-sans)", fill: "#fff" },
  legend: { display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10, paddingTop: 10, borderTop: "1px solid #F1F5F9" },
  leg: { display: "inline-flex", alignItems: "center", gap: 6, font: "500 11.5px var(--font-sans)", color: "#64748B" },
  dot: { width: 10, height: 2.5, borderRadius: 2, display: "inline-block" },
  dash: { width: 12, height: 0, borderTop: "1.5px dashed", display: "inline-block" },
  sq: { width: 9, height: 9, borderRadius: 2, display: "inline-block" },
}
