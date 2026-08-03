"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconActivity, IconAlert, IconTrendingUp, IconZap, IconArrowRight } from "@/components/ui/Icons"

/* EIDP Executive Workspace — the Organizational Brain surface. Org health index,
 * per-domain health, ranked decision queue (each fully explained), and forecasts.
 * Capability-gated by /api/intelligence/overview (ai.ops.view / admin.access). */

const bandColor = (b: string | null) => b === "Healthy" ? "var(--v-green)" : b === "Watch" ? "var(--v-accent)" : b === "At risk" ? "var(--v-amber)" : b === "Critical" ? "var(--v-red)" : "var(--v-ink-3)"
const sevColor = (s: string) => s === "critical" ? "var(--v-red)" : s === "high" ? "var(--v-amber)" : s === "medium" ? "var(--v-accent)" : s === "opportunity" ? "var(--v-green)" : "var(--v-ink-3)"
const trendGlyph = (t: string) => t === "rising" ? "▲" : t === "falling" ? "▼" : "▬"

export default function ExecutivePage() {
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading")
  const [data, setData] = useState<any>(null)
  const [openCard, setOpenCard] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/intelligence/overview").then(async r => {
      if (r.status === 401) { setState("denied"); return }
      if (r.status === 403) { setState("denied"); return }
      if (!r.ok) { setState("error"); return }
      setData(await r.json()); setState("ok")
    }).catch(() => setState("error"))
  }, [])

  if (state === "loading") return <AppShell title="Executive Workspace"><div style={S.page}><div style={S.empty}><p style={S.sub}>Computing organizational intelligence…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Executive Workspace"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Restricted</h1><p style={S.sub}>The Executive Workspace is available to founders, executives and administrators.</p><Link href="/dashboard" style={S.cta}>Back to dashboard <IconArrowRight size={15} /></Link></div></div></AppShell>
  if (state === "error" || !data) return <AppShell title="Executive Workspace"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Couldn't load intelligence</h1><p style={S.sub}>Please try again in a moment.</p></div></div></AppShell>

  const org = data.org || {}
  const stats = data.stats || {}
  const decisions = data.decisions || []
  const series = data.series || []

  return (
    <AppShell title="Executive Workspace">
      <div style={S.page}>
        <header style={S.head}>
          <div>
            <h1 style={S.h1}>Executive Workspace</h1>
            <p style={S.sub}>The organizational brain — health, decisions and forecasts across every domain. {data.coverageNote}</p>
          </div>
          <div style={S.hero}>
            <div style={{ ...S.heroRing, borderColor: bandColor(org.band) }}>
              <span style={S.heroNum}>{org.score ?? "—"}</span>
              <span style={S.heroDen}>/100</span>
            </div>
            <div>
              <div style={{ ...S.heroBand, color: bandColor(org.band) }}>{org.band || "No data"}</div>
              <div style={S.heroLbl}>Org health index</div>
            </div>
          </div>
        </header>

        {/* Strategic KPIs */}
        <div style={S.kpis}>
          <Kpi label="Members" value={fmt(stats.users)} sub={stats.newUsers30d != null ? `+${stats.newUsers30d} in 30d` : ""} />
          <Kpi label="Paid" value={fmt(stats.paidUsers)} sub={stats.mrrProxyCHF != null ? `~CHF ${fmt(stats.mrrProxyCHF)}/mo` : ""} />
          <Kpi label="Open roles" value={fmt(stats.activeRoles)} sub={stats.applications != null ? `${fmt(stats.applications)} applications` : ""} />
          <Kpi label="AI runs" value={fmt(stats.aiRuns)} sub={stats.aiRuns7d != null ? `${fmt(stats.aiRuns7d)} in 7d` : ""} />
          <Kpi label="Knowledge" value={fmt(stats.knowledgeItems)} sub="indexed items" />
          <Kpi label="Certificates" value={fmt(stats.certificates)} sub="issued" />
        </div>

        <div style={S.cols}>
          {/* Domain health */}
          <section style={S.col}>
            <h2 style={S.h2}><IconActivity size={16} /> Domain health</h2>
            <div style={S.domains}>
              {(org.domains || []).map((d: any) => (
                <div key={d.domain} style={S.domain}>
                  <div style={S.domainTop}>
                    <span style={S.domainName}>{d.label}</span>
                    <span style={{ ...S.domainScore, color: bandColor(d.band) }}>{d.score != null ? `${d.score}` : "—"}</span>
                  </div>
                  <div style={S.bar}><div style={{ ...S.barFill, width: `${d.score ?? 0}%`, background: bandColor(d.band) }} /></div>
                  <div style={S.metrics}>
                    {(d.metrics || []).map((m: any) => (
                      <div key={m.key} style={S.metric}>
                        <span style={S.metricLbl}>{m.label}</span>
                        <span style={{ ...S.metricVal, color: m.score == null ? "var(--v-ink-3)" : bandColor(m.band) }}>
                          {m.value == null ? "awaiting data" : `${m.value}${m.unit === "%" ? "%" : m.unit === "CHF" ? "" : ""}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Decision queue */}
          <section style={S.col}>
            <h2 style={S.h2}><IconAlert size={16} /> Decision queue <span style={S.count}>{decisions.length}</span></h2>
            {decisions.length === 0 && <p style={S.sub}>No decisions surfaced — health is steady and no strong trends detected.</p>}
            <div style={S.cards}>
              {decisions.map((c: any) => {
                const open = openCard === c.id
                return (
                  <div key={c.id} style={S.card}>
                    <button style={S.cardHead} onClick={() => setOpenCard(open ? null : c.id)}>
                      <span style={{ ...S.sevDot, background: sevColor(c.severity) }} />
                      <span style={S.cardTitle}>{c.title}</span>
                      <span style={{ ...S.sevTag, color: sevColor(c.severity) }}>{c.severity}</span>
                    </button>
                    <p style={S.rec}>{c.recommendation}</p>
                    {open && (
                      <div style={S.detail}>
                        <Block title="Evidence" items={c.evidence} />
                        <Block title="Alternatives" items={c.alternatives} />
                        <Block title="Risks" items={c.risks} />
                        <div style={S.conf}>Confidence: <b>{Math.round((c.confidence || 0) * 100)}%</b></div>
                      </div>
                    )}
                    <button style={S.moreBtn} onClick={() => setOpenCard(open ? null : c.id)}>{open ? "Hide detail" : "Why · evidence · risks"}</button>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        {/* Forecasts */}
        <section>
          <h2 style={S.h2}><IconTrendingUp size={16} /> Forecasts</h2>
          <div style={S.forecasts}>
            {series.map((s: any) => (
              <div key={s.key} style={S.fc}>
                <div style={S.fcTop}>
                  <span style={S.fcLbl}>{s.label}</span>
                  <span style={{ ...S.fcTrend, color: s.forecast.trend === "rising" ? "var(--v-green)" : s.forecast.trend === "falling" ? "var(--v-red)" : "var(--v-ink-3)" }}>
                    {trendGlyph(s.forecast.trend)} {s.forecast.changePct > 0 ? "+" : ""}{s.forecast.changePct}%
                  </span>
                </div>
                <Spark points={s.points} predictions={s.forecast.predictions} />
                <div style={S.fcFoot}>
                  <span>{s.forecast.method} · {Math.round((s.forecast.confidence || 0) * 100)}% conf.</span>
                  <span>next: {s.forecast.predictions.join(", ")}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div style={S.kpi}><div style={S.kpiVal}>{value}</div><div style={S.kpiLbl}>{label}</div>{sub && <div style={S.kpiSub}>{sub}</div>}</div>
}
function Block({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null
  return <div style={S.block}><div style={S.blockT}>{title}</div><ul style={S.blockList}>{items.map((x, i) => <li key={i} style={S.blockLi}>{x}</li>)}</ul></div>
}
function Spark({ points, predictions }: { points: number[]; predictions: number[] }) {
  const all = [...points, ...predictions]
  const max = Math.max(1, ...all), min = Math.min(0, ...all)
  const W = 260, H = 46, n = all.length
  const x = (i: number) => n <= 1 ? 0 : (i / (n - 1)) * W
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H
  const hist = points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const fut = predictions.map((v, i) => `${x(points.length - 1 + i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const bridge = points.length ? `${x(points.length - 1).toFixed(1)},${y(points[points.length - 1]).toFixed(1)} ${fut}` : fut
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 46, display: "block" }} preserveAspectRatio="none">
      <polyline points={hist} fill="none" stroke="var(--v-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={bridge} fill="none" stroke="var(--v-ink-3)" strokeWidth="1.6" strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
function fmt(n: any): string { return n == null ? "—" : Number(n).toLocaleString() }

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 1120, margin: "0 auto", paddingBottom: 60 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap", marginBottom: 22 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(22px,3vw,30px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0 },
  h2: { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--v-ink)", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 620 },
  hero: { display: "flex", alignItems: "center", gap: 14 },
  heroRing: { width: 84, height: 84, borderRadius: "50%", border: "4px solid", display: "grid", placeItems: "center", flexShrink: 0 },
  heroNum: { fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--v-ink)", lineHeight: 1 },
  heroDen: { fontSize: 11, color: "var(--v-ink-3)" },
  heroBand: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 },
  heroLbl: { fontSize: 12, color: "var(--v-ink-3)", marginTop: 2 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "48px 28px", textAlign: "center" },
  cta: { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 20px", fontSize: 14, fontWeight: 600, textDecoration: "none", cursor: "pointer", marginTop: 16 },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 },
  kpi: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px" },
  kpiVal: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--v-ink)", letterSpacing: "-.02em" },
  kpiLbl: { fontSize: 12.5, color: "var(--v-ink-2)", marginTop: 2, fontWeight: 500 },
  kpiSub: { fontSize: 11.5, color: "var(--v-ink-3)", marginTop: 3 },
  cols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24, alignItems: "start" },
  col: {},
  domains: { display: "flex", flexDirection: "column", gap: 10 },
  domain: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "13px 15px" },
  domainTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  domainName: { fontSize: 14, fontWeight: 600, color: "var(--v-ink)" },
  domainScore: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 },
  bar: { height: 6, background: "var(--v-surface-2)", borderRadius: 999, overflow: "hidden", margin: "8px 0 10px" },
  barFill: { height: "100%", borderRadius: 999, transition: "width .4s var(--v-ease)" },
  metrics: { display: "flex", flexDirection: "column", gap: 5 },
  metric: { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 },
  metricLbl: { color: "var(--v-ink-2)" },
  metricVal: { fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  count: { fontSize: 12, fontWeight: 700, color: "var(--v-accent)", background: "var(--v-accent-soft)", padding: "1px 8px", borderRadius: 999 },
  cards: { display: "flex", flexDirection: "column", gap: 10 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "13px 15px" },
  cardHead: { display: "flex", alignItems: "center", gap: 9, width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", textAlign: "left" },
  sevDot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: 600, color: "var(--v-ink)" },
  sevTag: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" },
  rec: { fontSize: 13, color: "var(--v-ink-2)", lineHeight: 1.55, margin: "9px 0 0" },
  detail: { marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--v-line-2)", display: "flex", flexDirection: "column", gap: 12 },
  block: {},
  blockT: { fontSize: 11, fontWeight: 700, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5 },
  blockList: { margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 },
  blockLi: { fontSize: 12.5, color: "var(--v-ink-2)", lineHeight: 1.5 },
  conf: { fontSize: 12.5, color: "var(--v-ink-2)" },
  moreBtn: { background: "none", border: "none", color: "var(--v-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "8px 0 0", font: "inherit" },
  forecasts: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 },
  fc: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px" },
  fcTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
  fcLbl: { fontSize: 13, fontWeight: 600, color: "var(--v-ink)" },
  fcTrend: { fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  fcFoot: { display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, color: "var(--v-ink-3)", marginTop: 8, flexWrap: "wrap" },
}
