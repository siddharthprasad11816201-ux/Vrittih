"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconActivity, IconCheckCircle, IconZap } from "@/components/ui/Icons"

const statusColor = (s: string) => s === "PUBLISHED" ? "var(--v-green)" : s === "UNDER_REVIEW" ? "var(--v-amber)" : s === "REJECTED" ? "var(--v-red)" : "var(--v-ink-3)"

export default function ResearchPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [tab, setTab] = useState<"outputs" | "review" | "assistant">("outputs")
  const [d, setD] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState("")
  const [no, setNo] = useState({ title: "", kind: "paper", abstract: "", venue: "", competencies: "" })
  const [q, setQ] = useState(""); const [asst, setAsst] = useState<any>(null)

  async function load() { try { const r = await fetch("/api/research"); if (r.status === 401) { setState("denied"); return } setD(await r.json()); setState("ok") } catch { setState("denied") } }
  useEffect(() => { load() }, [])
  async function post(body: any) { setBusy("x"); setErr(""); try { const d = await fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()); if (d.error) setErr(d.error); await load(); return d } finally { setBusy(null) } }
  async function createOutput() { if (!no.title.trim()) { setErr("Title required."); return } const d = await post({ action: "create-output", ...no, competencies: no.competencies.split(",").map(s => s.trim()).filter(Boolean) }); if (d?.success) setNo({ title: "", kind: "paper", abstract: "", venue: "", competencies: "" }) }
  async function review(outputId: string, recommendation: string) { const score = Number(window.prompt("Score 0-10 (optional):") || "") || undefined; await post({ action: "review", outputId, recommendation, score }) }
  async function askAssistant() { if (!q.trim()) return; setBusy("asst"); try { setAsst(await fetch("/api/research-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) }).then(r => r.json())) } finally { setBusy(null) } }

  if (state === "loading") return <AppShell title="Research"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Research"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in</h1></div></div></AppShell>

  const m = d?.metrics || {}
  return (
    <AppShell title="Research">
      <div style={S.page}>
        <header style={S.head}><h1 style={S.h1}><IconActivity size={20} /> Research & Innovation</h1><p style={S.sub}>Publish outputs, peer‑review others' work, and track citations — all feeding the same competency graph. Research outputs, once published, become research‑competency evidence.</p></header>
        {err && <div style={S.err}>{err}</div>}

        <div style={S.kpis}>
          <Kpi n={m.outputs} l="Outputs" /><Kpi n={m.totalCitations} l="Citations" /><Kpi n={m.hIndex} l="h-index" /><Kpi n={m.i10Index} l="i10" />
          {d?.org && <><Kpi n={d.org.published} l="Org published" /><Kpi n={d.org.hIndex} l="Org h-index" /></>}
        </div>

        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(tab === "outputs" ? S.tabOn : {}) }} onClick={() => setTab("outputs")}>My outputs ({d?.outputs?.length || 0})</button>
          <button style={{ ...S.tab, ...(tab === "review" ? S.tabOn : {}) }} onClick={() => setTab("review")}>Review queue ({d?.reviewQueue?.length || 0})</button>
          <button style={{ ...S.tab, ...(tab === "assistant" ? S.tabOn : {}) }} onClick={() => setTab("assistant")}>Research assistant</button>
        </div>

        {tab === "outputs" && (
          <div>
            <div style={S.card}>
              <div style={S.cardH}>New research output</div>
              <div style={S.grid2}>
                <input style={S.input} placeholder="Title" value={no.title} onChange={e => setNo({ ...no, title: e.target.value })} />
                <select style={S.input} value={no.kind} onChange={e => setNo({ ...no, kind: e.target.value })}>{(d?.kinds || ["paper"]).map((k: string) => <option key={k} value={k}>{k}</option>)}</select>
                <input style={S.input} placeholder="Venue (optional)" value={no.venue} onChange={e => setNo({ ...no, venue: e.target.value })} />
                <input style={S.input} placeholder="Competency keys (comma-sep)" value={no.competencies} onChange={e => setNo({ ...no, competencies: e.target.value })} />
              </div>
              <textarea style={{ ...S.input, marginTop: 10 }} rows={2} placeholder="Abstract" value={no.abstract} onChange={e => setNo({ ...no, abstract: e.target.value })} />
              <button style={{ ...S.cta, marginTop: 10 }} onClick={createOutput} disabled={busy === "x"}>Create draft</button>
            </div>
            <div style={S.list}>
              {(d?.outputs || []).map((o: any) => (
                <div key={o.id} style={S.row}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.rowT}>{o.title} <span style={S.kind}>{o.kind}</span></div>
                    <div style={S.rowS}>{o.venue || "—"} · {o.citations} citations{o.reviewSummary && o.reviewSummary.count ? ` · reviews: ${o.reviewSummary.recommendation}` : ""}</div>
                  </div>
                  <span style={{ ...S.badge, color: "#fff", background: statusColor(o.status) }}>{o.status.replace("_", " ")}</span>
                  {o.status === "DRAFT" && <button style={S.mini} disabled={busy === "x"} onClick={() => post({ action: "output-action", outputId: o.id, op: "submit" })}>Submit for review</button>}
                  {d?.isEditor && o.status === "UNDER_REVIEW" && <><button style={S.mini} onClick={() => post({ action: "output-action", outputId: o.id, op: "publish" })}>Publish</button><button style={S.ghost} onClick={() => post({ action: "output-action", outputId: o.id, op: "reject" })}>Reject</button></>}
                </div>
              ))}
              {(d?.outputs || []).length === 0 && <div style={S.empty}><p style={S.sub}>No outputs yet.</p></div>}
            </div>
          </div>
        )}

        {tab === "review" && (
          <div style={S.list}>
            {(d?.reviewQueue || []).length === 0 ? <div style={S.empty}><p style={S.sub}>Nothing to review right now.</p></div> : d.reviewQueue.map((o: any) => (
              <div key={o.id} style={S.row}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={S.rowT}>{o.title} <span style={S.kind}>{o.kind}</span></div><div style={S.rowS}>{o.author ? `by ${o.author}` : ""}{o.abstract ? ` · ${o.abstract.slice(0, 80)}…` : ""}</div></div>
                {(d?.recs || ["ACCEPT", "MINOR", "MAJOR", "REJECT"]).map((r: string) => <button key={r} style={S.recBtn} disabled={busy === "x"} onClick={() => review(o.id, r)}>{r}</button>)}
              </div>
            ))}
            <p style={S.fine}>Peer review is confidential and conflict‑of‑interest guarded — you can't review your own work; a human editor makes the final call.</p>
          </div>
        )}

        {tab === "assistant" && (
          <div>
            <div style={S.searchRow}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Find related published work by topic…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") askAssistant() }} />
              <button style={S.cta} onClick={askAssistant} disabled={busy === "asst"}><IconZap size={15} /> Search</button>
            </div>
            {asst && (asst.literature?.length === 0 ? <div style={S.empty}><p style={S.sub}>No related published outputs indexed yet.</p></div> : (
              <div style={S.list}>{(asst.literature || []).map((l: any) => (<div key={l.id} style={S.row}><div style={{ flex: 1 }}><div style={S.rowT}>{l.title}</div><div style={S.rowS}>{l.kind || "output"}{l.venue ? ` · ${l.venue}` : ""} · relevance {l.score}%</div></div></div>))}</div>
            ))}
            {asst?.note && <p style={S.fine}>{asst.note}</p>}
          </div>
        )}
      </div>
    </AppShell>
  )
}
function Kpi({ n, l }: any) { return <div style={S.kpi}><div style={S.kpiN}>{n == null ? "—" : n}</div><div style={S.kpiL}>{l}</div></div> }
const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 880, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 14 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 640 },
  err: { background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#B91C1C", margin: "12px 0" },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "36px 24px", textAlign: "center" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, margin: "14px 0" },
  kpi: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "12px 14px" },
  kpiN: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--v-ink)" },
  kpiL: { fontSize: 11.5, color: "var(--v-ink-2)", marginTop: 2 },
  tabs: { display: "flex", gap: 4, background: "var(--v-surface-2)", padding: 4, borderRadius: 12, marginBottom: 14, width: "fit-content", flexWrap: "wrap" },
  tab: { padding: "8px 15px", border: "none", background: "none", borderRadius: 9, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--v-ink-2)", cursor: "pointer" },
  tabOn: { background: "var(--v-surface)", color: "var(--v-ink)", boxShadow: "var(--v-shadow-sm)" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 16, marginBottom: 14 },
  cardH: { fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--v-ink)", marginBottom: 12 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, color: "var(--v-ink)", outline: "none", fontFamily: "inherit", width: "100%", background: "var(--v-surface)" },
  cta: { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: { display: "flex", alignItems: "center", gap: 10, background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "11px 14px", boxShadow: "var(--v-shadow-sm)", flexWrap: "wrap" },
  rowT: { fontSize: 14, fontWeight: 600, color: "var(--v-ink)" },
  kind: { fontSize: 11, color: "var(--v-ink-3)", fontWeight: 500 },
  rowS: { fontSize: 12, color: "var(--v-ink-2)", marginTop: 2 },
  badge: { fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" },
  mini: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 9, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  ghost: { background: "var(--v-surface)", color: "var(--v-ink)", border: "1px solid var(--v-line)", borderRadius: 9, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  recBtn: { background: "var(--v-surface-2)", color: "var(--v-ink)", border: "1px solid var(--v-line)", borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  searchRow: { display: "flex", gap: 8, marginBottom: 14 },
  fine: { fontSize: 11.5, color: "var(--v-ink-3)", lineHeight: 1.5, marginTop: 10 },
}
