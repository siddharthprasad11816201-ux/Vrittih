"use client"
import { useEffect, useState } from "react"

/* ICIRE §11/§13 — personalized learning plan on a job page. Timeframe selector →
 * day-by-day phases with curated resources, tasks, and projected-match milestones.
 * Hidden when logged out (the MatchPanel above handles the sign-in prompt). */

type Resource = { title: string; provider: string; url: string; type: string }
type Phase = { order: number; skill: string; startDay: number; endDay: number; days: number; resources: Resource[]; tasks: string[]; milestoneMatch: number }
type Data = { overall: number; projectedMatch: number; roadmap: { timeframeDays: number; startMatch: number; projectedMatch: number; phases: Phase[]; coveredSkills: string[] } }

const OPTIONS = [7, 14, 30, 60, 90]
const typeLabel: Record<string, string> = { docs: "Docs", course: "Course", book: "Book", repo: "Repo", practice: "Practice", video: "Video", project: "Project" }

export default function RoadmapPanel({ jobId }: { jobId: string }) {
  const [days, setDays] = useState(30)
  const [d, setD] = useState<Data | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading")

  useEffect(() => {
    let live = true
    fetch(`/api/career/roadmap/${jobId}?days=${days}`).then((r) => {
      if (!r.ok) { if (live) setState("hidden"); return null }
      return r.json()
    }).then((j) => { if (live && j) { setD(j); setState("ready") } }).catch(() => live && setState("hidden"))
    return () => { live = false }
  }, [jobId, days])

  if (state === "hidden") return null
  if (state === "loading" && !d) return <div style={S.card}><div style={S.muted}>Building your learning plan…</div></div>
  if (!d) return null

  const rm = d.roadmap
  const noGap = rm.phases.length === 0

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div>
          <div style={S.title}>Your learning plan</div>
          <div style={S.sub}>{noGap ? "You already meet the key requirements." : <>From <b style={{ color: "#64748B" }}>{rm.startMatch}%</b> → <b style={{ color: "#16A34A" }}>{rm.projectedMatch}%</b> match</>}</div>
        </div>
        {!noGap && (
          <div style={S.pills}>
            {OPTIONS.map((o) => (
              <button key={o} onClick={() => setDays(o)} style={{ ...S.pill, ...(rm.timeframeDays === o ? S.pillOn : {}) }}>{o}d</button>
            ))}
          </div>
        )}
      </div>

      {noGap ? (
        <p style={S.good}>Your profile already covers this role's core skills — focus your energy on a strong application and interview prep.</p>
      ) : (
        <div style={S.timeline}>
          {rm.phases.map((ph) => (
            <div key={ph.order} style={S.phase}>
              <div style={S.phaseSpine}>
                <span style={S.dot}>{ph.order}</span>
                {ph.order < rm.phases.length && <span style={S.line} />}
              </div>
              <div style={S.phaseBody}>
                <div style={S.phaseTop}>
                  <span style={S.phaseSkill}>{ph.skill}</span>
                  <span style={S.phaseDays}>Days {ph.startDay}–{ph.endDay}</span>
                  <span style={S.milestone}>→ ~{ph.milestoneMatch}% match</span>
                </div>
                <div style={S.resources}>
                  {ph.resources.filter((r) => r.type !== "project").slice(0, 3).map((r, i) => (
                    r.url
                      ? <a key={i} href={r.url} target="_blank" rel="noreferrer" style={S.res}><span style={S.resType}>{typeLabel[r.type] || r.type}</span>{r.title}<span style={S.resPrivate}> · {r.provider}</span></a>
                      : <span key={i} style={S.res}><span style={S.resType}>{typeLabel[r.type] || r.type}</span>{r.title}</span>
                  ))}
                </div>
                <ul style={S.tasks}>
                  {ph.tasks.map((t, i) => <li key={i} style={S.task}>{t}</li>)}
                </ul>
              </div>
            </div>
          ))}
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
  good: { font: "400 13.5px var(--font-sans)", color: "#166534", background: "#E7F8EE", border: "1px solid #CDEFDB", borderRadius: 11, padding: "12px 14px", margin: 0 },
  pills: { display: "flex", gap: 6, flexWrap: "wrap" },
  pill: { font: "600 12px var(--font-sans)", color: "#64748B", background: "#F1F5F9", border: "1px solid #E9EDF2", borderRadius: 999, padding: "5px 11px", cursor: "pointer" },
  pillOn: { background: "#EAF1FE", color: "#2F6BE0", borderColor: "#DCE8FD" },
  timeline: { display: "flex", flexDirection: "column" },
  phase: { display: "flex", gap: 14 },
  phaseSpine: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 },
  dot: { width: 26, height: 26, borderRadius: "50%", background: "#EAF1FE", color: "#2F6BE0", display: "grid", placeItems: "center", font: "700 12px var(--font-sans)", flexShrink: 0 },
  line: { flex: 1, width: 2, background: "#E9EDF2", margin: "4px 0" },
  phaseBody: { flex: 1, paddingBottom: 20 },
  phaseTop: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  phaseSkill: { font: "600 14.5px var(--font-sans)", color: "#1F2937" },
  phaseDays: { font: "500 12px var(--font-sans)", color: "#94A3B8" },
  milestone: { font: "600 12px var(--font-sans)", color: "#16A34A", background: "#E7F8EE", borderRadius: 999, padding: "2px 9px" },
  resources: { display: "flex", flexWrap: "wrap", gap: 7, margin: "9px 0" },
  res: { display: "inline-flex", alignItems: "center", gap: 6, font: "500 12.5px var(--font-sans)", color: "#334EAC", background: "#F7F9FC", border: "1px solid #E9EDF2", borderRadius: 8, padding: "5px 10px", textDecoration: "none" },
  resType: { font: "700 9.5px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".04em", color: "#6495ED", background: "#EAF1FE", borderRadius: 5, padding: "1px 5px" },
  resPrivate: { color: "#94A3B8", fontWeight: 400 },
  tasks: { margin: "4px 0 0", padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 4 },
  task: { font: "400 12.5px/1.5 var(--font-sans)", color: "#475569" },
}
