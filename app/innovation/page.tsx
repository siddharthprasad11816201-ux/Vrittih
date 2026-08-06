"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconZap, IconBanknote } from "@/components/ui/Icons"

const st = (s: string) => s === "AWARDED" || s === "WINNER" ? "var(--v-green)" : s === "REJECTED" ? "var(--v-red)" : s === "SHORTLISTED" ? "var(--v-accent)" : "var(--v-amber)"

export default function InnovationPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [tab, setTab] = useState<"grants" | "challenges">("grants")
  const [g, setG] = useState<any>(null); const [c, setC] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState("")

  async function load() {
    try {
      const [gr, ch] = await Promise.all([fetch("/api/grants"), fetch("/api/challenges")])
      if (gr.status === 401) { setState("denied"); return }
      setG(await gr.json()); setC(await ch.json()); setState("ok")
    } catch { setState("denied") }
  }
  useEffect(() => { load() }, [])
  async function grantApply(grantId: string) { const summary = window.prompt("Brief application summary:") || ""; setBusy(grantId); setErr(""); try { const d = await fetch("/api/grants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "apply", grantId, summary }) }).then(r => r.json()); if (d.error) setErr(d.error); await load() } finally { setBusy(null) } }
  async function grantDecide(id: string, status: string) { setBusy(id); try { await fetch("/api/grants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }); await load() } finally { setBusy(null) } }
  async function submitChallenge(challengeId: string) { const title = window.prompt("Submission title:") || ""; if (!title) return; const url = window.prompt("Link (optional):") || ""; setBusy(challengeId); setErr(""); try { const d = await fetch("/api/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", challengeId, title, url }) }).then(r => r.json()); if (d.error) setErr(d.error); await load() } finally { setBusy(null) } }
  async function judge(id: string, status: string) { setBusy(id); try { await fetch("/api/challenges", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }); await load() } finally { setBusy(null) } }

  if (state === "loading") return <AppShell title="Innovation"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Innovation"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in</h1></div></div></AppShell>

  return (
    <AppShell title="Innovation">
      <div style={S.page}>
        <header style={S.head}><h1 style={S.h1}><IconZap size={20} /> Grants & Innovation</h1><p style={S.sub}>Discover and apply for research grants; enter innovation challenges. Funders and sponsors post opportunities and judge submissions.</p></header>
        {err && <div style={S.err}>{err}</div>}
        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(tab === "grants" ? S.tabOn : {}) }} onClick={() => setTab("grants")}>Grants</button>
          <button style={{ ...S.tab, ...(tab === "challenges" ? S.tabOn : {}) }} onClick={() => setTab("challenges")}>Challenges</button>
        </div>

        {tab === "grants" && g && (
          <div>
            <div style={S.list}>
              {(g.open || []).map((x: any) => (
                <div key={x.id} style={S.row}>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={S.rowT}><IconBanknote size={14} /> {x.title}</div><div style={S.rowS}>{x.funder || "—"}{x.amount ? ` · ${x.currency} ${x.amount.toLocaleString()}` : ""}{x.deadline ? ` · by ${new Date(x.deadline).toLocaleDateString()}` : ""}</div></div>
                  {x.applied ? <span style={S.applied}>Applied</span> : <button style={S.cta} disabled={busy === x.id} onClick={() => grantApply(x.id)}>Apply</button>}
                </div>
              ))}
              {(g.open || []).length === 0 && <div style={S.empty}><p style={S.sub}>No open grants right now.</p></div>}
            </div>
            {(g.myApplications || []).length > 0 && (<><div style={S.sec}>My applications</div>{g.myApplications.map((a: any) => (<div key={a.id} style={S.appRow}><span style={{ flex: 1 }}>{a.grant}{a.funder ? ` · ${a.funder}` : ""}</span><span style={{ color: st(a.status), fontWeight: 700 }}>{a.status}</span></div>))}</>)}
            {g.canPost && (g.posted || []).length > 0 && (<><div style={S.sec}>My grants — applications</div>{g.posted.map((gr: any) => (<div key={gr.id} style={S.card}><div style={S.rowT}>{gr.title}</div>{(gr.applications || []).map((a: any) => (<div key={a.id} style={S.appRow}><span style={{ flex: 1 }}>{a.applicant} <span style={{ color: st(a.status), fontWeight: 700 }}>{a.status}</span></span>{["SHORTLISTED", "AWARDED", "REJECTED"].map(s => <button key={s} style={S.tiny} disabled={busy === a.id} onClick={() => grantDecide(a.id, s)}>{s[0]}</button>)}</div>))}{(gr.applications || []).length === 0 && <div style={S.rowS}>No applications yet.</div>}</div>))}</>)}
          </div>
        )}

        {tab === "challenges" && c && (
          <div>
            <div style={S.list}>
              {(c.open || []).map((x: any) => (
                <div key={x.id} style={S.row}>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={S.rowT}>{x.title}</div><div style={S.rowS}>{x.prize ? `Prize: ${x.prize}` : "—"} · {x.submissions} submissions{x.deadline ? ` · by ${new Date(x.deadline).toLocaleDateString()}` : ""}</div></div>
                  {x.submitted ? <span style={S.applied}>Submitted</span> : <button style={S.cta} disabled={busy === x.id} onClick={() => submitChallenge(x.id)}>Submit</button>}
                </div>
              ))}
              {(c.open || []).length === 0 && <div style={S.empty}><p style={S.sub}>No open challenges right now.</p></div>}
            </div>
            {(c.mySubmissions || []).length > 0 && (<><div style={S.sec}>My submissions</div>{c.mySubmissions.map((s: any) => (<div key={s.id} style={S.appRow}><span style={{ flex: 1 }}>{s.title} <em style={{ color: "var(--v-ink-3)" }}>{s.challenge}</em></span><span style={{ color: st(s.status), fontWeight: 700 }}>{s.status}</span></div>))}</>)}
            {c.canSponsor && (c.sponsored || []).length > 0 && (<><div style={S.sec}>My challenges — submissions</div>{c.sponsored.map((ch: any) => (<div key={ch.id} style={S.card}><div style={S.rowT}>{ch.title}</div>{(ch.submissions || []).map((s: any) => (<div key={s.id} style={S.appRow}><span style={{ flex: 1 }}>{s.title} <em style={{ color: "var(--v-ink-3)" }}>{s.by}</em> <span style={{ color: st(s.status), fontWeight: 700 }}>{s.status}</span></span>{["SHORTLISTED", "WINNER", "REJECTED"].map(x => <button key={x} style={S.tiny} disabled={busy === s.id} onClick={() => judge(s.id, x)}>{x[0]}</button>)}</div>))}{(ch.submissions || []).length === 0 && <div style={S.rowS}>No submissions yet.</div>}</div>))}</>)}
          </div>
        )}
      </div>
    </AppShell>
  )
}
const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 820, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 14 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 620 },
  err: { background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#B91C1C", margin: "12px 0" },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "36px 24px", textAlign: "center" },
  tabs: { display: "flex", gap: 4, background: "var(--v-surface-2)", padding: 4, borderRadius: 12, marginBottom: 14, width: "fit-content" },
  tab: { padding: "8px 16px", border: "none", background: "none", borderRadius: 9, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--v-ink-2)", cursor: "pointer" },
  tabOn: { background: "var(--v-surface)", color: "var(--v-ink)", boxShadow: "var(--v-shadow-sm)" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: { display: "flex", alignItems: "center", gap: 10, background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "11px 14px", boxShadow: "var(--v-shadow-sm)" },
  rowT: { fontSize: 14, fontWeight: 600, color: "var(--v-ink)", display: "flex", alignItems: "center", gap: 6 },
  rowS: { fontSize: 12, color: "var(--v-ink-2)", marginTop: 2 },
  cta: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  applied: { fontSize: 12.5, fontWeight: 700, color: "var(--v-green)" },
  sec: { fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--v-ink)", margin: "18px 0 10px" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: 14, marginBottom: 8 },
  appRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--v-ink-2)", marginTop: 8 },
  tiny: { background: "var(--v-surface-2)", color: "var(--v-ink)", border: "1px solid var(--v-line)", borderRadius: 7, padding: "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" },
}
