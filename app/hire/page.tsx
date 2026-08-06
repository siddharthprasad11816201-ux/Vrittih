"use client"
import { useCallback, useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconUsers, IconPlus, IconZap, IconCheckCircle, IconAlert, IconAward } from "@/components/ui/Icons"

const CURRENCIES = ["CHF", "EUR", "USD", "GBP", "INR"]
const ROLE_TYPES = ["FULLTIME", "CONTRACT", "INTERN", "FREELANCE"]

export default function HirePage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [requests, setRequests] = useState<any[]>([])
  const [isHr, setIsHr] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [f, setF] = useState({ title: "", roleType: "FULLTIME", skills: "", minYears: "3", headcount: "1", seniority: "", budget: "", currency: "CHF", location: "", remote: true, notes: "" })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetch("/api/talent-requests").then(async r => {
      if (r.status === 401) { setState("denied"); return }
      const d = await r.json(); setRequests(d.requests || []); setIsHr(!!d.isHr); setState("ok")
    }).catch(() => setState("denied"))
  }, [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!f.title.trim() || busy) return
    setBusy(true)
    const r = await fetch("/api/talent-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, skills: f.skills.split(",").map(s => s.trim()).filter(Boolean), minYears: Number(f.minYears) || 0, headcount: Number(f.headcount) || 1, budget: f.budget || null }) })
    setBusy(false)
    if (r.ok) { const d = await r.json(); setF({ ...f, title: "", skills: "", notes: "" }); load(); setSel(d.id) }
  }

  if (state === "loading") return <AppShell title="Hire"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Hire"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in to request talent</h1></div></div></AppShell>

  return (
    <AppShell title="Hire">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconUsers size={20} /> Hire — managed talent</h1>
          <p style={S.sub}>Describe what you need. EduRankAI's Enterprise Brain searches the talent pool and returns the best candidates with evidence — why, missing skills, risks, confidence, a salary band and an interview plan. {isHr ? "You are viewing the full fulfilment queue (HR)." : "Our HR team works your requirement end-to-end."}</p>
        </header>

        {/* Requirement intake */}
        <div style={S.card}>
          <div style={S.formGrid}>
            <label style={S.lWide}><span style={S.lbl}>Role *</span><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Backend Engineer" style={S.input} /></label>
            <label><span style={S.lbl}>Type</span><select value={f.roleType} onChange={e => setF({ ...f, roleType: e.target.value })} style={S.input}>{ROLE_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
            <label><span style={S.lbl}>Headcount</span><input type="number" value={f.headcount} onChange={e => setF({ ...f, headcount: e.target.value })} style={S.input} /></label>
            <label style={S.lWide}><span style={S.lbl}>Required skills (comma-separated)</span><input value={f.skills} onChange={e => setF({ ...f, skills: e.target.value })} placeholder="Python, FastAPI, Redis, Docker, AWS" style={S.input} /></label>
            <label><span style={S.lbl}>Min years</span><input type="number" value={f.minYears} onChange={e => setF({ ...f, minYears: e.target.value })} style={S.input} /></label>
            <label><span style={S.lbl}>Seniority</span><input value={f.seniority} onChange={e => setF({ ...f, seniority: e.target.value })} placeholder="Senior" style={S.input} /></label>
            <label><span style={S.lbl}>Budget</span><input type="number" value={f.budget} onChange={e => setF({ ...f, budget: e.target.value })} placeholder="e.g. 2400000" style={S.input} /></label>
            <label><span style={S.lbl}>Currency</span><select value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} style={S.input}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label>
            <label style={S.chk}><input type="checkbox" checked={f.remote} onChange={e => setF({ ...f, remote: e.target.checked })} /> Remote</label>
            <label style={S.lFull}><span style={S.lbl}>Notes (context: startup exp, communication, system design, mentoring, deadline…)</span><textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} rows={2} style={{ ...S.input, resize: "vertical" }} /></label>
          </div>
          <button onClick={create} disabled={busy || !f.title.trim()} style={{ ...S.btnPrimary, opacity: busy || !f.title.trim() ? 0.6 : 1 }}><IconPlus size={15} /> Submit requirement</button>
        </div>

        {/* Requirements list */}
        {requests.length === 0 ? <div style={S.empty}><p style={S.sub}>No requirements yet. Describe one above.</p></div> : (
          <div style={S.grid}>
            {requests.map(r => (
              <button key={r.id} onClick={() => setSel(sel === r.id ? null : r.id)} style={{ ...S.reqCard, ...(sel === r.id ? S.reqCardOn : {}) }}>
                <div style={S.reqTop}><span style={S.reqTitle}>{r.headcount}× {r.title}</span><span style={{ ...S.statusPill, ...statusStyle(r.status) }}>{r.status.replace("_", " ")}</span></div>
                <div style={S.reqMeta}>{r.roleType} · {r.minYears}y+ {r.remote ? "· remote" : ""} {r._count?.candidates ? `· ${r._count.candidates} sourced` : ""}</div>
              </button>
            ))}
          </div>
        )}

        {sel && <RequestDetail id={sel} onChange={load} />}
      </div>
    </AppShell>
  )
}

function RequestDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const [d, setD] = useState<any>(null)
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<string>("")
  const load = useCallback(() => { fetch(`/api/talent-requests/${id}`).then(r => r.json()).then(setD).catch(() => {}) }, [id])
  useEffect(() => { load() }, [load])

  const runShortlist = async () => {
    setRunning(true)
    const r = await fetch(`/api/talent-requests/${id}/shortlist`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
    setRunning(false)
    if (r.ok) { const j = await r.json(); setSummary(j.summary || ""); load(); onChange() }
  }
  const setStage = async (candidateRowId: string, stage: string) => { await fetch(`/api/talent-requests/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidateRowId, stage }) }); load() }

  if (!d || d.error) return <div style={S.detail}><p style={S.sub}>Loading requirement…</p></div>
  const req = d.request
  const verdictColor = (v: string) => v === "supported" ? "var(--v-green)" : v === "refuted" ? "var(--v-red)" : "#b7791f"
  return (
    <div style={S.detail}>
      <div style={S.detailHead}>
        <div><h2 style={S.h2}>{req.headcount}× {req.title}</h2><p style={S.sub}>{(req.skills || []).join(" · ")} · {req.minYears}y+ · {req.roleType}{req.remote ? " · remote" : ""}{req.budget ? ` · ${req.currency} ${Number(req.budget).toLocaleString()}` : ""}</p></div>
        <button onClick={runShortlist} disabled={running} style={{ ...S.btnPrimary, opacity: running ? 0.6 : 1 }}><IconZap size={15} /> {running ? "Searching…" : "Run AI shortlist"}</button>
      </div>
      {summary && <div style={S.aiSummary}><IconZap size={14} /> {summary}</div>}

      {(d.candidates || []).length === 0 ? <p style={S.fine}>No candidates sourced yet — run the AI shortlist.</p> : (
        <div style={S.candList}>
          {d.candidates.map((c: any) => (
            <div key={c.id} style={S.cand}>
              <div style={S.candTop}>
                <div>
                  <span style={S.candName}>{c.user?.name || "Candidate"}</span>
                  {c.user?.headline && <span style={S.candHeadline}> · {c.user.headline}</span>}
                </div>
                <div style={S.candRight}>
                  <span style={{ ...S.verdict, color: verdictColor(c.verdict), borderColor: verdictColor(c.verdict) }}>{c.verdict} · {Math.round((c.score || 0) * 100)}%</span>
                  <select value={c.stage} onChange={e => setStage(c.id, e.target.value)} style={S.stageSel}>{(d.stages || []).map((s: string) => <option key={s}>{s}</option>)}</select>
                </div>
              </div>
              {c.rationale?.why && <p style={S.why}>{c.rationale.why}</p>}
              <div style={S.chips}>
                {(c.rationale?.missing || []).length > 0 && <span style={S.missChip}><IconAlert size={11} /> Missing: {(c.rationale.missing || []).join(", ")}</span>}
                {(c.rationale?.risks || []).slice(0, 2).map((rk: string, i: number) => <span key={i} style={S.riskChip}>{rk}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
      <p style={S.fine}><IconCheckCircle size={12} /> Evidence-based ranking via the Enterprise Brain — every verdict carries why, missing skills, risks and honest confidence. In-house, no external LLM.</p>
    </div>
  )
}

function statusStyle(s: string): any { return s === "DELIVERED" ? { background: "var(--v-green-bg,#e9f9ef)", color: "var(--v-green)" } : s === "CLOSED" ? { background: "var(--v-surface-2)", color: "var(--v-ink-3)" } : s === "IN_PROGRESS" || s === "SHORTLISTED" ? { background: "#fff7e6", color: "#b7791f" } : { background: "var(--v-accent-bg,#eef0fb)", color: "var(--v-accent)" } }

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 1020, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 18 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  h2: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--v-ink)", margin: 0 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 760 },
  fine: { fontSize: 12, color: "var(--v-ink-3)", display: "flex", alignItems: "center", gap: 6, marginTop: 12 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "34px 24px", textAlign: "center" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18, marginBottom: 16 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 14 },
  lWide: { gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 4 },
  lFull: { gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: 4 },
  lbl: { fontSize: 12, color: "var(--v-ink-2)", fontWeight: 500 },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none", width: "100%" },
  chk: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--v-ink)", alignSelf: "end", paddingBottom: 8 },
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12, marginBottom: 16 },
  reqCard: { textAlign: "left", background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 15, cursor: "pointer", fontFamily: "inherit", width: "100%" },
  reqCardOn: { borderColor: "var(--v-accent)", boxShadow: "0 0 0 1px var(--v-accent)" },
  reqTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  reqTitle: { fontWeight: 600, color: "var(--v-ink)", fontSize: 14 },
  reqMeta: { fontSize: 12, color: "var(--v-ink-2)" },
  statusPill: { fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap", textTransform: "capitalize" },
  detail: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 20, marginTop: 8 },
  detailHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 },
  aiSummary: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--v-ink-2)", background: "var(--v-surface-2)", borderRadius: 10, padding: "9px 13px", marginBottom: 14 },
  candList: { display: "flex", flexDirection: "column", gap: 10 },
  cand: { border: "1px solid var(--v-line)", borderRadius: 12, padding: "12px 14px", background: "var(--v-surface)" },
  candTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" },
  candName: { fontWeight: 600, color: "var(--v-ink)", fontSize: 14 },
  candHeadline: { color: "var(--v-ink-2)", fontSize: 13 },
  candRight: { display: "flex", alignItems: "center", gap: 8 },
  verdict: { fontSize: 11, fontWeight: 700, border: "1px solid", borderRadius: 999, padding: "2px 9px", textTransform: "capitalize", whiteSpace: "nowrap" },
  stageSel: { border: "1px solid var(--v-line)", borderRadius: 7, padding: "4px 7px", fontSize: 11.5, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)" },
  why: { fontSize: 12.5, color: "var(--v-ink-2)", lineHeight: 1.5, margin: "8px 0 0" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  missChip: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#b7791f", background: "#fff7e6", borderRadius: 999, padding: "2px 9px" },
  riskChip: { fontSize: 11, color: "var(--v-ink-2)", background: "var(--v-surface-2)", borderRadius: 999, padding: "2px 9px" },
}
