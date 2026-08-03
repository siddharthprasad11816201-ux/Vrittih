"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconActivity, IconTarget } from "@/components/ui/Icons"

export default function RecruitmentAnalyticsPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [d, setD] = useState<any>(null)
  useEffect(() => {
    fetch("/api/recruitment/analytics").then(async r => {
      if (r.status === 403 || r.status === 401) { setState("denied"); return }
      setD(await r.json()); setState("ok")
    }).catch(() => setState("denied"))
  }, [])

  if (state === "loading") return <AppShell title="Recruitment analytics"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Recruitment analytics"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Recruiter access required</h1></div></div></AppShell>

  const funnel = d?.funnel || []
  const max = Math.max(1, ...funnel.map((f: any) => f.count))
  const rates = d?.rates || {}
  const rateRow = (label: string, v: number | null) => <div style={S.rate}><span style={S.rateL}>{label}</span><span style={S.rateV}>{v == null ? "—" : `${v}%`}</span></div>

  return (
    <AppShell title="Recruitment analytics">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconTarget size={20} /> Recruitment analytics</h1>
          <p style={S.sub}>Hiring funnel, offer and interview breakdowns, and conversion rates for {d?.scope}. Derived from the full status timeline — honest, evidence-based.</p>
        </header>

        <h2 style={S.h2}><IconActivity size={16} /> Hiring funnel</h2>
        <div style={S.card}>
          {funnel.map((f: any, i: number) => (
            <div key={f.stage} style={S.funRow}>
              <span style={S.funLbl}>{f.stage}</span>
              <span style={S.funBar}><span style={{ ...S.funFill, width: `${(f.count / max) * 100}%`, opacity: 1 - i * 0.15 }} /></span>
              <span style={S.funN}>{f.count}</span>
            </div>
          ))}
          {funnel.every((f: any) => f.count === 0) && <p style={S.sub}>No application activity yet — the funnel fills as candidates progress.</p>}
        </div>

        <div style={S.cols}>
          <div>
            <h2 style={S.h2}>Conversion rates</h2>
            <div style={S.card}>
              {rateRow("Application → interview", rates.applicationToInterview)}
              {rateRow("Interview → offer", rates.interviewToOffer)}
              {rateRow("Offer acceptance", rates.offerAcceptance)}
              {rateRow("Hire rate", rates.hireRate)}
              {rateRow("Rejection rate", rates.rejectionRate)}
            </div>
          </div>
          <div>
            <h2 style={S.h2}>Offers &amp; interviews</h2>
            <div style={S.card}>
              <div style={S.miniH}>Offers ({d?.offers?.total || 0})</div>
              {Object.entries(d?.offers?.byStatus || {}).length === 0 ? <p style={S.subS}>None yet.</p> : Object.entries(d?.offers?.byStatus || {}).map(([k, v]: any) => <div key={k} style={S.rate}><span style={S.rateL}>{k}</span><span style={S.rateV}>{v}</span></div>)}
              <div style={{ ...S.miniH, marginTop: 12 }}>Interviews ({d?.interviews?.total || 0})</div>
              {Object.entries(d?.interviews?.byStatus || {}).length === 0 ? <p style={S.subS}>None yet.</p> : Object.entries(d?.interviews?.byStatus || {}).map(([k, v]: any) => <div key={k} style={S.rate}><span style={S.rateL}>{k}</span><span style={S.rateV}>{v}</span></div>)}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 860, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 16 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  h2: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--v-ink)", margin: "20px 0 10px", display: "flex", alignItems: "center", gap: 8 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 620 },
  subS: { fontSize: 12.5, color: "var(--v-ink-3)", margin: 0 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "44px 24px", textAlign: "center" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 16 },
  funRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 },
  funLbl: { width: 96, fontSize: 13, fontWeight: 600, color: "var(--v-ink)" },
  funBar: { flex: 1, height: 22, background: "var(--v-surface-2)", borderRadius: 6, overflow: "hidden" },
  funFill: { display: "block", height: "100%", background: "var(--v-accent)", borderRadius: 6 },
  funN: { width: 44, textAlign: "right", fontWeight: 700, color: "var(--v-ink)", fontVariantNumeric: "tabular-nums" },
  cols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" },
  rate: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--v-line-2)" },
  rateL: { color: "var(--v-ink-2)" },
  rateV: { fontWeight: 700, color: "var(--v-ink)", fontVariantNumeric: "tabular-nums" },
  miniH: { fontSize: 12, fontWeight: 700, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 },
}
