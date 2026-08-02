"use client"
import { useEffect, useState } from "react"

/* ICIRE market frontier — the highest-leverage skills to learn next, ranked by
 * how many live roles each would bring within reach. Real listings only. */

type Skill = { skill: string; difficulty: string; prepDays: number; jobsUnlocked: number; nearMissJobs: number; avgCurrentMatch: number; sampleTitles: string[] }
type Data = { learnNext: Skill[]; jobsConsidered: number; note: string }

const diffTone: Record<string, string> = { Easy: "#16A34A", Medium: "#B45309", Hard: "#B42318" }

export default function FrontierPanel() {
  const [d, setD] = useState<Data | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading")

  useEffect(() => {
    let live = true
    fetch("/api/career/frontier").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!live) return
      if (!j?.frontier?.learnNext?.length) { setState("hidden"); return }
      setD(j.frontier); setState("ready")
    }).catch(() => live && setState("hidden"))
    return () => { live = false }
  }, [])

  if (state === "hidden") return null
  if (state === "loading" && !d) return <div style={S.card}><div style={S.muted}>Scanning the market…</div></div>
  if (!d) return null

  return (
    <div style={S.card}>
      <div style={S.title}>Highest-leverage skills to learn next</div>
      <div style={S.sub}>Across {d.jobsConsidered} live roles — one skill each, ranked by roles it brings within reach</div>
      <div style={S.list}>
        {d.learnNext.map((s, i) => (
          <div key={s.skill} style={S.row}>
            <span style={S.rank}>{i + 1}</span>
            <div style={S.body}>
              <div style={S.top}>
                <span style={S.skill}>{s.skill}</span>
                <span style={{ ...S.diff, color: diffTone[s.difficulty] || "#64748B" }}>{s.difficulty} · ~{s.prepDays}d</span>
              </div>
              <div style={S.meta}>
                {s.jobsUnlocked > 0 && <span style={S.unlock}>brings {s.jobsUnlocked} role{s.jobsUnlocked === 1 ? "" : "s"} within reach</span>}
                <span style={S.near}>relevant to {s.nearMissJobs} near-miss role{s.nearMissJobs === 1 ? "" : "s"}</span>
              </div>
              {s.sampleTitles.length > 0 && <div style={S.titles}>e.g. {s.sampleTitles.join(" · ")}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={S.note}>{d.note}</div>
    </div>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", margin: "0 0 20px" },
  title: { font: "600 17px var(--font-sans)", color: "#1F2937", letterSpacing: "-.01em" },
  sub: { font: "400 12.5px var(--font-sans)", color: "#94A3B8", margin: "3px 0 14px" },
  muted: { font: "400 13.5px var(--font-sans)", color: "#64748B" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  row: { display: "flex", gap: 12, alignItems: "flex-start" },
  rank: { width: 24, height: 24, borderRadius: "50%", background: "#EAF1FE", color: "#2F6BE0", display: "grid", placeItems: "center", font: "700 12px var(--font-sans)", flexShrink: 0, marginTop: 1 },
  body: { flex: 1, minWidth: 0 },
  top: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  skill: { font: "600 14px var(--font-sans)", color: "#1F2937" },
  diff: { font: "600 11.5px var(--font-sans)" },
  meta: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 3 },
  unlock: { font: "600 12px var(--font-sans)", color: "#166534", background: "#E7F8EE", borderRadius: 999, padding: "2px 9px" },
  near: { font: "400 12px var(--font-sans)", color: "#94A3B8" },
  titles: { font: "400 11.5px var(--font-sans)", color: "#94A3B8", marginTop: 4 },
  note: { font: "400 11.5px/1.5 var(--font-sans)", color: "#94A3B8", marginTop: 12, paddingTop: 12, borderTop: "1px solid #F1F5F9" },
}
