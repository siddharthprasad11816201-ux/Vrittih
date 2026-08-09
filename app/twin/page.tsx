"use client"
import { useEffect, useState, useCallback } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconActivity, IconUsers, IconLayers, IconTrendingUp } from "@/components/ui/Icons"

const chf = (n: number) => "CHF " + Math.round(n).toLocaleString("de-CH")

export default function TwinPage() {
  const [tab, setTab] = useState<"org" | "project">("org")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setErr(false)
    try {
      const r = await fetch("/api/twin")
      if (!r.ok) throw new Error(String(r.status))
      setData(await r.json())
    } catch { setErr(true) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <AppShell title="Digital Twin"><div style={S.center}>Loading…</div></AppShell>
  if (err || !data) return <AppShell title="Digital Twin"><div style={S.center}>Couldn&rsquo;t load the twin. <button onClick={load} style={S.retry}>Retry</button></div></AppShell>

  return (
    <AppShell title="Digital Twin">
      <div style={S.wrap}>
        <div style={S.head}>
          <h1 style={S.h1}>Digital Twin</h1>
          <p style={S.sub}>A live model of your organisation and projects, computed from real data — run what-if simulations with honest, deterministic projections.</p>
        </div>
        <div style={S.tabs}>
          <button onClick={() => setTab("org")} style={{ ...S.tab, ...(tab === "org" ? S.tabOn : {}) }}><IconUsers size={15} /> Organisation</button>
          <button onClick={() => setTab("project")} style={{ ...S.tab, ...(tab === "project" ? S.tabOn : {}) }}><IconLayers size={15} /> Projects</button>
        </div>

        {tab === "org" ? <OrgTwin data={data} onSaved={load} /> : <ProjectTwin data={data} onSaved={load} />}

        {data.scenarios?.length > 0 && (
          <>
            <h2 style={S.h2}>Saved scenarios</h2>
            <div style={S.card}>
              {data.scenarios.map((s: any) => (
                <div key={s.id} style={S.scenRow}>
                  <span style={S.pill}>{s.kind}</span>
                  <span style={S.scenName}>{s.name}</span>
                  <span style={S.muted}>{new Date(s.createdAt).toLocaleDateString()}</span>
                  <button onClick={async () => { await fetch(`/api/twin/scenarios/${s.id}`, { method: "DELETE" }); load() }} style={S.delBtn}>Delete</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

function OrgTwin({ data, onSaved }: { data: any; onSaved: () => void }) {
  const org = data.org
  const [p, setP] = useState({ hiresPerMonth: Math.max(1, Math.round(org?.monthlyHiresAvg || 2)), attritionRatePct: org?.annualAttritionPct || 10, months: 12 })
  const [res, setRes] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")

  if (!org) return <div style={S.card}><p style={S.muted}>No workforce to model yet. Add employees (HRMS) and the organisation twin appears here.</p></div>

  async function run(save = false) {
    setBusy(true); setMsg("")
    try {
      const r = await fetch("/api/twin/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "org", params: p, save, name: save ? `Org: ${p.hiresPerMonth}/mo, ${p.attritionRatePct}% attr` : undefined }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(d.error || "Simulation failed."); return }
      setRes(d.result); if (save) { setMsg("Scenario saved."); onSaved() }
    } catch { setMsg("Couldn't reach the server.") }
    finally { setBusy(false) }
  }

  const proj = res?.projected || []
  const mx = Math.max(1, org.headcount, ...proj.map((x: any) => x.headcount))
  return (
    <>
      <div style={S.statGrid}>
        <Stat n={org.headcount} l="Headcount" />
        <Stat n={`${org.annualAttritionPct}%`} l="Annual attrition" />
        <Stat n={org.monthlyHiresAvg} l="Hires / month (12mo avg)" />
        <Stat n={org.avgAnnualCostCHF ? chf(org.avgAnnualCostCHF) : "—"} l="Avg annual cost" />
      </div>
      {org.byDepartment?.length > 0 && (
        <div style={S.card}>
          <div style={S.miniH}>By department</div>
          <div style={S.deptRow}>{org.byDepartment.map((d: any) => <span key={d.dept} style={S.dept}>{d.dept} <b>{d.count}</b></span>)}</div>
        </div>
      )}

      <h2 style={S.h2}><IconActivity size={15} /> Simulate</h2>
      <div style={S.card}>
        <div style={S.simRow}>
          <Slider label="Hires / month" min={0} max={50} value={p.hiresPerMonth} onChange={v => setP(x => ({ ...x, hiresPerMonth: v }))} />
          <Slider label="Annual attrition %" min={0} max={60} value={p.attritionRatePct} onChange={v => setP(x => ({ ...x, attritionRatePct: v }))} />
          <Slider label="Months" min={3} max={36} value={p.months} onChange={v => setP(x => ({ ...x, months: v }))} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <button onClick={() => run(false)} disabled={busy} style={S.runBtn}>{busy ? "Running…" : "Run simulation"}</button>
          {res && <button onClick={() => run(true)} disabled={busy} style={S.saveBtn}>Save scenario</button>}
        </div>
        {msg && <div style={S.msg}>{msg}</div>}
        {res && (
          <div style={S.result}>
            <div style={S.resHead}>
              <span>End headcount <b>{res.endHeadcount}</b></span>
              <span style={{ color: res.netChange >= 0 ? "#059669" : "#DC2626" }}>{res.netChange >= 0 ? "+" : ""}{res.netChange} net</span>
              <span>Added payroll run-rate <b>{chf(res.budget.annualisedPayroll)}/yr</b></span>
              <span>Hiring cost <b>{chf(res.budget.hiringCost)}</b></span>
            </div>
            {res.costAssumed && <p style={S.note}>Cost uses a default average (no salary data on file) — add salaries in HRMS for a precise figure.</p>}
            <div style={S.spark}>
              {proj.map((x: any, i: number) => <span key={i} title={`month ${x.month}: ${x.headcount}`} style={{ ...S.sparkBar, height: `${(x.headcount / mx) * 100}%` }} />)}
            </div>
            <div style={S.sparkAxis}><span>now: {org.headcount}</span><span>month {res.months}: {res.endHeadcount}</span></div>
          </div>
        )}
      </div>
    </>
  )
}

function ProjectTwin({ data, onSaved }: { data: any; onSaved: () => void }) {
  const projects = data.projects || []
  const [sel, setSel] = useState(projects[0]?.id || "")
  const [twin, setTwin] = useState<any>(null)
  const [p, setP] = useState({ addPeople: 0, extraTasks: 0 })
  const [res, setRes] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")

  const loadTwin = useCallback(async (id: string) => {
    if (!id) return
    setTwin(null); setRes(null)
    try { const r = await fetch(`/api/twin/project/${id}`); if (r.ok) setTwin(await r.json()) } catch {}
  }, [])
  useEffect(() => { loadTwin(sel) }, [sel, loadTwin])

  if (projects.length === 0) return <div style={S.card}><p style={S.muted}>No projects yet. Create one in Projects and its twin appears here.</p></div>

  async function run(save = false) {
    setBusy(true); setMsg("")
    try {
      const r = await fetch("/api/twin/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "project", targetId: sel, params: p, save, name: save ? `${twin?.project?.name}: +${p.addPeople}ppl, +${p.extraTasks} tasks` : undefined }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(d.error || "Simulation failed."); return }
      setRes(d.result); if (save) { setMsg("Scenario saved."); onSaved() }
    } catch { setMsg("Couldn't reach the server.") }
    finally { setBusy(false) }
  }

  const s = twin?.snapshot
  const wk = (w: number | null) => w == null ? "—" : `${w} wk`
  return (
    <>
      <div style={S.card}>
        <label style={S.miniH}>Project</label>
        <select value={sel} onChange={e => setSel(e.target.value)} style={S.input}>
          {projects.map((pr: any) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
        </select>
      </div>
      {s && (
        <>
          <div style={S.statGrid}>
            <Stat n={s.openTasks} l="Open tasks" />
            <Stat n={s.perWeek} l="Velocity / week" />
            <Stat n={wk(s.etaWeeks)} l="Forecast ETA" />
            <Stat n={s.teamSize} l="Team size" />
          </div>
          <h2 style={S.h2}><IconTrendingUp size={15} /> Simulate</h2>
          <div style={S.card}>
            <div style={S.simRow}>
              <Slider label="Add people" min={0} max={10} value={p.addPeople} onChange={v => setP(x => ({ ...x, addPeople: v }))} />
              <Slider label="Extra tasks (scope)" min={-20} max={50} value={p.extraTasks} onChange={v => setP(x => ({ ...x, extraTasks: v }))} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button onClick={() => run(false)} disabled={busy} style={S.runBtn}>{busy ? "Running…" : "Run simulation"}</button>
              {res && <button onClick={() => run(true)} disabled={busy} style={S.saveBtn}>Save scenario</button>}
            </div>
            {msg && <div style={S.msg}>{msg}</div>}
            {res && (
              <div style={S.result}>
                <div style={S.resHead}>
                  <span>New ETA <b>{wk(res.etaWeeks)}</b></span>
                  {res.deltaWeeks != null && <span style={{ color: res.deltaWeeks <= 0 ? "#059669" : "#DC2626" }}>{res.deltaWeeks <= 0 ? "" : "+"}{res.deltaWeeks} wk vs now</span>}
                  <span>Velocity <b>{res.perWeek}/wk</b></span>
                  <span>Confidence <b>{Math.round(res.confidence * 100)}%</b></span>
                </div>
                {res.etaWeeks == null && <p style={S.note}>Not enough velocity to forecast — complete a few tasks (or reduce scope) to get an ETA.</p>}
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

function Stat({ n, l }: { n: any; l: string }) { return <div style={S.stat}><div style={S.statNum}>{n}</div><div style={S.statLbl}>{l}</div></div> }
function Slider({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (v: number) => void }) {
  return (
    <div style={S.slider}>
      <div style={S.sliderHead}><span>{label}</span><b>{value}</b></div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--v-accent)" }} />
    </div>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 900, margin: "0 auto", padding: "0 4px" },
  head: { marginBottom: 14 },
  h1: { fontSize: 22, fontWeight: 700, color: "var(--v-ink)", letterSpacing: "-.3px" },
  sub: { fontSize: 13.5, color: "var(--v-ink-3)", marginTop: 4, maxWidth: 620, lineHeight: 1.5 },
  h2: { fontSize: 15, fontWeight: 650, color: "var(--v-ink)", margin: "22px 0 10px", display: "flex", alignItems: "center", gap: 8 },
  tabs: { display: "flex", gap: 6, marginBottom: 16 },
  tab: { display: "inline-flex", alignItems: "center", gap: 7, background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 10, padding: "9px 16px", fontSize: 13.5, color: "var(--v-ink-2)", cursor: "pointer" },
  tabOn: { background: "var(--v-accent-soft)", borderColor: "var(--v-accent)", color: "var(--v-accent)", fontWeight: 600 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 12 },
  stat: { background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 12, padding: "14px 16px" },
  statNum: { fontSize: 22, fontWeight: 700, color: "var(--v-ink)", letterSpacing: "-.5px" },
  statLbl: { fontSize: 12, color: "var(--v-ink-3)", marginTop: 3 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 14, padding: 16, marginBottom: 12 },
  miniH: { fontSize: 12, fontWeight: 700, color: "var(--v-ink-3)", textTransform: "uppercase" as const, letterSpacing: ".04em", marginBottom: 8, display: "block" },
  deptRow: { display: "flex", flexWrap: "wrap" as const, gap: 8 },
  dept: { background: "var(--v-surface-2)", borderRadius: 8, padding: "5px 11px", fontSize: 13, color: "var(--v-ink-2)" },
  simRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 6 },
  slider: {},
  sliderHead: { display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--v-ink-2)", marginBottom: 6 },
  runBtn: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  saveBtn: { background: "var(--v-surface-2)", color: "var(--v-ink-2)", border: "1px solid var(--v-line-2)", borderRadius: 9, padding: "9px 18px", fontSize: 14, cursor: "pointer" },
  msg: { background: "var(--v-accent-soft)", border: "1px solid var(--v-accent)", color: "var(--v-accent)", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginTop: 10 },
  result: { marginTop: 14, borderTop: "1px solid var(--v-line-2)", paddingTop: 14 },
  resHead: { display: "flex", flexWrap: "wrap" as const, gap: 16, fontSize: 13.5, color: "var(--v-ink-2)", marginBottom: 10 },
  note: { fontSize: 12, color: "var(--v-ink-3)", margin: "0 0 10px" },
  spark: { display: "flex", alignItems: "flex-end", gap: 3, height: 70 },
  sparkBar: { flex: 1, minHeight: 3, background: "var(--v-accent)", borderRadius: 3 },
  sparkAxis: { display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--v-ink-3)", marginTop: 6 },
  input: { width: "100%", border: "1px solid var(--v-line-2)", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, color: "var(--v-ink)", background: "var(--v-surface)", outline: "none", fontFamily: "inherit" },
  scenRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--v-line-2)", fontSize: 13 },
  scenName: { flex: 1, fontWeight: 600, color: "var(--v-ink)" },
  pill: { background: "var(--v-surface-2)", color: "var(--v-ink-3)", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, textTransform: "capitalize" as const },
  muted: { color: "var(--v-ink-3)" },
  delBtn: { background: "none", border: "1px solid var(--v-line-2)", color: "var(--danger)", borderRadius: 8, padding: "5px 11px", fontSize: 12.5, cursor: "pointer" },
  center: { textAlign: "center" as const, padding: "3rem 0", color: "var(--v-ink-3)", fontSize: 14 },
  retry: { marginLeft: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer" },
}
