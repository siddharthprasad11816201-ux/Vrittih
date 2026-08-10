"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

/* ICIRE explainable match panel (§7/§9/§18/§25) on a job page. Shows the
 * candidate's compatibility, matched vs missing skills, why, the projected match
 * after closing gaps, and the hiring-probability funnel. Never just "not a fit". */

type Match = {
  overall: number; technical: number; confidence: number; projectedMatch: number; prepDays: number
  matched: { skill: string; confidence: number; must: boolean }[]
  missing: { skill: string; difficulty: string; prepDays: number; must: boolean }[]
  why: string[]
  subscores: { technical: number; communication: number | null; leadership: number | null; research: number | null }
  hiring: { screening: number; shortlist: number; technical: number; offer: number; label: string; calibrated?: number; basis?: number }
}
type Feedback = { skill: string; direction: "up" | "down"; liftPct: number }[]

const tierColor = (n: number) => (n >= 75 ? "#16A34A" : n >= 55 ? "#6495ED" : n >= 35 ? "#B45309" : "#94A3B8")
const diffColor: Record<string, { bg: string; fg: string }> = {
  Easy: { bg: "#E7F8EE", fg: "#16A34A" }, Medium: { bg: "#FEF3E2", fg: "#B45309" }, Hard: { bg: "#FDECEC", fg: "#DC2626" },
}

export default function MatchPanel({ jobId }: { jobId: string }) {
  const [state, setState] = useState<"loading" | "anon" | "ready" | "error">("loading")
  const [m, setM] = useState<Match | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const load = () => {
    setState("loading")
    fetch(`/api/career/match/${jobId}`).then((r) => {
      if (r.status === 401) { setState("anon"); return null }
      if (!r.ok) { setState("error"); return null }
      return r.json()
    }).then((d) => { if (d === null) return; if (d?.match) { setM(d.match); setFeedback(d.feedback || null); setState("ready") } else setState("error") }).catch(() => setState("error"))
  }
  useEffect(() => { load() }, [jobId])

  if (state === "loading") return <div style={S.card}><div style={S.muted}>Analysing your fit…</div></div>
  if (state === "error") return (
    <div style={S.card}>
      <div style={S.title}>Your fit for this role</div>
      <p style={S.muted}>Couldn&apos;t analyse your fit just now — this is usually temporary. <button onClick={load} style={{ background: "none", border: "none", color: "#334EAC", font: "inherit", fontWeight: 600, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Try again</button></p>
    </div>
  )
  if (state === "anon") return (
    <div style={S.card}>
      <div style={S.title}>Your fit for this role</div>
      <p style={S.muted}>Sign in to see your AI compatibility, what you're missing, and a plan to close the gap.</p>
      <Link href={`/login?next=/jobs/${jobId}`} style={S.cta}>Sign in to see your match</Link>
    </div>
  )
  if (!m) return null

  const gap = m.projectedMatch - m.overall
  const funnel = [
    { k: "Resume screening", v: m.hiring.screening }, { k: "Shortlist", v: m.hiring.shortlist },
    { k: "Technical round", v: m.hiring.technical }, { k: "Offer", v: m.hiring.offer },
  ]

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div>
          <div style={S.title}>Your fit for this role</div>
          <div style={S.sub}>AI compatibility · {m.confidence}% confidence</div>
        </div>
        <div style={S.scoreWrap}>
          <span style={{ ...S.score, color: tierColor(m.overall) }}>{m.overall}%</span>
          <span style={{ ...S.hire, ...(m.hiring.label === "High" ? S.hHigh : m.hiring.label === "Medium" ? S.hMed : S.hLow) }}>{m.hiring.label} offer odds</span>
        </div>
      </div>

      <div style={S.bars}>
        <Bar label="Technical" v={m.technical} />
        {m.subscores.leadership != null && <Bar label="Leadership" v={m.subscores.leadership} />}
        {m.subscores.communication != null && <Bar label="Communication" v={m.subscores.communication} />}
        {m.subscores.research != null && <Bar label="Research" v={m.subscores.research} />}
      </div>

      {m.why.length > 0 && (
        <div style={S.block}>
          <div style={S.blockLabel}>Why you match</div>
          <div style={S.chips}>{m.why.map((s) => <span key={s} style={S.chipOk}>✓ {s}</span>)}</div>
        </div>
      )}

      {m.missing.length > 0 && (
        <div style={S.block}>
          <div style={S.blockLabel}>To close the gap</div>
          <div style={S.chips}>{m.missing.slice(0, 8).map((x) => (
            <span key={x.skill} style={S.chipMiss}>{x.skill}<span style={{ ...S.diff, background: diffColor[x.difficulty]?.bg, color: diffColor[x.difficulty]?.fg }}>{x.difficulty}</span></span>
          ))}</div>
        </div>
      )}

      {gap > 0 && (
        <div style={S.projected}>
          <span style={S.projIcon}>↗</span>
          <span>Reach <b style={{ color: "#16A34A" }}>{m.projectedMatch}%</b> (+{gap}) in about <b>{m.prepDays} days</b> by learning the skills above.</span>
        </div>
      )}

      <div style={S.block}>
        <div style={S.blockLabel}>Hiring probability</div>
        <div style={S.funnel}>
          {funnel.map((f) => (
            <div key={f.k} style={S.fRow}>
              <span style={S.fLabel}>{f.k}</span>
              <div style={S.fTrack}><div style={{ ...S.fFill, width: `${f.v}%`, background: tierColor(f.v) }} /></div>
              <span style={S.fVal}>{f.v}%</span>
            </div>
          ))}
        </div>
        {typeof m.hiring.calibrated === "number" && (
          <div style={S.calNote}>Calibrated on real outcomes: candidates at your score reach shortlist about <b>{m.hiring.calibrated}%</b> of the time here (from {m.hiring.basis} decided applications).</div>
        )}
      </div>

      {feedback && feedback.length > 0 && (
        <div style={S.block}>
          <div style={S.blockLabel}>What tends to help here</div>
          <div style={S.chips}>
            {feedback.map((f) => (
              <span key={f.skill} style={f.direction === "up" ? S.fbUp : S.fbDown}>{f.direction === "up" ? "↑" : "↓"} {f.skill} <span style={S.fbLift}>{f.direction === "up" ? "+" : "−"}{f.liftPct}%</span></span>
            ))}
          </div>
          <div style={S.calNote}>Aggregate, anonymised patterns from applicants to similar roles — this mirrors recruiter behaviour, not an endorsement.</div>
        </div>
      )}
    </div>
  )
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div style={S.barRow}>
      <span style={S.barLabel}>{label}</span>
      <div style={S.barTrack}><div style={{ ...S.barFill, width: `${v}%`, background: tierColor(v) }} /></div>
      <span style={S.barVal}>{v}%</span>
    </div>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 12px 28px -16px rgba(51,78,172,.18)", margin: "0 0 20px" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  title: { font: "600 17px var(--font-sans)", color: "#1F2937", letterSpacing: "-.01em" },
  sub: { font: "400 12.5px var(--font-sans)", color: "#94A3B8", marginTop: 3 },
  muted: { font: "400 13.5px var(--font-sans)", color: "#64748B", lineHeight: 1.6 },
  cta: { display: "inline-block", marginTop: 12, background: "#6495ED", color: "#fff", borderRadius: 11, padding: "9px 16px", font: "600 13px var(--font-sans)", textDecoration: "none", boxShadow: "0 12px 24px -10px rgba(100,149,237,.8)" },
  scoreWrap: { textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 },
  score: { font: "700 34px var(--font-sans)", letterSpacing: "-.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  hire: { font: "600 11px var(--font-sans)", borderRadius: 999, padding: "3px 10px" },
  hHigh: { background: "#E7F8EE", color: "#16A34A" }, hMed: { background: "#FEF3E2", color: "#B45309" }, hLow: { background: "#F1F5F9", color: "#64748B" },
  bars: { display: "flex", flexDirection: "column", gap: 8, margin: "16px 0 4px" },
  barRow: { display: "flex", alignItems: "center", gap: 10 },
  barLabel: { font: "500 12.5px var(--font-sans)", color: "#64748B", width: 96, flexShrink: 0 },
  barTrack: { flex: 1, height: 7, background: "#F1F5F9", borderRadius: 5, overflow: "hidden" },
  barFill: { height: 7, borderRadius: 5, transition: "width .5s ease" },
  barVal: { font: "600 12px var(--font-sans)", color: "#475569", width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  block: { marginTop: 16 },
  blockLabel: { font: "600 11px var(--font-sans)", letterSpacing: ".06em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 8 },
  chips: { display: "flex", flexWrap: "wrap", gap: 7 },
  chipOk: { font: "600 12px var(--font-sans)", background: "#EAF1FE", color: "#2F6BE0", borderRadius: 8, padding: "4px 10px" },
  chipMiss: { display: "inline-flex", alignItems: "center", gap: 6, font: "600 12px var(--font-sans)", background: "#F1F5F9", color: "#475569", borderRadius: 8, padding: "4px 8px 4px 10px" },
  diff: { font: "700 10px var(--font-sans)", borderRadius: 6, padding: "1px 6px" },
  projected: { display: "flex", alignItems: "center", gap: 10, marginTop: 16, background: "#E7F8EE", border: "1px solid #CDEFDB", borderRadius: 11, padding: "10px 14px", font: "400 13px var(--font-sans)", color: "#166534" },
  projIcon: { font: "700 15px var(--font-sans)", color: "#16A34A" },
  funnel: { display: "flex", flexDirection: "column", gap: 8 },
  fRow: { display: "flex", alignItems: "center", gap: 10 },
  fLabel: { font: "500 12.5px var(--font-sans)", color: "#64748B", width: 120, flexShrink: 0 },
  fTrack: { flex: 1, height: 7, background: "#F1F5F9", borderRadius: 5, overflow: "hidden" },
  fFill: { height: 7, borderRadius: 5, transition: "width .5s ease" },
  fVal: { font: "600 12px var(--font-sans)", color: "#475569", width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  calNote: { font: "400 11.5px/1.5 var(--font-sans)", color: "#94A3B8", marginTop: 9 },
  fbUp: { display: "inline-flex", alignItems: "center", gap: 5, font: "600 12px var(--font-sans)", background: "#E7F8EE", color: "#166534", borderRadius: 8, padding: "4px 10px" },
  fbDown: { display: "inline-flex", alignItems: "center", gap: 5, font: "600 12px var(--font-sans)", background: "#FDECEC", color: "#B42318", borderRadius: 8, padding: "4px 10px" },
  fbLift: { fontWeight: 500, opacity: 0.85 },
}
