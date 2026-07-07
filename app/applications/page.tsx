"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconBriefcase, IconArrowRight, IconCheck, IconX } from "@/components/ui/Icons"

// The transparent 7-tier hiring pipeline — the product promise made visible.
const STAGES = ["Applied", "Screening", "Task", "Interview", "HR round", "Team fit", "Offer"]
const STEP_OF: Record<string, number> = {
  APPLIED: 0, REVIEWED: 1, SCREENING: 1, SHORTLISTED: 2, ASSESSMENT: 2,
  INTERVIEW: 3, HR: 4, TEAM: 5, OFFERED: 6, ACCEPTED: 6, HIRED: 6,
}
const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"

export default function ApplicationsTracker() {
  const [apps, setApps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/applications").then(r => r.json()).then(d => { setApps(d.applications || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  return (
    <AppShell title="Applications">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="trk">
        <header className="trkHead">
          <div>
            <h1 className="trkTitle">Your applications</h1>
            <p className="trkSub">Every role, every stage — live, from first click to offer letter.</p>
          </div>
          <Link href="/jobs" className="trkCta">Browse jobs <IconArrowRight size={15} /></Link>
        </header>

        {loading ? (
          <div className="trkList">{[0, 1].map(i => <div key={i} className="v-skeleton" style={{ height: 150, borderRadius: 16 }} />)}</div>
        ) : apps.length === 0 ? (
          <div className="trkEmpty">
            <span className="trkEmptyIc"><IconBriefcase size={24} /></span>
            <h2 className="trkEmptyTitle">Your first application will appear here</h2>
            <p className="trkEmptyText">Apply to a role and watch it move through all seven stages in real time — nothing hidden, nothing stale.</p>
            <Link href="/jobs" className="trkCta">Find a role</Link>
          </div>
        ) : (
          <div className="trkList">
            {apps.map(a => {
              const rejected = a.status === "REJECTED" || a.status === "WITHDRAWN"
              const step = STEP_OF[a.status] ?? 0
              const done = a.status === "HIRED"
              return (
                <article key={a.id} className="trkCard">
                  <div className="trkCardTop">
                    <div className="trkLogo"><IconBriefcase size={18} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/jobs/${a.job?.id}`} className="trkJob">{a.job?.title || "Role"}</Link>
                      <div className="trkMeta">{a.job?.company}{a.job?.location ? ` · ${a.job.location}` : ""} · applied {fmt(a.appliedAt)}</div>
                    </div>
                    <span className={"trkPill " + (rejected ? "pRej" : done ? "pHire" : "pLive")}>
                      {rejected ? (a.status === "WITHDRAWN" ? "Withdrawn" : "Not selected") : done ? "Hired" : "In progress"}
                    </span>
                  </div>

                  <div className="trkPipe">
                    {STAGES.map((label, i) => {
                      const isDone = !rejected && i < step
                      const isCur = !rejected && i === step && !done
                      const isHire = done && i === STAGES.length - 1
                      const stopped = rejected && i === step
                      return (
                        <div key={label} className="trkStep">
                          {i > 0 && <span className={"trkConn " + (i <= step && !rejected ? "on" : "")} />}
                          <span className={"trkDot " + (isDone || done ? "d" : isCur ? "c" : stopped ? "x" : "")}>
                            {(isDone || isHire) ? <IconCheck size={12} /> : stopped ? <IconX size={11} /> : null}
                            {isCur && <span className="trkPulse v-live" />}
                          </span>
                          <span className={"trkStepLabel " + (i <= step && !rejected ? "on" : "")}>{label}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="trkFoot">
                    {rejected
                      ? <span className="trkFootMuted">This application closed at {STAGES[step]}. Keep going — the next fit is out there.</span>
                      : done
                        ? <span className="trkFootHire"><IconCheck size={13} /> Offer extended — congratulations.</span>
                        : <span className="trkFootLive"><span className="trkDotLive v-live" /> Currently at <b>{STAGES[step]}</b>. You'll see the next move the moment it happens.</span>}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}

const CSS = `
.trk { max-width: 900px; margin: 0 auto; padding: clamp(1.5rem,4vw,2.5rem) clamp(1rem,3vw,2rem); }
.trkHead { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
.trkTitle { font-family: var(--font-display); font-size: clamp(1.6rem,3vw,2.1rem); font-weight: 600; color: var(--v-ink); letter-spacing: -.02em; }
.trkSub { font-size: 14.5px; color: var(--v-ink-2); margin-top: 5px; }
.trkCta { display: inline-flex; align-items: center; gap: 7px; background: var(--brand-600); color: #fff; padding: 10px 18px; border-radius: 999px; font-size: 14px; font-weight: 600; text-decoration: none; white-space: nowrap; }
.trkCta:hover { background: var(--brand-700); }
.trkList { display: flex; flex-direction: column; gap: 16px; }

.trkCard { background: var(--v-surface); border: 1px solid var(--v-line); border-radius: 18px; padding: 20px; box-shadow: var(--v-shadow-sm); }
.trkCardTop { display: flex; align-items: center; gap: 13px; margin-bottom: 22px; }
.trkLogo { width: 42px; height: 42px; border-radius: 11px; background: var(--brand-100); color: var(--brand-600); display: grid; place-items: center; flex-shrink: 0; }
.trkJob { font-size: 16px; font-weight: 650; color: var(--v-ink); text-decoration: none; }
.trkJob:hover { color: var(--brand-700); }
.trkMeta { font-size: 12.5px; color: var(--v-ink-3); margin-top: 2px; }
.trkPill { font-size: 11.5px; font-weight: 600; padding: 5px 12px; border-radius: 999px; flex-shrink: 0; }
.pLive { background: var(--brand-100); color: var(--brand-700); }
.pHire { background: #DFF3E8; color: #0B6B45; }
.pRej { background: #F6ECEC; color: #A32D2D; }

/* the 7-step pipeline */
.trkPipe { display: grid; grid-template-columns: repeat(7, 1fr); margin: 0 6px; }
.trkStep { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.trkConn { position: absolute; top: 11px; right: 50%; width: 100%; height: 2px; background: var(--v-line-2); z-index: 0; }
.trkConn.on { background: var(--brand-400); }
.trkDot { position: relative; z-index: 1; width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--v-line-2); background: var(--v-surface); display: grid; place-items: center; color: #fff; flex-shrink: 0; }
.trkDot.d { background: var(--brand-600); border-color: var(--brand-600); }
.trkDot.c { border-color: var(--brand-400); background: var(--brand-100); }
.trkDot.x { background: var(--danger); border-color: var(--danger); }
.trkPulse { position: absolute; inset: -5px; border-radius: 50%; border: 2px solid var(--brand-400); }
.trkStepLabel { font-size: 10.5px; color: var(--v-ink-3); text-align: center; line-height: 1.2; }
.trkStepLabel.on { color: var(--brand-700); font-weight: 600; }

.trkFoot { margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--v-line); font-size: 13px; }
.trkFootLive { display: inline-flex; align-items: center; gap: 8px; color: var(--v-ink-2); }
.trkFootLive b { color: var(--brand-700); }
.trkDotLive { width: 8px; height: 8px; border-radius: 50%; background: var(--brand-400); flex-shrink: 0; }
.trkFootHire { display: inline-flex; align-items: center; gap: 7px; color: #0B6B45; font-weight: 600; }
.trkFootMuted { color: var(--v-ink-3); }

.trkEmpty { text-align: center; padding: 3rem 1rem; background: var(--v-surface); border: 1px solid var(--v-line); border-radius: 18px; }
.trkEmptyIc { display: grid; place-items: center; width: 60px; height: 60px; border-radius: 16px; background: var(--brand-100); color: var(--brand-600); margin: 0 auto 16px; }
.trkEmptyTitle { font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--v-ink); }
.trkEmptyText { font-size: 14px; color: var(--v-ink-2); max-width: 42ch; margin: 8px auto 20px; line-height: 1.6; }

@media (max-width: 640px) {
  .trkStepLabel { font-size: 9px; }
  .trkDot { width: 20px; height: 20px; }
  .trkConn { top: 9px; }
}
`
