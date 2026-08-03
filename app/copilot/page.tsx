"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconZap, IconArrowRight } from "@/components/ui/Icons"

const sevColor = (s: string) => s === "urgent" ? "var(--v-red)" : s === "high" ? "var(--v-amber)" : s === "medium" ? "var(--v-accent)" : "var(--v-ink-3)"

export default function CopilotPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch("/api/copilot/recruit").then(async r => {
      if (r.status === 403 || r.status === 401) { setState("denied"); return }
      setData(await r.json()); setState("ok")
    }).catch(() => setState("denied"))
  }, [])

  if (state === "loading") return <AppShell title="Copilot"><div style={S.page}><div style={S.empty}><p style={S.sub}>Reading your pipeline…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Copilot"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Recruiter access required</h1></div></div></AppShell>

  const s = data?.suggestions || []
  return (
    <AppShell title="Copilot">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconZap size={20} /> Recruiter copilot</h1>
          <p style={S.sub}>Your highest-leverage next actions, computed from your real pipeline and explained — in-house, no black box. Runs through AIOS (audited).</p>
          <div style={S.summary}>{data?.summary}</div>
        </header>
        {s.length === 0 ? (
          <div style={S.empty}><div style={S.okIc}><IconZap size={26} /></div><p style={S.sub}>You're all caught up — nothing needs your attention right now.</p></div>
        ) : (
          <div style={S.list}>
            {s.map((sg: any) => (
              <div key={sg.id} style={S.card}>
                <span style={{ ...S.dot, background: sevColor(sg.severity) }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.cardTop}><span style={S.cardTitle}>{sg.title}</span><span style={{ ...S.sev, color: sevColor(sg.severity) }}>{sg.severity}</span></div>
                  <p style={S.detail}>{sg.detail}</p>
                </div>
                <Link href={sg.action.href} style={S.action}>{sg.action.label} <IconArrowRight size={14} /></Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 760, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 18 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 620 },
  summary: { marginTop: 12, fontSize: 14, fontWeight: 600, color: "var(--v-ink)" },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "44px 24px", textAlign: "center" },
  okIc: { width: 52, height: 52, borderRadius: "50%", background: "var(--v-green-soft)", color: "var(--v-green)", display: "grid", placeItems: "center", margin: "0 auto 14px" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  card: { display: "flex", gap: 12, alignItems: "flex-start", background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px", boxShadow: "var(--v-shadow-sm)" },
  dot: { width: 10, height: 10, borderRadius: "50%", marginTop: 5, flexShrink: 0 },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  cardTitle: { fontSize: 14.5, fontWeight: 600, color: "var(--v-ink)" },
  sev: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" },
  detail: { fontSize: 13, color: "var(--v-ink-2)", lineHeight: 1.55, margin: "5px 0 0" },
  action: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-accent)", color: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" },
}
