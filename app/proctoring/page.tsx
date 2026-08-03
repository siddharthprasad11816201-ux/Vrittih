"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconShield, IconAlert, IconCheckCircle, IconArrowRight } from "@/components/ui/Icons"

const bandColor = (s: number) => s >= 60 ? "var(--v-red)" : s >= 30 ? "var(--v-amber)" : s >= 10 ? "var(--v-blue)" : "var(--v-green)"
const bandLabel = (s: number) => s >= 60 ? "High" : s >= 30 ? "Elevated" : s >= 10 ? "Low" : "Clear"
const revColor = (r: string) => r === "FLAGGED" ? "var(--v-red)" : r === "CLEARED" ? "var(--v-green)" : "var(--v-amber)"
const sevColor = (s: string) => s === "high" ? "var(--v-red)" : s === "medium" ? "var(--v-amber)" : s === "low" ? "var(--v-blue)" : "var(--v-ink-3)"

export default function ProctoringPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [sessions, setSessions] = useState<any[]>([])
  const [open, setOpen] = useState<any>(null)
  const [detail, setDetail] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const r = await fetch("/api/proctor/sessions")
      if (r.status === 403 || r.status === 401) { setState("denied"); return }
      const d = await r.json()
      setSessions(d.sessions || []); setState("ok")
    } catch { setState("denied") }
  }
  useEffect(() => { load() }, [])

  async function openSession(s: any) {
    setOpen(s); setDetail(null)
    try { setDetail(await fetch(`/api/proctor/sessions/${s.id}`).then(r => r.json())) } catch {}
  }
  async function decide(id: string, reviewStatus: string) {
    setBusy(true)
    try {
      await fetch(`/api/proctor/sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewStatus }) })
      await load(); if (open) await openSession({ ...open })
    } catch {} finally { setBusy(false) }
  }

  if (state === "loading") return <AppShell title="Proctoring"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Proctoring"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Reviewer access required</h1><p style={S.sub}>Integrity review is available to interviewers, recruiters and administrators.</p></div></div></AppShell>

  return (
    <AppShell title="Proctoring">
      <div style={S.page}>
        <header style={S.head}>
          <div>
            <h1 style={S.h1}><IconShield size={20} /> Integrity review</h1>
            <p style={S.sub}>Sessions ranked by a deterministic triage score built from observable events. The score routes work to you — <b>you</b> decide. No automated guilt determination.</p>
          </div>
        </header>

        {sessions.length === 0 ? <div style={S.empty}><p style={S.sub}>No proctored sessions yet.</p></div> : (
          <div style={S.list}>
            {sessions.map(s => (
              <button key={s.id} style={S.row} onClick={() => openSession(s)}>
                <span style={{ ...S.risk, color: "#fff", background: bandColor(s.riskScore) }}>{s.riskScore}</span>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={S.rowTitle}>{s.subject?.name || s.subject?.email || "Candidate"} <span style={S.kind}>{s.kind}</span></div>
                  <div style={S.rowSub}>{s.eventCount} events · {bandLabel(s.riskScore)} · {new Date(s.startedAt).toLocaleString()}</div>
                </div>
                <span style={{ ...S.rev, color: revColor(s.reviewStatus) }}>{s.reviewStatus}</span>
                <IconArrowRight size={15} />
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div style={S.modalWrap} onClick={() => setOpen(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.mHead}>
              <div>
                <div style={S.mTitle}>{open.subject?.name || "Candidate"}</div>
                <div style={S.rowSub}>{open.kind} · {open.eventCount} events</div>
              </div>
              <span style={{ ...S.risk, color: "#fff", background: bandColor(open.riskScore) }}>{open.riskScore}</span>
            </div>
            {!detail ? <p style={S.sub}>Loading events…</p> : (
              <>
                {detail.risk?.note && <p style={S.note}>{detail.risk.note}</p>}
                {detail.risk?.contributors?.length > 0 && (
                  <div style={S.contribs}>
                    {detail.risk.contributors.map((c: any) => (
                      <div key={c.type} style={S.contrib}><span style={{ ...S.sevDot, background: sevColor(c.severity) }} /><span style={S.cLbl}>{c.label}</span><span style={S.cCount}>×{c.count}</span></div>
                    ))}
                  </div>
                )}
                <div style={S.events}>
                  {(detail.events || []).slice(-40).reverse().map((e: any) => (
                    <div key={e.id} style={S.ev}>
                      <span style={{ ...S.sevDot, background: sevColor(e.severity) }} />
                      <span style={S.evType}>{e.type}</span>
                      <span style={S.evTs}>{new Date(e.ts).toLocaleTimeString()}</span>
                    </div>
                  ))}
                  {(!detail.events || detail.events.length === 0) && <p style={S.sub}>No events recorded.</p>}
                </div>
                <div style={S.decide}>
                  <span style={S.decideLbl}>Your decision:</span>
                  <button style={{ ...S.clearBtn }} disabled={busy} onClick={() => decide(open.id, "CLEARED")}><IconCheckCircle size={14} /> Clear</button>
                  <button style={{ ...S.flagBtn }} disabled={busy} onClick={() => decide(open.id, "FLAGGED")}><IconAlert size={14} /> Flag for follow-up</button>
                </div>
                <p style={S.fine}>Flagging records a human review decision; it is not an accusation and never auto-penalises the candidate.</p>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 820, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 18 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 620 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "44px 24px", textAlign: "center" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: { display: "flex", alignItems: "center", gap: 13, width: "100%", background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "12px 15px", cursor: "pointer", font: "inherit", boxShadow: "var(--v-shadow-sm)" },
  risk: { minWidth: 40, height: 40, borderRadius: 10, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, flexShrink: 0 },
  rowTitle: { fontSize: 14, fontWeight: 600, color: "var(--v-ink)" },
  kind: { fontSize: 11, color: "var(--v-ink-3)", fontWeight: 500, textTransform: "capitalize" },
  rowSub: { fontSize: 12, color: "var(--v-ink-2)", marginTop: 2 },
  rev: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" },
  modalWrap: { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "grid", placeItems: "center", zIndex: 60, padding: 20 },
  modal: { background: "var(--v-surface)", borderRadius: 18, padding: 22, width: "100%", maxWidth: 520, maxHeight: "82vh", overflowY: "auto", boxShadow: "var(--v-shadow-lg)" },
  mHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 },
  mTitle: { fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--v-ink)" },
  note: { fontSize: 12.5, color: "var(--v-ink-2)", lineHeight: 1.5, marginBottom: 12 },
  contribs: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 },
  contrib: { display: "flex", alignItems: "center", gap: 9, fontSize: 13 },
  cLbl: { flex: 1, color: "var(--v-ink)" },
  cCount: { color: "var(--v-ink-2)", fontWeight: 600 },
  sevDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  events: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto", padding: "10px 0", borderTop: "1px solid var(--v-line-2)", borderBottom: "1px solid var(--v-line-2)", marginBottom: 14 },
  ev: { display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 },
  evType: { flex: 1, color: "var(--v-ink)", fontFamily: "var(--font-mono, monospace)" },
  evTs: { color: "var(--v-ink-3)", fontVariantNumeric: "tabular-nums" },
  decide: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  decideLbl: { fontSize: 12.5, fontWeight: 600, color: "var(--v-ink-2)", marginRight: 4 },
  clearBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-green)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  flagBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-surface)", color: "var(--v-red)", border: "1px solid var(--v-red)", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  fine: { fontSize: 11.5, color: "var(--v-ink-3)", lineHeight: 1.5, marginTop: 10 },
}
