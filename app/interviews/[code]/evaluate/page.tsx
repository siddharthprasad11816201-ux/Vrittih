"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
import { IconCheckCircle, IconArrowRight, IconAlert } from "@/components/ui/Icons"

const RECS = [
  { v: "STRONG_NO", label: "Strong no" }, { v: "NO", label: "No" },
  { v: "YES", label: "Yes" }, { v: "STRONG_YES", label: "Strong yes" },
]
const RATING_LABEL = ["", "Poor", "Fair", "Good", "Excellent"]

export default function EvaluatePage() {
  const params = useParams(); const router = useRouter()
  const code = params.code as string
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [rec, setRec] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const [denied, setDenied] = useState(false)
  const [intel, setIntel] = useState<any>(null)   // §32 candidate verification intelligence

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/interviews/${code}/scorecard`)
      if (r.status === 403) { setDenied(true); setLoading(false); return }
      if (r.status === 401) { router.push("/login"); return }
      const d = await r.json()
      setData(d)
      if (d.myScorecard) { setRatings(d.myScorecard.ratings || {}); setRec(d.myScorecard.recommendation || ""); setNotes(d.myScorecard.notes || "") }
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    fetch(`/api/interviews/${code}/intel`).then(r => (r.ok ? r.json() : null)).then(d => setIntel(d)).catch(() => {})
  }, [code])

  async function submit() {
    if (!rec) { setErr("Choose an overall recommendation."); return }
    if (!Object.keys(ratings).length) { setErr("Rate at least one competency."); return }
    setSaving(true); setErr("")
    try {
      const d = await fetch(`/api/interviews/${code}/scorecard`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings, recommendation: rec, notes }),
      }).then(r => r.json())
      if (d.error) setErr(d.error); else await load()
    } catch { setErr("Network error.") } finally { setSaving(false) }
  }

  if (denied) return <AppShell title="Evaluate"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Not authorized</h1><p style={S.sub}>Only interviewers on this panel can evaluate this candidate.</p></div></div></AppShell>
  if (loading) return <AppShell title="Evaluate"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>

  const comps = data?.competencies || []
  const panel = data?.panel

  return (
    <AppShell title="Evaluate">
      <div style={S.page}>
        <h1 style={S.h1}>Interview scorecard</h1>
        <p style={S.sub}>Rate each competency on the evidence you observed, then give an overall recommendation. Your ratings combine into an explainable panel decision.</p>
        {err && <div style={S.err}>{err}</div>}

        {intel?.available && (
          <div style={S.card}>
            <div style={S.cardH}>Candidate intelligence <span style={S.count}>evidence-based</span></div>
            <p style={S.sub2}>For {intel.jobTitle} · {intel.candidateSkills} skills on file · {intel.seniority} level. Use these to <b>verify</b> claims — never to trick.</p>
            {intel.strongest?.length ? <div style={S.iSec}><div style={S.iLbl}>Strongest — demonstrated in their experience</div><div style={S.iChips}>{intel.strongest.map((s: string) => <span key={s} style={S.iChipGood}>{s}</span>)}</div></div> : null}
            {intel.unverified?.length ? <div style={S.iSec}><div style={S.iLbl}>Listed but not evidenced — probe these</div><div style={S.iChips}>{intel.unverified.map((u: any) => <span key={u.skill} style={S.iChipWarn} title={u.reason}>{u.skill}</span>)}</div></div> : null}
            {intel.gaps?.length ? <div style={S.iSec}><div style={S.iLbl}>Must-have gaps for this role</div><div style={S.iChips}>{intel.gaps.map((g: string) => <span key={g} style={S.iChipGap}>{g}</span>)}</div></div> : null}
            {intel.risks?.length ? <div style={S.iSec}>{intel.risks.map((r: string, i: number) => <div key={i} style={S.iRisk}><IconAlert size={13} /> <span>{r}</span></div>)}</div> : null}
            {intel.questions?.length ? <div style={S.iSec}><div style={S.iLbl}>Recommended verification questions</div>{intel.questions.map((q: any, i: number) => <div key={i} style={S.iQ}><span style={S.iQTag}>{q.purpose}</span> {q.question}</div>)}</div> : null}
          </div>
        )}
        {intel && !intel.available && intel.reason ? <div style={S.card}><div style={S.cardH}>Candidate intelligence</div><p style={S.sub2}>{intel.reason}</p></div> : null}

        <div style={S.card}>
          <div style={S.cardH}>Your evaluation</div>
          {comps.map((c: any) => (
            <div key={c.key} style={S.comp}>
              <div style={S.compTop}><span style={S.compLbl}>{c.label}</span><span style={S.compVal}>{ratings[c.key] ? RATING_LABEL[ratings[c.key]] : "—"}</span></div>
              <div style={S.scale}>
                {[1, 2, 3, 4].map(n => (
                  <button key={n} onClick={() => setRatings(r => ({ ...r, [c.key]: n }))}
                    style={{ ...S.dot, ...(ratings[c.key] === n ? S.dotOn : {}), ...(ratings[c.key] && ratings[c.key] >= n ? S.dotFill : {}) }} aria-label={`${c.label} ${RATING_LABEL[n]}`}>{n}</button>
                ))}
              </div>
            </div>
          ))}
          <div style={S.recRow}>
            <span style={S.compLbl}>Overall recommendation</span>
            <div style={S.recBtns}>
              {RECS.map(r => <button key={r.v} onClick={() => setRec(r.v)} style={{ ...S.recBtn, ...(rec === r.v ? S.recOn : {}) }}>{r.label}</button>)}
            </div>
          </div>
          <textarea style={S.notes} rows={3} placeholder="Evidence & notes (what you observed)…" value={notes} onChange={e => setNotes(e.target.value)} />
          <button style={S.submit} onClick={submit} disabled={saving}><IconCheckCircle size={15} /> {saving ? "Saving…" : data?.myScorecard ? "Update scorecard" : "Submit scorecard"}</button>
        </div>

        {panel && (
          <div style={S.card}>
            <div style={S.cardH}>Panel decision <span style={S.count}>{panel.panelSize} evaluation{panel.panelSize > 1 ? "s" : ""}</span></div>
            <div style={S.panelTop}>
              <div>
                <div style={{ ...S.decision, color: panel.decision === "advance" ? "var(--v-green)" : panel.decision === "reject" ? "var(--v-red)" : "var(--v-amber)" }}>{panel.decision.toUpperCase()}</div>
                <div style={S.sub2}>Consensus {Math.round(panel.overall.consensus * 100)}% · confidence {Math.round(panel.confidence * 100)}%</div>
              </div>
            </div>
            <div style={S.pc}>
              {panel.perCompetency.map((m: any) => (
                <div key={m.key} style={S.pcRow}><span style={S.pcLbl}>{m.label}</span><span style={S.pcVal}>{m.mean.toFixed(1)}/4{m.spread > 0.9 ? <em style={S.spread}> · split</em> : null}</span></div>
              ))}
            </div>
            {panel.biasSignals?.length > 0 && (
              <div style={S.signals}>
                {panel.biasSignals.map((s: any, i: number) => (
                  <div key={i} style={{ ...S.signal, borderColor: s.severity === "high" ? "var(--v-red)" : s.severity === "medium" ? "var(--v-amber)" : "var(--v-line)" }}>
                    <IconAlert size={13} /> <span>{s.note}</span>
                  </div>
                ))}
              </div>
            )}
            {data?.canManage && data.scorecards?.length > 0 && (
              <div style={S.raters}>
                {data.scorecards.map((c: any) => (
                  <div key={c.panelistId} style={S.rater}><span style={S.raterName}>{c.panelistName || "Panelist"}</span><span style={S.raterRec}>{c.recommendation.replace("_", " ").toLowerCase()}</span></div>
                ))}
              </div>
            )}
          </div>
        )}
        <button style={S.back} onClick={() => router.push("/interviews")}>Back to interviews <IconArrowRight size={14} /></button>
      </div>
    </AppShell>
  )
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 640, margin: "0 auto", paddingBottom: 60 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0 },
  sub: { fontSize: 14, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 18px" },
  sub2: { fontSize: 12.5, color: "var(--v-ink-2)", marginTop: 3 },
  err: { background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#B91C1C", marginBottom: 14 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "44px 24px", textAlign: "center" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18, marginBottom: 14, boxShadow: "var(--v-shadow-sm)" },
  cardH: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--v-ink)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 },
  count: { fontSize: 11.5, fontWeight: 700, color: "var(--v-accent)", background: "var(--v-accent-soft)", padding: "1px 8px", borderRadius: 999 },
  comp: { marginBottom: 14 },
  compTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 },
  compLbl: { fontSize: 13.5, fontWeight: 600, color: "var(--v-ink)" },
  compVal: { fontSize: 12.5, color: "var(--v-ink-2)" },
  scale: { display: "flex", gap: 6 },
  dot: { flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid var(--v-line)", background: "var(--v-surface)", color: "var(--v-ink-3)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  dotOn: { borderColor: "var(--v-accent)" },
  dotFill: { background: "var(--v-accent-soft)", color: "var(--v-accent-2)", borderColor: "var(--v-accent)" },
  recRow: { marginTop: 4, marginBottom: 12 },
  recBtns: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" },
  recBtn: { flex: 1, minWidth: 72, padding: "9px 8px", borderRadius: 9, border: "1px solid var(--v-line)", background: "var(--v-surface)", color: "var(--v-ink-2)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  recOn: { borderColor: "var(--v-accent)", background: "var(--v-accent-soft)", color: "var(--v-accent-2)" },
  notes: { width: "100%", border: "1px solid var(--v-line)", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", outline: "none", resize: "vertical", marginBottom: 12 },
  submit: { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 11, padding: "11px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  panelTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  decision: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-.01em" },
  pc: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 },
  pcRow: { display: "flex", justifyContent: "space-between", fontSize: 13 },
  pcLbl: { color: "var(--v-ink-2)" },
  pcVal: { fontWeight: 600, color: "var(--v-ink)", fontVariantNumeric: "tabular-nums" },
  spread: { fontStyle: "normal", color: "var(--v-amber)", fontWeight: 600 },
  signals: { display: "flex", flexDirection: "column", gap: 8 },
  signal: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--v-ink-2)", lineHeight: 1.5, padding: "9px 11px", border: "1px solid var(--v-line)", borderLeftWidth: 3, borderRadius: 8, background: "var(--v-surface-2)" },
  raters: { display: "flex", flexDirection: "column", gap: 5, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--v-line-2)" },
  rater: { display: "flex", justifyContent: "space-between", fontSize: 12.5 },
  raterName: { color: "var(--v-ink-2)" },
  raterRec: { fontWeight: 600, color: "var(--v-ink)", textTransform: "capitalize" },
  back: { display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--v-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  iSec: { marginTop: 12 },
  iLbl: { fontSize: 11.5, fontWeight: 700, color: "var(--v-ink-3)", textTransform: "uppercase" as const, letterSpacing: ".04em", marginBottom: 7 },
  iChips: { display: "flex", flexWrap: "wrap" as const, gap: 6 },
  iChipGood: { background: "#DCFCE7", color: "#047857", borderRadius: 999, padding: "3px 10px", fontSize: 12.5, fontWeight: 600 },
  iChipWarn: { background: "#FEF3C7", color: "#B45309", borderRadius: 999, padding: "3px 10px", fontSize: 12.5, fontWeight: 600, cursor: "help" },
  iChipGap: { background: "#FEE2E2", color: "#B91C1C", borderRadius: 999, padding: "3px 10px", fontSize: 12.5, fontWeight: 600 },
  iRisk: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "var(--v-ink-2)", lineHeight: 1.5, padding: "9px 11px", border: "1px solid var(--v-amber)", borderRadius: 8, background: "var(--v-surface-2)", marginBottom: 6 },
  iQ: { fontSize: 13, color: "var(--v-ink)", lineHeight: 1.55, padding: "8px 0", borderBottom: "1px solid var(--v-line-2)" },
  iQTag: { fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "var(--v-accent)", background: "var(--v-accent-soft)", borderRadius: 5, padding: "1px 6px", marginRight: 7 },
}
