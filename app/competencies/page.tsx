"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconActivity, IconTarget, IconCheckCircle } from "@/components/ui/Icons"

const KIND_LABEL: Record<string, string> = {
  technical: "Technical", behavioural: "Behavioural", leadership: "Leadership", research: "Research",
  teaching: "Teaching", communication: "Communication", innovation: "Innovation", future: "Future skills",
}
// Self-assessment can indicate up to "Proficient" only — Advanced/Expert require
// verified evidence (assessments/projects), enforced server-side (0.5 cap).
const BAND_LEVELS = [
  { v: 0, label: "—" }, { v: 0.1, label: "Novice" }, { v: 0.3, label: "Developing" }, { v: 0.5, label: "Proficient" },
]
const bandColor = (b: string) => b === "Expert" ? "var(--v-green)" : b === "Advanced" ? "var(--v-accent)" : b === "Proficient" ? "var(--v-blue)" : b === "Developing" ? "var(--v-amber)" : "var(--v-ink-3)"

export default function CompetenciesPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [tab, setTab] = useState<"me" | "org">("me")
  const [data, setData] = useState<any>(null)
  const [heat, setHeat] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [canOrg, setCanOrg] = useState(false)

  async function load() {
    try {
      const r = await fetch("/api/competencies")
      if (r.status === 401) { setState("denied"); return }
      const d = await r.json(); setData(d); setState("ok")
    } catch { setState("denied") }
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    fetch("/api/competencies/heatmap").then(async r => { if (r.ok) { setCanOrg(true); setHeat(await r.json()) } }).catch(() => {})
  }, [])

  async function selfAssess(key: string, proficiency: number) {
    setBusy(key)
    try { await fetch("/api/competencies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "self", competencyKey: key, proficiency }) }); await load() } finally { setBusy(null) }
  }
  async function seed() { setBusy("seed"); try { await fetch("/api/competencies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "seed" }) }); await load() } finally { setBusy(null) } }

  if (state === "loading") return <AppShell title="Competencies"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Competencies"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in to view competencies</h1></div></div></AppShell>

  const lib = data?.library || []
  const byKind: Record<string, any[]> = {}
  for (const c of lib) (byKind[c.kind] = byKind[c.kind] || []).push(c)

  return (
    <AppShell title="Competencies">
      <div style={S.page}>
        <header style={S.head}>
          <div>
            <h1 style={S.h1}><IconActivity size={20} /> Competency framework</h1>
            <p style={S.sub}>The capability spine — technical, behavioural, leadership, research and future competencies, mapped to the same skill graph you're hired on. Record your level; evidence from assessments, courses and projects strengthens it over time.</p>
          </div>
          {data?.canAuthor && !data?.seeded && <button style={S.cta} onClick={seed} disabled={busy === "seed"}>{busy === "seed" ? "Seeding…" : "Seed default library"}</button>}
        </header>

        {canOrg && (
          <div style={S.tabs}>
            <button style={{ ...S.tab, ...(tab === "me" ? S.tabOn : {}) }} onClick={() => setTab("me")}>My competencies ({data?.myCount || 0})</button>
            <button style={{ ...S.tab, ...(tab === "org" ? S.tabOn : {}) }} onClick={() => setTab("org")}>Org capability</button>
          </div>
        )}

        {tab === "me" && (
          lib.length === 0 ? <div style={S.empty}><p style={S.sub}>No competencies defined yet{data?.canAuthor ? " — seed the default library to begin." : "."}</p></div> : (
            <div>
              {Object.keys(byKind).map(kind => (
                <div key={kind} style={{ marginBottom: 22 }}>
                  <h2 style={S.h2}>{KIND_LABEL[kind] || kind}</h2>
                  <div style={S.grid}>
                    {byKind[kind].map((c: any) => (
                      <div key={c.key} style={S.card}>
                        <div style={S.cardTop}>
                          <span style={S.cLabel}>{c.label}</span>
                          <span style={{ ...S.band, color: c.myProficiency > 0 ? bandColor(c.band) : "var(--v-ink-3)" }}>{c.myProficiency > 0 ? c.band : "Not set"}</span>
                        </div>
                        <div style={S.bar}><div style={{ ...S.barFill, width: `${Math.round((c.myProficiency || 0) * 100)}%`, background: bandColor(c.band) }} /></div>
                        {c.skills?.length > 0 && <div style={S.skills}>{c.skills.slice(0, 4).map((s: string) => <span key={s} style={S.skill}>{s}</span>)}</div>}
                        <select style={S.sel} value={BAND_LEVELS.reduce((best, b) => Math.abs(b.v - (c.myProficiency || 0)) < Math.abs(best.v - (c.myProficiency || 0)) ? b : best, BAND_LEVELS[0]).v} disabled={busy === c.key} onChange={e => selfAssess(c.key, Number(e.target.value))}>
                          {BAND_LEVELS.map(b => <option key={b.v} value={b.v}>{b.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "org" && canOrg && (
          <div style={S.card}>
            <h2 style={{ ...S.h2, marginTop: 0 }}><IconTarget size={16} /> Organization capability heatmap</h2>
            <p style={S.sub}>{heat?.note || `Average proficiency across ${heat?.stats?.peopleWithData || 0} people — weakest first (where to invest).`}</p>
            <div style={{ marginTop: 12 }}>
              {(heat?.cells || []).map((c: any) => (
                <div key={c.key} style={S.heatRow}>
                  <span style={S.heatLbl}>{c.label} <em style={S.heatKind}>{KIND_LABEL[c.kind] || c.kind}</em></span>
                  <span style={S.heatBar}><span style={{ ...S.heatFill, width: `${Math.round(c.avg * 100)}%`, background: bandColor(c.band) }} /></span>
                  <span style={S.heatN}>{Math.round(c.avg * 100)}% <em style={S.heatCount}>· {c.count}</em></span>
                </div>
              ))}
              {(heat?.cells || []).length === 0 && <p style={S.subS}>No data yet.</p>}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 900, margin: "0 auto", paddingBottom: 60 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 18 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  h2: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--v-ink)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 640 },
  subS: { fontSize: 12.5, color: "var(--v-ink-3)" },
  cta: { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "44px 24px", textAlign: "center" },
  tabs: { display: "flex", gap: 4, background: "var(--v-surface-2)", padding: 4, borderRadius: 12, marginBottom: 18, width: "fit-content" },
  tab: { padding: "8px 16px", border: "none", background: "none", borderRadius: 9, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--v-ink-2)", cursor: "pointer" },
  tabOn: { background: "var(--v-surface)", color: "var(--v-ink)", boxShadow: "var(--v-shadow-sm)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 15, boxShadow: "var(--v-shadow-sm)" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  cLabel: { fontSize: 14, fontWeight: 600, color: "var(--v-ink)" },
  band: { fontSize: 11.5, fontWeight: 700 },
  bar: { height: 7, background: "var(--v-surface-2)", borderRadius: 999, overflow: "hidden", margin: "8px 0 10px" },
  barFill: { height: "100%", borderRadius: 999 },
  skills: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 },
  skill: { fontSize: 11, color: "var(--v-ink-2)", background: "var(--v-surface-2)", padding: "2px 8px", borderRadius: 6 },
  sel: { width: "100%", border: "1px solid var(--v-line)", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, background: "var(--v-surface)", color: "var(--v-ink)", fontFamily: "inherit" },
  heatRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 9 },
  heatLbl: { width: 190, fontSize: 13, color: "var(--v-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  heatKind: { fontStyle: "normal", fontSize: 10.5, color: "var(--v-ink-3)", marginLeft: 4 },
  heatBar: { flex: 1, height: 12, background: "var(--v-surface-2)", borderRadius: 999, overflow: "hidden" },
  heatFill: { display: "block", height: "100%", borderRadius: 999 },
  heatN: { width: 70, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: "var(--v-ink)", fontVariantNumeric: "tabular-nums" },
  heatCount: { fontStyle: "normal", fontWeight: 400, color: "var(--v-ink-3)" },
}
