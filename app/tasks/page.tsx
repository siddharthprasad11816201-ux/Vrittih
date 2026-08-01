"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import FeatureGate from "@/components/vrittih/FeatureGate"

type Task = { id: string; title: string; description?: string | null; status: string; priority: string; dueAt?: string | null; assigneeId?: string | null; assignee?: { id: string; name: string } | null }
type Emp = { id: string; name: string | null }

const COLUMNS = [
  { key: "TODO", label: "To do" },
  { key: "DOING", label: "In progress" },
  { key: "DONE", label: "Done" },
]
const PRIO: Record<string, { label: string; bg: string; fg: string }> = {
  HIGH: { label: "High", bg: "#FBECEC", fg: "#DC2626" },
  MEDIUM: { label: "Medium", bg: "#FDF3E3", fg: "#B45309" },
  LOW: { label: "Low", bg: "#EAF1FE", fg: "#2F6BE0" },
}

function Board() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [emps, setEmps] = useState<Emp[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [priority, setPriority] = useState("MEDIUM")
  const [dueAt, setDueAt] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  async function load() {
    const [t, e] = await Promise.all([
      fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] })),
      fetch("/api/hrms/employees").then((r) => r.json()).catch(() => ({ employees: [] })),
    ])
    setTasks(t.tasks || [])
    setEmps((e.employees || []).map((x: any) => ({ id: x.id, name: x.name })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create() {
    if (!title.trim()) return
    setBusy(true); setErr("")
    try {
      const r = await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, assigneeId: assigneeId || undefined, priority, dueAt: dueAt || undefined }) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || "Could not create task"); return }
      setTitle(""); setAssigneeId(""); setPriority("MEDIUM"); setDueAt("")
      load()
    } finally { setBusy(false) }
  }
  async function move(t: Task, status: string) {
    setTasks((cur) => cur.map((x) => x.id === t.id ? { ...x, status } : x))
    await fetch(`/api/tasks/${t.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) })
  }
  async function remove(t: Task) {
    setTasks((cur) => cur.filter((x) => x.id !== t.id))
    await fetch(`/api/tasks/${t.id}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: t.id }) })
  }

  const byStatus = (s: string) => tasks.filter((t) => t.status === s)
  const overdue = (t: Task) => t.dueAt && t.status !== "DONE" && new Date(t.dueAt).getTime() < Date.now()

  return (
    <div style={S.page}>
      <div style={S.head}>
        <div>
          <h1 style={S.h1}>Tasks</h1>
          <p style={S.sub}>Assign work to your team and track it to done.</p>
        </div>
      </div>

      <div style={S.newRow}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="New task…" style={{ ...S.input, flex: "2 1 220px" }} maxLength={300} />
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={S.input}>
          <option value="">Unassigned</option>
          {emps.map((e) => <option key={e.id} value={e.id}>{e.name || "—"}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={S.input}>
          <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
        </select>
        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={S.input} />
        <button onClick={create} disabled={busy || !title.trim()} style={{ ...S.btn, opacity: busy || !title.trim() ? 0.6 : 1 }}>{busy ? "Adding…" : "Add task"}</button>
      </div>
      {err && <div style={S.err}>{err}</div>}

      {loading ? <div style={S.muted}>Loading…</div> : (
        <div style={S.board}>
          {COLUMNS.map((col) => (
            <div key={col.key} style={S.col}>
              <div style={S.colHead}>{col.label} <span style={S.count}>{byStatus(col.key).length}</span></div>
              <div style={S.colBody}>
                {byStatus(col.key).map((t) => (
                  <div key={t.id} style={S.card}>
                    <div style={S.cardTop}>
                      <span style={{ ...S.prio, background: PRIO[t.priority]?.bg, color: PRIO[t.priority]?.fg }}>{PRIO[t.priority]?.label || t.priority}</span>
                      <button onClick={() => remove(t)} style={S.del} title="Delete">×</button>
                    </div>
                    <div style={S.cardTitle}>{t.title}</div>
                    <div style={S.cardMeta}>
                      <span>{t.assignee?.name || "Unassigned"}</span>
                      {t.dueAt && <span style={{ color: overdue(t) ? "#DC2626" : "#64748B" }}>· due {new Date(t.dueAt).toLocaleDateString()}</span>}
                    </div>
                    <div style={S.moves}>
                      {COLUMNS.filter((c) => c.key !== t.status).map((c) => (
                        <button key={c.key} onClick={() => move(t, c.key)} style={S.moveBtn}>→ {c.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
                {byStatus(col.key).length === 0 && <div style={S.empty}>Nothing here</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TasksPage() {
  return (
    <AppShell>
      <FeatureGate feature="tasks">
        <Board />
      </FeatureGate>
    </AppShell>
  )
}

const S: Record<string, any> = {
  page: { padding: "1.5rem 1.75rem 3rem", maxWidth: 1200, margin: "0 auto" },
  head: { marginBottom: 18 },
  h1: { fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--v-ink)", margin: 0 },
  sub: { fontSize: 14, color: "var(--v-ink-3)", margin: "4px 0 0" },
  newRow: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 },
  input: { flex: "1 1 130px", border: "1px solid var(--v-line-2)", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, background: "var(--v-surface)", color: "var(--v-ink)", fontFamily: "var(--font-sans)" },
  btn: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  err: { margin: "8px 0", fontSize: 13, color: "#DC2626", background: "#FBECEC", border: "1px solid #F0D2D2", borderRadius: 8, padding: "8px 12px" },
  muted: { color: "var(--v-ink-3)", fontSize: 14, padding: "20px 0" },
  board: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 14 },
  col: { background: "var(--v-surface-2)", borderRadius: 14, padding: 12, minHeight: 200 },
  colHead: { fontSize: 12.5, fontWeight: 700, color: "var(--v-ink-2)", textTransform: "uppercase", letterSpacing: ".04em", padding: "2px 4px 10px", display: "flex", alignItems: "center", gap: 8 },
  count: { background: "var(--v-surface)", color: "var(--v-ink-3)", borderRadius: 999, padding: "1px 8px", fontSize: 11 },
  colBody: { display: "flex", flexDirection: "column", gap: 10 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 11, padding: "11px 12px", boxShadow: "0 1px 2px rgba(51,78,172,.04)" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  prio: { fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "2px 9px" },
  del: { background: "none", border: "none", color: "var(--v-ink-3)", fontSize: 18, lineHeight: 1, cursor: "pointer", padding: 0 },
  cardTitle: { fontSize: 14, fontWeight: 500, color: "var(--v-ink)", lineHeight: 1.4 },
  cardMeta: { fontSize: 12, color: "var(--v-ink-3)", marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap" },
  moves: { display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" },
  moveBtn: { background: "var(--v-surface-2)", color: "var(--v-ink-2)", border: "none", borderRadius: 7, padding: "4px 9px", fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
  empty: { fontSize: 12.5, color: "var(--v-ink-3)", textAlign: "center", padding: "16px 0" },
}
