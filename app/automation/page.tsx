"use client"
import { useEffect, useState, useCallback } from "react"
import AppShell from "@/components/vrittih/AppShell"
import EmptyState from "@/components/vrittih/EmptyState"
import { IconZap, IconCheck, IconActivity } from "@/components/ui/Icons"

type Rule = { id: string; name: string; enabled: boolean; trigger: string; conditions: any[]; actionType: string; actionConfig: any; runs: number; lastRunAt: string | null }
type Catalog = { triggers: any[]; ops: any[]; actions: any[] }

export default function AutomationPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [msg, setMsg] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setErr(false)
    try {
      const [a, r] = await Promise.all([
        fetch("/api/automation").then(x => x.json()),
        fetch("/api/automation/runs").then(x => x.json()).catch(() => ({ runs: [] })),
      ])
      setRules(a.rules || []); setCatalog(a.catalog || null); setRuns(r.runs || [])
    } catch { setErr(true) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function toggle(rule: Rule) {
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
    try { await fetch(`/api/automation/${rule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !rule.enabled }) }) } catch {}
  }
  async function remove(id: string) {
    if (!confirm("Delete this rule?")) return
    try { await fetch(`/api/automation/${id}`, { method: "DELETE" }); load() } catch {}
  }
  async function test(id: string) {
    setMsg("")
    try {
      const r = await fetch(`/api/automation/${id}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      const d = await r.json().catch(() => ({}))
      setMsg(d.matched ? `Test: matched → ${d.actionResult?.ok ? "action ran" : "action failed"} — ${d.actionResult?.detail || ""}` : "Test: conditions did not match the sample payload.")
      load()
    } catch { setMsg("Test failed to reach the server.") }
  }

  const triggerLabel = (k: string) => catalog?.triggers.find(t => t.key === k)?.label || k
  const actionLabel = (k: string) => catalog?.actions.find(a => a.key === k)?.label || k

  return (
    <AppShell title="Automation">
      <div style={S.wrap}>
        <div style={S.head}>
          <div>
            <h1 style={S.h1}>Automation</h1>
            <p style={S.sub}>When something happens on the platform, run an action automatically — notify, run an AI capability, or call a webhook. Every run is audited.</p>
          </div>
          <button onClick={() => { setShowNew(true); setMsg("") }} style={S.newBtn} disabled={!catalog}>New rule</button>
        </div>

        {msg && <div style={S.msg}>{msg}</div>}

        {loading ? (
          <div style={S.center}>Loading…</div>
        ) : err ? (
          <div style={S.center}>Couldn&rsquo;t load automation. <button onClick={load} style={S.retry}>Retry</button></div>
        ) : (
          <>
            {rules.length === 0 ? (
              <EmptyState title="No automation rules yet" reason="Create a rule to react to platform events automatically." ctaLabel="New rule" onCta={() => setShowNew(true)} />
            ) : (
              <div style={S.list}>
                {rules.map(r => (
                  <div key={r.id} style={S.card}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.cardName}>{r.name}</div>
                      <div style={S.cardMeta}>
                        <span style={S.pill}><IconZap size={11} /> {triggerLabel(r.trigger)}</span>
                        {r.conditions.length > 0 && <span style={S.muted}>{r.conditions.length} condition{r.conditions.length > 1 ? "s" : ""}</span>}
                        <span style={S.arrow}>→</span>
                        <span style={S.pill}>{actionLabel(r.actionType)}</span>
                      </div>
                      <div style={S.runMeta}>{r.runs} run{r.runs === 1 ? "" : "s"}{r.lastRunAt ? ` · last ${new Date(r.lastRunAt).toLocaleString()}` : ""}</div>
                    </div>
                    <div style={S.cardActions}>
                      <button onClick={() => test(r.id)} style={S.smallBtn}>Test</button>
                      <button onClick={() => remove(r.id)} style={S.delBtn}>Delete</button>
                      <button onClick={() => toggle(r)} style={{ ...S.toggle, ...(r.enabled ? S.toggleOn : {}) }} aria-label={r.enabled ? "Disable" : "Enable"}>
                        <span style={{ ...S.knob, ...(r.enabled ? S.knobOn : {}) }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 style={S.h2}><IconActivity size={15} /> Recent runs</h2>
            <div style={S.card}>
              {runs.length === 0 ? <p style={S.muted}>No runs yet. Rules run when their trigger event fires, or when you press Test.</p> : (
                <div>
                  {runs.map(run => (
                    <div key={run.id} style={S.runRow}>
                      <span style={{ ...S.dot, background: run.status === "ok" ? "#059669" : run.status === "error" ? "#DC2626" : "var(--v-ink-3)" }} />
                      <span style={S.runRule}>{run.rule}</span>
                      <span style={S.runDetail}>{run.detail || run.status}</span>
                      <span style={S.runTime}>{new Date(run.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {showNew && catalog && <NewRule catalog={catalog} onClose={() => setShowNew(false)} onDone={() => { setShowNew(false); load() }} />}
    </AppShell>
  )
}

function NewRule({ catalog, onClose, onDone }: { catalog: Catalog; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("")
  const [trigger, setTrigger] = useState(catalog.triggers[0]?.key || "")
  const [conditions, setConditions] = useState<{ field: string; op: string; value: string }[]>([])
  const [actionType, setActionType] = useState(catalog.actions[0]?.key || "")
  const [config, setConfig] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const trig = catalog.triggers.find(t => t.key === trigger)
  const act = catalog.actions.find(a => a.key === actionType)
  const opNeedsValue = (op: string) => catalog.ops.find(o => o.key === op)?.needsValue !== false

  async function submit(e: any) {
    e.preventDefault()
    setSaving(true); setError("")
    try {
      const r = await fetch("/api/automation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, trigger, conditions: conditions.filter(c => c.field && c.op), actionType, actionConfig: config }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.success) { setError(d.error || "Couldn't create the rule."); return }
      onDone()
    } catch { setError("Couldn't reach the server.") }
    finally { setSaving(false) }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={S.modalTitle}>New automation rule</h2>
        {error && <div style={S.errBox}>{error}</div>}
        <form onSubmit={submit}>
          <label style={S.label}>Rule name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={S.input} placeholder="e.g. Notify me when a candidate is shortlisted" required />

          <label style={S.label}>When (trigger)</label>
          <select value={trigger} onChange={e => { setTrigger(e.target.value); setConditions([]) }} style={S.input}>
            {catalog.triggers.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>

          <label style={S.label}>Conditions (all must match — optional)</label>
          {conditions.map((c, i) => (
            <div key={i} style={S.condRow}>
              <select value={c.field} onChange={e => setConditions(p => p.map((x, j) => j === i ? { ...x, field: e.target.value } : x))} style={{ ...S.input, flex: 1 }}>
                <option value="">field…</option>
                {(trig?.fields || []).map((f: any) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <select value={c.op} onChange={e => setConditions(p => p.map((x, j) => j === i ? { ...x, op: e.target.value } : x))} style={{ ...S.input, width: 130 }}>
                {catalog.ops.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              {opNeedsValue(c.op) && <input value={c.value} onChange={e => setConditions(p => p.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} style={{ ...S.input, flex: 1 }} placeholder="value" />}
              <button type="button" onClick={() => setConditions(p => p.filter((_, j) => j !== i))} style={S.condDel}>×</button>
            </div>
          ))}
          <button type="button" onClick={() => setConditions(p => [...p, { field: trig?.fields?.[0]?.key || "", op: "eq", value: "" }])} style={S.addCond}>+ Add condition</button>

          <label style={S.label}>Then (action)</label>
          <select value={actionType} onChange={e => { setActionType(e.target.value); setConfig({}) }} style={S.input}>
            {catalog.actions.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
          {(act?.fields || []).map((f: any) => (
            <div key={f.key}>
              <label style={S.labelS}>{f.label}</label>
              <input value={config[f.key] || ""} onChange={e => setConfig(p => ({ ...p, [f.key]: e.target.value }))} style={S.input} />
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button type="submit" disabled={saving} style={S.newBtn}>{saving ? "Creating…" : "Create rule"}</button>
            <button type="button" onClick={onClose} style={S.cancelBtn}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 880, margin: "0 auto", padding: "0 4px" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 16, flexWrap: "wrap" as const },
  h1: { fontSize: 22, fontWeight: 700, color: "var(--v-ink)", letterSpacing: "-.3px" },
  sub: { fontSize: 13.5, color: "var(--v-ink-3)", marginTop: 4, maxWidth: 600, lineHeight: 1.5 },
  h2: { fontSize: 15, fontWeight: 650, color: "var(--v-ink)", margin: "26px 0 10px", display: "flex", alignItems: "center", gap: 8 },
  newBtn: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  msg: { background: "var(--v-accent-soft)", border: "1px solid var(--v-accent)", color: "var(--v-accent)", borderRadius: 9, padding: "10px 14px", fontSize: 13, marginBottom: 14 },
  list: { display: "flex", flexDirection: "column" as const, gap: 10 },
  card: { display: "flex", alignItems: "center", gap: 14, background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 12, padding: "14px 16px" },
  cardName: { fontSize: 15, fontWeight: 650, color: "var(--v-ink)" },
  cardMeta: { display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" as const, fontSize: 12.5 },
  pill: { display: "inline-flex", alignItems: "center", gap: 4, background: "var(--v-surface-2)", color: "var(--v-ink-2)", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 500 },
  arrow: { color: "var(--v-ink-3)" },
  muted: { color: "var(--v-ink-3)" },
  runMeta: { fontSize: 12, color: "var(--v-ink-3)", marginTop: 6 },
  cardActions: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  smallBtn: { background: "var(--v-surface-2)", border: "1px solid var(--v-line-2)", color: "var(--v-ink-2)", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, cursor: "pointer" },
  delBtn: { background: "none", border: "1px solid var(--v-line-2)", color: "var(--danger)", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, cursor: "pointer" },
  toggle: { width: 42, height: 24, borderRadius: 999, border: "none", background: "var(--v-line-2)", position: "relative" as const, cursor: "pointer", flexShrink: 0, transition: "background .15s" },
  toggleOn: { background: "var(--v-accent)" },
  knob: { position: "absolute" as const, top: 3, left: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s" },
  knobOn: { left: 21 },
  runRow: { display: "grid", gridTemplateColumns: "14px 140px 1fr auto", gap: 10, alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--v-line-2)", fontSize: 12.5 },
  dot: { width: 8, height: 8, borderRadius: "50%" },
  runRule: { fontWeight: 600, color: "var(--v-ink)", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" },
  runDetail: { color: "var(--v-ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  runTime: { color: "var(--v-ink-3)", whiteSpace: "nowrap" as const },
  center: { textAlign: "center" as const, padding: "3rem 0", color: "var(--v-ink-3)", fontSize: 14 },
  retry: { marginLeft: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer" },
  overlay: { position: "fixed" as const, inset: 0, background: "rgba(10,10,15,.45)", display: "grid", placeItems: "center", padding: 20, zIndex: 100 },
  modal: { background: "var(--v-surface)", borderRadius: 16, padding: "1.75rem", width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" as const },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "var(--v-ink)", marginBottom: 14 },
  errBox: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#B91C1C", marginBottom: 12 },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--v-ink-2)", margin: "12px 0 5px" },
  labelS: { display: "block", fontSize: 12, color: "var(--v-ink-3)", margin: "8px 0 4px" },
  input: { width: "100%", border: "1px solid var(--v-line-2)", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, color: "var(--v-ink)", background: "var(--v-surface)", outline: "none", fontFamily: "inherit" },
  condRow: { display: "flex", gap: 6, marginBottom: 6, alignItems: "center" },
  condDel: { background: "none", border: "1px solid var(--v-line-2)", color: "var(--v-ink-3)", borderRadius: 8, width: 32, height: 34, cursor: "pointer", flexShrink: 0, fontSize: 16 },
  addCond: { background: "none", border: "1px dashed var(--v-line-2)", color: "var(--v-ink-2)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, cursor: "pointer", marginTop: 2 },
  cancelBtn: { background: "none", border: "1px solid var(--v-line-2)", color: "var(--v-ink-2)", borderRadius: 9, padding: "9px 18px", fontSize: 14, cursor: "pointer" },
}
