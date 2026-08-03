"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconCheckCircle, IconArrowRight } from "@/components/ui/Icons"
import { OFFER_STATUS_LABEL, managerActions, candidateActions, type OfferAction } from "@/lib/offer/lifecycle"

const ACTION_LABEL: Record<string, string> = { submit: "Submit for approval", approve: "Approve", send: "Send to candidate", withdraw: "Withdraw", revise: "Revise" }
const statusColor = (s: string) => ({
  DRAFT: "var(--v-ink-3)", PENDING_APPROVAL: "var(--v-amber)", APPROVED: "var(--v-blue)",
  SENT: "var(--v-accent)", ACCEPTED: "var(--v-green)", DECLINED: "var(--v-red)",
  WITHDRAWN: "var(--v-ink-3)", EXPIRED: "var(--v-ink-3)",
} as Record<string, string>)[s] || "var(--v-ink-3)"

const money = (amt: number | null, ccy: string) => amt == null ? null : `${ccy} ${Number(amt).toLocaleString()}`
const statusLabel = (s: string) => (OFFER_STATUS_LABEL as Record<string, string>)[s] || s

export default function OffersPage() {
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(true)
  const [data, setData] = useState<any>({ created: [], received: [], canManage: false })
  const [tab, setTab] = useState<"received" | "managing">("received")
  const [busy, setBusy] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<any>({ candidateEmail: "", applicationId: "", title: "", companyName: "", baseAmount: "", currency: "CHF", bonusAmount: "", equity: "", benefits: "", expiresAt: "", startDate: "" })
  const [err, setErr] = useState("")

  async function load() {
    setLoading(true)
    try {
      const r = await fetch("/api/offers")
      if (r.status === 401) { setAuthed(false); setLoading(false); return }
      const d = await r.json()
      setData(d)
      setTab(d.received?.length || !d.canManage ? "received" : "managing")
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function act(id: string, action: OfferAction) {
    setBusy(id + action); setErr("")
    try {
      const d = await fetch(`/api/offers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).then(r => r.json())
      if (d.error) setErr(d.error); else await load()
    } catch { setErr("Network error.") } finally { setBusy(null) }
  }
  async function respond(id: string, decision: "accept" | "decline") {
    let reason = ""
    if (decision === "decline") { reason = window.prompt("Optional: a brief reason for declining") || "" }
    setBusy(id + decision); setErr("")
    try {
      const d = await fetch(`/api/offers/${id}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, reason }) }).then(r => r.json())
      if (d.error) setErr(d.error); else await load()
    } catch { setErr("Network error.") } finally { setBusy(null) }
  }
  async function createOffer(e: any) {
    e.preventDefault(); setErr("")
    if (!form.title.trim() || (!form.candidateEmail.trim() && !form.applicationId.trim())) { setErr("A candidate email (or application id) and a title are required."); return }
    setBusy("create")
    try {
      const body: any = { ...form, benefits: form.benefits ? form.benefits.split(",").map((s: string) => s.trim()).filter(Boolean) : [] }
      const d = await fetch("/api/offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json())
      if (d.error) setErr(d.error)
      else { setShowCreate(false); setForm({ candidateEmail: "", applicationId: "", title: "", companyName: "", baseAmount: "", currency: "CHF", bonusAmount: "", equity: "", benefits: "", expiresAt: "", startDate: "" }); await load() }
    } catch { setErr("Network error.") } finally { setBusy(null) }
  }

  if (!authed) return <AppShell title="Offers"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in to view your offers</h1></div></div></AppShell>

  const received = data.received || []
  const created = data.created || []

  return (
    <AppShell title="Offers">
      <div style={S.page}>
        <header style={S.head}>
          <div>
            <h1 style={S.h1}>Offers</h1>
            <p style={S.sub}>Review and respond to offers you receive; create, approve and send offers you manage.</p>
          </div>
          {data.canManage && <button style={S.cta} onClick={() => setShowCreate(v => !v)}>{showCreate ? "Close" : "New offer"}</button>}
        </header>

        {err && <div style={S.err}>{err}</div>}

        {showCreate && data.canManage && (
          <form style={S.createCard} onSubmit={createOffer}>
            <div style={S.grid2}>
              <Field label="Candidate email"><input style={S.input} value={form.candidateEmail} onChange={e => setForm({ ...form, candidateEmail: e.target.value })} placeholder="candidate@email.com" /></Field>
              <Field label="…or application id"><input style={S.input} value={form.applicationId} onChange={e => setForm({ ...form, applicationId: e.target.value })} placeholder="optional" /></Field>
              <Field label="Role title"><input style={S.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Senior Backend Engineer" /></Field>
              <Field label="Company"><input style={S.input} value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} /></Field>
              <Field label="Base compensation"><input style={S.input} type="number" value={form.baseAmount} onChange={e => setForm({ ...form, baseAmount: e.target.value })} /></Field>
              <Field label="Currency"><input style={S.input} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></Field>
              <Field label="Bonus (optional)"><input style={S.input} type="number" value={form.bonusAmount} onChange={e => setForm({ ...form, bonusAmount: e.target.value })} /></Field>
              <Field label="Equity (optional)"><input style={S.input} value={form.equity} onChange={e => setForm({ ...form, equity: e.target.value })} placeholder="e.g. 0.1%" /></Field>
              <Field label="Benefits (comma-separated)"><input style={S.input} value={form.benefits} onChange={e => setForm({ ...form, benefits: e.target.value })} placeholder="Health, Remote, 25 days leave" /></Field>
              <Field label="Start date"><input style={S.input} type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></Field>
              <Field label="Responds by"><input style={S.input} type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} /></Field>
            </div>
            <button style={{ ...S.cta, marginTop: 4 }} disabled={busy === "create"}>{busy === "create" ? "Creating…" : "Create draft offer"}</button>
          </form>
        )}

        {data.canManage && (
          <div style={S.tabs}>
            <button style={{ ...S.tab, ...(tab === "received" ? S.tabOn : {}) }} onClick={() => setTab("received")}>Received ({received.length})</button>
            <button style={{ ...S.tab, ...(tab === "managing" ? S.tabOn : {}) }} onClick={() => setTab("managing")}>Managing ({created.length})</button>
          </div>
        )}

        {loading ? <div style={S.empty}><p style={S.sub}>Loading…</p></div> : (
          <div style={S.list}>
            {tab === "received" && (received.length === 0
              ? <div style={S.empty}><p style={S.sub}>No offers yet. When an employer sends you one, it appears here.</p></div>
              : received.map((o: any) => <OfferCard key={o.id} o={o} mine="candidate" busy={busy} onRespond={respond} />))}
            {tab === "managing" && data.canManage && (created.length === 0
              ? <div style={S.empty}><p style={S.sub}>No offers created yet. Use “New offer”.</p></div>
              : created.map((o: any) => <OfferCard key={o.id} o={o} mine="manager" isAdmin={!!data.isAdmin} busy={busy} onAct={act} />))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function OfferCard({ o, mine, isAdmin, busy, onAct, onRespond }: any) {
  const acts = mine === "manager" ? managerActions(o.status, { isAdmin }) : candidateActions(o.status)
  const pred = o.acceptFactors
  return (
    <div style={S.card}>
      <div style={S.cardTop}>
        <div style={{ minWidth: 0 }}>
          <div style={S.cardTitle}>{o.title} <span style={S.ver}>v{o.version}</span></div>
          <div style={S.cardSub}>{o.companyName}{mine === "manager" && o.candidate ? ` · ${o.candidate.name || o.candidate.email}` : ""}</div>
        </div>
        <span style={{ ...S.badge, color: "#fff", background: statusColor(o.status) }}>{statusLabel(o.status)}</span>
      </div>

      <div style={S.compRow}>
        {money(o.baseAmount, o.currency) && <span style={S.comp}><b>{money(o.baseAmount, o.currency)}</b> base</span>}
        {money(o.bonusAmount, o.currency) && <span style={S.comp}>{money(o.bonusAmount, o.currency)} bonus</span>}
        {o.equity && <span style={S.comp}>{o.equity} equity</span>}
        {o.expiresAt && <span style={S.compMuted}>responds by {new Date(o.expiresAt).toLocaleDateString()}</span>}
      </div>
      {o.benefits?.length > 0 && <div style={S.benefits}>{o.benefits.map((b: string) => <span key={b} style={S.benefit}>{b}</span>)}</div>}

      {mine === "manager" && o.acceptScore != null && (
        <div style={S.pred}>
          <span style={S.predLbl}>Predicted acceptance</span>
          <span style={{ ...S.predVal, color: o.acceptScore >= 0.66 ? "var(--v-green)" : o.acceptScore >= 0.45 ? "var(--v-amber)" : "var(--v-red)" }}>{Math.round(o.acceptScore * 100)}%</span>
          {pred?.confidence != null && <span style={S.predConf}>· {Math.round(pred.confidence * 100)}% conf.</span>}
          {pred?.factors?.length > 0 && <span style={S.predWhy}>{pred.factors.slice(0, 2).map((f: any) => `${f.label} ${f.effect > 0 ? "+" : ""}${f.effect}`).join(" · ")}</span>}
        </div>
      )}

      <div style={S.actions}>
        {mine === "candidate" && acts.includes("accept" as any) && (
          <>
            <button style={S.primary} disabled={busy === o.id + "accept"} onClick={() => onRespond(o.id, "accept")}><IconCheckCircle size={15} /> {busy === o.id + "accept" ? "…" : "Accept"}</button>
            <button style={S.ghost} disabled={busy === o.id + "decline"} onClick={() => onRespond(o.id, "decline")}>Decline</button>
          </>
        )}
        {mine === "candidate" && !acts.length && <span style={S.done}>{o.status === "ACCEPTED" ? "You accepted this offer." : o.status === "DECLINED" ? "You declined this offer." : statusLabel(o.status)}</span>}
        {mine === "manager" && acts.map((a: OfferAction) => (
          <button key={a} style={a === "send" || a === "approve" ? S.primary : S.ghost} disabled={busy === o.id + a} onClick={() => onAct(o.id, a)}>
            {a === "send" && <IconArrowRight size={14} />}{busy === o.id + a ? "…" : ACTION_LABEL[a]}
          </button>
        ))}
        {mine === "manager" && !acts.length && <span style={S.done}>{statusLabel(o.status)}</span>}
      </div>
    </div>
  )
}
function Field({ label, children }: any) { return <label style={S.field}><span style={S.fieldLbl}>{label}</span>{children}</label> }

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 860, margin: "0 auto", paddingBottom: 60 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 18 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(22px,3vw,28px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0 },
  sub: { fontSize: 14, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 560 },
  cta: { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  err: { background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#B91C1C", marginBottom: 14 },
  createCard: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18, marginBottom: 18 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLbl: { fontSize: 12, fontWeight: 500, color: "var(--v-ink-2)" },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "8px 11px", fontSize: 13, color: "var(--v-ink)", outline: "none", fontFamily: "inherit", width: "100%", background: "var(--v-surface)" },
  tabs: { display: "flex", gap: 4, background: "var(--v-surface-2)", padding: 4, borderRadius: 12, marginBottom: 16, width: "fit-content" },
  tab: { padding: "8px 16px", border: "none", background: "none", borderRadius: 9, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--v-ink-2)", cursor: "pointer" },
  tabOn: { background: "var(--v-surface)", color: "var(--v-ink)", boxShadow: "var(--v-shadow-sm)" },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "40px 24px", textAlign: "center" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "16px 18px", boxShadow: "var(--v-shadow-sm)" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  cardTitle: { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--v-ink)" },
  ver: { fontSize: 11, color: "var(--v-ink-3)", fontWeight: 500 },
  cardSub: { fontSize: 13, color: "var(--v-ink-2)", marginTop: 2 },
  badge: { fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 },
  compRow: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline", marginTop: 12 },
  comp: { fontSize: 13.5, color: "var(--v-ink)" },
  compMuted: { fontSize: 12.5, color: "var(--v-ink-3)", marginLeft: "auto" },
  benefits: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 },
  benefit: { fontSize: 12, color: "var(--v-ink-2)", background: "var(--v-surface-2)", padding: "3px 9px", borderRadius: 6 },
  pred: { display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "8px 12px", background: "var(--v-surface-2)", borderRadius: 10, flexWrap: "wrap" },
  predLbl: { fontSize: 12, color: "var(--v-ink-2)", fontWeight: 500 },
  predVal: { fontSize: 15, fontWeight: 700 },
  predConf: { fontSize: 11.5, color: "var(--v-ink-3)" },
  predWhy: { fontSize: 11.5, color: "var(--v-ink-3)", marginLeft: "auto" },
  actions: { display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" },
  primary: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  ghost: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-surface)", color: "var(--v-ink)", border: "1px solid var(--v-line)", borderRadius: 10, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  done: { fontSize: 13, color: "var(--v-ink-2)", fontWeight: 500 },
}
