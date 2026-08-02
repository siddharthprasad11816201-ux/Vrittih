"use client"
import { useEffect, useState } from "react"

/* ICIRE §20 — the applicant's growth over time. Average-confidence sparkline,
 * momentum, and the biggest skill movers between the two latest snapshots. Shows
 * only real recorded history — never an invented trend. */

type Delta = { skill: string; from: number; to: number; delta: number; direction: "up" | "down" | "new" | "gone" }
type Point = { at: string; avgConfidence: number; skillCount: number; explicitCount: number }
type Drift = { fromArchetype?: string; toArchetype?: string; fromSeniority?: string; toSeniority?: string; changed: boolean }
type Data = {
  snapshots: number
  series: Point[]
  movers: Delta[]
  momentum: { direction: "up" | "down" | "flat"; deltaPct: number }
  drift?: Drift | null
  latest: { skillCount: number; explicitCount: number; avgConfidence: number; at: string } | null
}

function Spark({ pts }: { pts: number[] }) {
  if (pts.length < 2) return null
  const w = 200, h = 40, pad = 3
  const min = Math.min(...pts), max = Math.max(...pts)
  const range = max - min || 1
  const step = (w - pad * 2) / (pts.length - 1)
  const d = pts.map((v, i) => `${pad + i * step},${h - pad - ((v - min) / range) * (h - pad * 2)}`).join(" ")
  return (
    <svg width={w} height={h} style={{ display: "block", maxWidth: "100%" }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={d} fill="none" stroke="#6495ED" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const arrow = (dir: string) => (dir === "up" || dir === "new" ? "▲" : dir === "down" || dir === "gone" ? "▼" : "—")

export default function ProgressPanel() {
  const [d, setD] = useState<Data | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading")

  useEffect(() => {
    let live = true
    fetch("/api/career/progress").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!live) return
      if (!j) { setState("hidden"); return }
      setD(j); setState("ready")
    }).catch(() => live && setState("hidden"))
    return () => { live = false }
  }, [])

  if (state === "hidden") return null
  if (state === "loading" && !d) return <div style={S.card}><div style={S.muted}>Loading your progress…</div></div>
  if (!d) return null

  if (d.snapshots < 2) {
    return (
      <div style={S.card}>
        <div style={S.title}>Your progress</div>
        <p style={S.empty}>We start tracking your growth from now. As you add experience, skills and documents — or come back over time — you'll see your skills strengthen here.</p>
      </div>
    )
  }

  const mom = d.momentum
  const momTone = mom.direction === "up" ? { c: "#16A34A", bg: "#E7F8EE" } : mom.direction === "down" ? { c: "#B42318", bg: "#FDECEC" } : { c: "#64748B", bg: "#F1F5F9" }

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div>
          <div style={S.title}>Your progress</div>
          <div style={S.sub}>{d.snapshots} snapshots · {d.latest?.skillCount} skills ({d.latest?.explicitCount} demonstrated)</div>
        </div>
        <div style={{ ...S.mom, color: momTone.c, background: momTone.bg }}>
          {arrow(mom.direction)} {mom.deltaPct > 0 ? "+" : ""}{mom.deltaPct}% avg confidence
        </div>
      </div>

      <Spark pts={d.series.map((s) => s.avgConfidence)} />

      {d.drift?.changed && (
        <div style={S.drift}>
          {d.drift.fromArchetype && d.drift.fromArchetype !== d.drift.toArchetype
            ? <>Your profile has evolved: <b>{d.drift.fromArchetype}</b> → <b>{d.drift.toArchetype}</b>.</>
            : <>Seniority signal moved: <b>{d.drift.fromSeniority}</b> → <b>{d.drift.toSeniority}</b>.</>}
        </div>
      )}

      {d.movers.length > 0 && (
        <div style={S.movers}>
          <div style={S.moversLabel}>Recent movers</div>
          {d.movers.map((m) => {
            const tone = m.direction === "up" || m.direction === "new" ? "#16A34A" : "#B42318"
            return (
              <div key={m.skill} style={S.mover}>
                <span style={{ ...S.moverArrow, color: tone }}>{arrow(m.direction)}</span>
                <span style={S.moverSkill}>{m.skill}</span>
                <span style={S.moverVal}>{m.direction === "new" ? `new · ${m.to}%` : m.direction === "gone" ? "removed" : `${m.from}% → ${m.to}%`}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", margin: "0 0 20px" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 14 },
  title: { font: "600 17px var(--font-sans)", color: "#1F2937", letterSpacing: "-.01em" },
  sub: { font: "400 12.5px var(--font-sans)", color: "#94A3B8", marginTop: 3 },
  muted: { font: "400 13.5px var(--font-sans)", color: "#64748B" },
  empty: { font: "400 13px/1.55 var(--font-sans)", color: "#475569", background: "#F7F9FC", border: "1px solid #E9EDF2", borderRadius: 11, padding: "12px 14px", margin: 0 },
  mom: { font: "600 12px var(--font-sans)", borderRadius: 999, padding: "5px 12px", whiteSpace: "nowrap" },
  drift: { font: "400 12.5px/1.5 var(--font-sans)", color: "#334EAC", background: "#F3F6FF", border: "1px solid #E1E9FE", borderRadius: 11, padding: "10px 13px", margin: "12px 0 0" },
  movers: { marginTop: 14 },
  moversLabel: { font: "700 11px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".05em", color: "#94A3B8", marginBottom: 8 },
  mover: { display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderTop: "1px solid #F1F5F9" },
  moverArrow: { font: "700 11px var(--font-sans)", width: 12 },
  moverSkill: { font: "500 13px var(--font-sans)", color: "#1F2937", flex: 1 },
  moverVal: { font: "500 12px var(--font-sans)", color: "#64748B" },
}
