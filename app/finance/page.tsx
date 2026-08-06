"use client"
import { useCallback, useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconBanknote, IconCreditCard, IconBarChart, IconPlus, IconBriefcase } from "@/components/ui/Icons"

const CURRENCIES = ["CHF", "EUR", "USD", "GBP", "INR"]
const money = (n: number, c: string) => `${c} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

export default function FinancePage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [d, setD] = useState<any>(null)
  const [tab, setTab] = useState<"invoices" | "expenses" | "budgets" | "vendors">("invoices")

  const load = useCallback(() => {
    fetch("/api/erp/finance").then(async r => {
      if (r.status === 401 || r.status === 403) { setState("denied"); return }
      setD(await r.json()); setState("ok")
    }).catch(() => setState("denied"))
  }, [])
  useEffect(() => { load() }, [load])

  const post = async (body: any) => { const r = await fetch("/api/erp/finance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); if (r.ok) load(); return r.ok }

  if (state === "loading") return <AppShell title="Finance"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Finance"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in to access finance</h1></div></div></AppShell>

  const summary = d?.summary || []
  return (
    <AppShell title="Finance">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconBanknote size={20} /> Finance & ERP</h1>
          <p style={S.sub}>Invoices, expenses, budgets and vendors — an in-house finance ledger. All figures are grouped by currency and never summed across currencies; convert explicitly when you need a single number.</p>
        </header>

        {/* Per-currency rollups */}
        {summary.length === 0 ? (
          <div style={S.empty}><p style={S.sub}>No financial data yet. Add an invoice or expense below.</p></div>
        ) : (
          <div style={S.rollups}>
            {summary.map((r: any) => (
              <div key={r.currency} style={S.roll}>
                <div style={S.rollCur}>{r.currency}</div>
                <div style={S.rollGrid}>
                  <Fig l="Revenue" v={money(r.revenue, r.currency)} color="var(--v-green)" />
                  <Fig l="Outstanding" v={money(r.outstanding, r.currency)} />
                  <Fig l="Expenses" v={money(r.expenses, r.currency)} color="var(--v-red)" />
                  <Fig l="Net" v={money(r.net, r.currency)} color={r.net >= 0 ? "var(--v-accent)" : "var(--v-red)"} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={S.tabs}>
          {(["invoices", "expenses", "budgets", "vendors"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}>{t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>

        {tab === "invoices" && <Invoices d={d} post={post} />}
        {tab === "expenses" && <Expenses d={d} post={post} />}
        {tab === "budgets" && <Budgets d={d} post={post} />}
        {tab === "vendors" && <Vendors d={d} post={post} />}
      </div>
    </AppShell>
  )
}

function Invoices({ d, post }: any) {
  const [f, setF] = useState({ number: "", client: "", amount: "", currency: "CHF", dueAt: "" })
  const add = async () => { if (!(await post({ action: "create-invoice", ...f, amount: Number(f.amount) || 0 }))) return; setF({ number: "", client: "", amount: "", currency: "CHF", dueAt: "" }) }
  return (
    <div>
      <div style={S.card}>
        <div style={S.formRow}>
          <input value={f.number} onChange={e => setF({ ...f, number: e.target.value })} placeholder="Number (auto if blank)" style={{ ...S.input, flex: 1 }} />
          <input value={f.client} onChange={e => setF({ ...f, client: e.target.value })} placeholder="Client" style={{ ...S.input, flex: 1.4 }} />
          <input type="number" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="Amount" style={{ ...S.input, width: 110 }} />
          <select value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} style={S.select}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
          <input type="date" value={f.dueAt} onChange={e => setF({ ...f, dueAt: e.target.value })} style={S.input} title="Due date" />
          <button onClick={add} disabled={!f.amount} style={{ ...S.btnSm, opacity: f.amount ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
        </div>
      </div>
      <Table rows={d.invoices} cols={["number", "client", "amount", "status"]} statuses={d.statuses?.invoice} kind="invoice" post={post} />
    </div>
  )
}

function Expenses({ d, post }: any) {
  const [f, setF] = useState({ category: "", description: "", amount: "", currency: "CHF" })
  const add = async () => { if (!(await post({ action: "create-expense", ...f, category: f.category || "general", amount: Number(f.amount) || 0 }))) return; setF({ category: "", description: "", amount: "", currency: "CHF" }) }
  return (
    <div>
      <div style={S.card}>
        <div style={S.formRow}>
          <input value={f.category} onChange={e => setF({ ...f, category: e.target.value })} placeholder="Category" style={{ ...S.input, flex: 1 }} />
          <input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Description" style={{ ...S.input, flex: 1.6 }} />
          <input type="number" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="Amount" style={{ ...S.input, width: 110 }} />
          <select value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} style={S.select}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
          <button onClick={add} disabled={!f.amount} style={{ ...S.btnSm, opacity: f.amount ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
        </div>
      </div>
      <Table rows={d.expenses} cols={["category", "description", "amount", "status"]} statuses={d.statuses?.expense} kind="expense" post={post} />
    </div>
  )
}

function Budgets({ d, post }: any) {
  const [f, setF] = useState({ category: "", amount: "", currency: "CHF", period: "" })
  const add = async () => { if (!f.category.trim()) return; if (!(await post({ action: "create-budget", ...f, amount: Number(f.amount) || 0 }))) return; setF({ category: "", amount: "", currency: "CHF", period: "" }) }
  const util = d.budgetUtil || []
  return (
    <div>
      <div style={S.card}>
        <div style={S.formRow}>
          <input value={f.category} onChange={e => setF({ ...f, category: e.target.value })} placeholder="Category" style={{ ...S.input, flex: 1 }} />
          <input type="number" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="Amount" style={{ ...S.input, width: 110 }} />
          <select value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} style={S.select}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
          <input value={f.period} onChange={e => setF({ ...f, period: e.target.value })} placeholder="Period (e.g. 2026)" style={{ ...S.input, width: 130 }} />
          <button onClick={add} disabled={!f.category.trim()} style={{ ...S.btnSm, opacity: f.category.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
        </div>
      </div>
      <p style={S.fine}><IconBarChart size={13} /> Utilisation below is CHF-only (approved + reimbursed expenses vs CHF budgets).</p>
      <div style={S.card}>
        {util.length === 0 ? <p style={S.fine}>No CHF budgets yet.</p> : util.map((b: any) => (
          <div key={b.category} style={S.budRow}>
            <span style={S.budCat}>{b.category}</span>
            <div style={S.budBarWrap}><span style={{ ...S.budBar, width: `${Math.min(100, b.utilization)}%`, background: b.over ? "var(--v-red)" : b.utilization >= 80 ? "#b7791f" : "var(--v-accent)" }} /></div>
            <span style={S.budNums}>CHF {b.spent.toLocaleString()} / {b.budget.toLocaleString()} · {b.utilization}%{b.over ? " ⚠" : ""}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Vendors({ d, post }: any) {
  const [v, setV] = useState({ name: "", contact: "", category: "" })
  const [po, setPo] = useState({ title: "", amount: "", currency: "CHF", vendorId: "" })
  const addV = async () => { if (!v.name.trim()) return; if (!(await post({ action: "create-vendor", ...v }))) return; setV({ name: "", contact: "", category: "" }) }
  const addPo = async () => { if (!po.title.trim()) return; if (!(await post({ action: "create-po", ...po, amount: Number(po.amount) || 0 }))) return; setPo({ title: "", amount: "", currency: "CHF", vendorId: "" }) }
  return (
    <div>
      <div style={S.card}>
        <div style={S.formRow}>
          <input value={v.name} onChange={e => setV({ ...v, name: e.target.value })} placeholder="Vendor name" style={{ ...S.input, flex: 1 }} />
          <input value={v.contact} onChange={e => setV({ ...v, contact: e.target.value })} placeholder="Contact" style={{ ...S.input, flex: 1 }} />
          <input value={v.category} onChange={e => setV({ ...v, category: e.target.value })} placeholder="Category" style={{ ...S.input, width: 130 }} />
          <button onClick={addV} disabled={!v.name.trim()} style={{ ...S.btnSm, opacity: v.name.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Vendor</button>
        </div>
      </div>
      <div style={S.vendGrid}>
        {(d.vendors || []).map((vn: any) => <div key={vn.id} style={S.vendCard}><IconBriefcase size={14} /><div><div style={{ fontWeight: 600, color: "var(--v-ink)", fontSize: 13 }}>{vn.name}</div><div style={S.fine}>{[vn.category, vn.contact].filter(Boolean).join(" · ") || "—"}</div></div></div>)}
        {(d.vendors || []).length === 0 && <p style={S.fine}>No vendors yet.</p>}
      </div>
      <h3 style={S.h3}>Purchase orders</h3>
      <div style={S.card}>
        <div style={S.formRow}>
          <input value={po.title} onChange={e => setPo({ ...po, title: e.target.value })} placeholder="PO title" style={{ ...S.input, flex: 1.4 }} />
          <select value={po.vendorId} onChange={e => setPo({ ...po, vendorId: e.target.value })} style={S.select}><option value="">Vendor (optional)</option>{(d.vendors || []).map((vn: any) => <option key={vn.id} value={vn.id}>{vn.name}</option>)}</select>
          <input type="number" value={po.amount} onChange={e => setPo({ ...po, amount: e.target.value })} placeholder="Amount" style={{ ...S.input, width: 110 }} />
          <select value={po.currency} onChange={e => setPo({ ...po, currency: e.target.value })} style={S.select}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
          <button onClick={addPo} disabled={!po.title.trim()} style={{ ...S.btnSm, opacity: po.title.trim() ? 1 : 0.6 }}><IconPlus size={13} /> PO</button>
        </div>
      </div>
      <Table rows={d.pos} cols={["title", "amount", "status"]} statuses={d.statuses?.po} kind="po" post={post} />
    </div>
  )
}

function Table({ rows, cols, statuses, kind, post }: any) {
  if (!rows || rows.length === 0) return <div style={S.empty}><p style={S.sub}>Nothing here yet.</p></div>
  return (
    <div style={S.tableWrap}>
      <table style={S.table}>
        <thead><tr>{cols.map((c: string) => <th key={c} style={S.th}>{c[0].toUpperCase() + c.slice(1)}</th>)}<th style={S.th}></th></tr></thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} style={S.tr}>
              {cols.map((c: string) => (
                <td key={c} style={S.td}>
                  {c === "amount" ? money(r.amount, r.currency)
                    : c === "status" ? <span style={{ ...S.statusPill, ...finStatusStyle(r.status) }}>{r.status}</span>
                    : (r[c] || "—")}
                </td>
              ))}
              <td style={{ ...S.td, textAlign: "right" }}>
                {statuses && <select value={r.status} onChange={e => post({ action: "set-status", kind, id: r.id, status: e.target.value })} style={S.selectSm}>{statuses.map((s: string) => <option key={s} value={s}>{s}</option>)}</select>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Fig({ l, v, color }: { l: string; v: string; color?: string }) { return <div><div style={{ ...S.figN, ...(color ? { color } : {}) }}>{v}</div><div style={S.figL}>{l}</div></div> }
function finStatusStyle(s: string): any {
  if (["PAID", "APPROVED", "REIMBURSED", "RECEIVED", "CLOSED"].includes(s)) return { background: "var(--v-green-bg,#e9f9ef)", color: "var(--v-green)" }
  if (["OVERDUE", "REJECTED", "VOID", "CANCELLED"].includes(s)) return { background: "var(--v-red-bg,#fee)", color: "var(--v-red)" }
  if (["SENT", "OPEN"].includes(s)) return { background: "#fff7e6", color: "#b7791f" }
  return { background: "var(--v-surface-2)", color: "var(--v-ink-3)" }
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 1000, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 18 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  h3: { fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--v-ink)", margin: "20px 0 10px" },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 700 },
  fine: { fontSize: 12, color: "var(--v-ink-3)", display: "flex", alignItems: "center", gap: 6, margin: "8px 0" },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "32px 24px", textAlign: "center" },
  rollups: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginBottom: 18 },
  roll: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18 },
  rollCur: { fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--v-ink-2)", letterSpacing: ".04em", marginBottom: 12 },
  rollGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  figN: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--v-ink)", letterSpacing: "-.01em" },
  figL: { fontSize: 11.5, color: "var(--v-ink-2)", marginTop: 2 },
  tabs: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" },
  tab: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 999, padding: "7px 16px", fontSize: 13, color: "var(--v-ink-2)", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 },
  tabOn: { background: "var(--v-accent)", color: "#fff", borderColor: "var(--v-accent)" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 14, marginBottom: 12 },
  formRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none" },
  select: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)" },
  selectSm: { border: "1px solid var(--v-line)", borderRadius: 7, padding: "4px 7px", fontSize: 11.5, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)" },
  btnSm: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  tableWrap: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "11px 14px", fontSize: 11.5, fontWeight: 600, color: "var(--v-ink-2)", textTransform: "uppercase", letterSpacing: ".03em", borderBottom: "1px solid var(--v-line)", background: "var(--v-surface-2)" },
  tr: { borderBottom: "1px solid var(--v-line)" },
  td: { padding: "11px 14px", color: "var(--v-ink)", verticalAlign: "middle" },
  statusPill: { fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999 },
  budRow: { display: "flex", alignItems: "center", gap: 12, padding: "9px 0", fontSize: 13 },
  budCat: { width: 130, color: "var(--v-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  budBarWrap: { flex: 1, height: 9, background: "var(--v-surface-2)", borderRadius: 999, overflow: "hidden" },
  budBar: { display: "block", height: "100%", borderRadius: 999 },
  budNums: { fontSize: 11.5, color: "var(--v-ink-2)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  vendGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10, marginBottom: 8 },
  vendCard: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", color: "var(--v-ink-2)" },
}
