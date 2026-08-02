"use client"
import { useEffect, useState } from "react"

/* ICIRE §19 — career-path simulator. Three tracks (IC / management / breadth)
 * from the applicant's current role; each step shows honest skill gaps + prep and
 * CHF salary only where real listings exist. Hidden when logged out. */

type Step = { role: string; level: number; track: string; readinessNow: number; addSkills: { skill: string; difficulty: string; prepDays: number }[]; prepDays: number; salary: string | null; salaryCount: number; jobsFound: number }
type Track = { key: string; label: string; steps: Step[] }
type Sim = { current: { family: string; label: string; level: number; title: string }; tracks: Track[]; salaryNote: string }

const diffTone: Record<string, string> = { Easy: "#16A34A", Medium: "#B45309", Hard: "#B42318" }

export default function PathSimulatorPanel() {
  const [d, setD] = useState<Sim | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading")
  const [track, setTrack] = useState(0)

  useEffect(() => {
    let live = true
    fetch("/api/career/simulate").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!live) return
      if (!j?.simulation?.tracks?.length) { setState("hidden"); return }
      setD(j.simulation); setState("ready")
    }).catch(() => live && setState("hidden"))
    return () => { live = false }
  }, [])

  if (state === "hidden") return null
  if (state === "loading" && !d) return <div style={S.card}><div style={S.muted}>Simulating your career paths…</div></div>
  if (!d) return null

  const tr = d.tracks[Math.min(track, d.tracks.length - 1)]

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div>
          <div style={S.title}>Career paths</div>
          <div style={S.sub}>From <b style={{ color: "#334EAC" }}>{d.current.title}</b> — where you could go next</div>
        </div>
      </div>

      <div style={S.tabs}>
        {d.tracks.map((t, i) => (
          <button key={t.key} style={{ ...S.tab, ...(i === track ? S.tabOn : {}) }} onClick={() => setTrack(i)}>{t.label}</button>
        ))}
      </div>

      <div style={S.timeline}>
        {tr.steps.map((st, i) => (
          <div key={i} style={S.step}>
            <div style={S.spine}>
              <span style={S.dot}>{i + 1}</span>
              {i < tr.steps.length - 1 && <span style={S.line} />}
            </div>
            <div style={S.body}>
              <div style={S.stepTop}>
                <span style={S.role}>{st.role}</span>
                <span style={S.ready}>{st.readinessNow}% ready now</span>
              </div>
              {st.salary ? (
                <div style={S.salary}>{st.salary} <span style={S.salaryMeta}>· from {st.salaryCount} CHF listing{st.salaryCount === 1 ? "" : "s"}</span></div>
              ) : (
                <div style={S.noSalary}>No CHF salary data for this role</div>
              )}
              {st.addSkills.length > 0 ? (
                <div>
                  <div style={S.addLabel}>Add {st.addSkills.length} skill{st.addSkills.length === 1 ? "" : "s"} · ~{st.prepDays} days focused</div>
                  <div style={S.chips}>
                    {st.addSkills.map((a) => (
                      <span key={a.skill} style={S.chip}><span style={{ ...S.chipDot, background: diffTone[a.difficulty] || "#64748B" }} />{a.skill}<span style={S.chipDiff}>{a.difficulty}</span></span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={S.ready2}>You already meet the core skills for this role.</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={S.note}>{d.salaryNote}</div>
    </div>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", margin: "0 0 20px" },
  head: { marginBottom: 12 },
  title: { font: "600 17px var(--font-sans)", color: "#1F2937", letterSpacing: "-.01em" },
  sub: { font: "400 12.5px var(--font-sans)", color: "#94A3B8", marginTop: 3 },
  muted: { font: "400 13.5px var(--font-sans)", color: "#64748B" },
  tabs: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 },
  tab: { font: "600 12px var(--font-sans)", color: "#64748B", background: "#F1F5F9", border: "1px solid #E9EDF2", borderRadius: 999, padding: "6px 13px", cursor: "pointer" },
  tabOn: { background: "#EAF1FE", color: "#2F6BE0", borderColor: "#DCE8FD" },
  timeline: { display: "flex", flexDirection: "column" },
  step: { display: "flex", gap: 14 },
  spine: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  dot: { width: 26, height: 26, borderRadius: "50%", background: "#EAF1FE", color: "#2F6BE0", display: "grid", placeItems: "center", font: "700 12px var(--font-sans)" },
  line: { flex: 1, width: 2, background: "#E9EDF2", margin: "4px 0" },
  body: { flex: 1, paddingBottom: 18 },
  stepTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  role: { font: "600 14.5px var(--font-sans)", color: "#1F2937" },
  ready: { font: "600 12px var(--font-sans)", color: "#16A34A", background: "#E7F8EE", borderRadius: 999, padding: "2px 9px" },
  salary: { font: "600 13px var(--font-sans)", color: "#334EAC", marginTop: 5 },
  salaryMeta: { font: "400 11.5px var(--font-sans)", color: "#94A3B8" },
  noSalary: { font: "400 12px var(--font-sans)", color: "#94A3B8", marginTop: 5 },
  addLabel: { font: "500 12px var(--font-sans)", color: "#64748B", margin: "9px 0 7px" },
  chips: { display: "flex", flexWrap: "wrap", gap: 7 },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, font: "500 12px var(--font-sans)", color: "#334155", background: "#F7F9FC", border: "1px solid #E9EDF2", borderRadius: 999, padding: "4px 10px" },
  chipDot: { width: 6, height: 6, borderRadius: "50%" },
  chipDiff: { font: "500 10.5px var(--font-sans)", color: "#94A3B8" },
  ready2: { font: "400 12.5px var(--font-sans)", color: "#166534", marginTop: 8 },
  note: { font: "400 11.5px/1.5 var(--font-sans)", color: "#94A3B8", marginTop: 8, paddingTop: 12, borderTop: "1px solid #F1F5F9" },
}
