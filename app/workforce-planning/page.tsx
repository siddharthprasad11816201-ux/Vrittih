"use client"
import { useEffect, useMemo, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconTrendingUp, IconActivity } from "@/components/ui/Icons"
import { headcountRamp, scenarioHeadcount, budgetProjection } from "@/lib/planning/workforce"

const trendGlyph = (t: string) => t === "rising" ? "▲" : t === "falling" ? "▼" : "▬"

export default function WorkforcePlanningPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [data, setData] = useState<any>(null)
  // scenario planner inputs
  const [current, setCurrent] = useState(20)
  const [target, setTarget] = useState(35)
  const [months, setMonths] = useState(12)
  const [costPerHire, setCostPerHire] = useState(5000)
  const [avgAnnualCost, setAvgAnnualCost] = useState(90000)
  const [growthPct, setGrowthPct] = useState(5)

  useEffect(() => {
    fetch("/api/planning/workforce").then(async r => {
      if (r.status === 403 || r.status === 401) { setState("denied"); return }
      setData(await r.json()); setState("ok")
    }).catch(() => setState("denied"))
  }, [])

  const ramp = useMemo(() => headcountRamp(current, target, months), [current, target, months])
  const budget = useMemo(() => budgetProjection(ramp, { costPerHire, avgAnnualCost, currency: "CHF" }), [ramp, costPerHire, avgAnnualCost])
  const scenario = useMemo(() => scenarioHeadcount(current, growthPct, months), [current, growthPct, months])

  if (state === "loading") return <AppShell title="Workforce planning"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Workforce planning"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Planning access required</h1></div></div></AppShell>

  const st = data?.stats || {}
  const fc = data?.forecasts || {}

  return (
    <AppShell title="Workforce planning">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconTrendingUp size={20} /> Strategic workforce planning</h1>
          <p style={S.sub}>Hiring-demand forecasts from real history (in-house forecast engine) plus scenario, headcount and budget planning. Sparse history yields low-confidence forecasts — shown honestly.</p>
        </header>

        <div style={S.kpis}>
          <Kpi n={st.openRoles} l="Approved reqs" />
          <Kpi n={st.activeJobs} l="Active jobs" />
          <Kpi n={st.hires12mo} l="Hires (12mo)" />
          <Kpi n={st.applications12mo} l="Applications (12mo)" />
        </div>

        <h2 style={S.h2}><IconTrendingUp size={16} /> Demand forecasts</h2>
        <div style={S.fcGrid}>
          <Forecast title="Hiring demand / month" f={fc.hires} />
          <Forecast title="Applications / month" f={fc.applications} />
          <Forecast title="Org growth (new members) / month" f={fc.growth} />
        </div>

        <h2 style={S.h2}><IconActivity size={16} /> Skill demand</h2>
        <div style={S.card}>
          {(data?.skillDemand || []).length === 0 ? <p style={S.sub}>No skill data yet.</p> : (
            <div style={S.skills}>
              {data.skillDemand.map((s: any) => {
                const max = Math.max(...data.skillDemand.map((x: any) => x.count), 1)
                return <div key={s.skill} style={S.skillRow}><span style={S.skillName}>{s.skill}</span><span style={S.skillBar}><span style={{ ...S.skillFill, width: `${(s.count / max) * 100}%` }} /></span><span style={S.skillN}>{s.count}</span></div>
              })}
            </div>
          )}
        </div>

        <h2 style={S.h2}>Scenario & budget planner</h2>
        <div style={S.card}>
          <div style={S.planGrid}>
            <Num label="Current headcount" v={current} set={setCurrent} />
            <Num label="Target headcount" v={target} set={setTarget} />
            <Num label="Months" v={months} set={setMonths} />
            <Num label="Cost per hire (CHF)" v={costPerHire} set={setCostPerHire} step={500} />
            <Num label="Avg annual cost (CHF)" v={avgAnnualCost} set={setAvgAnnualCost} step={5000} />
            <Num label="Monthly growth %" v={growthPct} set={setGrowthPct} />
          </div>
          <div style={S.planOut}>
            <div style={S.outCard}><div style={S.outN}>{budget.totalHires}</div><div style={S.outL}>hires needed</div></div>
            <div style={S.outCard}><div style={S.outN}>CHF {budget.hiringCost.toLocaleString()}</div><div style={S.outL}>one-off hiring cost</div></div>
            <div style={S.outCard}><div style={S.outN}>CHF {budget.annualisedPayroll.toLocaleString()}</div><div style={S.outL}>added annual payroll</div></div>
            <div style={S.outCard}><div style={S.outN}>{scenario[scenario.length - 1]}</div><div style={S.outL}>headcount @ {growthPct}%/mo</div></div>
          </div>
          <div style={S.rampRow}>
            {ramp.map(r => <div key={r.month} style={S.rampCell}><div style={S.rampBar} title={`${r.hires} hires`}><span style={{ ...S.rampFill, height: `${Math.min(100, r.hires * 18 + 6)}%` }} /></div><span style={S.rampM}>M{r.month}</span></div>)}
          </div>
          <p style={S.fine}>Budget figures are a single-currency projection (CHF) — never summed across currencies. A deterministic planning aid, not an actual.</p>
        </div>
      </div>
    </AppShell>
  )
}

function Kpi({ n, l }: { n: any; l: string }) { return <div style={S.kpi}><div style={S.kpiN}>{n == null ? "—" : Number(n).toLocaleString()}</div><div style={S.kpiL}>{l}</div></div> }
function Num({ label, v, set, step = 1 }: any) { return <label style={S.num}><span style={S.numL}>{label}</span><input type="number" step={step} value={v} onChange={e => set(Math.max(0, Number(e.target.value) || 0))} style={S.numI} /></label> }
function Forecast({ title, f }: { title: string; f: any }) {
  if (!f) return null
  const all = [...(f.points || []), ...(f.forecast?.predictions || [])]
  const max = Math.max(1, ...all), min = Math.min(0, ...all), W = 220, H = 40, n = all.length
  const x = (i: number) => n <= 1 ? 0 : (i / (n - 1)) * W
  const y = (val: number) => H - ((val - min) / (max - min || 1)) * H
  const hist = (f.points || []).map((v: number, i: number) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const fut = (f.forecast?.predictions || []).map((v: number, i: number) => `${x((f.points?.length || 0) - 1 + i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const t = f.forecast?.trend || "flat"
  return (
    <div style={S.fc}>
      <div style={S.fcTop}><span style={S.fcLbl}>{title}</span><span style={{ ...S.fcTrend, color: t === "rising" ? "var(--v-green)" : t === "falling" ? "var(--v-red)" : "var(--v-ink-3)" }}>{trendGlyph(t)} {f.forecast?.changePct > 0 ? "+" : ""}{f.forecast?.changePct}%</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 40, display: "block" }} preserveAspectRatio="none">
        <polyline points={hist} fill="none" stroke="var(--v-accent)" strokeWidth="2" strokeLinejoin="round" />
        {fut && <polyline points={`${x((f.points?.length || 0) - 1).toFixed(1)},${y(f.points[f.points.length - 1]).toFixed(1)} ${fut}`} fill="none" stroke="var(--v-ink-3)" strokeWidth="1.6" strokeDasharray="4 3" />}
      </svg>
      <div style={S.fcFoot}>{f.forecast?.method} · {Math.round((f.forecast?.confidence || 0) * 100)}% conf · next {(f.forecast?.predictions || []).join(", ")}</div>
    </div>
  )
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 940, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 18 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  h2: { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--v-ink)", margin: "22px 0 12px", display: "flex", alignItems: "center", gap: 8 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 640 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "44px 24px", textAlign: "center" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12 },
  kpi: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px" },
  kpiN: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--v-ink)" },
  kpiL: { fontSize: 12, color: "var(--v-ink-2)", marginTop: 2 },
  fcGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 },
  fc: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px" },
  fcTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
  fcLbl: { fontSize: 12.5, fontWeight: 600, color: "var(--v-ink)" },
  fcTrend: { fontSize: 12, fontWeight: 700 },
  fcFoot: { fontSize: 11, color: "var(--v-ink-3)", marginTop: 8 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18 },
  skills: { display: "flex", flexDirection: "column", gap: 8 },
  skillRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 13 },
  skillName: { width: 130, color: "var(--v-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  skillBar: { flex: 1, height: 8, background: "var(--v-surface-2)", borderRadius: 999, overflow: "hidden" },
  skillFill: { display: "block", height: "100%", background: "var(--v-accent)", borderRadius: 999 },
  skillN: { width: 34, textAlign: "right", color: "var(--v-ink-2)", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  planGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 14 },
  num: { display: "flex", flexDirection: "column", gap: 4 },
  numL: { fontSize: 12, color: "var(--v-ink-2)", fontWeight: 500 },
  numI: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none", width: "100%" },
  planOut: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 16 },
  outCard: { background: "var(--v-surface-2)", borderRadius: 12, padding: "12px 14px" },
  outN: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--v-accent)", letterSpacing: "-.01em" },
  outL: { fontSize: 11.5, color: "var(--v-ink-2)", marginTop: 2 },
  rampRow: { display: "flex", gap: 6, alignItems: "flex-end", height: 90, marginBottom: 10 },
  rampCell: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  rampBar: { width: "100%", height: 70, background: "var(--v-surface-2)", borderRadius: 6, display: "flex", alignItems: "flex-end", overflow: "hidden" },
  rampFill: { width: "100%", background: "var(--v-accent)", borderRadius: 6 },
  rampM: { fontSize: 10, color: "var(--v-ink-3)" },
  fine: { fontSize: 11.5, color: "var(--v-ink-3)", lineHeight: 1.5 },
}
