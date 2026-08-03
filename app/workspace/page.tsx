"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"

/* Phase 1 · Module 7 — the Universal Workspace. Renders the capability-composed
 * widget set from /api/workspace. No hardcoded dashboard: what appears is derived
 * from the subject's capabilities + saved layout, each widget backed by real data. */

type Widget = { id: string; title: string; description?: string; size: "sm" | "md" | "lg"; group: string; data: any; unavailable?: boolean }
const tier = (n: number) => (n >= 75 ? "#16A34A" : n >= 55 ? "#6495ED" : n >= 35 ? "#B45309" : "#94A3B8")
const span = (s: string) => (s === "lg" ? "span 2" : "span 1")

export default function WorkspacePage() {
  const [widgets, setWidgets] = useState<Widget[] | null>(null)
  const [state, setState] = useState<"loading" | "anon" | "ready">("loading")

  useEffect(() => {
    fetch("/api/workspace").then((r) => { if (r.status === 401) { setState("anon"); return null } return r.json() })
      .then((d) => { if (d?.widgets) { setWidgets(d.widgets); setState("ready") } }).catch(() => setState("anon"))
  }, [])

  if (state === "loading") return <AppShell title="Workspace"><div style={S.dim}>Composing your workspace…</div></AppShell>
  if (state === "anon") return (
    <AppShell title="Workspace"><div style={S.wrap}><div style={S.card}><h1 style={S.h1}>Workspace</h1><p style={S.muted}>Sign in to see your personalized, capability-composed workspace.</p><Link href="/login?next=/workspace" style={S.cta}>Sign in</Link></div></div></AppShell>
  )

  return (
    <AppShell title="Workspace">
      <div style={S.wrap}>
        <div style={S.head}><h1 style={S.h1}>Workspace</h1><p style={S.sub}>Composed for you from your capabilities — {widgets?.length || 0} widgets</p></div>
        <div style={S.grid}>
          {(widgets || []).map((w) => (
            <div key={w.id} style={{ ...S.widget, gridColumn: span(w.size) }}>
              <div style={S.wTop}><span style={S.wTitle}>{w.title}</span>{w.description && <span style={S.wDesc}>{w.description}</span>}</div>
              <div style={S.wBody}>{w.unavailable ? <span style={S.na}>Temporarily unavailable</span> : renderWidget(w)}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

function renderWidget(w: Widget) {
  const d = w.data || {}
  switch (w.id) {
    case "top-matches":
      return !d.matches?.length ? <Empty t="No strong matches yet" /> : (
        <div style={S.list}>{d.matches.map((m: any) => (
          <Link key={m.id} href={`/jobs/${m.id}`} style={S.jobRow}><span style={S.jobMain}><b>{m.title}</b><span style={S.jobSub}>{m.company}</span></span><span style={{ ...S.score, color: tier(m.overall) }}>{m.overall}%</span></Link>
        ))}</div>
      )
    case "career-readiness":
      return <div style={S.stats}><Stat n={d.archetype || "—"} l="archetype" wide /><Stat n={d.seniority || "—"} l="seniority" /><Stat n={d.demonstrated ?? 0} l="demonstrated" /><Stat n={d.skills ?? 0} l="skills" /></div>
    case "learn-next":
      return !d.skills?.length ? <Empty t="You cover the core skills" /> : <div style={S.chips}>{d.skills.map((s: any) => <span key={s.skill} style={S.chip}>{s.skill} · {s.difficulty}</span>)}</div>
    case "applications":
      return <div><div style={S.big}>{d.total ?? 0}</div><div style={S.chips}>{(d.byStatus || []).map((s: any) => <span key={s.status} style={S.chipMuted}>{s.status.toLowerCase()} {s.count}</span>)}</div></div>
    case "candidates": return <div><div style={S.big}>{d.total ?? 0}</div><div style={S.wDesc}>applicants to your roles</div></div>
    case "ai-ops": return <div style={S.stats}><Stat n={d.aiRuns ?? 0} l="AI runs" /><Stat n={d.indexedDocs ?? 0} l="indexed" /><Stat n={d.events ?? 0} l="events" /></div>
    default: return <pre style={S.pre}>{JSON.stringify(d, null, 1)}</pre>
  }
}
const Stat = ({ n, l, wide }: { n: any; l: string; wide?: boolean }) => (<div style={{ ...S.stat, ...(wide ? { flexBasis: "100%" } : {}) }}><span style={S.statN}>{n}</span><span style={S.statL}>{l}</span></div>)
const Empty = ({ t }: { t: string }) => <span style={S.na}>{t}</span>

const S: Record<string, any> = {
  wrap: { maxWidth: 980, margin: "0 auto", padding: "8px 4px 40px" },
  dim: { padding: 40, textAlign: "center", color: "#64748B", font: "400 14px var(--font-sans)" },
  head: { marginBottom: 16 },
  h1: { font: "700 24px var(--font-sans)", color: "#1F2937", letterSpacing: "-.02em", margin: 0 },
  sub: { font: "400 13px var(--font-sans)", color: "#94A3B8", marginTop: 4 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 },
  widget: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "16px 18px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", minHeight: 120, display: "flex", flexDirection: "column" },
  wTop: { marginBottom: 10 },
  wTitle: { font: "600 15px var(--font-sans)", color: "#1F2937", display: "block" },
  wDesc: { font: "400 12px var(--font-sans)", color: "#94A3B8" },
  wBody: { flex: 1 },
  list: { display: "flex", flexDirection: "column", gap: 7 },
  jobRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "#F7F9FC", border: "1px solid #E9EDF2", borderRadius: 10, padding: "8px 11px", textDecoration: "none" },
  jobMain: { display: "flex", flexDirection: "column", minWidth: 0, font: "600 13px var(--font-sans)", color: "#1F2937" },
  jobSub: { font: "400 12px var(--font-sans)", color: "#94A3B8", fontWeight: 400 },
  score: { font: "700 14px var(--font-sans)" },
  stats: { display: "flex", flexWrap: "wrap", gap: 12 },
  stat: { display: "flex", flexDirection: "column" },
  statN: { font: "700 18px var(--font-sans)", color: "#334EAC" },
  statL: { font: "400 11.5px var(--font-sans)", color: "#94A3B8" },
  big: { font: "700 30px var(--font-sans)", color: "#1F2937", lineHeight: 1 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: { font: "500 12px var(--font-sans)", color: "#334EAC", background: "#EAF1FE", border: "1px solid #DCE8FD", borderRadius: 999, padding: "3px 10px" },
  chipMuted: { font: "500 11.5px var(--font-sans)", color: "#64748B", background: "#F1F5F9", borderRadius: 999, padding: "3px 9px" },
  na: { font: "400 12.5px var(--font-sans)", color: "#94A3B8" },
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "28px 26px", maxWidth: 520, margin: "20px auto" },
  muted: { font: "400 14px/1.6 var(--font-sans)", color: "#64748B", margin: "10px 0 18px" },
  cta: { display: "inline-block", background: "#6495ED", color: "#fff", borderRadius: 11, padding: "10px 18px", font: "600 13.5px var(--font-sans)", textDecoration: "none" },
  pre: { font: "400 11px var(--font-mono, monospace)", color: "#475569", whiteSpace: "pre-wrap", margin: 0 },
}
