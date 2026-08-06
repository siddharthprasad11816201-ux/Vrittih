"use client"
import { useCallback, useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconLayers, IconPlus, IconTarget, IconCheckCircle, IconFileText, IconAlert } from "@/components/ui/Icons"

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

  const load = useCallback(() => {
    fetch("/api/projects").then(async r => {
      if (r.status === 401 || r.status === 403) { setState("denied"); return }
      const d = await r.json()
      setProjects(d.projects || []); setPortfolio(d.portfolio || null); setStatuses(d.statuses || []); setState("ok")
    }).catch(() => setState("denied"))
  }, [])
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

  const load = useCallback(() => { fetch(`/api/projects/${id}`).then(r => r.json()).then(setD).catch(() => {}) }, [id])
  useEffect(() => { load() }, [load])

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
                  {key !== "TODO" && <button onClick={() => post({ action: "move-task", taskId: t.id, status: key === "DONE" ? "DOING" : "TODO" })} style={S.moveBtn}>←</button>}
                  {key !== "DONE" && <button onClick={() => post({ action: "move-task", taskId: t.id, status: key === "TODO" ? "DOING" : "DONE" })} style={S.moveBtn}>→</button>}
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
  kanban: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 10 },
  kcol: { background: "var(--v-surface-2)", borderRadius: 12, padding: 10, minHeight: 80 },
  kcolHead: { fontSize: 12, fontWeight: 700, color: "var(--v-ink-2)", marginBottom: 8, display: "flex", justifyContent: "space-between" },
  kcount: { background: "var(--v-surface)", borderRadius: 999, padding: "0 7px", color: "var(--v-ink-3)" },
  tcard: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 8, padding: "8px 10px", marginBottom: 7, display: "flex", flexDirection: "column", gap: 6 },
  tcardTitle: { fontSize: 12.5, color: "var(--v-ink)", lineHeight: 1.4 },
  tcardActions: { display: "flex", gap: 6, justifyContent: "flex-end" },
  moveBtn: { background: "var(--v-surface-2)", border: "1px solid var(--v-line)", borderRadius: 6, width: 24, height: 22, cursor: "pointer", color: "var(--v-ink-2)", fontSize: 13, lineHeight: 1 },
  wRow: { display: "flex", alignItems: "center", gap: 8, textAlign: "left", background: "var(--v-surface-2)", border: "none", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--v-ink)", cursor: "pointer", fontFamily: "inherit" },
  textarea: { width: "100%", minHeight: 200, border: "1px solid var(--v-line)", borderRadius: 10, padding: 12, fontSize: 13, fontFamily: "var(--font-mono,monospace)", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none", lineHeight: 1.6, resize: "vertical" },
}
