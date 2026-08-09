"use client"
import { useCallback, useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconLayers, IconPlus, IconTarget, IconCheckCircle, IconFileText, IconAlert, IconZap, IconActivity, IconUsers } from "@/components/ui/Icons"

type Project = { id: string; name: string; description?: string; status: string; dueAt?: string | null; progress: number; milestones: number; tasks: number; atRisk: boolean }
type Portfolio = { total: number; active: number; done: number; onHold: number; atRisk: number; avgProgress: number; band: "healthy" | "watch" | "at-risk" }

export default function ProjectsPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [projects, setProjects] = useState<Project[]>([])
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [statuses, setStatuses] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [busy, setBusy] = useState(false)
  const [pm, setPm] = useState<any>(null)

  const loadPm = useCallback(() => { fetch("/api/projects/intelligence").then(r => r.ok ? r.json() : null).then(d => d && setPm(d)).catch(() => {}) }, [])
  const load = useCallback(() => {
    fetch("/api/projects").then(async r => {
      if (r.status === 401 || r.status === 403) { setState("denied"); return }
      const d = await r.json()
      setProjects(d.projects || []); setPortfolio(d.portfolio || null); setStatuses(d.statuses || []); setState("ok")
      loadPm()
    }).catch(() => setState("denied"))
  }, [loadPm])
  useEffect(() => { load() }, [load])

  const createProject = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const r = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create-project", name, dueAt: dueAt || undefined }) })
    setBusy(false)
    if (r.ok) { setName(""); setDueAt(""); load() }
  }

  if (state === "loading") return <AppShell title="Projects"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Projects"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in to manage projects</h1></div></div></AppShell>

  return (
    <AppShell title="Projects">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconLayers size={20} /> Projects & collaboration</h1>
          <p style={S.sub}>Plan work with milestones, run a kanban board, and keep a portfolio view of progress and risk — an in-house project OS. Health and risk are computed deterministically from milestones and tasks.</p>
        </header>

        {pm && <ProjectManagerPanel pm={pm} />}

        {portfolio && (
          <div style={S.kpis}>
            <Kpi n={portfolio.total} l="Projects" />
            <Kpi n={portfolio.active} l="Active" />
            <Kpi n={portfolio.done} l="Done" />
            <Kpi n={portfolio.atRisk} l="At risk" accent={portfolio.atRisk > 0 ? "var(--v-red)" : undefined} />
            <Kpi n={`${portfolio.avgProgress}%`} l="Avg progress" />
            <div style={{ ...S.kpi, display: "flex", alignItems: "center" }}>
              <span style={{ ...S.band, ...bandStyle(portfolio.band) }}>{portfolio.band.replace("-", " ")}</span>
            </div>
          </div>
        )}

        <div style={S.card}>
          <div style={S.newRow}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="New project name" style={{ ...S.input, flex: 2 }} onKeyDown={e => e.key === "Enter" && createProject()} />
            <input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} style={{ ...S.input, flex: 1 }} title="Due date (optional)" />
            <button onClick={createProject} disabled={busy || !name.trim()} style={{ ...S.btnPrimary, opacity: busy || !name.trim() ? 0.6 : 1 }}><IconPlus size={15} /> Create</button>
          </div>
        </div>

        {projects.length === 0 ? (
          <div style={S.empty}><p style={S.sub}>No projects yet. Create your first above.</p></div>
        ) : (
          <div style={S.grid}>
            {projects.map(p => (
              <button key={p.id} onClick={() => setSelected(selected === p.id ? null : p.id)} style={{ ...S.projCard, ...(selected === p.id ? S.projCardOn : {}) }}>
                <div style={S.projTop}>
                  <span style={S.projName}>{p.name}</span>
                  <span style={{ ...S.statusPill, ...statusStyle(p.status) }}>{p.status.replace("_", " ")}</span>
                </div>
                {p.description && <p style={S.projDesc}>{p.description}</p>}
                <div style={S.barWrap}><span style={{ ...S.barFill, width: `${p.progress}%` }} /></div>
                <div style={S.projMeta}>
                  <span>{p.progress}%</span>
                  <span><IconTarget size={12} /> {p.milestones} milestones</span>
                  <span><IconCheckCircle size={12} /> {p.tasks} tasks</span>
                  {p.atRisk && <span style={S.riskBadge}><IconAlert size={12} /> at risk</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {selected && <ProjectDetail id={selected} statuses={statuses} onChange={load} onClose={() => setSelected(null)} />}
      </div>
    </AppShell>
  )
}

function ProjectDetail({ id, statuses, onChange, onClose }: { id: string; statuses: string[]; onChange: () => void; onClose: () => void }) {
  const [d, setD] = useState<any>(null)
  const [mTitle, setMTitle] = useState("")
  const [tTitle, setTTitle] = useState("")
  const [wTitle, setWTitle] = useState("")
  const [wOpen, setWOpen] = useState<any>(null)
  const [wBody, setWBody] = useState("")
  const [team, setTeam] = useState<Array<{ id: string; name: string }>>([])

  const load = useCallback(() => { fetch(`/api/projects/${id}`).then(r => r.json()).then(setD).catch(() => {}) }, [id])
  useEffect(() => { load() }, [load])
  // Best-effort: employers get their team for assignment; seekers get 403 → no picker.
  useEffect(() => { fetch("/api/hrms/employees").then(r => r.ok ? r.json() : null).then(x => { if (x?.employees) setTeam(x.employees.map((e: any) => ({ id: e.id, name: e.user?.name || e.employeeCode || e.id.slice(0, 8) }))) }).catch(() => {}) }, [])
  const teamName = (aid: string | null) => aid ? (team.find(t => t.id === aid)?.name || "Assigned") : ""

  const post = async (body: any) => { const r = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, projectId: id }) }); if (r.ok) { load(); onChange() } }
  const setStatus = async (status: string) => { await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }); load(); onChange() }

  const openWiki = async (pageId: string) => { const r = await fetch(`/api/wiki?id=${pageId}`); const j = await r.json(); if (j.page) { setWOpen(j.page); setWBody(j.page.contentMd || "") } }
  const saveWiki = async () => {
    if (wOpen) { await fetch("/api/wiki", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: wOpen.id, contentMd: wBody }) }); setWOpen(null); load() }
  }
  const createWiki = async () => { if (!wTitle.trim()) return; await fetch("/api/wiki", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: id, title: wTitle }) }); setWTitle(""); load() }

  if (!d || d.error) return <div style={S.detail}><p style={S.sub}>Loading project…</p></div>
  const cols: Array<[string, string]> = [["TODO", "To do"], ["DOING", "In progress"], ["DONE", "Done"]]

  return (
    <div style={S.detail}>
      <div style={S.detailHead}>
        <div>
          <h2 style={S.h2}>{d.project.name}</h2>
          <p style={S.sub}>{d.progress}% complete{d.atRisk ? " · at risk" : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={d.project.status} onChange={e => setStatus(e.target.value)} style={S.select}>
            {statuses.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <button onClick={onClose} style={S.btnGhost}>Close</button>
        </div>
      </div>

      {/* Milestones */}
      <h3 style={S.h3}><IconTarget size={15} /> Milestones</h3>
      <div style={S.list}>
        {(d.milestones || []).length === 0 && <p style={S.fine}>No milestones yet.</p>}
        {(d.milestones || []).map((m: any) => (
          <div key={m.id} style={S.mRow}>
            <span style={{ ...S.mDot, background: m.status === "DONE" ? "var(--v-green)" : m.status === "IN_PROGRESS" ? "var(--v-accent)" : "var(--v-line)" }} />
            <span style={{ flex: 1, textDecoration: m.status === "DONE" ? "line-through" : "none", color: m.status === "DONE" ? "var(--v-ink-3)" : "var(--v-ink)" }}>{m.title}</span>
            <select value={m.status} onChange={e => post({ action: "update-milestone", milestoneId: m.id, status: e.target.value })} style={S.selectSm}>
              <option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="DONE">Done</option>
            </select>
          </div>
        ))}
      </div>
      <div style={S.newRow}>
        <input value={mTitle} onChange={e => setMTitle(e.target.value)} placeholder="Add a milestone" style={{ ...S.input, flex: 1 }} onKeyDown={e => { if (e.key === "Enter" && mTitle.trim()) { post({ action: "add-milestone", title: mTitle }); setMTitle("") } }} />
        <button onClick={() => { if (mTitle.trim()) { post({ action: "add-milestone", title: mTitle }); setMTitle("") } }} style={S.btnSm}><IconPlus size={13} /></button>
      </div>

      {/* Kanban */}
      <h3 style={S.h3}><IconCheckCircle size={15} /> Board</h3>
      <div style={S.kanban}>
        {cols.map(([key, label]) => (
          <div key={key} style={S.kcol}>
            <div style={S.kcolHead}>{label} <span style={S.kcount}>{(d.board?.[key] || []).length}</span></div>
            {(d.board?.[key] || []).map((t: any) => (
              <div key={t.id} style={S.tcard}>
                <span style={S.tcardTitle}>{t.title}</span>
                <div style={S.tcardActions}>
                  {team.length > 0 ? (
                    <select value={t.assigneeId || ""} onChange={e => post({ action: "assign-task", taskId: t.id, assigneeId: e.target.value || null })} style={S.assignSel} title="Assignee">
                      <option value="">Unassigned</option>
                      {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  ) : t.assigneeId ? <span style={S.assignChip}>{teamName(t.assigneeId)}</span> : <span />}
                  <span style={{ display: "flex", gap: 6 }}>
                    {key !== "TODO" && <button onClick={() => post({ action: "move-task", taskId: t.id, status: key === "DONE" ? "DOING" : "TODO" })} style={S.moveBtn}>←</button>}
                    {key !== "DONE" && <button onClick={() => post({ action: "move-task", taskId: t.id, status: key === "TODO" ? "DOING" : "DONE" })} style={S.moveBtn}>→</button>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={S.newRow}>
        <input value={tTitle} onChange={e => setTTitle(e.target.value)} placeholder="Add a task (to To do)" style={{ ...S.input, flex: 1 }} onKeyDown={e => { if (e.key === "Enter" && tTitle.trim()) { post({ action: "add-task", title: tTitle }); setTTitle("") } }} />
        <button onClick={() => { if (tTitle.trim()) { post({ action: "add-task", title: tTitle }); setTTitle("") } }} style={S.btnSm}><IconPlus size={13} /></button>
      </div>

      {/* Wiki / docs */}
      <h3 style={S.h3}><IconFileText size={15} /> Docs</h3>
      {wOpen ? (
        <div>
          <div style={S.detailHead}><strong style={{ color: "var(--v-ink)" }}>{wOpen.title}</strong><div style={{ display: "flex", gap: 8 }}><button onClick={saveWiki} style={S.btnSm}>Save</button><button onClick={() => setWOpen(null)} style={S.btnGhost}>Cancel</button></div></div>
          <textarea value={wBody} onChange={e => setWBody(e.target.value)} placeholder="Write in Markdown…" style={S.textarea} />
        </div>
      ) : (
        <>
          <div style={S.list}>
            {(d.wiki || []).length === 0 && <p style={S.fine}>No documents yet.</p>}
            {(d.wiki || []).map((w: any) => <button key={w.id} onClick={() => openWiki(w.id)} style={S.wRow}><IconFileText size={13} /> {w.title}</button>)}
          </div>
          <div style={S.newRow}>
            <input value={wTitle} onChange={e => setWTitle(e.target.value)} placeholder="New document title" style={{ ...S.input, flex: 1 }} onKeyDown={e => e.key === "Enter" && createWiki()} />
            <button onClick={createWiki} style={S.btnSm}><IconPlus size={13} /></button>
          </div>
        </>
      )}
    </div>
  )
}

function ProjectManagerPanel({ pm }: { pm: any }) {
  const standup = pm.standup || {}
  const suggestions = standup.suggestions || []
  const insights = pm.insights || []
  const loads = (pm.resource?.loads || []).filter((l: any) => l.open > 0)
  const balance = pm.resource?.balance
  const sevColor: any = { urgent: "var(--v-red)", high: "#b7791f", medium: "var(--v-accent)", low: "var(--v-ink-3)" }
  const riskColor = (b: string) => b === "high" ? "var(--v-red)" : b === "medium" ? "#b7791f" : "var(--v-green)"
  return (
    <div style={S.pm}>
      <div style={S.pmHead}>
        <span style={S.pmTitle}><IconZap size={16} /> AI Project Manager</span>
        <span style={S.pmSummary}>{standup.summary}</span>
      </div>
      {suggestions.length > 0 && (
        <div style={S.pmList}>
          {suggestions.slice(0, 6).map((s: any) => (
            <div key={s.id} style={S.pmItem}>
              <span style={{ ...S.pmDot, background: sevColor[s.severity] || "var(--v-ink-3)" }} />
              <div style={{ flex: 1 }}>
                <div style={S.pmItemTitle}>{s.title} <span style={{ ...S.sevTag, color: sevColor[s.severity] }}>{s.severity}</span></div>
                <div style={S.pmItemDetail}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={S.pmCols}>
        {insights.length > 0 && (
          <div style={S.pmCol}>
            <div style={S.pmColHead}><IconActivity size={13} /> Forecast & risk</div>
            {insights.map((ins: any) => (
              <div key={ins.projectId} style={S.insRow}>
                <span style={S.insName}>{ins.name}</span>
                <span style={S.insMeta}>{ins.velocityPerWeek}/wk · {ins.openTasks} open{ins.forecast?.etaAt ? ` · ETA ${new Date(ins.forecast.etaAt).toLocaleDateString()}` : ins.openTasks > 0 ? " · stalled" : ""}{ins.scheduleVarianceDays != null && ins.scheduleVarianceDays < 0 ? ` · ${-ins.scheduleVarianceDays}d late` : ""}</span>
                <span style={{ ...S.riskTag, color: riskColor(ins.risk?.band), borderColor: riskColor(ins.risk?.band) }}>{ins.risk?.band} {ins.risk?.score}</span>
              </div>
            ))}
          </div>
        )}
        {loads.length > 0 && (
          <div style={S.pmCol}>
            <div style={S.pmColHead}><IconUsers size={13} /> Resource load {balance ? <span style={{ ...S.bandMini, ...(balance.band === "overloaded" ? { color: "var(--v-red)" } : balance.band === "uneven" ? { color: "#b7791f" } : { color: "var(--v-green)" }) }}>· {balance.band}</span> : null}</div>
            {loads.slice(0, 8).map((l: any) => (
              <div key={l.assigneeId || "un"} style={S.loadRow}>
                <span style={S.loadName}>{l.name}</span>
                <span style={S.loadBarWrap}><span style={{ ...S.loadBar, width: `${Math.min(100, l.loadPct)}%`, background: l.overAllocated ? "var(--v-red)" : l.loadPct >= 80 ? "#b7791f" : "var(--v-accent)" }} /></span>
                <span style={S.loadPct}>{l.open} open · {l.loadPct}%{l.overAllocated ? " ⚠" : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p style={S.pmFine}>In-house, deterministic project intelligence (velocity, forecast, risk, allocation) — audited through the AI gateway. No external LLM.</p>
    </div>
  )
}

function Kpi({ n, l, accent }: { n: any; l: string; accent?: string }) { return <div style={S.kpi}><div style={{ ...S.kpiN, ...(accent ? { color: accent } : {}) }}>{n == null ? "—" : n}</div><div style={S.kpiL}>{l}</div></div> }
function bandStyle(b: string): any { return b === "at-risk" ? { background: "var(--v-red-bg,#fee)", color: "var(--v-red)" } : b === "watch" ? { background: "#fff7e6", color: "#b7791f" } : { background: "var(--v-green-bg,#e9f9ef)", color: "var(--v-green)" } }
function statusStyle(s: string): any { return s === "DONE" ? { background: "var(--v-green-bg,#e9f9ef)", color: "var(--v-green)" } : s === "ON_HOLD" ? { background: "#fff7e6", color: "#b7791f" } : s === "ARCHIVED" ? { background: "var(--v-surface-2)", color: "var(--v-ink-3)" } : { background: "var(--v-accent-bg,#eef0fb)", color: "var(--v-accent)" } }

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 1040, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 18 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  h2: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--v-ink)", margin: 0 },
  h3: { fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--v-ink)", margin: "20px 0 10px", display: "flex", alignItems: "center", gap: 7 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 680 },
  fine: { fontSize: 12.5, color: "var(--v-ink-3)" },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "40px 24px", textAlign: "center" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 16 },
  kpi: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px" },
  kpiN: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--v-ink)" },
  kpiL: { fontSize: 12, color: "var(--v-ink-2)", marginTop: 2 },
  band: { fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999, textTransform: "capitalize" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 16, marginBottom: 16 },
  newRow: { display: "flex", gap: 8, alignItems: "center" },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none" },
  select: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)" },
  selectSm: { border: "1px solid var(--v-line)", borderRadius: 7, padding: "5px 8px", fontSize: 12, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)" },
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  btnSm: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  btnGhost: { background: "transparent", color: "var(--v-ink-2)", border: "1px solid var(--v-line)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 },
  projCard: { textAlign: "left", background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 16, cursor: "pointer", fontFamily: "inherit", display: "block", width: "100%" },
  projCardOn: { borderColor: "var(--v-accent)", boxShadow: "0 0 0 1px var(--v-accent)" },
  projTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  projName: { fontWeight: 600, color: "var(--v-ink)", fontSize: 14.5 },
  projDesc: { fontSize: 12.5, color: "var(--v-ink-2)", margin: "0 0 10px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  statusPill: { fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, textTransform: "capitalize", whiteSpace: "nowrap" },
  barWrap: { height: 7, background: "var(--v-surface-2)", borderRadius: 999, overflow: "hidden", margin: "8px 0" },
  barFill: { display: "block", height: "100%", background: "var(--v-accent)", borderRadius: 999 },
  projMeta: { display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11.5, color: "var(--v-ink-2)", alignItems: "center" },
  riskBadge: { display: "inline-flex", alignItems: "center", gap: 3, color: "var(--v-red)", fontWeight: 700 },
  detail: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 20, marginTop: 16 },
  detailHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  list: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 },
  mRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, background: "var(--v-surface-2)", borderRadius: 8, padding: "8px 12px" },
  mDot: { width: 9, height: 9, borderRadius: 999, flexShrink: 0 },
  kanban: { display: "grid", gridTemplateColumns: "repeat(3,minmax(140px,1fr))", gap: 10, marginBottom: 10, overflowX: "auto" },
  kcol: { background: "var(--v-surface-2)", borderRadius: 12, padding: 10, minHeight: 80 },
  kcolHead: { fontSize: 12, fontWeight: 700, color: "var(--v-ink-2)", marginBottom: 8, display: "flex", justifyContent: "space-between" },
  kcount: { background: "var(--v-surface)", borderRadius: 999, padding: "0 7px", color: "var(--v-ink-3)" },
  tcard: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 8, padding: "8px 10px", marginBottom: 7, display: "flex", flexDirection: "column", gap: 6 },
  tcardTitle: { fontSize: 12.5, color: "var(--v-ink)", lineHeight: 1.4 },
  tcardActions: { display: "flex", gap: 6, justifyContent: "space-between", alignItems: "center" },
  assignSel: { border: "1px solid var(--v-line)", borderRadius: 6, padding: "3px 5px", fontSize: 11, fontFamily: "inherit", color: "var(--v-ink-2)", background: "var(--v-surface)", maxWidth: 120 },
  assignChip: { fontSize: 10.5, color: "var(--v-ink-2)", background: "var(--v-surface-2)", borderRadius: 999, padding: "2px 8px" },
  moveBtn: { background: "var(--v-surface-2)", border: "1px solid var(--v-line)", borderRadius: 6, width: 24, height: 22, cursor: "pointer", color: "var(--v-ink-2)", fontSize: 13, lineHeight: 1 },
  wRow: { display: "flex", alignItems: "center", gap: 8, textAlign: "left", background: "var(--v-surface-2)", border: "none", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--v-ink)", cursor: "pointer", fontFamily: "inherit" },
  textarea: { width: "100%", minHeight: 200, border: "1px solid var(--v-line)", borderRadius: 10, padding: 12, fontSize: 13, fontFamily: "var(--font-mono,monospace)", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none", lineHeight: 1.6, resize: "vertical" },
  pm: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18, marginBottom: 16, borderLeft: "3px solid var(--v-accent)" },
  pmHead: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, marginBottom: 12 },
  pmTitle: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--v-ink)", display: "flex", alignItems: "center", gap: 7 },
  pmSummary: { fontSize: 13, color: "var(--v-ink-2)" },
  pmList: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  pmItem: { display: "flex", gap: 10, alignItems: "flex-start" },
  pmDot: { width: 8, height: 8, borderRadius: 999, marginTop: 6, flexShrink: 0 },
  pmItemTitle: { fontSize: 13, fontWeight: 600, color: "var(--v-ink)" },
  sevTag: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginLeft: 4 },
  pmItemDetail: { fontSize: 12, color: "var(--v-ink-2)", lineHeight: 1.5, marginTop: 1 },
  pmCols: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 },
  pmCol: {},
  pmColHead: { fontSize: 11.5, fontWeight: 700, color: "var(--v-ink-2)", textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 },
  bandMini: { fontWeight: 700, textTransform: "capitalize" },
  insRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 12.5, borderBottom: "1px solid var(--v-line)" },
  insName: { fontWeight: 600, color: "var(--v-ink)", width: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  insMeta: { flex: 1, color: "var(--v-ink-2)", fontSize: 11.5 },
  riskTag: { fontSize: 10.5, fontWeight: 700, textTransform: "capitalize", border: "1px solid", borderRadius: 999, padding: "1px 8px", whiteSpace: "nowrap" },
  loadRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12.5 },
  loadName: { width: 100, color: "var(--v-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  loadBarWrap: { flex: 1, height: 8, background: "var(--v-surface-2)", borderRadius: 999, overflow: "hidden" },
  loadBar: { display: "block", height: "100%", borderRadius: 999 },
  loadPct: { fontSize: 11, color: "var(--v-ink-2)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  pmFine: { fontSize: 11, color: "var(--v-ink-3)", lineHeight: 1.5, marginTop: 12, marginBottom: 0 },
}
