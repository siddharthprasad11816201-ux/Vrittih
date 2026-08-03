"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconActivity, IconAward } from "@/components/ui/Icons"

const bandColor = (b: string) => b === "Expert" ? "var(--v-green)" : b === "Advanced" ? "var(--v-accent)" : b === "Proficient" ? "var(--v-blue)" : b === "Developing" ? "var(--v-amber)" : "var(--v-ink-3)"

export default function LearningAnalyticsPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [d, setD] = useState<any>(null)
  useEffect(() => { fetch("/api/learning/analytics").then(async r => { if (r.status === 401) { setState("denied"); return } setD(await r.json()); setState("ok") }).catch(() => setState("denied")) }, [])

  if (state === "loading") return <AppShell title="Learning analytics"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Learning analytics"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in</h1></div></div></AppShell>

  const me = d?.me || {}; const org = d?.org
  return (
    <AppShell title="Learning analytics">
      <div style={S.page}>
        <header style={S.head}><h1 style={S.h1}><IconActivity size={20} /> Learning analytics</h1><p style={S.sub}>Your growth, and — for leaders — the organization capability index. Evidence-based; competency proficiency comes from completed learning and assessments.</p></header>

        <h2 style={S.h2}>My learning</h2>
        <div style={S.kpis}>
          <Kpi n={me.enrolled} l="Enrolled" />
          <Kpi n={me.completed} l="Completed" />
          <Kpi n={me.certificates} l="Certificates" icon />
          <Kpi n={me.competencies} l="Competencies" />
          <Kpi n={me.avgProficiency != null ? `${Math.round((me.avgProficiency || 0) * 100)}%` : "—"} l="Avg proficiency" />
        </div>

        {org && (
          <>
            <h2 style={S.h2}>Organization</h2>
            <div style={S.kpis}>
              <Kpi n={org.learners} l="Active learners" />
              <Kpi n={org.enrollments} l="Enrollments" />
              <Kpi n={org.completionRate != null ? `${org.completionRate}%` : "—"} l="Completion rate" />
              <Kpi n={org.coursesPublished} l="Courses" />
              <Kpi n={org.certificates30d} l="Certs (30d)" />
              <Kpi n={org.capabilityIndex != null ? `${org.capabilityIndex}` : "—"} l="Capability index" />
            </div>
            <div style={S.cols}>
              <div style={S.card}>
                <div style={S.cardH}>Weakest competencies (invest here)</div>
                {(org.weakest || []).length === 0 ? <p style={S.subS}>No competency data yet.</p> : org.weakest.map((c: any) => <Row key={c.key} c={c} />)}
              </div>
              <div style={S.card}>
                <div style={S.cardH}>Strongest competencies</div>
                {(org.strongest || []).length === 0 ? <p style={S.subS}>No competency data yet.</p> : org.strongest.map((c: any) => <Row key={c.key} c={c} />)}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
function Kpi({ n, l, icon }: any) { return <div style={S.kpi}><div style={S.kpiN}>{icon && <IconAward size={16} />} {n == null ? "—" : n}</div><div style={S.kpiL}>{l}</div></div> }
function Row({ c }: any) {
  return <div style={S.row}><span style={S.rowL}>{c.label}</span><span style={S.bar}><span style={{ ...S.fill, width: `${Math.round(c.avg * 100)}%`, background: bandColor(c.band) }} /></span><span style={S.rowN}>{Math.round(c.avg * 100)}%</span></div>
}
const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 880, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 8 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  h2: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--v-ink)", margin: "22px 0 12px" },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 640 },
  subS: { fontSize: 12.5, color: "var(--v-ink-3)" },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "44px 24px", textAlign: "center" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12 },
  kpi: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px" },
  kpiN: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--v-ink)", display: "flex", alignItems: "center", gap: 6 },
  kpiL: { fontSize: 12, color: "var(--v-ink-2)", marginTop: 2 },
  cols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 16 },
  cardH: { fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--v-ink)", marginBottom: 12 },
  row: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13 },
  rowL: { width: 150, color: "var(--v-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  bar: { flex: 1, height: 10, background: "var(--v-surface-2)", borderRadius: 999, overflow: "hidden" },
  fill: { display: "block", height: "100%", borderRadius: 999 },
  rowN: { width: 42, textAlign: "right", fontWeight: 700, color: "var(--v-ink)", fontVariantNumeric: "tabular-nums" },
}
