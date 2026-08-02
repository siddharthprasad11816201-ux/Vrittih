"use client"
import { useEffect, useState } from "react"

/* ICIRE §16/§17 — interview readiness + a tailored mock interview on the job
 * page. Readiness meter, difficulty, focus areas, and expandable question rounds.
 * Hidden when logged out (the MatchPanel above handles the sign-in prompt). */

type Round = { name: string; questions: string[] }
type Prep = {
  difficulty: "Junior" | "Mid" | "Senior"
  readiness: number
  readinessLabel: "Strong" | "Getting there" | "Needs work"
  focusAreas: { skill: string; have: boolean }[]
  rounds: Round[]
  tips: string[]
}

const tone = (label: Prep["readinessLabel"]) =>
  label === "Strong" ? { c: "#16A34A", bg: "#E7F8EE" } : label === "Getting there" ? { c: "#B45309", bg: "#FEF3E2" } : { c: "#DC2626", bg: "#FDECEC" }

export default function InterviewPanel({ jobId }: { jobId: string }) {
  const [d, setD] = useState<Prep | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading")
  const [open, setOpen] = useState(0)

  useEffect(() => {
    let live = true
    fetch(`/api/career/interview/${jobId}`).then((r) => {
      if (!r.ok) { if (live) setState("hidden"); return null }
      return r.json()
    }).then((j) => { if (live && j?.prep) { setD(j.prep); setState("ready") } }).catch(() => live && setState("hidden"))
    return () => { live = false }
  }, [jobId])

  if (state === "hidden") return null
  if (state === "loading" && !d) return <div style={S.card}><div style={S.muted}>Preparing your mock interview…</div></div>
  if (!d) return null
  const t = tone(d.readinessLabel)

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div>
          <div style={S.title}>Interview prep</div>
          <div style={S.sub}>{d.difficulty}-level bar · a mock interview built from this role and your profile</div>
        </div>
        <div style={{ ...S.readiness, color: t.c, background: t.bg }}>
          <b style={{ fontSize: 18 }}>{d.readiness}%</b> ready · {d.readinessLabel}
        </div>
      </div>

      {d.focusAreas.length > 0 && (
        <div style={S.focus}>
          {d.focusAreas.map((f) => (
            <span key={f.skill} style={{ ...S.chip, ...(f.have ? S.chipHave : S.chipGap) }}>
              <span style={S.chipDot(f.have)} />{f.skill}
            </span>
          ))}
        </div>
      )}

      <div style={S.rounds}>
        {d.rounds.map((r, i) => (
          <div key={r.name} style={S.round}>
            <button style={S.roundHead} onClick={() => setOpen(open === i ? -1 : i)}>
              <span style={S.roundName}>{r.name} round</span>
              <span style={S.roundMeta}>{r.questions.length} questions <span style={S.caret}>{open === i ? "−" : "+"}</span></span>
            </button>
            {open === i && (
              <ol style={S.qlist}>
                {r.questions.map((q, j) => <li key={j} style={S.q}>{q}</li>)}
              </ol>
            )}
          </div>
        ))}
      </div>

      <ul style={S.tips}>
        {d.tips.map((tip, i) => <li key={i} style={S.tip}>{tip}</li>)}
      </ul>
    </div>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", margin: "0 0 20px" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 14 },
  title: { font: "600 17px var(--font-sans)", color: "#1F2937", letterSpacing: "-.01em" },
  sub: { font: "400 12.5px var(--font-sans)", color: "#94A3B8", marginTop: 3 },
  muted: { font: "400 13.5px var(--font-sans)", color: "#64748B" },
  readiness: { font: "500 12.5px var(--font-sans)", borderRadius: 999, padding: "6px 13px", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" },
  focus: { display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, font: "500 12.5px var(--font-sans)", borderRadius: 999, padding: "4px 11px" },
  chipHave: { color: "#166534", background: "#E7F8EE", border: "1px solid #CDEFDB" },
  chipGap: { color: "#92400E", background: "#FEF3E2", border: "1px solid #FADFB5" },
  chipDot: (have: boolean) => ({ width: 6, height: 6, borderRadius: "50%", background: have ? "#16A34A" : "#D97706" }),
  rounds: { display: "flex", flexDirection: "column", gap: 8 },
  round: { border: "1px solid #E9EDF2", borderRadius: 11, overflow: "hidden", background: "#F7F9FC" },
  roundHead: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" },
  roundName: { font: "600 13.5px var(--font-sans)", color: "#1F2937" },
  roundMeta: { font: "500 12px var(--font-sans)", color: "#94A3B8", display: "inline-flex", alignItems: "center", gap: 9 },
  caret: { font: "700 15px var(--font-sans)", color: "#6495ED", width: 14, textAlign: "center" },
  qlist: { margin: 0, padding: "0 16px 14px 34px", display: "flex", flexDirection: "column", gap: 8, background: "#fff", borderTop: "1px solid #EEF2F6" },
  q: { font: "400 13px/1.55 var(--font-sans)", color: "#334155", paddingTop: 8 },
  tips: { margin: "16px 0 0", padding: "14px 16px 14px 32px", background: "#F3F6FF", border: "1px solid #E1E9FE", borderRadius: 11, display: "flex", flexDirection: "column", gap: 6 },
  tip: { font: "400 12.5px/1.5 var(--font-sans)", color: "#3A4A6B" },
}
