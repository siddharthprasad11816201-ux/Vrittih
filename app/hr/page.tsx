"use client"
import { useCallback, useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconUsers, IconZap, IconAlert, IconAward } from "@/components/ui/Icons"

export default function HrPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [d, setD] = useState<any>(null)
  const load = useCallback(() => {
    fetch("/api/hr/copilot").then(async r => {
      if (r.status === 401 || r.status === 403) { setState("denied"); return }
      setD(await r.json()); setState("ok")
    }).catch(() => setState("denied"))
  }, [])
  useEffect(() => { load() }, [load])

  if (state === "loading") return <AppShell title="Workforce Intelligence"><div style={S.page}><div style={S.empty}><p style={S.sub}>Analysing workforce…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Workforce Intelligence"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>HR access required</h1></div></div></AppShell>

  const risks = (d.attritionRisks || [])
  const strongRisks = risks.filter((r: any) => r.verdict === "supported")
  const watch = risks.filter((r: any) => r.verdict === "uncertain")
  const ready = d.promotionReady || []
  return (
    <AppShell title="Workforce Intelligence">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconUsers size={20} /> HR Copilot — Workforce Intelligence</h1>
          <p style={S.sub}>Evidence-based attrition risk and promotion readiness for your team. Every verdict is deliberated by the Enterprise Brain from real signals — performance, goals, recognition, 1:1 cadence, tenure and succession — with the reasoning shown. In-house, no external LLM.</p>
        </header>

        <div style={S.summary}><IconZap size={15} /> {d.summary}</div>

        <div style={S.kpis}>
          <Kpi n={d.workforce} l="Employees analysed" />
          <Kpi n={strongRisks.length} l="Attrition risks" accent={strongRisks.length ? "var(--v-red)" : undefined} />
          <Kpi n={watch.length} l="Watch" />
          <Kpi n={ready.length} l="Promotion-ready" accent={ready.length ? "var(--v-green)" : undefined} />
        </div>

        <div style={S.cols}>
          <section style={S.col}>
            <h2 style={S.h2}><IconAlert size={16} /> Attrition risk</h2>
            {risks.length === 0 ? <p style={S.fine}>No attrition risks detected.</p> : risks.map((r: any) => (
              <div key={r.userId} style={S.card}>
                <div style={S.cardTop}>
                  <span style={S.name}>{r.name}{r.designation ? <span style={S.desig}> · {r.designation}</span> : null}</span>
                  <span style={{ ...S.tag, color: r.verdict === "supported" ? "var(--v-red)" : "#b7791f", borderColor: r.verdict === "supported" ? "var(--v-red)" : "#b7791f" }}>{r.verdict === "supported" ? "at risk" : "watch"} · {Math.round((r.confidence || 0) * 100)}%</span>
                </div>
                <p style={S.why}>{r.why}</p>
              </div>
            ))}
          </section>
          <section style={S.col}>
            <h2 style={S.h2}><IconAward size={16} /> Promotion-ready</h2>
            {ready.length === 0 ? <p style={S.fine}>No clear promotion candidates yet.</p> : ready.map((r: any) => (
              <div key={r.userId} style={S.card}>
                <div style={S.cardTop}>
                  <span style={S.name}>{r.name}{r.designation ? <span style={S.desig}> · {r.designation}</span> : null}</span>
                  <span style={{ ...S.tag, color: "var(--v-green)", borderColor: "var(--v-green)" }}>ready · {Math.round((r.confidence || 0) * 100)}%</span>
                </div>
                <p style={S.why}>{r.why}</p>
              </div>
            ))}
          </section>
        </div>
        <p style={S.fine}>Deliberated through the Enterprise Brain — each verdict carries its evidence, honest confidence and risks. Guidance for a manager to weigh, never an automatic decision.</p>
      </div>
    </AppShell>
  )
}

function Kpi({ n, l, accent }: { n: any; l: string; accent?: string }) { return <div style={S.kpi}><div style={{ ...S.kpiN, ...(accent ? { color: accent } : {}) }}>{n == null ? "—" : n}</div><div style={S.kpiL}>{l}</div></div> }

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 1040, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 16 }, h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  h2: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--v-ink)", margin: "0 0 12px", display: "flex", alignItems: "center", gap: 7 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 760 },
  fine: { fontSize: 12, color: "var(--v-ink-3)", lineHeight: 1.5, marginTop: 12 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "40px 24px", textAlign: "center" },
  summary: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--v-ink-2)", background: "var(--v-surface)", border: "1px solid var(--v-line)", borderLeft: "3px solid var(--v-accent)", borderRadius: 12, padding: "11px 14px", marginBottom: 16 },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 18 },
  kpi: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px" },
  kpiN: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--v-ink)" }, kpiL: { fontSize: 11.5, color: "var(--v-ink-2)", marginTop: 2 },
  cols: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 },
  col: {},
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "12px 14px", marginBottom: 10 },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" },
  name: { fontWeight: 600, color: "var(--v-ink)", fontSize: 14 }, desig: { color: "var(--v-ink-2)", fontSize: 12.5, fontWeight: 400 },
  tag: { fontSize: 11, fontWeight: 700, border: "1px solid", borderRadius: 999, padding: "2px 9px", textTransform: "capitalize", whiteSpace: "nowrap" },
  why: { fontSize: 12.5, color: "var(--v-ink-2)", lineHeight: 1.5, margin: "8px 0 0" },
}
