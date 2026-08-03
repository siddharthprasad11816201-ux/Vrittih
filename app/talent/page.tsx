"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconUsers, IconSearch, IconArrowRight, IconCheckCircle } from "@/components/ui/Icons"

const bandColor = (b: string) => b === "healthy" ? "var(--v-green)" : b === "steady" ? "var(--v-accent)" : b === "cooling" ? "var(--v-amber)" : "var(--v-ink-3)"
const refColor = (s: string) => s === "HIRED" ? "var(--v-green)" : s === "REJECTED" ? "var(--v-red)" : s === "INTERVIEWING" ? "var(--v-accent)" : "var(--v-amber)"

export default function TalentPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [tab, setTab] = useState<"pools" | "discover" | "referrals">("pools")
  const [data, setData] = useState<any>({ pools: [], kinds: [] })
  const [sel, setSel] = useState<any>(null)          // selected pool detail
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  // create pool
  const [np, setNp] = useState({ name: "", kind: "POOL", description: "" })
  const [showNew, setShowNew] = useState(false)
  // discover
  const [q, setQ] = useState(""); const [results, setResults] = useState<any[] | null>(null)
  // referrals
  const [refs, setRefs] = useState<any>({ mine: [], incoming: [], canManage: false })
  const [refForm, setRefForm] = useState({ candidateEmail: "", candidateName: "", relationship: "", note: "" })
  // add member
  const [addEmail, setAddEmail] = useState("")

  async function loadPools() {
    try {
      const r = await fetch("/api/talent/pools")
      if (r.status === 403 || r.status === 401) { setState("denied"); return }
      setData(await r.json()); setState("ok")
    } catch { setState("denied") }
  }
  async function loadRefs() { try { setRefs(await fetch("/api/referrals").then(r => r.json())) } catch {} }
  useEffect(() => { loadPools(); loadRefs() }, [])

  async function openPool(id: string) {
    setSel(null)
    try {
      const r = await fetch(`/api/talent/pools/${id}`); const d = await r.json()
      if (r.ok && d?.pool) setSel(d); else { setErr(d?.error || "Could not open that pool."); await loadPools() }
    } catch { setErr("Could not open that pool.") }
  }
  async function createPool() {
    if (!np.name.trim()) { setErr("Pool name required."); return }
    setBusy("pool"); setErr("")
    try { const d = await fetch("/api/talent/pools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(np) }).then(r => r.json()); if (d.error) setErr(d.error); else { setShowNew(false); setNp({ name: "", kind: "POOL", description: "" }); await loadPools() } } finally { setBusy(null) }
  }
  async function poolAction(body: any) {
    if (!sel) return; setBusy("member"); setErr("")
    try { const d = await fetch(`/api/talent/pools/${sel.pool.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()); if (d.error) setErr(d.error); await openPool(sel.pool.id); await loadPools() } finally { setBusy(null) }
  }
  async function discover() {
    const skills = q.split(",").map(s => s.trim()).filter(Boolean)
    if (!skills.length) return
    setBusy("discover"); setResults(null)
    try { const d = await fetch("/api/talent/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skills }) }).then(r => r.json()); setResults(d.results || []) } finally { setBusy(null) }
  }
  async function submitReferral() {
    if (!refForm.candidateEmail.trim()) { setErr("Candidate email required."); return }
    setBusy("ref"); setErr("")
    try { const d = await fetch("/api/referrals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(refForm) }).then(r => r.json()); if (d.error) setErr(d.error); else { setRefForm({ candidateEmail: "", candidateName: "", relationship: "", note: "" }); await loadRefs() } } finally { setBusy(null) }
  }
  async function advanceRef(id: string, status: string) { setBusy(id); try { await fetch("/api/referrals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }); await loadRefs() } finally { setBusy(null) } }

  if (state === "loading") return <AppShell title="Talent"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Talent"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Recruiter access required</h1></div></div></AppShell>

  return (
    <AppShell title="Talent">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconUsers size={20} /> Talent CRM</h1>
          <p style={S.sub}>Build talent pools, discover candidates by skill, and manage referrals — with explainable pipeline health.</p>
        </header>
        {err && <div style={S.err}>{err}</div>}

        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(tab === "pools" ? S.tabOn : {}) }} onClick={() => setTab("pools")}>Pools ({data.pools.length})</button>
          <button style={{ ...S.tab, ...(tab === "discover" ? S.tabOn : {}) }} onClick={() => setTab("discover")}>Discover</button>
          <button style={{ ...S.tab, ...(tab === "referrals" ? S.tabOn : {}) }} onClick={() => setTab("referrals")}>Referrals ({refs.incoming?.length || refs.mine?.length || 0})</button>
        </div>

        {/* ── POOLS ── */}
        {tab === "pools" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}><button style={S.cta} onClick={() => setShowNew(v => !v)}>{showNew ? "Close" : "New pool"}</button></div>
            {showNew && (
              <div style={S.card}>
                <div style={S.grid}>
                  <input style={S.input} placeholder="Pool name" value={np.name} onChange={e => setNp({ ...np, name: e.target.value })} />
                  <select style={S.input} value={np.kind} onChange={e => setNp({ ...np, kind: e.target.value })}>{data.kinds.map((k: any) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
                </div>
                <input style={{ ...S.input, marginTop: 10 }} placeholder="Description (optional)" value={np.description} onChange={e => setNp({ ...np, description: e.target.value })} />
                <button style={{ ...S.cta, marginTop: 10 }} onClick={createPool} disabled={busy === "pool"}>{busy === "pool" ? "…" : "Create pool"}</button>
              </div>
            )}
            <div style={S.list}>
              {data.pools.length === 0 && <div style={S.empty}><p style={S.sub}>No pools yet — create one.</p></div>}
              {data.pools.map((p: any) => (
                <button key={p.id} style={S.poolRow} onClick={() => openPool(p.id)}>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div style={S.poolName}>{p.name} <span style={S.kind}>{data.kinds.find((k: any) => k.key === p.kind)?.label || p.kind}</span></div>
                    <div style={S.poolSub}>{p.size} member{p.size === 1 ? "" : "s"} · {p.health.note}</div>
                  </div>
                  <span style={{ ...S.healthBadge, color: "#fff", background: bandColor(p.health.band) }}>{p.health.score}</span>
                  <IconArrowRight size={15} />
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── DISCOVER ── */}
        {tab === "discover" && (
          <div>
            <div style={S.searchRow}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Skills to search for, comma-separated (e.g. React, TypeScript, Node.js)" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") discover() }} />
              <button style={S.cta} onClick={discover} disabled={busy === "discover"}><IconSearch size={15} /> {busy === "discover" ? "…" : "Search"}</button>
            </div>
            {results && (results.length === 0 ? <div style={S.empty}><p style={S.sub}>No candidates matched those skills.</p></div> : (
              <div style={S.list}>
                {results.map((r: any) => (
                  <div key={r.id} style={S.candRow}>
                    <span style={{ ...S.healthBadge, color: "#fff", background: r.score >= 70 ? "var(--v-green)" : r.score >= 45 ? "var(--v-accent)" : "var(--v-amber)" }}>{r.score}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.poolName}>{r.name}{r.openToWork ? <span style={S.otw}>open to work</span> : null}</div>
                      <div style={S.poolSub}>{r.headline || "—"}</div>
                      {r.shared?.length > 0 && <div style={S.chips}>{r.shared.slice(0, 6).map((s: string) => <span key={s} style={S.have}>{s}</span>)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── REFERRALS ── */}
        {tab === "referrals" && (
          <div>
            <div style={S.card}>
              <div style={S.cardH}>Refer a candidate</div>
              <div style={S.grid}>
                <input style={S.input} placeholder="Candidate email" value={refForm.candidateEmail} onChange={e => setRefForm({ ...refForm, candidateEmail: e.target.value })} />
                <input style={S.input} placeholder="Candidate name (optional)" value={refForm.candidateName} onChange={e => setRefForm({ ...refForm, candidateName: e.target.value })} />
              </div>
              <input style={{ ...S.input, marginTop: 10 }} placeholder="How you know them / why they're a fit" value={refForm.relationship} onChange={e => setRefForm({ ...refForm, relationship: e.target.value })} />
              <button style={{ ...S.cta, marginTop: 10 }} onClick={submitReferral} disabled={busy === "ref"}>{busy === "ref" ? "…" : "Submit referral"}</button>
            </div>
            {refs.canManage && refs.incoming?.length > 0 && (
              <>
                <div style={S.sectionH}>Incoming referrals</div>
                <div style={S.list}>
                  {refs.incoming.map((r: any) => (
                    <div key={r.id} style={S.candRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.poolName}>{r.candidateName || r.candidateEmail}</div>
                        <div style={S.poolSub}>Referred by {r.referrer || "—"}{r.relationship ? ` · ${r.relationship}` : ""}</div>
                      </div>
                      <select style={S.stageSel} value={r.status} disabled={busy === r.id} onChange={e => advanceRef(r.id, e.target.value)}>
                        {["SUBMITTED", "REVIEWING", "INTERVIEWING", "HIRED", "REJECTED"].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </>
            )}
            {refs.mine?.length > 0 && (
              <>
                <div style={S.sectionH}>My referrals</div>
                <div style={S.list}>
                  {refs.mine.map((r: any) => (
                    <div key={r.id} style={S.candRow}>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={S.poolName}>{r.candidateName || r.candidateEmail}</div></div>
                      <span style={{ ...S.refBadge, color: refColor(r.status) }}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* pool detail modal */}
      {sel && (
        <div style={S.modalWrap} onClick={() => setSel(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.mHead}>
              <div><div style={S.mTitle}>{sel.pool.name}</div><div style={S.poolSub}>{sel.health?.note}</div></div>
              <span style={{ ...S.healthBadge, color: "#fff", background: bandColor(sel.health?.band) }}>{sel.health?.score}</span>
            </div>
            <div style={S.addRow}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Add candidate by email" value={addEmail} onChange={e => setAddEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && addEmail.trim()) { poolAction({ action: "add", email: addEmail }); setAddEmail("") } }} />
              <button style={S.cta} onClick={() => { if (addEmail.trim()) { poolAction({ action: "add", email: addEmail }); setAddEmail("") } }} disabled={busy === "member"}>Add</button>
            </div>
            <div style={S.members}>
              {(sel.members || []).length === 0 && <p style={S.sub}>No members yet.</p>}
              {(sel.members || []).map((m: any) => (
                <div key={m.id} style={S.member}>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={S.poolName}>{m.name || m.email}</div><div style={S.poolSub}>{m.headline || m.email}</div></div>
                  <select style={S.stageSel} value={m.stage} disabled={busy === "member"} onChange={e => poolAction({ action: "stage", memberId: m.id, stage: e.target.value })}>
                    {(sel.stages || []).map((s: string) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button style={S.rm} onClick={() => poolAction({ action: "remove", memberId: m.id })}>×</button>
                </div>
              ))}
            </div>
            <button style={S.cta} onClick={() => setSel(null)}>Done</button>
          </div>
        </div>
      )}
    </AppShell>
  )
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 860, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 16 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 620 },
  err: { background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#B91C1C", marginBottom: 14 },
  tabs: { display: "flex", gap: 4, background: "var(--v-surface-2)", padding: 4, borderRadius: 12, marginBottom: 16, width: "fit-content" },
  tab: { padding: "8px 16px", border: "none", background: "none", borderRadius: 9, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--v-ink-2)", cursor: "pointer" },
  tabOn: { background: "var(--v-surface)", color: "var(--v-ink)", boxShadow: "var(--v-shadow-sm)" },
  cta: { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 16, marginBottom: 14 },
  cardH: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--v-ink)", marginBottom: 12 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, color: "var(--v-ink)", outline: "none", fontFamily: "inherit", width: "100%", background: "var(--v-surface)" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "36px 24px", textAlign: "center" },
  poolRow: { display: "flex", alignItems: "center", gap: 12, width: "100%", background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "12px 15px", cursor: "pointer", font: "inherit", boxShadow: "var(--v-shadow-sm)" },
  poolName: { fontSize: 14, fontWeight: 600, color: "var(--v-ink)" },
  kind: { fontSize: 11, color: "var(--v-ink-3)", fontWeight: 500 },
  poolSub: { fontSize: 12, color: "var(--v-ink-2)", marginTop: 2 },
  healthBadge: { minWidth: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, flexShrink: 0 },
  searchRow: { display: "flex", gap: 8, marginBottom: 14 },
  candRow: { display: "flex", alignItems: "center", gap: 12, background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "12px 15px", boxShadow: "var(--v-shadow-sm)" },
  otw: { fontSize: 10.5, fontWeight: 700, color: "var(--v-green)", background: "var(--v-green-soft)", padding: "1px 7px", borderRadius: 999, marginLeft: 8 },
  chips: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 },
  have: { fontSize: 11.5, color: "var(--v-green)", background: "var(--v-green-soft)", padding: "2px 8px", borderRadius: 6 },
  sectionH: { fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--v-ink)", margin: "18px 0 10px" },
  refBadge: { fontSize: 11, fontWeight: 700 },
  stageSel: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "6px 9px", fontSize: 12, background: "var(--v-surface)", color: "var(--v-ink)", fontFamily: "inherit" },
  modalWrap: { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "grid", placeItems: "center", zIndex: 60, padding: 20 },
  modal: { background: "var(--v-surface)", borderRadius: 18, padding: 20, width: "100%", maxWidth: 520, maxHeight: "82vh", overflowY: "auto", boxShadow: "var(--v-shadow-lg)" },
  mHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 },
  mTitle: { fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--v-ink)" },
  addRow: { display: "flex", gap: 8, marginBottom: 12 },
  members: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, maxHeight: 320, overflowY: "auto" },
  member: { display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: "var(--v-surface-2)", borderRadius: 10 },
  rm: { background: "none", border: "none", fontSize: 18, color: "var(--v-ink-3)", cursor: "pointer", flexShrink: 0 },
}
