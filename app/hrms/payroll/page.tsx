"use client"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconBanknote, IconUsers, IconCheck, IconFileText } from "@/components/ui/Icons"

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

type Comp = { name: string; kind: "earning" | "deduction"; calc: "fixed" | "pct_basic" | "pct_ctc"; value: number; cap?: number }
type Emp = { id: string; name: string; email?: string; code: string; department?: string; designation?: string; status: string; compensation: { currency: string; annualCTC: number; components: Comp[] } | null }
type Run = { id: string; label: string; status: string; currency: string; totalGross: number; totalDeduct: number; totalNet: number; headcount: number }

const money = (n: number, c: string) => `${c} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function PayrollPage() {
  const now = new Date()
  const [data, setData] = useState<{ runs: Run[]; employees: Emp[] }>({ runs: [], employees: [] })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [workingDays, setWorkingDays] = useState(30)
  const [editing, setEditing] = useState<Emp | null>(null)
  const [form, setForm] = useState<{ currency: string; annualCTC: string; components: Comp[] }>({ currency: "INR", annualCTC: "", components: [] })
  const [preview, setPreview] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch("/api/hrms/payroll")
    if (r.ok) setData(await r.json())
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  function openEditor(e: Emp) {
    setEditing(e)
    setPreview(null)
    setForm(e.compensation
      ? { currency: e.compensation.currency, annualCTC: String(e.compensation.annualCTC), components: e.compensation.components }
      : { currency: "INR", annualCTC: "", components: [
          { name: "Basic", kind: "earning", calc: "pct_ctc", value: 40 },
          { name: "House Rent Allowance", kind: "earning", calc: "pct_basic", value: 50 },
          { name: "Special Allowance", kind: "earning", calc: "pct_ctc", value: 25 },
          { name: "Provident Fund (employee)", kind: "deduction", calc: "pct_basic", value: 12, cap: 1800 },
          { name: "Professional Tax", kind: "deduction", calc: "fixed", value: 200 },
        ] })
  }

  async function saveStructure() {
    if (!editing) return
    setBusy(true); setMsg(null)
    const r = await fetch("/api/hrms/compensation", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: editing.id, currency: form.currency, annualCTC: Number(form.annualCTC), components: form.components }),
    })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg({ kind: "err", text: d.error || "Could not save." }); return }
    setPreview(d.preview)
    setMsg({ kind: "ok", text: `Saved. ${editing.name} nets ${money(d.preview.net, form.currency)} a month.` })
    load()
  }

  async function runPayroll() {
    setBusy(true); setMsg(null)
    const r = await fetch("/api/hrms/payroll", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodYear: year, periodMonth: month, workingDays }),
    })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg({ kind: "err", text: d.error || "Could not run payroll." }); return }
    setMsg({ kind: "ok", text: `${d.label}: ${d.headcount} paid, net ${money(d.totalNet, d.currency)}.${d.note ? " " + d.note : ""}` })
    load()
  }

  async function advance(runId: string, action: "approve" | "paid" | "cancel") {
    setBusy(true); setMsg(null)
    const r = await fetch("/api/hrms/payroll", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId, action }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg({ kind: "err", text: d.error || "Could not update the run." }); return }
    load()
  }

  const ready = data.employees.filter((e) => e.compensation).length
  const missing = data.employees.length - ready

  return (
    <AppShell title="Payroll">
      <div style={S.wrap}>
        <div style={S.head}>
          <div>
            <h1 style={S.h1}>Payroll</h1>
            <p style={S.sub}>{ready} of {data.employees.length} employees have a salary structure</p>
          </div>
          <Link href="/hrms" style={S.ghost}>← HRMS</Link>
        </div>

        <div style={S.notice}>
          <b>This computes pay from the structure you define.</b> It is not a statutory-compliance
          product — it does not know current PF/ESI/TDS rates, slabs or caps, and it files nothing.
          Every rate below is yours. Have finance or your CA verify a structure before anyone is paid from it.
        </div>

        {msg && <div style={{ ...S.msg, ...(msg.kind === "err" ? S.msgErr : S.msgOk) }}>{msg.text}</div>}

        {/* run a cycle */}
        <section style={S.card}>
          <h2 style={S.cardHead}><IconBanknote size={16} /> Run a cycle</h2>
          <div style={S.row}>
            <label style={S.field}><span style={S.label}>Month</span>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={S.input}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <label style={S.field}><span style={S.label}>Year</span>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={S.input} />
            </label>
            <label style={S.field}><span style={S.label}>Working days</span>
              <input type="number" min={1} max={31} value={workingDays} onChange={(e) => setWorkingDays(Number(e.target.value))} style={S.input} />
            </label>
            <button onClick={runPayroll} disabled={busy || !ready} style={{ ...S.primary, ...(busy || !ready ? S.disabled : {}) }}>
              {busy ? "Working…" : "Compute payroll"}
            </button>
          </div>
          {missing > 0 && <p style={S.warn}>{missing} employee{missing === 1 ? "" : "s"} without a structure will be left out — set their compensation below.</p>}
        </section>

        {/* runs */}
        <section style={S.card}>
          <h2 style={S.cardHead}><IconFileText size={16} /> Cycles</h2>
          {loading ? <p style={S.dim}>Loading…</p> : data.runs.length === 0 ? <p style={S.dim}>No payroll has been run yet.</p> : (
            <div style={S.table} data-table-wrap>
              <div data-table style={{ ...S.tr, ...S.th }}><span>Period</span><span>Staff</span><span>Gross</span><span>Deductions</span><span>Net</span><span>Status</span><span /></div>
              {data.runs.map((r) => (
                <div key={r.id} data-table style={S.tr}>
                  <span style={S.strong}>{r.label}</span>
                  <span>{r.headcount}</span>
                  <span>{money(r.totalGross, r.currency)}</span>
                  <span>{money(r.totalDeduct, r.currency)}</span>
                  <span style={S.strong}>{money(r.totalNet, r.currency)}</span>
                  <span><em style={{ ...S.pill, ...(S as any)[`pill_${r.status}`] }}>{r.status}</em></span>
                  <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {r.status === "DRAFT" && <button onClick={() => advance(r.id, "approve")} disabled={busy} style={S.mini}>Approve</button>}
                    {r.status === "APPROVED" && <button onClick={() => advance(r.id, "paid")} disabled={busy} style={S.mini}>Mark paid</button>}
                    {(r.status === "DRAFT" || r.status === "APPROVED") && <button onClick={() => advance(r.id, "cancel")} disabled={busy} style={S.miniGhost}>Cancel</button>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* people */}
        <section style={S.card}>
          <h2 style={S.cardHead}><IconUsers size={16} /> Salary structures</h2>
          {loading ? <p style={S.dim}>Loading…</p> : (
            <div style={S.table} data-table-wrap>
              <div data-table style={{ ...S.tr2, ...S.th }}><span>Employee</span><span>Department</span><span>Annual CTC</span><span /></div>
              {data.employees.map((e) => (
                <div key={e.id} data-table style={S.tr2}>
                  <span><span style={S.strong}>{e.name}</span> <span style={S.dim}>{e.code}</span></span>
                  <span style={S.dim}>{e.department || "—"}</span>
                  <span>{e.compensation ? money(e.compensation.annualCTC, e.compensation.currency) : <em style={S.none}>not set</em>}</span>
                  <span style={{ textAlign: "right" }}><button onClick={() => openEditor(e)} style={S.mini}>{e.compensation ? "Edit" : "Set"}</button></span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* editor */}
        {editing && (
          <div style={S.overlay} onClick={() => setEditing(null)}>
            <div style={S.modal} onClick={(ev) => ev.stopPropagation()}>
              <h2 style={S.cardHead}>{editing.name} — salary structure</h2>
              <div style={S.row}>
                <label style={S.field}><span style={S.label}>Currency</span>
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} style={S.input}>
                    {["INR","CHF","EUR","USD","GBP","SGD","AED"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label style={{ ...S.field, flex: 2 }}><span style={S.label}>Annual CTC</span>
                  <input type="number" value={form.annualCTC} onChange={(e) => setForm({ ...form, annualCTC: e.target.value })} placeholder="1200000" style={S.input} />
                </label>
              </div>

              <div style={S.compHead}><span>Component</span><span>Type</span><span>Basis</span><span>Value</span><span>Cap</span><span /></div>
              {form.components.map((c, i) => (
                <div key={i} style={S.compRow}>
                  <input value={c.name} onChange={(e) => { const n = [...form.components]; n[i] = { ...c, name: e.target.value }; setForm({ ...form, components: n }) }} style={S.input} />
                  <select value={c.kind} onChange={(e) => { const n = [...form.components]; n[i] = { ...c, kind: e.target.value as any }; setForm({ ...form, components: n }) }} style={S.input}>
                    <option value="earning">Earning</option><option value="deduction">Deduction</option>
                  </select>
                  <select value={c.calc} onChange={(e) => { const n = [...form.components]; n[i] = { ...c, calc: e.target.value as any }; setForm({ ...form, components: n }) }} style={S.input}>
                    <option value="fixed">Fixed</option><option value="pct_basic">% of Basic</option><option value="pct_ctc">% of CTC</option>
                  </select>
                  <input type="number" value={c.value} onChange={(e) => { const n = [...form.components]; n[i] = { ...c, value: Number(e.target.value) }; setForm({ ...form, components: n }) }} style={S.input} />
                  <input type="number" value={c.cap ?? ""} placeholder="—" onChange={(e) => { const n = [...form.components]; n[i] = { ...c, cap: e.target.value === "" ? undefined : Number(e.target.value) }; setForm({ ...form, components: n }) }} style={S.input} />
                  <button onClick={() => setForm({ ...form, components: form.components.filter((_, j) => j !== i) })} style={S.miniGhost}>Remove</button>
                </div>
              ))}
              <button onClick={() => setForm({ ...form, components: [...form.components, { name: "", kind: "earning", calc: "fixed", value: 0 }] })} style={S.mini}>+ Add component</button>

              {preview && (
                <div style={S.preview}>
                  {preview.lines.map((l: any) => (
                    <div key={l.name} style={S.pline}><span>{l.kind === "earning" ? "+" : "−"} {l.name}</span><span>{money(l.amount, form.currency)}</span></div>
                  ))}
                  <div style={{ ...S.pline, ...S.ptotal }}><span>Net monthly</span><span>{money(preview.net, form.currency)}</span></div>
                </div>
              )}

              <div style={S.modalActions}>
                <button onClick={() => setEditing(null)} style={S.ghost}>Close</button>
                <button onClick={saveStructure} disabled={busy} style={{ ...S.primary, ...(busy ? S.disabled : {}) }}>
                  {busy ? "Saving…" : <><IconCheck size={14} /> Save structure</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 1040, margin: "0 auto", padding: "6px 4px 48px", display: "flex", flexDirection: "column", gap: 16 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
  h1: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--v-ink)", margin: 0, letterSpacing: "-.02em" },
  sub: { fontSize: 13.5, color: "var(--v-ink-3)", marginTop: 4 },
  notice: { background: "var(--v-surface-2)", border: "1px solid var(--v-line-2)", borderRadius: 12, padding: "13px 16px", fontSize: 13, lineHeight: 1.6, color: "var(--v-ink-2)" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 20 },
  cardHead: { display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--v-ink)", margin: "0 0 14px" },
  row: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" },
  field: { display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 120 },
  label: { fontSize: 11.5, fontWeight: 600, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".04em" },
  input: { border: "1px solid var(--v-line-2)", borderRadius: 9, padding: "9px 11px", fontSize: 14, color: "var(--v-ink)", background: "var(--v-bg)", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  primary: { display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 999, border: "none", background: "var(--v-accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  ghost: { display: "inline-flex", alignItems: "center", padding: "9px 16px", borderRadius: 999, border: "1px solid var(--v-line-2)", background: "var(--v-surface)", color: "var(--v-ink)", fontSize: 13.5, fontWeight: 600, textDecoration: "none", cursor: "pointer" },
  disabled: { opacity: .5, cursor: "not-allowed" },
  mini: { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--v-accent)", background: "transparent", color: "var(--v-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  miniGhost: { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--v-line-2)", background: "transparent", color: "var(--v-ink-3)", fontSize: 12.5, cursor: "pointer" },
  table: { display: "flex", flexDirection: "column" },
  tr: { display: "grid", gridTemplateColumns: "1.2fr .5fr 1fr 1fr 1fr .8fr 1.4fr", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--v-line)", fontSize: 13.5 },
  tr2: { display: "grid", gridTemplateColumns: "2fr 1.2fr 1.2fr .8fr", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--v-line)", fontSize: 13.5 },
  th: { fontSize: 11, fontWeight: 700, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".05em" },
  strong: { fontWeight: 600, color: "var(--v-ink)" },
  dim: { color: "var(--v-ink-3)", fontSize: 13 },
  none: { color: "var(--v-ink-3)", fontStyle: "italic" },
  warn: { fontSize: 12.5, color: "#8A6D1F", marginTop: 10 },
  pill: { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, fontStyle: "normal", background: "var(--v-surface-2)", color: "var(--v-ink-2)" },
  pill_APPROVED: { background: "#E6F0FF", color: "#1D4E9B" },
  pill_PAID: { background: "var(--v-accent-soft)", color: "var(--v-accent)" },
  pill_CANCELLED: { background: "#FBE9E9", color: "#A33" },
  msg: { padding: "11px 15px", borderRadius: 10, fontSize: 13.5 },
  msgOk: { background: "var(--v-accent-soft)", color: "var(--v-accent)" },
  msgErr: { background: "#FBE9E9", color: "#A33" },
  overlay: { position: "fixed", inset: 0, background: "rgba(20,15,40,.4)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" },
  modal: { width: "100%", maxWidth: 780, background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 16, padding: 22, display: "flex", flexDirection: "column", gap: 12 },
  compHead: { display: "grid", gridTemplateColumns: "1.6fr .9fr 1fr .7fr .7fr .8fr", gap: 8, fontSize: 11, fontWeight: 700, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 6 },
  compRow: { display: "grid", gridTemplateColumns: "1.6fr .9fr 1fr .7fr .7fr .8fr", gap: 8, alignItems: "center" },
  preview: { background: "var(--v-bg)", border: "1px solid var(--v-line)", borderRadius: 11, padding: 14, display: "flex", flexDirection: "column", gap: 6, marginTop: 6 },
  pline: { display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--v-ink-2)" },
  ptotal: { borderTop: "1px solid var(--v-line-2)", paddingTop: 8, marginTop: 4, fontWeight: 700, color: "var(--v-ink)" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 },
}
