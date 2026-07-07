"use client"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconUsers, IconCheckCircle, IconArrowRight, IconX, IconCalendar, IconPlus } from "@/components/ui/Icons"

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  ONBOARDING: { label: "Onboarding", bg: "#FFF4E1", color: "#8a5a12" },
  ACTIVE: { label: "Active", bg: "#E1F5EE", color: "#0B6B45" },
  ON_LEAVE: { label: "On leave", bg: "#E6F1FB", color: "#185FA5" },
  EXITED: { label: "Exited", bg: "#F3EDE3", color: "#7a6a55" },
}
const initials = (n?: string) => (n || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()
const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"
const timeStr = (iso?: string) => iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"
const ATT: Record<string, { label: string; bg: string; color: string }> = {
  PRESENT: { label: "Present", bg: "#E1F5EE", color: "#0B6B45" },
  LATE: { label: "Late", bg: "#FFF4E1", color: "#8a5a12" },
  REMOTE: { label: "Remote", bg: "#E6F1FB", color: "#185FA5" },
  LEAVE: { label: "On leave", bg: "#EDEAF9", color: "#5A4FB0" },
  HALF_DAY: { label: "Half day", bg: "#FFF4E1", color: "#8a5a12" },
  HOLIDAY: { label: "Holiday", bg: "#F3EDE3", color: "#7a6a55" },
  ABSENT: { label: "Absent", bg: "#F6ECEC", color: "#A32D2D" },
}

export default function HRMS() {
  const [data, setData] = useState<any>({ employees: [], stats: {}, onboardable: [] })
  const [leaves, setLeaves] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [drawer, setDrawer] = useState<any>(null)
  const [leaveForm, setLeaveForm] = useState({ type: "Annual", startDate: "", endDate: "", reason: "" })
  const [tab, setTab] = useState<"team" | "attendance" | "leave">("team")
  const [att, setAtt] = useState<any>({ roster: [], counts: {} })

  const load = useCallback(async () => {
    const [d, l, a] = await Promise.all([
      fetch("/api/hrms/employees").then(r => r.json()),
      fetch("/api/hrms/leave").then(r => r.json()),
      fetch("/api/hrms/attendance").then(r => r.json()),
    ])
    if (!d.error) setData(d)
    if (!l.error) setLeaves(l.leaves || [])
    if (!a.error) setAtt(a)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function attend(employeeId: string, action: string, status?: string) {
    await fetch("/api/hrms/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId, action, status }) })
    load()
  }

  // keep drawer in sync after reloads
  useEffect(() => { if (drawer) { const e = data.employees.find((x: any) => x.id === drawer.id); if (e) setDrawer(e) } }, [data]) // eslint-disable-line

  async function onboard(applicationId: string) {
    await fetch("/api/hrms/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId }) })
    load()
  }
  async function toggleStep(id: string, i: number) {
    await fetch("/api/hrms/employees", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, toggleStep: i }) })
    load()
  }
  async function setStatus(id: string, status: string) {
    await fetch("/api/hrms/employees", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
    load()
  }
  async function logLeave(e: any) {
    e.preventDefault()
    if (!drawer || !leaveForm.startDate || !leaveForm.endDate) return
    await fetch("/api/hrms/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: drawer.id, ...leaveForm }) })
    setLeaveForm({ type: "Annual", startDate: "", endDate: "", reason: "" })
    load()
  }
  async function decideLeave(id: string, status: string) {
    await fetch("/api/hrms/leave", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
    load()
  }

  const s = data.stats || {}
  const stats = [
    ["Team", s.total ?? 0], ["Active", s.active ?? 0], ["Onboarding", s.onboarding ?? 0], ["On leave", s.onLeave ?? 0], ["Pending leave", s.pendingLeave ?? 0],
  ]
  const empLeaves = drawer ? leaves.filter(l => l.employeeId === drawer.id) : []
  const pendingLeaves = leaves.filter(l => l.status === "PENDING")

  return (
    <AppShell title="HRMS">
      <style>{CSS}</style>
      <div className="hr">
        <header className="hrHead">
          <div>
            <h1 className="hrTitle">People &amp; HR</h1>
            <p className="hrSub">Onboard hires, manage your team, and approve leave — all in one place.</p>
          </div>
        </header>

        <div className="hrStats">
          {stats.map(([l, v]) => <div key={l as string} className="hrStat"><div className="hrStatN">{v as number}</div><div className="hrStatL">{l as string}</div></div>)}
        </div>

        {/* Onboard hired candidates */}
        {data.onboardable?.length > 0 && (
          <section className="hrCard">
            <div className="hrCardHead">Ready to onboard <span className="hrPill">{data.onboardable.length}</span></div>
            <p className="hrMuted">These candidates were marked <b>Hired</b> — bring them onto your team.</p>
            <div className="hrOnboard">
              {data.onboardable.map((o: any) => (
                <div key={o.applicationId} className="hrOnboardRow">
                  <span className="hrAv">{initials(o.user?.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="hrName">{o.user?.name}</div>
                    <div className="hrMeta">Hired for {o.jobTitle}</div>
                  </div>
                  <button onClick={() => onboard(o.applicationId)} className="hrBtn">Onboard <IconArrowRight size={14} /></button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="hrTabs">
          <button className={"hrTab" + (tab === "team" ? " on" : "")} onClick={() => setTab("team")}>Team directory</button>
          <button className={"hrTab" + (tab === "attendance" ? " on" : "")} onClick={() => setTab("attendance")}>Attendance</button>
          <button className={"hrTab" + (tab === "leave" ? " on" : "")} onClick={() => setTab("leave")}>Leave requests{pendingLeaves.length ? <span className="hrPill">{pendingLeaves.length}</span> : null}</button>
        </div>

        {tab === "team" ? (
          <section className="hrCard">
            {loading ? <div className="v-skeleton" style={{ height: 120, borderRadius: 12 }} /> :
              data.employees.length === 0 ? <p className="hrEmpty">No employees yet. Onboard a hired candidate above to start building your team.</p> : (
                <div className="hrTableWrap">
                  <table className="hrTable">
                    <thead><tr>{["Employee", "Code", "Role", "Type", "Onboarding", "Status"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {data.employees.map((e: any) => {
                        const st = STATUS[e.status] || STATUS.ACTIVE
                        return (
                          <tr key={e.id} className="hrRow" onClick={() => setDrawer(e)}>
                            <td><div className="hrCell"><span className="hrAv sm">{initials(e.user?.name)}</span><div><div className="hrName">{e.user?.name || "—"}</div><div className="hrMeta">{e.user?.email}</div></div></div></td>
                            <td><span className="hrMono">{e.employeeCode}</span></td>
                            <td>{e.designation || "—"}<div className="hrMeta">{e.department || ""}</div></td>
                            <td>{e.employmentType}</td>
                            <td><div className="hrBar"><div className="hrBarF" style={{ width: `${e.onboardingPct}%` }} /></div><span className="hrMeta">{e.onboardingPct}%</span></td>
                            <td><span className="hrStatus" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </section>
        ) : tab === "attendance" ? (
          <section className="hrCard">
            <div className="hrAttCounts">
              {[["Present", att.counts?.present, "#0B6B45"], ["Late", att.counts?.late, "#8a5a12"], ["Remote", att.counts?.remote, "#185FA5"], ["Leave", att.counts?.leave, "#5A4FB0"], ["Absent", att.counts?.absent, "#A32D2D"]].map(([l, v, c]) => (
                <div key={l as string} className="hrAttCount"><b style={{ color: c as string }}>{(v as number) || 0}</b> {l as string}</div>
              ))}
              <span className="hrAttDate">Today · {att.date || ""}</span>
            </div>
            {att.roster?.length === 0 ? <p className="hrEmpty">No employees to track yet.</p> : (
              <div className="hrTableWrap">
                <table className="hrTable">
                  <thead><tr>{["Employee", "Status", "In", "Out", "Mark"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {att.roster?.map((r: any) => {
                      const a = r.attendance; const st = ATT[a?.status || "ABSENT"]
                      return (
                        <tr key={r.employeeId} className="hrRow">
                          <td><div className="hrCell"><span className="hrAv sm">{r.initials}</span><div><div className="hrName">{r.name}</div><div className="hrMeta">{r.code}</div></div></div></td>
                          <td><span className="hrStatus" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                          <td><span className="hrMono">{timeStr(a?.checkIn)}</span></td>
                          <td><span className="hrMono">{timeStr(a?.checkOut)}</span></td>
                          <td>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                              {!a?.checkIn && <button onClick={() => attend(r.employeeId, "checkin")} className="hrBtn sm">Check in</button>}
                              {a?.checkIn && !a?.checkOut && <button onClick={() => attend(r.employeeId, "checkout")} className="hrBtn ghost sm">Check out</button>}
                              <select value="" onChange={e => { if (e.target.value) attend(r.employeeId, "mark", e.target.value) }} className="hrInput" style={{ padding: "5px 8px", fontSize: 12 }}>
                                <option value="">Mark…</option>
                                {["PRESENT", "REMOTE", "LEAVE", "HALF_DAY", "HOLIDAY", "ABSENT"].map(s => <option key={s} value={s}>{ATT[s].label}</option>)}
                              </select>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className="hrCard">
            {leaves.length === 0 ? <p className="hrEmpty">No leave requests yet.</p> : (
              <div className="hrLeaveList">
                {leaves.map(l => (
                  <div key={l.id} className="hrLeaveRow">
                    <span className="hrAv sm">{initials(l.employee?.name)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="hrName">{l.employee?.name} · <span className="hrMuted">{l.type}</span></div>
                      <div className="hrMeta">{fmt(l.startDate)} – {fmt(l.endDate)} · {l.days} day{l.days > 1 ? "s" : ""}{l.reason ? ` · ${l.reason}` : ""}</div>
                    </div>
                    {l.status === "PENDING" ? (
                      <div className="hrLeaveActions">
                        <button onClick={() => decideLeave(l.id, "APPROVED")} className="hrBtn sm">Approve</button>
                        <button onClick={() => decideLeave(l.id, "REJECTED")} className="hrBtn ghost sm">Reject</button>
                      </div>
                    ) : <span className="hrStatus" style={{ background: l.status === "APPROVED" ? "#E1F5EE" : "#F6ECEC", color: l.status === "APPROVED" ? "#0B6B45" : "#A32D2D" }}>{l.status === "APPROVED" ? "Approved" : "Rejected"}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Employee drawer */}
      {drawer && (
        <>
          <div className="hrScrim" onClick={() => setDrawer(null)} />
          <aside className="hrDrawer">
            <div className="hrDrawerHead">
              <div className="hrCell"><span className="hrAv">{initials(drawer.user?.name)}</span><div><div className="hrName" style={{ fontSize: 16 }}>{drawer.user?.name}</div><div className="hrMeta">{drawer.employeeCode} · {drawer.designation || "—"}</div></div></div>
              <button onClick={() => setDrawer(null)} className="hrIconBtn"><IconX size={16} /></button>
            </div>

            <div className="hrDGrid">
              <div><div className="hrDLabel">Department</div><div>{drawer.department || "—"}</div></div>
              <div><div className="hrDLabel">Type</div><div>{drawer.employmentType}</div></div>
              <div><div className="hrDLabel">Joined</div><div>{fmt(drawer.joinedAt)}</div></div>
              <div><div className="hrDLabel">Leave balance</div><div>{drawer.leaveBalance} days</div></div>
            </div>

            <div className="hrDSec">
              <div className="hrDSecHead">Status</div>
              <div className="hrStatusRow">
                {Object.keys(STATUS).map(k => (
                  <button key={k} onClick={() => setStatus(drawer.id, k)} className={"hrChip" + (drawer.status === k ? " on" : "")}>{STATUS[k].label}</button>
                ))}
              </div>
            </div>

            <div className="hrDSec">
              <div className="hrDSecHead">Onboarding checklist</div>
              {(drawer.steps || []).map((step: any, i: number) => (
                <button key={i} onClick={() => toggleStep(drawer.id, i)} className="hrStep">
                  <span className={"hrCheck" + (step.done ? " on" : "")}>{step.done ? <IconCheckCircle size={16} /> : null}</span>
                  <span style={{ textDecoration: step.done ? "line-through" : "none", color: step.done ? "var(--v-ink-3)" : "var(--v-ink)" }}>{step.label}</span>
                </button>
              ))}
            </div>

            <div className="hrDSec">
              <div className="hrDSecHead">Record leave</div>
              <form onSubmit={logLeave} className="hrLeaveForm">
                <div className="hrRow2">
                  <select value={leaveForm.type} onChange={e => setLeaveForm(p => ({ ...p, type: e.target.value }))} className="hrInput">
                    {["Annual", "Sick", "Casual", "Unpaid"].map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(p => ({ ...p, startDate: e.target.value }))} className="hrInput" required />
                  <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(p => ({ ...p, endDate: e.target.value }))} className="hrInput" required />
                </div>
                <input value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))} placeholder="Reason (optional)" className="hrInput" />
                <button type="submit" className="hrBtn"><IconPlus size={14} /> Add leave request</button>
              </form>
              {empLeaves.length > 0 && (
                <div className="hrEmpLeaves">
                  {empLeaves.map(l => (
                    <div key={l.id} className="hrEmpLeave">
                      <IconCalendar size={13} /> <span>{fmt(l.startDate)}–{fmt(l.endDate)} · {l.type} · {l.days}d</span>
                      <span className="hrStatus sm" style={{ background: l.status === "APPROVED" ? "#E1F5EE" : l.status === "REJECTED" ? "#F6ECEC" : "#FFF4E1", color: l.status === "APPROVED" ? "#0B6B45" : l.status === "REJECTED" ? "#A32D2D" : "#8a5a12" }}>{l.status[0] + l.status.slice(1).toLowerCase()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </AppShell>
  )
}

const CSS = `
.hr{ max-width:1080px; margin:0 auto; padding:clamp(1.25rem,3vw,2rem); }
.hrHead{ margin-bottom:20px; }
.hrTitle{ font-family:var(--font-display); font-size:clamp(1.5rem,3vw,2rem); font-weight:600; color:var(--v-ink); letter-spacing:-.02em; }
.hrSub{ font-size:14px; color:var(--v-ink-2); margin-top:4px; }
.hrStats{ display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:20px; }
.hrStat{ background:var(--v-surface); border:1px solid var(--v-line); border-radius:14px; padding:16px; box-shadow:var(--v-shadow-sm); }
.hrStatN{ font-family:var(--font-display); font-size:26px; font-weight:600; color:var(--brand-700); }
.hrStatL{ font-size:12.5px; color:var(--v-ink-2); margin-top:2px; }
.hrCard{ background:var(--v-surface); border:1px solid var(--v-line); border-radius:16px; padding:1.25rem 1.4rem; margin-bottom:16px; box-shadow:var(--v-shadow-sm); }
.hrCardHead{ display:flex; align-items:center; gap:8px; font-size:15px; font-weight:700; color:var(--v-ink); }
.hrPill{ background:var(--brand-100); color:var(--brand-700); font-size:11.5px; font-weight:700; padding:1px 9px; border-radius:999px; }
.hrMuted{ color:var(--v-ink-3); font-size:13px; }
.hrOnboard{ display:flex; flex-direction:column; gap:10px; margin-top:12px; }
.hrOnboardRow{ display:flex; align-items:center; gap:12px; padding:10px 12px; background:var(--v-surface-2); border-radius:11px; }
.hrAv{ width:38px; height:38px; border-radius:10px; background:var(--brand-100); color:var(--brand-700); display:grid; place-items:center; font-weight:700; font-size:13px; flex-shrink:0; }
.hrAv.sm{ width:32px; height:32px; font-size:11.5px; }
.hrName{ font-size:14px; font-weight:600; color:var(--v-ink); }
.hrMeta{ font-size:12px; color:var(--v-ink-3); }
.hrMono{ font-family:var(--font-mono); font-size:12.5px; color:var(--v-ink-2); }
.hrBtn{ display:inline-flex; align-items:center; gap:6px; background:var(--brand-600); color:#fff; border:none; border-radius:9px; padding:8px 14px; font-size:13px; font-weight:600; cursor:pointer; }
.hrBtn.ghost{ background:var(--v-surface); border:1px solid var(--v-line-2); color:var(--v-ink); }
.hrBtn.sm{ padding:6px 12px; font-size:12.5px; }
.hrTabs{ display:flex; gap:8px; margin-bottom:14px; }
.hrTab{ display:inline-flex; align-items:center; gap:7px; background:var(--v-surface); border:1px solid var(--v-line); border-radius:999px; padding:8px 16px; font-size:13.5px; font-weight:600; color:var(--v-ink-2); cursor:pointer; }
.hrTab.on{ background:var(--brand-900); color:#fff; border-color:var(--brand-900); }
.hrAttCounts{ display:flex; flex-wrap:wrap; gap:18px; align-items:center; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--v-line); }
.hrAttCount{ font-size:13px; color:var(--v-ink-2); }
.hrAttCount b{ font-family:var(--font-display); font-size:18px; margin-right:5px; }
.hrAttDate{ margin-left:auto; font-size:12px; color:var(--v-ink-3); font-family:var(--font-mono); }
.hrEmpty{ color:var(--v-ink-3); font-size:14px; padding:1.5rem 0; text-align:center; }
.hrTableWrap{ overflow-x:auto; }
.hrTable{ width:100%; border-collapse:collapse; font-size:13.5px; min-width:640px; }
.hrTable th{ text-align:left; padding:9px 12px; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--v-ink-3); font-weight:700; border-bottom:1px solid var(--v-line); }
.hrRow{ border-bottom:1px solid var(--v-line); cursor:pointer; transition:background .12s; }
.hrRow:hover{ background:var(--v-surface-2); }
.hrRow td{ padding:11px 12px; vertical-align:middle; }
.hrCell{ display:flex; align-items:center; gap:10px; }
.hrBar{ width:80px; height:7px; background:var(--v-surface-2); border-radius:5px; overflow:hidden; display:inline-block; vertical-align:middle; margin-right:8px; }
.hrBarF{ height:7px; background:var(--brand-600); border-radius:5px; }
.hrStatus{ font-size:11.5px; font-weight:600; padding:3px 10px; border-radius:999px; white-space:nowrap; }
.hrStatus.sm{ font-size:10.5px; padding:2px 8px; }
.hrLeaveList{ display:flex; flex-direction:column; gap:10px; }
.hrLeaveRow{ display:flex; align-items:center; gap:12px; padding:11px 12px; background:var(--v-surface-2); border-radius:11px; }
.hrLeaveActions{ display:flex; gap:6px; }

.hrScrim{ position:fixed; inset:0; background:rgba(4,52,44,.28); z-index:70; }
.hrDrawer{ position:fixed; top:0; right:0; height:100vh; width:min(440px,94vw); background:var(--v-surface); z-index:71; box-shadow:-20px 0 60px rgba(4,52,44,.18); padding:1.4rem; overflow-y:auto; }
.hrDrawerHead{ display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:16px; }
.hrIconBtn{ background:var(--v-surface-2); border:none; border-radius:8px; padding:7px; cursor:pointer; color:var(--v-ink-2); display:flex; }
.hrDGrid{ display:grid; grid-template-columns:1fr 1fr; gap:14px; padding:14px 0; border-top:1px solid var(--v-line); border-bottom:1px solid var(--v-line); font-size:13.5px; color:var(--v-ink); }
.hrDLabel{ font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--v-ink-3); font-weight:600; margin-bottom:3px; }
.hrDSec{ margin-top:18px; }
.hrDSecHead{ font-size:12.5px; font-weight:700; color:var(--v-ink); margin-bottom:10px; text-transform:uppercase; letter-spacing:.03em; }
.hrStatusRow,.hrChipRow{ display:flex; flex-wrap:wrap; gap:6px; }
.hrChip{ background:var(--v-surface-2); border:1px solid var(--v-line-2); border-radius:999px; padding:5px 12px; font-size:12.5px; font-weight:600; color:var(--v-ink-2); cursor:pointer; }
.hrChip.on{ background:var(--brand-600); color:#fff; border-color:var(--brand-600); }
.hrStep{ display:flex; align-items:center; gap:11px; width:100%; text-align:left; background:none; border:none; padding:8px 0; font-size:13.5px; cursor:pointer; }
.hrCheck{ width:24px; height:24px; border-radius:7px; border:1.5px solid var(--v-line-2); display:grid; place-items:center; color:#fff; flex-shrink:0; }
.hrCheck.on{ background:var(--brand-600); border-color:var(--brand-600); }
.hrLeaveForm{ display:flex; flex-direction:column; gap:8px; }
.hrRow2{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
.hrInput{ border:1px solid var(--v-line-2); border-radius:9px; padding:8px 10px; font-size:13px; outline:none; background:var(--v-surface); color:var(--v-ink); font-family:inherit; }
.hrEmpLeaves{ display:flex; flex-direction:column; gap:6px; margin-top:12px; }
.hrEmpLeave{ display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--v-ink-2); }
.hrEmpLeave span:first-of-type{ flex:1; }

@media (max-width:720px){
  .hrStats{ grid-template-columns:repeat(2,1fr); }
  .hrRow2{ grid-template-columns:1fr; }
}
`
