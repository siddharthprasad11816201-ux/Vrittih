"use client"
import { useCallback, useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconTarget, IconPlus, IconZap, IconCheckCircle, IconAlert } from "@/components/ui/Icons"

const TYPES = ["FULLTIME", "INTERN", "CONTRACT", "FREELANCE"]

export default function GetPlacedPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [requests, setRequests] = useState<any[]>([])
  const [match, setMatch] = useState<any>(null)
  const [f, setF] = useState({ desiredType: "FULLTIME", targetRoles: "", skills: "", location: "", remote: true, availability: "", notes: "" })
  const [busy, setBusy] = useState(false)

  const loadMatch = useCallback(() => { fetch("/api/placement-requests/match").then(r => r.ok ? r.json() : null).then(x => x && setMatch(x)).catch(() => {}) }, [])
  const load = useCallback(() => {
    fetch("/api/placement-requests").then(async r => {
      if (r.status === 401) { setState("denied"); return }
      setRequests((await r.json()).requests || []); setState("ok"); loadMatch()
    }).catch(() => setState("denied"))
  }, [loadMatch])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (busy) return; setBusy(true)
    const r = await fetch("/api/placement-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, targetRoles: f.targetRoles.split(",").map(s => s.trim()).filter(Boolean), skills: f.skills.split(",").map(s => s.trim()).filter(Boolean) }) })
    setBusy(false)
    if (r.ok) { setF({ ...f, targetRoles: "", skills: "", notes: "" }); load() }
  }

  if (state === "loading") return <AppShell title="Get placed"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Get placed"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in to get placed</h1></div></div></AppShell>

  const opps = (match?.opportunities || [])
  const vColor = (v: string) => v === "supported" ? "var(--v-green)" : v === "uncertain" ? "#b7791f" : "var(--v-ink-3)"
  return (
    <AppShell title="Get placed">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconTarget size={20} /> Get placed</h1>
          <p style={S.sub}>Tell us the role you want — intern, full-time, contract or freelance — and our team works your placement end to end. The Enterprise Brain matches you to open employer requirements with the reasoning shown. In-house, no external LLM.</p>
        </header>

        {/* Intent intake */}
        <div style={S.card}>
          <div style={S.formGrid}>
            <label><span style={S.lbl}>I want</span><select value={f.desiredType} onChange={e => setF({ ...f, desiredType: e.target.value })} style={S.input}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
            <label style={S.wide}><span style={S.lbl}>Target roles (comma-separated)</span><input value={f.targetRoles} onChange={e => setF({ ...f, targetRoles: e.target.value })} placeholder="AI Engineer, Backend Engineer" style={S.input} /></label>
            <label style={S.wide}><span style={S.lbl}>Your skills (comma-separated)</span><input value={f.skills} onChange={e => setF({ ...f, skills: e.target.value })} placeholder="Python, PyTorch, FastAPI" style={S.input} /></label>
            <label><span style={S.lbl}>Location</span><input value={f.location} onChange={e => setF({ ...f, location: e.target.value })} placeholder="Zürich / Remote" style={S.input} /></label>
            <label><span style={S.lbl}>Availability</span><input value={f.availability} onChange={e => setF({ ...f, availability: e.target.value })} placeholder="Immediate / 30 days" style={S.input} /></label>
            <label style={S.chk}><input type="checkbox" checked={f.remote} onChange={e => setF({ ...f, remote: e.target.checked })} /> Open to remote</label>
            <label style={S.full}><span style={S.lbl}>Notes</span><textarea value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} rows={2} style={{ ...S.input, resize: "vertical" }} /></label>
          </div>
          <button onClick={submit} disabled={busy} style={{ ...S.btnPrimary, opacity: busy ? 0.6 : 1 }}><IconPlus size={15} /> Request placement</button>
        </div>

        {requests.length > 0 && (
          <div style={S.myRow}>
            {requests.map(r => <span key={r.id} style={S.myChip}>{r.desiredType} · <b style={{ color: r.status === "PLACED" ? "var(--v-green)" : "var(--v-ink)" }}>{r.status}</b></span>)}
          </div>
        )}

        {/* AI-matched opportunities */}
        <div style={S.matchHead}>
          <h2 style={S.h2}><IconZap size={16} /> Opportunities matched to you</h2>
          {match?.summary && <span style={S.sub}>{match.summary}</span>}
        </div>
        {opps.length === 0 ? <div style={S.empty}><p style={S.sub}>No matches yet — add your skills above so the Brain can match you to open requirements.</p></div> : (
          <div style={S.list}>
            {opps.map((o: any) => (
              <div key={o.requestId} style={S.opp}>
                <div style={S.oppTop}>
                  <span style={S.oppTitle}>{o.title} <span style={S.oppType}>· {o.roleType}{o.remote ? " · remote" : ""}</span></span>
                  <span style={{ ...S.verdict, color: vColor(o.verdict), borderColor: vColor(o.verdict) }}>{o.verdict === "supported" ? "strong fit" : o.verdict} · {Math.round((o.confidence || 0) * 100)}%</span>
                </div>
                <p style={S.why}>{o.why}</p>
                <div style={S.chips}>
                  {(o.matched || []).slice(0, 6).map((s: string) => <span key={s} style={S.okChip}><IconCheckCircle size={11} /> {s}</span>)}
                  {(o.missing || []).length > 0 && <span style={S.gapChip}><IconAlert size={11} /> to learn: {(o.missing || []).slice(0, 4).join(", ")}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <p style={S.fine}>Matched by the Enterprise Brain from your real skills + experience vs open requirements — every match shows why, your confidence, and the skills to close. Guidance to act on, never a gate.</p>
      </div>
    </AppShell>
  )
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 940, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 16 }, h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  h2: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 7 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 760 },
  fine: { fontSize: 12, color: "var(--v-ink-3)", lineHeight: 1.5, marginTop: 14 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "32px 24px", textAlign: "center" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18, marginBottom: 14 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 14 },
  wide: { gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 4 }, full: { gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: 4 },
  lbl: { fontSize: 12, color: "var(--v-ink-2)", fontWeight: 500 },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none", width: "100%" },
  chk: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--v-ink)", alignSelf: "end", paddingBottom: 8 },
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  myRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  myChip: { fontSize: 12.5, color: "var(--v-ink-2)", background: "var(--v-surface-2)", borderRadius: 999, padding: "5px 12px" },
  matchHead: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, margin: "6px 0 12px" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  opp: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "13px 15px" },
  oppTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" },
  oppTitle: { fontWeight: 600, color: "var(--v-ink)", fontSize: 14.5 }, oppType: { color: "var(--v-ink-2)", fontSize: 12.5, fontWeight: 400 },
  verdict: { fontSize: 11, fontWeight: 700, border: "1px solid", borderRadius: 999, padding: "2px 9px", textTransform: "capitalize", whiteSpace: "nowrap" },
  why: { fontSize: 12.5, color: "var(--v-ink-2)", lineHeight: 1.5, margin: "8px 0 0" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 },
  okChip: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--v-green)", background: "var(--v-green-bg,#e9f9ef)", borderRadius: 999, padding: "2px 9px" },
  gapChip: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#b7791f", background: "#fff7e6", borderRadius: 999, padding: "2px 9px" },
}
