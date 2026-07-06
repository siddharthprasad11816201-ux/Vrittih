"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconFileText, IconCalendar } from "@/components/ui/Icons"

const STATUSES = ["APPLIED", "REVIEWED", "SHORTLISTED", "INTERVIEW", "ASSESSMENT", "OFFERED", "HIRED"]

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  APPLIED:     { bg: "#E1F5EE", color: "#0F6E56" },
  REVIEWED:    { bg: "#EFF4FF", color: "#1D4ED8" },
  SHORTLISTED: { bg: "#ECFDF5", color: "#047857" },
  INTERVIEW:   { bg: "#FFF7ED", color: "#B45309" },
  ASSESSMENT:  { bg: "#FEF2F2", color: "#B91C1C" },
  OFFERED:     { bg: "#ECFDF5", color: "#059669" },
  HIRED:       { bg: "#ECFDF5", color: "#047857" },
  REJECTED:    { bg: "#FEF2F2", color: "#991B1B" },
  WITHDRAWN:   { bg: "#F3F4F6", color: "#4B5563" },
}
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || { bg: "#F3F4F6", color: "#4B5563" }
  return <span style={{ background: c.bg, color: c.color, padding: "3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{label(status)}</span>
}

function ProgressBar({ status }: { status: string }) {
  const idx = STATUSES.indexOf(status)
  const rejected = status === "REJECTED" || status === "WITHDRAWN"
  return (
    <div style={{ margin: "1rem 0" }}>
      <div style={{ display: "flex" }}>
        {STATUSES.map((s, i) => {
          const done = !rejected && i <= idx
          return (
            <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: "100%", height: 4, background: done ? "#0F6E56" : "#ECEBF1", borderRadius: i === 0 ? "4px 0 0 4px" : i === STATUSES.length - 1 ? "0 4px 4px 0" : 0 }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: done ? "#0F6E56" : "#DCDAE6", border: s === status ? "2px solid #0B5A46" : "none" }} />
              <span style={{ fontSize: 9, color: done ? "#0F6E56" : "#A5A1AE", textAlign: "center", lineHeight: 1.2 }}>{label(s)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<any[] | null>(null)

  useEffect(() => {
    fetch("/api/applications").then(r => r.json()).then(d => setApps(d.applications || [])).catch(() => setApps([]))
  }, [])

  const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""
  const fmtShort = (iso?: string) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""

  return (
    <AppShell title="Applications">
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#16151D", letterSpacing: "-.02em", marginBottom: 6 }}>My applications</h1>
        <p style={{ fontSize: 13.5, color: "#8A8595", marginBottom: 22 }}>{apps === null ? "Loading…" : `${apps.length} application${apps.length !== 1 ? "s" : ""}`}</p>

        {apps === null ? (
          <div style={card()}>Loading…</div>
        ) : apps.length === 0 ? (
          <div style={{ ...card(), textAlign: "center", padding: "3.5rem 2rem" }}>
            <span style={{ display: "grid", placeItems: "center", width: 52, height: 52, borderRadius: 14, background: "#E1F5EE", color: "#0F6E56", margin: "0 auto 12px" }}><IconFileText size={22} /></span>
            <p style={{ fontSize: 15, fontWeight: 650, color: "#16151D" }}>No applications yet</p>
            <p style={{ fontSize: 13, color: "#8A8595", marginTop: 4 }}>Apply to a role and track every stage here in real time.</p>
            <Link href="/jobs" style={{ display: "inline-block", marginTop: 14, background: "#0F6E56", color: "#fff", padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Browse jobs</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {apps.map(app => {
              const timeline = app.timeline?.length ? app.timeline : [{ status: app.status, note: "Application submitted", createdAt: app.appliedAt }]
              const rejected = app.status === "REJECTED" || app.status === "WITHDRAWN"
              return (
                <div key={app.id} style={card()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <Link href={`/jobs/${app.job?.id}`} style={{ fontSize: 16, fontWeight: 650, color: "#16151D", textDecoration: "none" }}>{app.job?.title}</Link>
                      <div style={{ fontSize: 13, color: "#8A8595", marginTop: 2 }}>{[app.job?.company, app.job?.location].filter(Boolean).join(" · ")}</div>
                    </div>
                    <StatusPill status={app.status} />
                  </div>
                  <div style={{ fontSize: 12, color: "#A5A1AE", marginTop: 6 }}>Applied {fmtDate(app.appliedAt)}</div>

                  {!rejected && <ProgressBar status={app.status} />}

                  {app.interview && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#B45309", margin: "8px 0" }}>
                      <IconCalendar size={14} /> Interview scheduled: <strong>{fmtDate(app.interview)}</strong>
                    </div>
                  )}

                  <div style={{ marginTop: "1rem", borderTop: "1px solid #F3F2F7", paddingTop: "1rem" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8595", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>Timeline</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {timeline.map((ev: any, i: number) => (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0F6E56", marginTop: 5, flexShrink: 0 }} />
                            {i < timeline.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 22, background: "#ECEBF1" }} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <StatusPill status={ev.status} />
                              <span style={{ fontSize: 11, color: "#A5A1AE" }}>{fmtShort(ev.createdAt)}</span>
                            </div>
                            {ev.note && <div style={{ fontSize: 13, color: "#56535F", marginTop: 3 }}>{ev.note}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function card(): React.CSSProperties {
  return { background: "#fff", border: "1px solid #ECEBF1", borderRadius: 14, padding: "1.5rem", color: "#56535F", fontSize: 14 }
}
