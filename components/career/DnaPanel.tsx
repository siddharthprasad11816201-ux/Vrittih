"use client"
import { useEffect, useState } from "react"

/* ICIRE §6 — Career DNA card: archetype + signature, a template narrative,
 * category lean, and explainable bipolar/meter dimensions with evidence. Hidden
 * when logged out. */

type Evidence = { label: string; detail: string }
type Dim = { key: string; label: string; kind: "bipolar" | "meter"; value: number; poleLow?: string; poleHigh?: string; band?: string; confidence: number; evidence: Evidence[] }
type Lean = { bucket: string; label: string; pct: number; top: string[] }
type DNA = {
  computed: boolean
  archetype: { key: string; label: string; tagline: string }
  narrative: string
  signature: string
  domainFocus: string
  dimensions: Dim[]
  categoryLean: Lean[]
  stats: { skills: number; demonstrated: number; inferred: number; experienceMonths: number; recentSkills: number }
}

export default function DnaPanel() {
  const [d, setD] = useState<DNA | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading")
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch("/api/career/dna").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!live) return
      if (!j?.dna) { setState("hidden"); return }
      setD(j.dna); setState("ready")
    }).catch(() => live && setState("hidden"))
    return () => { live = false }
  }, [])

  if (state === "hidden") return null
  if (state === "loading" && !d) return <div style={S.card}><div style={S.muted}>Mapping your Career DNA…</div></div>
  if (!d) return null

  if (!d.computed) {
    return (
      <div style={S.card}>
        <div style={S.title}>Career DNA</div>
        <p style={S.empty}>{d.narrative}</p>
      </div>
    )
  }

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div>
          <div style={S.arch}>{d.archetype.label}</div>
          <div style={S.tagline}>{d.archetype.tagline}</div>
        </div>
        {d.signature && <div style={S.sig}>{d.signature}</div>}
      </div>

      <p style={S.narr}>{d.narrative}</p>

      {d.categoryLean.length > 0 && (
        <div style={S.lean}>
          {d.categoryLean.map((c) => (
            <div key={c.bucket} style={S.leanRow}>
              <span style={S.leanLabel}>{c.label}</span>
              <div style={S.leanBar}><div style={{ ...S.leanFill, width: `${c.pct}%` }} /></div>
              <span style={S.leanPct}>{c.pct}%</span>
            </div>
          ))}
        </div>
      )}

      <div style={S.dims}>
        {d.dimensions.map((dim) => (
          <div key={dim.key} style={S.dim}>
            <button style={S.dimHead} onClick={() => setOpen(open === dim.key ? null : dim.key)}>
              <span style={S.dimLabel}>{dim.label}{dim.band ? <span style={S.band}> · {dim.band}</span> : null}</span>
              <span style={S.dimVal}>{dim.kind === "bipolar" ? `${dim.poleLow} ↔ ${dim.poleHigh}` : `${dim.value}%`}</span>
            </button>
            <div style={S.track}>
              <div style={{ ...S.fill, width: `${dim.value}%`, background: dim.kind === "bipolar" ? "#8B5CF6" : "#6495ED" }} />
              {dim.kind === "bipolar" && <div style={{ ...S.marker, left: `calc(${dim.value}% - 1px)` }} />}
            </div>
            {open === dim.key && (
              <ul style={S.ev}>
                {dim.evidence.map((e, i) => <li key={i} style={S.evItem}><b>{e.label}:</b> {e.detail}</li>)}
                <li style={S.evConf}>Confidence in this reading: {Math.round(dim.confidence * 100)}%</li>
              </ul>
            )}
          </div>
        ))}
      </div>

      <div style={S.stats}>
        <span>{d.stats.demonstrated} demonstrated</span>
        <span>{d.stats.inferred} inferred</span>
        {d.stats.experienceMonths > 0 && <span>{(d.stats.experienceMonths / 12).toFixed(1)} yrs experience</span>}
      </div>
    </div>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", margin: "0 0 20px" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" },
  title: { font: "600 17px var(--font-sans)", color: "#1F2937", letterSpacing: "-.01em" },
  muted: { font: "400 13.5px var(--font-sans)", color: "#64748B" },
  empty: { font: "400 13px/1.55 var(--font-sans)", color: "#475569", background: "#F7F9FC", border: "1px solid #E9EDF2", borderRadius: 11, padding: "12px 14px", margin: "10px 0 0" },
  arch: { font: "700 18px var(--font-sans)", color: "#1F2937", letterSpacing: "-.01em" },
  tagline: { font: "400 12.5px var(--font-sans)", color: "#94A3B8", marginTop: 2 },
  sig: { font: "600 11px var(--font-sans)", color: "#334EAC", background: "#EAF1FE", border: "1px solid #DCE8FD", borderRadius: 8, padding: "6px 10px", letterSpacing: ".02em", whiteSpace: "nowrap" },
  narr: { font: "400 13.5px/1.6 var(--font-sans)", color: "#334155", margin: "12px 0 16px" },
  lean: { display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 },
  leanRow: { display: "flex", alignItems: "center", gap: 10 },
  leanLabel: { font: "500 12.5px var(--font-sans)", color: "#475569", width: 110, flexShrink: 0 },
  leanBar: { flex: 1, height: 7, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" },
  leanFill: { height: "100%", background: "#6495ED", borderRadius: 999 },
  leanPct: { font: "600 12px var(--font-sans)", color: "#64748B", width: 34, textAlign: "right" },
  dims: { display: "flex", flexDirection: "column", gap: 14 },
  dim: { display: "flex", flexDirection: "column", gap: 6 },
  dimHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", width: "100%" },
  dimLabel: { font: "600 13px var(--font-sans)", color: "#1F2937" },
  band: { font: "500 12px var(--font-sans)", color: "#6495ED" },
  dimVal: { font: "500 12px var(--font-sans)", color: "#94A3B8" },
  track: { position: "relative", height: 7, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  marker: { position: "absolute", top: -2, width: 2, height: 11, background: "#1F2937", borderRadius: 2 },
  ev: { margin: "2px 0 0", padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 4 },
  evItem: { font: "400 12px/1.5 var(--font-sans)", color: "#475569" },
  evConf: { font: "400 11.5px var(--font-sans)", color: "#94A3B8", listStyle: "none", marginLeft: -16 },
  stats: { display: "flex", flexWrap: "wrap", gap: 14, marginTop: 16, paddingTop: 14, borderTop: "1px solid #F1F5F9", font: "500 12px var(--font-sans)", color: "#94A3B8" },
}
