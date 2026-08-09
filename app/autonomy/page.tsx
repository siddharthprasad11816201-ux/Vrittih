"use client"
import { useEffect, useState, useCallback } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconZap, IconCheck, IconActivity, IconShield } from "@/components/ui/Icons"

type Step = { i: number; name: string; title: string; capId: string | null; requiresApproval: boolean; rationale: string; status: string; result?: any }
type Plan = { id: string; goalKey: string; goal: string; status: string; steps: Step[]; createdAt: string }

const STATUS_COLOR: Record<string, string> = { done: "#059669", running: "#6495ED", awaiting_approval: "#B45309", blocked: "#9CA3AF", error: "#DC2626", approved: "#059669", pending: "#9CA3AF" }

export default function AutonomyPage() {
  const [goals, setGoals] = useState<any[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [active, setActive] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setErr(false)
    try {
      const r = await fetch("/api/autonomy")
      if (!r.ok) throw new Error(String(r.status))
      const d = await r.json()
      setGoals(d.goals || []); setPlans(d.plans || [])
      setActive(prev => prev ? (d.plans || []).find((p: Plan) => p.id === prev.id) || prev : null)
    } catch { setErr(true) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function createPlan(goalKey: string) {
    setBusy(true)
    try { const r = await fetch("/api/autonomy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goalKey }) }); const d = await r.json(); if (r.ok) { setActive(d.plan); load() } }
    finally { setBusy(false) }
  }
  async function run() {
    if (!active) return
    setBusy(true)
    try { const r = await fetch(`/api/autonomy/${active.id}/run`, { method: "POST" }); const d = await r.json(); if (r.ok) { setActive(d.plan); load() } }
    finally { setBusy(false) }
  }
  async function approve() {
    if (!active) return
    setBusy(true)
    try { const r = await fetch(`/api/autonomy/${active.id}/approve`, { method: "POST" }); const d = await r.json(); if (r.ok) { setActive(d.plan); load() } }
    finally { setBusy(false) }
  }
  async function del(id: string) {
    if (!confirm("Delete this plan?")) return
    await fetch(`/api/autonomy/${id}`, { method: "DELETE" }); if (active?.id === id) setActive(null); load()
  }

  if (loading) return <AppShell title="Autonomous AI"><div style={S.center}>Loading…</div></AppShell>
  if (err) return <AppShell title="Autonomous AI"><div style={S.center}>Couldn&rsquo;t load. <button onClick={load} style={S.retry}>Retry</button></div></AppShell>

  return (
    <AppShell title="Autonomous AI">
      <div style={S.wrap}>
        <div style={S.head}>
          <h1 style={S.h1}>Autonomous AI</h1>
          <p style={S.sub}>Set a goal. The in-house planner builds an ordered, evidence-based plan that runs through the Enterprise Brain — pausing for your approval before any action.</p>
        </div>

        <h2 style={S.h2}>Start a goal</h2>
        <div style={S.goalRow}>
          {goals.map(g => <button key={g.key} onClick={() => createPlan(g.key)} disabled={busy} style={S.goalBtn}><IconZap size={14} /> {g.title}</button>)}
        </div>

        {active && (
          <>
            <div style={S.planHead}>
              <div>
                <h2 style={{ ...S.h2, margin: 0 }}>{active.goal}</h2>
                <span style={{ ...S.statusPill, background: bg(active.status), color: fg(active.status) }}>{active.status.replace("_", " ")}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {active.status === "running" && <button onClick={run} disabled={busy} style={S.runBtn}>{busy ? "Running…" : "Run"}</button>}
                {active.status === "awaiting_approval" && <button onClick={approve} disabled={busy} style={S.approveBtn}><IconShield size={14} /> Approve &amp; continue</button>}
                <button onClick={() => del(active.id)} style={S.delBtn}>Delete</button>
              </div>
            </div>
            <div style={S.steps}>
              {active.steps.map(st => (
                <div key={st.i} style={S.step}>
                  <div style={{ ...S.dot, background: STATUS_COLOR[st.status] || "#9CA3AF" }}>{st.status === "done" ? <IconCheck size={12} /> : st.i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.stepTitle}>{st.title} {st.requiresApproval && <span style={S.gate}><IconShield size={10} /> approval</span>}</div>
                    <div style={S.stepRationale}>{st.rationale}{st.capId ? ` · ${st.capId}` : ""}</div>
                    {st.result && (
                      <div style={S.result}>
                        {st.result.explanation && <span style={S.resExpl}>{st.result.explanation}</span>}
                        {typeof st.result.confidence === "number" && <span style={S.conf}>confidence {Math.round(st.result.confidence * 100)}%</span>}
                        {st.result.error && <span style={S.resErr}>{st.result.error}</span>}
                        {st.result.runId && <span style={S.runId}>audited · {st.result.runId}</span>}
                      </div>
                    )}
                  </div>
                  <span style={{ ...S.stepStatus, color: STATUS_COLOR[st.status] || "#9CA3AF" }}>{st.status.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {plans.length > 0 && (
          <>
            <h2 style={S.h2}>Your plans</h2>
            <div style={S.card}>
              {plans.map(p => (
                <div key={p.id} style={S.planRow} onClick={() => setActive(p)}>
                  <IconActivity size={15} />
                  <span style={S.planName}>{p.goal}</span>
                  <span style={{ ...S.statusPill, background: bg(p.status), color: fg(p.status) }}>{p.status.replace("_", " ")}</span>
                  <span style={S.muted}>{new Date(p.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
function bg(s: string) { return s === "done" ? "#DCFCE7" : s === "awaiting_approval" ? "#FEF3C7" : s === "failed" ? "#FEE2E2" : "var(--v-surface-2)" }
function fg(s: string) { return s === "done" ? "#047857" : s === "awaiting_approval" ? "#B45309" : s === "failed" ? "#B91C1C" : "var(--v-ink-2)" }

const S: Record<string, any> = {
  wrap: { maxWidth: 820, margin: "0 auto", padding: "0 4px" },
  head: { marginBottom: 16 },
  h1: { fontSize: 22, fontWeight: 700, color: "var(--v-ink)", letterSpacing: "-.3px" },
  sub: { fontSize: 13.5, color: "var(--v-ink-3)", marginTop: 4, maxWidth: 600, lineHeight: 1.5 },
  h2: { fontSize: 15, fontWeight: 650, color: "var(--v-ink)", margin: "22px 0 10px" },
  goalRow: { display: "flex", gap: 10, flexWrap: "wrap" as const },
  goalBtn: { display: "inline-flex", alignItems: "center", gap: 7, background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 10, padding: "10px 16px", fontSize: 13.5, color: "var(--v-ink)", cursor: "pointer", fontWeight: 500 },
  planHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginTop: 22, flexWrap: "wrap" as const },
  statusPill: { display: "inline-block", borderRadius: 6, padding: "3px 10px", fontSize: 11.5, fontWeight: 600, textTransform: "capitalize" as const, marginTop: 6 },
  runBtn: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  approveBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "#B45309", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  delBtn: { background: "none", border: "1px solid var(--v-line-2)", color: "var(--danger)", borderRadius: 9, padding: "8px 16px", fontSize: 13, cursor: "pointer" },
  steps: { display: "flex", flexDirection: "column" as const, gap: 10, marginTop: 14 },
  step: { display: "flex", gap: 12, alignItems: "flex-start", background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 12, padding: "14px 16px" },
  dot: { width: 24, height: 24, borderRadius: "50%", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  stepTitle: { fontSize: 14.5, fontWeight: 650, color: "var(--v-ink)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const },
  gate: { display: "inline-flex", alignItems: "center", gap: 3, background: "#FEF3C7", color: "#B45309", borderRadius: 5, padding: "1px 6px", fontSize: 10.5, fontWeight: 600 },
  stepRationale: { fontSize: 12.5, color: "var(--v-ink-3)", marginTop: 3 },
  result: { marginTop: 8, display: "flex", flexWrap: "wrap" as const, gap: 10, alignItems: "center", fontSize: 12.5 },
  resExpl: { color: "var(--v-ink-2)", flex: "1 1 100%", lineHeight: 1.5 },
  conf: { color: "var(--v-ink-2)", fontWeight: 600 },
  resErr: { color: "#B91C1C" },
  runId: { color: "var(--v-ink-3)", fontSize: 11 },
  stepStatus: { fontSize: 11.5, fontWeight: 600, textTransform: "capitalize" as const, flexShrink: 0 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 14, padding: 8 },
  planRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13.5, color: "var(--v-ink-2)" },
  planName: { flex: 1, fontWeight: 600, color: "var(--v-ink)" },
  muted: { color: "var(--v-ink-3)", fontSize: 12 },
  center: { textAlign: "center" as const, padding: "3rem 0", color: "var(--v-ink-3)", fontSize: 14 },
  retry: { marginLeft: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer" },
}
