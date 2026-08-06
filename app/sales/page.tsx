"use client"
import { useCallback, useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconTrendingUp, IconPlus, IconZap, IconActivity, IconMessage, IconTarget } from "@/components/ui/Icons"

const CURRENCIES = ["CHF", "EUR", "USD", "GBP", "INR"]
const money = (n: number, c: string) => `${c} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const OPEN = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION"]

export default function SalesPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [d, setD] = useState<any>(null)
  const [ai, setAi] = useState<any>(null)
  const [tab, setTab] = useState<"pipeline" | "campaigns" | "support">("pipeline")

  const loadAi = useCallback(() => { fetch("/api/crm/assistant").then(r => r.ok ? r.json() : null).then(x => x && setAi(x)).catch(() => {}) }, [])
  const load = useCallback(() => {
    fetch("/api/crm/sales").then(async r => {
      if (r.status === 401 || r.status === 403) { setState("denied"); return }
      setD(await r.json()); setState("ok"); loadAi()
    }).catch(() => setState("denied"))
  }, [loadAi])
  useEffect(() => { load() }, [load])
  const post = async (body: any) => { const r = await fetch("/api/crm/sales", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); if (r.ok) { load() } return r.ok }

  if (state === "loading") return <AppShell title="Sales"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Sales"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>CRM access required</h1><p style={S.sub}>The Sales workspace is part of the CRM. Ask an admin to enable it for your plan.</p></div></div></AppShell>

  const meta = d?.meta || {}
  return (
    <AppShell title="Sales">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconTrendingUp size={20} /> Sales & revenue</h1>
          <p style={S.sub}>A weighted pipeline, marketing campaigns and support — one revenue engine. Forecasts are probability-weighted and grouped by currency (never summed across currencies). In-house intelligence, no external LLM.</p>
        </header>

        {ai && <SalesAssistant ai={ai} />}

        {/* Revenue rollup per currency */}
        {(d.pipeline || []).length > 0 && (
          <div style={S.rollups}>
            {d.pipeline.map((r: any) => (
              <div key={r.currency} style={S.roll}>
                <div style={S.rollCur}>{r.currency}</div>
                <div style={S.rollGrid}>
                  <Fig l="Open pipeline" v={money(r.openValue, r.currency)} />
                  <Fig l="Weighted forecast" v={money(r.weightedValue, r.currency)} color="var(--v-accent)" />
                  <Fig l="Won" v={money(r.wonValue, r.currency)} color="var(--v-green)" />
                  <Fig l="Open deals" v={String(r.openCount)} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={S.winRow}>
          <span style={S.winChip}>Win rate <strong>{d.win?.rate ?? 0}%</strong></span>
          <span style={S.winSub}>{d.win?.won ?? 0} won · {d.win?.lost ?? 0} lost</span>
        </div>

        <div style={S.tabs}>
          {(["pipeline", "campaigns", "support"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        {tab === "pipeline" && <Pipeline d={d} meta={meta} post={post} />}
        {tab === "campaigns" && <Campaigns d={d} meta={meta} post={post} />}
        {tab === "support" && <Support d={d} meta={meta} post={post} />}
      </div>
    </AppShell>
  )
}

function SalesAssistant({ ai }: { ai: any }) {
  const advice = ai.advice || {}
  const suggestions = advice.suggestions || []
  const sev: any = { urgent: "var(--v-red)", high: "#b7791f", medium: "var(--v-accent)", low: "var(--v-ink-3)" }
  return (
    <div style={S.ai}>
      <div style={S.aiHead}><span style={S.aiTitle}><IconZap size={16} /> AI Sales Assistant</span><span style={S.aiSummary}>{advice.summary}</span></div>
      {suggestions.length > 0 && (
        <div style={S.aiList}>
          {suggestions.slice(0, 6).map((s: any) => (
            <div key={s.id} style={S.aiItem}>
              <span style={{ ...S.aiDot, background: sev[s.severity] || "var(--v-ink-3)" }} />
              <div style={{ flex: 1 }}><div style={S.aiItemTitle}>{s.title} <span style={{ ...S.sevTag, color: sev[s.severity] }}>{s.severity}</span></div><div style={S.aiItemDetail}>{s.detail}</div></div>
            </div>
          ))}
        </div>
      )}
      <p style={S.aiFine}>Deterministic revenue intelligence — audited through the AI gateway. No external LLM.</p>
    </div>
  )
}

function Pipeline({ d, meta, post }: any) {
  const [f, setF] = useState({ title: "", amount: "", currency: "CHF", stage: "LEAD" })
  const stages: string[] = meta.stages || []
  const byStage = (st: string) => (d.deals || []).filter((x: any) => x.stage === st)
  const add = async () => { if (!f.title.trim()) return; if (await post({ action: "create-deal", ...f, amount: Number(f.amount) || 0 })) setF({ title: "", amount: "", currency: "CHF", stage: "LEAD" }) }
  return (
    <div>
      <div style={S.card}>
        <div style={S.formRow}>
          <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="New deal name" style={{ ...S.input, flex: 2 }} />
          <input type="number" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="Amount" style={{ ...S.input, width: 120 }} />
          <select value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} style={S.select}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
          <select value={f.stage} onChange={e => setF({ ...f, stage: e.target.value })} style={S.select}>{OPEN.map(s => <option key={s} value={s}>{s}</option>)}</select>
          <button onClick={add} disabled={!f.title.trim()} style={{ ...S.btnSm, opacity: f.title.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
        </div>
      </div>
      <div style={S.board}>
        {stages.map(st => (
          <div key={st} style={S.col}>
            <div style={S.colHead}>{st} <span style={S.colCount}>{byStage(st).length}</span></div>
            {byStage(st).map((deal: any) => (
              <div key={deal.id} style={S.deal}>
                <div style={S.dealTitle}>{deal.title}</div>
                <div style={S.dealMeta}>{money(deal.amount, deal.currency)} · {deal.probability}%</div>
                <div style={S.dealActions}>
                  <select value={deal.stage} onChange={e => post({ action: "move-deal", dealId: deal.id, stage: e.target.value })} style={S.moveSel}>
                    {stages.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            ))}
            {byStage(st).length === 0 && <p style={S.colEmpty}>—</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Campaigns({ d, meta, post }: any) {
  const [f, setF] = useState({ name: "", channel: "EMAIL", budget: "", currency: "CHF", sent: "", opened: "", converted: "" })
  const add = async () => { if (!f.name.trim()) return; if (await post({ action: "create-campaign", ...f, budget: Number(f.budget) || 0, sent: Number(f.sent) || 0, opened: Number(f.opened) || 0, converted: Number(f.converted) || 0 })) setF({ name: "", channel: "EMAIL", budget: "", currency: "CHF", sent: "", opened: "", converted: "" }) }
  const perf: Record<string, any> = Object.fromEntries((d.campaignPerf || []).map((p: any) => [p.name, p]))
  return (
    <div>
      <div style={S.card}>
        <div style={S.formRow}>
          <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Campaign name" style={{ ...S.input, flex: 1.6 }} />
          <select value={f.channel} onChange={e => setF({ ...f, channel: e.target.value })} style={S.select}>{(meta.channels || []).map((c: string) => <option key={c}>{c}</option>)}</select>
          <input type="number" value={f.budget} onChange={e => setF({ ...f, budget: e.target.value })} placeholder="Budget" style={{ ...S.input, width: 100 }} />
          <select value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} style={S.select}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
          <input type="number" value={f.sent} onChange={e => setF({ ...f, sent: e.target.value })} placeholder="Sent" style={{ ...S.input, width: 76 }} />
          <input type="number" value={f.opened} onChange={e => setF({ ...f, opened: e.target.value })} placeholder="Opened" style={{ ...S.input, width: 82 }} />
          <input type="number" value={f.converted} onChange={e => setF({ ...f, converted: e.target.value })} placeholder="Conv." style={{ ...S.input, width: 76 }} />
          <button onClick={add} disabled={!f.name.trim()} style={{ ...S.btnSm, opacity: f.name.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
        </div>
      </div>
      {(d.campaigns || []).length === 0 ? <div style={S.empty}><p style={S.sub}>No campaigns yet.</p></div> : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr>{["Campaign", "Channel", "Status", "Open %", "Conv %", "Cost/conv"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {d.campaigns.map((c: any) => { const pf = perf[c.name] || {}; return (
                <tr key={c.id} style={S.tr}>
                  <td style={S.td}>{c.name}</td>
                  <td style={S.td}>{c.channel}</td>
                  <td style={S.td}>
                    <select value={c.status} onChange={e => post({ action: "update-campaign", campaignId: c.id, status: e.target.value })} style={S.moveSel}>{(meta.campaignStatuses || []).map((s: string) => <option key={s}>{s}</option>)}</select>
                  </td>
                  <td style={S.td}>{pf.openRate ?? 0}%</td>
                  <td style={S.td}>{pf.convRate ?? 0}%</td>
                  <td style={S.td}>{pf.costPerConv == null ? "—" : money(pf.costPerConv, c.currency)}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Support({ d, meta, post }: any) {
  const [f, setF] = useState({ subject: "", priority: "MEDIUM", body: "" })
  const add = async () => { if (!f.subject.trim()) return; if (await post({ action: "create-ticket", ...f })) setF({ subject: "", priority: "MEDIUM", body: "" }) }
  const th = d.ticketHealth || {}
  const badge: any = { OPEN: { background: "var(--v-accent-bg,#eef0fb)", color: "var(--v-accent)" }, PENDING: { background: "#fff7e6", color: "#b7791f" }, RESOLVED: { background: "var(--v-green-bg,#e9f9ef)", color: "var(--v-green)" }, CLOSED: { background: "var(--v-surface-2)", color: "var(--v-ink-3)" } }
  return (
    <div>
      <div style={S.thRow}>
        <span style={S.thChip}>Backlog <strong>{th.backlog ?? 0}</strong></span>
        <span style={S.thChip}>Urgent open <strong style={{ color: th.urgentOpen ? "var(--v-red)" : undefined }}>{th.urgentOpen ?? 0}</strong></span>
        <span style={S.thChip}>Avg resolution <strong>{th.avgResolutionHours == null ? "—" : `${th.avgResolutionHours}h`}</strong></span>
        <span style={{ ...S.thBand, ...(th.band === "overloaded" ? { color: "var(--v-red)" } : th.band === "watch" ? { color: "#b7791f" } : { color: "var(--v-green)" }) }}>{th.band}</span>
      </div>
      <div style={S.card}>
        <div style={S.formRow}>
          <input value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} placeholder="Ticket subject" style={{ ...S.input, flex: 2 }} />
          <select value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })} style={S.select}>{(meta.ticketPriorities || []).map((p: string) => <option key={p}>{p}</option>)}</select>
          <button onClick={add} disabled={!f.subject.trim()} style={{ ...S.btnSm, opacity: f.subject.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
        </div>
      </div>
      {(d.tickets || []).length === 0 ? <div style={S.empty}><p style={S.sub}>No tickets yet.</p></div> : (
        <div style={S.list}>
          {d.tickets.map((t: any) => (
            <div key={t.id} style={S.ticket}>
              <span style={{ ...S.prio, ...(t.priority === "URGENT" ? { color: "var(--v-red)" } : t.priority === "HIGH" ? { color: "#b7791f" } : { color: "var(--v-ink-3)" }) }}>{t.priority}</span>
              <span style={{ flex: 1, color: "var(--v-ink)", fontSize: 13.5 }}>{t.subject}</span>
              <span style={{ ...S.tBadge, ...(badge[t.status] || {}) }}>{t.status}</span>
              <select value={t.status} onChange={e => post({ action: "update-ticket", ticketId: t.id, status: e.target.value })} style={S.moveSel}>{(meta.ticketStatuses || []).map((s: string) => <option key={s}>{s}</option>)}</select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Fig({ l, v, color }: { l: string; v: string; color?: string }) { return <div><div style={{ ...S.figN, ...(color ? { color } : {}) }}>{v}</div><div style={S.figL}>{l}</div></div> }

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 1060, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 18 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 720 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "34px 24px", textAlign: "center" },
  ai: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18, marginBottom: 16, borderLeft: "3px solid var(--v-accent)" },
  aiHead: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, marginBottom: 12 },
  aiTitle: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--v-ink)", display: "flex", alignItems: "center", gap: 7 },
  aiSummary: { fontSize: 13, color: "var(--v-ink-2)" },
  aiList: { display: "flex", flexDirection: "column", gap: 8 },
  aiItem: { display: "flex", gap: 10, alignItems: "flex-start" },
  aiDot: { width: 8, height: 8, borderRadius: 999, marginTop: 6, flexShrink: 0 },
  aiItemTitle: { fontSize: 13, fontWeight: 600, color: "var(--v-ink)" },
  sevTag: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginLeft: 4 },
  aiItemDetail: { fontSize: 12, color: "var(--v-ink-2)", lineHeight: 1.5, marginTop: 1 },
  aiFine: { fontSize: 11, color: "var(--v-ink-3)", marginTop: 12, marginBottom: 0 },
  rollups: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginBottom: 12 },
  roll: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18 },
  rollCur: { fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--v-ink-2)", letterSpacing: ".04em", marginBottom: 12 },
  rollGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  figN: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--v-ink)", letterSpacing: "-.01em" },
  figL: { fontSize: 11.5, color: "var(--v-ink-2)", marginTop: 2 },
  winRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  winChip: { fontSize: 13, color: "var(--v-ink-2)" },
  winSub: { fontSize: 12, color: "var(--v-ink-3)" },
  tabs: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" },
  tab: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 999, padding: "7px 16px", fontSize: 13, color: "var(--v-ink-2)", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 },
  tabOn: { background: "var(--v-accent)", color: "#fff", borderColor: "var(--v-accent)" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 14, marginBottom: 12 },
  formRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none" },
  select: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)" },
  btnSm: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  board: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, overflowX: "auto" },
  col: { background: "var(--v-surface-2)", borderRadius: 12, padding: 10, minWidth: 150 },
  colHead: { fontSize: 11.5, fontWeight: 700, color: "var(--v-ink-2)", marginBottom: 8, display: "flex", justifyContent: "space-between", textTransform: "uppercase", letterSpacing: ".02em" },
  colCount: { background: "var(--v-surface)", borderRadius: 999, padding: "0 7px", color: "var(--v-ink-3)" },
  colEmpty: { fontSize: 12, color: "var(--v-ink-3)", textAlign: "center", margin: "8px 0" },
  deal: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 10px", marginBottom: 7 },
  dealTitle: { fontSize: 12.5, fontWeight: 600, color: "var(--v-ink)", lineHeight: 1.35 },
  dealMeta: { fontSize: 11.5, color: "var(--v-ink-2)", marginTop: 3 },
  dealActions: { marginTop: 6 },
  moveSel: { border: "1px solid var(--v-line)", borderRadius: 6, padding: "4px 6px", fontSize: 11, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)", width: "100%" },
  tableWrap: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "11px 14px", fontSize: 11.5, fontWeight: 600, color: "var(--v-ink-2)", textTransform: "uppercase", letterSpacing: ".03em", borderBottom: "1px solid var(--v-line)", background: "var(--v-surface-2)" },
  tr: { borderBottom: "1px solid var(--v-line)" },
  td: { padding: "10px 14px", color: "var(--v-ink)", verticalAlign: "middle" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  ticket: { display: "flex", alignItems: "center", gap: 12, background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 10, padding: "10px 14px" },
  prio: { fontSize: 10.5, fontWeight: 700, width: 60, letterSpacing: ".03em" },
  tBadge: { fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999 },
  thRow: { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 12 },
  thChip: { fontSize: 12.5, color: "var(--v-ink-2)" },
  thBand: { fontSize: 12, fontWeight: 700, textTransform: "capitalize", marginLeft: "auto" },
}
