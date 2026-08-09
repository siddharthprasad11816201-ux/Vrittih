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
  const [showGf, setShowGf] = useState(false); const [gf, setGf] = useState<any>({ title: "", funder: "", amount: "", currency: "CHF", field: "", description: "", deadline: "" })
  const [showCf, setShowCf] = useState(false); const [cf, setCf] = useState<any>({ title: "", description: "", prize: "", deadline: "" })

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
  async function postGrant() { if (!gf.title.trim()) { setErr("Grant title required."); return } setBusy("newGrant"); setErr(""); try { const d = await fetch("/api/grants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: gf.title, funder: gf.funder, amount: gf.amount, currency: gf.currency, field: gf.field, description: gf.description, deadline: gf.deadline || null }) }).then(r => r.json()); if (d.error) { setErr(d.error); return } setGf({ title: "", funder: "", amount: "", currency: "CHF", field: "", description: "", deadline: "" }); setShowGf(false); await load() } finally { setBusy(null) } }
  async function createChallenge() { if (!cf.title.trim()) { setErr("Challenge title required."); return } setBusy("newChallenge"); setErr(""); try { const d = await fetch("/api/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: cf.title, description: cf.description, prize: cf.prize, deadline: cf.deadline || null }) }).then(r => r.json()); if (d.error) { setErr(d.error); return } setCf({ title: "", description: "", prize: "", deadline: "" }); setShowCf(false); await load() } finally { setBusy(null) } }

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
            {g.canPost && (!showGf
              ? <button style={S.ghost} onClick={() => { setErr(""); setShowGf(true) }}>+ Post a grant</button>
              : <div style={S.formWrap}>
                  <div style={S.formHead}><div style={S.rowT}><IconBanknote size={14} /> Post a grant</div><button style={S.tiny} onClick={() => setShowGf(false)}>Cancel</button></div>
                  <div style={S.formGrid}>
                    <div style={S.field}><label style={S.label}>Title</label><input style={S.input} value={gf.title} onChange={e => setGf({ ...gf, title: e.target.value })} placeholder="Grant title" /></div>
                    <div style={S.field}><label style={S.label}>Funder</label><input style={S.input} value={gf.funder} onChange={e => setGf({ ...gf, funder: e.target.value })} placeholder="Organization" /></div>
                    <div style={S.field}><label style={S.label}>Amount</label><input style={S.input} type="number" value={gf.amount} onChange={e => setGf({ ...gf, amount: e.target.value })} placeholder="0" /></div>
                    <div style={S.field}><label style={S.label}>Currency</label><input style={S.input} value={gf.currency} onChange={e => setGf({ ...gf, currency: e.target.value })} placeholder="CHF" /></div>
                    <div style={S.field}><label style={S.label}>Field</label><input style={S.input} value={gf.field} onChange={e => setGf({ ...gf, field: e.target.value })} placeholder="Research field" /></div>
                    <div style={S.field}><label style={S.label}>Deadline</label><input style={S.input} type="date" value={gf.deadline} onChange={e => setGf({ ...gf, deadline: e.target.value })} /></div>
                  </div>
                  <label style={S.label}>Description</label>
                  <textarea style={S.textarea} value={gf.description} onChange={e => setGf({ ...gf, description: e.target.value })} placeholder="What the grant funds…" />
                  <div style={{ marginTop: 10 }}><button style={S.cta} disabled={busy === "newGrant" || !gf.title.trim()} onClick={postGrant}>{busy === "newGrant" ? "Posting…" : "Post grant"}</button></div>
                </div>
            )}
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
            {c.canSponsor && (!showCf
              ? <button style={S.ghost} onClick={() => { setErr(""); setShowCf(true) }}>+ Create a challenge</button>
              : <div style={S.formWrap}>
                  <div style={S.formHead}><div style={S.rowT}><IconZap size={14} /> Create a challenge</div><button style={S.tiny} onClick={() => setShowCf(false)}>Cancel</button></div>
                  <div style={S.formGrid}>
                    <div style={S.field}><label style={S.label}>Title</label><input style={S.input} value={cf.title} onChange={e => setCf({ ...cf, title: e.target.value })} placeholder="Challenge title" /></div>
                    <div style={S.field}><label style={S.label}>Prize</label><input style={S.input} value={cf.prize} onChange={e => setCf({ ...cf, prize: e.target.value })} placeholder="e.g. CHF 5,000" /></div>
                    <div style={S.field}><label style={S.label}>Deadline</label><input style={S.input} type="date" value={cf.deadline} onChange={e => setCf({ ...cf, deadline: e.target.value })} /></div>
                  </div>
                  <label style={S.label}>Description</label>
                  <textarea style={S.textarea} value={cf.description} onChange={e => setCf({ ...cf, description: e.target.value })} placeholder="What entrants must build or solve…" />
                  <div style={{ marginTop: 10 }}><button style={S.cta} disabled={busy === "newChallenge" || !cf.title.trim()} onClick={createChallenge}>{busy === "newChallenge" ? "Creating…" : "Create challenge"}</button></div>
                </div>
            )}
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
  ghost: { background: "var(--v-surface-2)", color: "var(--v-ink)", border: "1px solid var(--v-line)", borderRadius: 10, padding: "9px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12 },
  formWrap: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: 14, marginBottom: 12, boxShadow: "var(--v-shadow-sm)" },
  formHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 10 },
  field: { minWidth: 0 },
  label: { display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--v-ink-2)", marginBottom: 4 },
  input: { width: "100%", padding: "8px 10px", border: "1px solid var(--v-line)", borderRadius: 9, font: "inherit", fontSize: 13, color: "var(--v-ink)", background: "var(--v-surface)", boxSizing: "border-box" },
  textarea: { width: "100%", padding: "8px 10px", border: "1px solid var(--v-line)", borderRadius: 9, font: "inherit", fontSize: 13, color: "var(--v-ink)", background: "var(--v-surface)", boxSizing: "border-box", minHeight: 64, resize: "vertical" },
}
