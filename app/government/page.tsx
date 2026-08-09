"use client"
import { useCallback, useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconShield, IconPlus, IconZap, IconAlert, IconCheckCircle } from "@/components/ui/Icons"

const CURRENCIES = ["CHF", "EUR", "USD", "GBP", "INR"]

export default function GovernmentPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [d, setD] = useState<any>(null)
  const [ai, setAi] = useState<any>(null)
  const [sel, setSel] = useState<string>("")
  const [tab, setTab] = useState<"schemes" | "requests">("requests")
  const [newAgency, setNewAgency] = useState("")

  const loadAi = useCallback(() => { fetch("/api/government/intelligence").then(r => r.ok ? r.json() : null).then(x => x && setAi(x)).catch(() => {}) }, [])
  const load = useCallback((agencyId?: string) => {
    fetch(`/api/government${agencyId ? `?agencyId=${agencyId}` : ""}`).then(async r => {
      if (r.status === 401) { setState("denied"); return }
      const j = await r.json(); setD(j); setSel(j.selected || ""); setState("ok"); loadAi()
    }).catch(() => setState("denied"))
  }, [loadAi])
  useEffect(() => { load() }, [load])
  const post = async (body: any) => { const r = await fetch("/api/government", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, agencyId: body.agencyId || sel }) }); if (r.ok) load(sel); return r.ok }
  const createAgency = async () => { if (!newAgency.trim()) return; const r = await fetch("/api/government", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create-agency", name: newAgency }) }); if (r.ok) { setNewAgency(""); const j = await r.json(); load(j.id) } }

  if (state === "loading") return <AppShell title="Government"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Government"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in to manage an agency</h1></div></div></AppShell>

  const meta = d?.meta || {}, detail = d?.detail, stats = detail?.stats
  return (
    <AppShell title="Government">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconShield size={20} /> Government platform</h1>
          <p style={S.sub}>Citizen services, grievances and welfare schemes with in-house Policy Intelligence — SLA health, scheme reach (per-currency), and a brain-deliberated verdict. No external LLM.</p>
        </header>

        {(d.agencies || []).length === 0 ? (
          <div style={S.card}><div style={S.row}><input value={newAgency} onChange={e => setNewAgency(e.target.value)} placeholder="Create your agency/department (e.g. City Services Directorate)" style={{ ...S.input, flex: 1 }} onKeyDown={e => e.key === "Enter" && createAgency()} /><button onClick={createAgency} disabled={!newAgency.trim()} style={{ ...S.btnSm, opacity: newAgency.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Create</button></div></div>
        ) : (
          <>
            {ai && ai.hasData && <PolicyIntel ai={ai} />}
            <div style={S.row}>
              <select value={sel} onChange={e => { setSel(e.target.value); load(e.target.value) }} style={S.select}>{d.agencies.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              <input value={newAgency} onChange={e => setNewAgency(e.target.value)} placeholder="New agency…" style={{ ...S.input, width: 200 }} onKeyDown={e => e.key === "Enter" && createAgency()} />
              <button onClick={createAgency} disabled={!newAgency.trim()} style={{ ...S.btnGhost, opacity: newAgency.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
            </div>

            {stats && (
              <div style={S.kpis}>
                <Kpi n={stats.backlog.totalOpen} l="Open requests" />
                <Kpi n={stats.sla.overdue} l="Past SLA" accent={stats.sla.overdue ? "var(--v-red)" : undefined} />
                <Kpi n={`${stats.sla.resolutionRate}%`} l="Resolution rate" />
                <Kpi n={stats.backlog.urgentOpen} l="Urgent open" accent={stats.backlog.urgentOpen ? "var(--v-red)" : undefined} />
                <Kpi n={stats.reach.reduce((a: number, r: any) => a + r.beneficiaries, 0).toLocaleString()} l="Beneficiaries" />
              </div>
            )}

            <div style={S.tabs}>{(["requests", "schemes"] as const).map(t => <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
            {detail && tab === "requests" && <Requests detail={detail} meta={meta} post={post} />}
            {detail && tab === "schemes" && <Schemes detail={detail} meta={meta} post={post} />}
          </>
        )}
      </div>
    </AppShell>
  )
}

function PolicyIntel({ ai }: { ai: any }) {
  const del = ai.deliberation || {}
  const vColor = del.verdict === "supported" ? "var(--v-green)" : del.verdict === "refuted" ? "var(--v-red)" : "#b7791f"
  return (
    <div style={S.ai}>
      <div style={S.aiHead}><span style={S.aiTitle}><IconZap size={16} /> Policy Intelligence</span><span style={{ ...S.verdict, color: vColor, borderColor: vColor }}>{del.verdict} · {Math.round((del.confidence || 0) * 100)}%</span></div>
      <p style={S.aiWhy}>{del.why}</p>
      {(del.risks || []).length > 0 && <div style={S.chips}>{del.risks.slice(0, 4).map((r: string, i: number) => <span key={i} style={S.riskChip}><IconAlert size={11} /> {r}</span>)}</div>}
      <p style={S.aiFine}>Evidence-based, deliberated through the Enterprise Brain — audited. No external LLM.</p>
    </div>
  )
}

function Requests({ detail, meta, post }: any) {
  const [f, setF] = useState({ subject: "", kind: "GRIEVANCE", priority: "MEDIUM", citizenName: "", slaDays: "15" })
  const add = async () => { if (!f.subject.trim()) return; if (await post({ action: "create-request", ...f, slaDays: Number(f.slaDays) || 15 })) setF({ subject: "", kind: "GRIEVANCE", priority: "MEDIUM", citizenName: "", slaDays: "15" }) }
  const badge: any = { OPEN: { background: "var(--v-accent-bg,#eef0fb)", color: "var(--v-accent)" }, IN_PROGRESS: { background: "#fff7e6", color: "#b7791f" }, RESOLVED: { background: "var(--v-green-bg,#e9f9ef)", color: "var(--v-green)" }, REJECTED: { background: "var(--v-red-bg,#fee)", color: "var(--v-red)" } }
  return (
    <div>
      <div style={S.card}><div style={S.formRow}>
        <input value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} placeholder="Request / grievance subject" style={{ ...S.input, flex: 2 }} />
        <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} style={S.select}>{(meta.requestKinds || []).map((k: string) => <option key={k}>{k}</option>)}</select>
        <select value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })} style={S.select}>{(meta.priorities || []).map((k: string) => <option key={k}>{k}</option>)}</select>
        <input type="number" value={f.slaDays} onChange={e => setF({ ...f, slaDays: e.target.value })} placeholder="SLA days" style={{ ...S.input, width: 90 }} />
        <button onClick={add} disabled={!f.subject.trim()} style={{ ...S.btnSm, opacity: f.subject.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
      </div></div>
      {detail.requests.length === 0 ? <div style={S.empty}><p style={S.sub}>No requests yet.</p></div> : (
        <div style={S.list}>{detail.requests.map((r: any) => (
          <div key={r.id} style={S.item}>
            <span style={{ ...S.prio, ...(r.priority === "URGENT" ? { color: "var(--v-red)" } : r.priority === "HIGH" ? { color: "#b7791f" } : { color: "var(--v-ink-3)" }) }}>{r.priority}</span>
            <span style={{ flex: 1 }}><span style={{ color: "var(--v-ink)", fontSize: 13.5 }}>{r.subject}</span><span style={S.itemMeta}> · {r.kind}</span></span>
            <span style={{ ...S.tBadge, ...(badge[r.status] || {}) }}>{r.status.replace("_", " ")}</span>
            <select value={r.status} onChange={e => post({ action: "update-request", requestId: r.id, status: e.target.value })} style={S.moveSel}>{(meta.requestStatuses || []).map((s: string) => <option key={s}>{s}</option>)}</select>
          </div>
        ))}</div>
      )}
    </div>
  )
}

function Schemes({ detail, meta, post }: any) {
  const [f, setF] = useState({ name: "", category: "", budget: "", currency: "CHF", beneficiaries: "", status: "ACTIVE" })
  const add = async () => { if (!f.name.trim()) return; if (await post({ action: "create-scheme", ...f, budget: Number(f.budget) || 0, beneficiaries: Number(f.beneficiaries) || 0 })) setF({ name: "", category: "", budget: "", currency: "CHF", beneficiaries: "", status: "ACTIVE" }) }
  const statuses = meta.schemeStatuses || ["DRAFT", "ACTIVE", "CLOSED"]
  const badge: any = { DRAFT: { background: "var(--v-surface-2)", color: "var(--v-ink-2)" }, ACTIVE: { background: "var(--v-green-bg,#e9f9ef)", color: "var(--v-green)" }, CLOSED: { background: "var(--v-red-bg,#fee)", color: "var(--v-red)" } }
  return (
    <div>
      <div style={S.card}><div style={S.formRow}>
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Scheme name" style={{ ...S.input, flex: 2 }} />
        <input value={f.category} onChange={e => setF({ ...f, category: e.target.value })} placeholder="Category" style={{ ...S.input, flex: 1 }} />
        <input type="number" value={f.budget} onChange={e => setF({ ...f, budget: e.target.value })} placeholder="Budget" style={{ ...S.input, width: 110 }} />
        <select value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} style={S.select}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
        <input type="number" value={f.beneficiaries} onChange={e => setF({ ...f, beneficiaries: e.target.value })} placeholder="Beneficiaries" style={{ ...S.input, width: 120 }} />
        <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} style={S.select}>{statuses.map((s: string) => <option key={s}>{s}</option>)}</select>
        <button onClick={add} disabled={!f.name.trim()} style={{ ...S.btnSm, opacity: f.name.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
      </div></div>
      {(detail.stats.reach || []).length > 0 && <div style={S.reachRow}>{detail.stats.reach.map((r: any) => <span key={r.currency} style={S.reachChip}>{r.currency}: {r.beneficiaries.toLocaleString()} @ {r.costPerBeneficiary == null ? "—" : `${r.currency} ${r.costPerBeneficiary.toLocaleString()}/head`}</span>)}</div>}
      {detail.schemes.length === 0 ? <div style={S.empty}><p style={S.sub}>No schemes yet.</p></div> : (
        <div style={S.tableWrap}><table style={S.table}><thead><tr>{["Scheme", "Category", "Budget", "Beneficiaries", "Status"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{detail.schemes.map((s: any) => <tr key={s.id} style={S.tr}><td style={S.td}>{s.name}</td><td style={S.td}>{s.category || "—"}</td><td style={S.td}>{s.currency} {Number(s.budget).toLocaleString()}</td><td style={S.td}>{s.beneficiaries.toLocaleString()}</td>
            <td style={S.td}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ ...S.tBadge, ...(badge[s.status] || {}) }}>{s.status}</span><select value={s.status} onChange={e => post({ action: "update-scheme", schemeId: s.id, status: e.target.value })} style={S.moveSel}>{statuses.map((st: string) => <option key={st}>{st}</option>)}</select></span></td></tr>)}</tbody>
        </table></div>
      )}
    </div>
  )
}

function Kpi({ n, l, accent }: { n: any; l: string; accent?: string }) { return <div style={S.kpi}><div style={{ ...S.kpiN, ...(accent ? { color: accent } : {}) }}>{n == null ? "—" : n}</div><div style={S.kpiL}>{l}</div></div> }

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 1020, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 18 }, h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 720 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "34px 24px", textAlign: "center" },
  ai: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18, marginBottom: 16, borderLeft: "3px solid var(--v-accent)" },
  aiHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" },
  aiTitle: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--v-ink)", display: "flex", alignItems: "center", gap: 7 },
  aiWhy: { fontSize: 13, color: "var(--v-ink-2)", lineHeight: 1.55, margin: 0 },
  aiFine: { fontSize: 11, color: "var(--v-ink-3)", marginTop: 10, marginBottom: 0 },
  verdict: { fontSize: 11.5, fontWeight: 700, border: "1px solid", borderRadius: 999, padding: "2px 10px", textTransform: "capitalize", whiteSpace: "nowrap" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 },
  riskChip: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--v-ink-2)", background: "var(--v-surface-2)", borderRadius: 999, padding: "2px 9px" },
  row: { display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 16 },
  kpi: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px" },
  kpiN: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--v-ink)" }, kpiL: { fontSize: 11.5, color: "var(--v-ink-2)", marginTop: 2 },
  tabs: { display: "flex", gap: 6, marginBottom: 14 }, tab: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 999, padding: "7px 16px", fontSize: 13, color: "var(--v-ink-2)", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 },
  tabOn: { background: "var(--v-accent)", color: "#fff", borderColor: "var(--v-accent)" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 14, marginBottom: 12 },
  formRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none" },
  select: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)" },
  btnSm: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  btnGhost: { display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", color: "var(--v-ink-2)", border: "1px solid var(--v-line)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  item: { display: "flex", alignItems: "center", gap: 12, background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 10, padding: "10px 14px" },
  prio: { fontSize: 10.5, fontWeight: 700, width: 60 }, itemMeta: { fontSize: 12, color: "var(--v-ink-3)" },
  tBadge: { fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, textTransform: "capitalize" },
  moveSel: { border: "1px solid var(--v-line)", borderRadius: 7, padding: "4px 7px", fontSize: 11.5, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)" },
  reachRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  reachChip: { fontSize: 12, color: "var(--v-ink-2)", background: "var(--v-surface-2)", borderRadius: 999, padding: "4px 11px" },
  tableWrap: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "11px 14px", fontSize: 11.5, fontWeight: 600, color: "var(--v-ink-2)", textTransform: "uppercase", letterSpacing: ".03em", borderBottom: "1px solid var(--v-line)", background: "var(--v-surface-2)" },
  tr: { borderBottom: "1px solid var(--v-line)" }, td: { padding: "10px 14px", color: "var(--v-ink)" },
}
