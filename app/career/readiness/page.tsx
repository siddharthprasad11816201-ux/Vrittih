"use client"
import { useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconActivity, IconZap, IconCheckCircle, IconAlert, IconBookmark } from "@/components/ui/Icons"

export default function CareerReadinessPage() {
  const [role, setRole] = useState("")
  const [busy, setBusy] = useState(false)
  const [d, setD] = useState<any>(null)
  const [err, setErr] = useState("")

  const run = async () => {
    if (!role.trim() || busy) return
    setBusy(true); setErr(""); setD(null)
    const r = await fetch("/api/career/coach/readiness", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetRole: role }) })
    setBusy(false)
    if (r.status === 401) { setErr("Please sign in."); return }
    const j = await r.json(); if (!r.ok || !j.readiness) { setErr(j.error || "Couldn't assess that role — try a more common title."); return }
    setD(j)
  }

  const rd = d?.readiness
  const vColor = rd?.verdict === "supported" ? "var(--v-green)" : rd?.verdict === "refuted" ? "var(--v-red)" : "#b7791f"
  return (
    <AppShell title="Career Coach">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconActivity size={20} /> Career Coach — role readiness</h1>
          <p style={S.sub}>Tell me the role you want to grow into. I'll assess your readiness from your real skills and experience vs what the role actually requires in the market, show the reasoning, and give you a concrete learning plan. In-house, evidence-based, no external LLM.</p>
        </header>

        <div style={S.card}>
          <div style={S.formRow}>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. AI Engineer, Backend Engineer, Product Manager" style={{ ...S.input, flex: 1 }} onKeyDown={e => e.key === "Enter" && run()} />
            <button onClick={run} disabled={busy || !role.trim()} style={{ ...S.btn, opacity: busy || !role.trim() ? 0.6 : 1 }}><IconZap size={15} /> {busy ? "Analysing…" : "Assess readiness"}</button>
          </div>
          {err && <p style={S.err}>{err}</p>}
        </div>

        {d && (
          <>
            <div style={{ ...S.card, borderLeft: `3px solid ${vColor}` }}>
              <div style={S.rdTop}>
                <span style={S.rdLabel}>{rd.label} for <b>{d.targetRole}</b></span>
                <span style={{ ...S.verdict, color: vColor, borderColor: vColor }}>{rd.verdict} · {Math.round((rd.confidence || 0) * 100)}%</span>
              </div>
              <p style={S.why}>{rd.why}</p>
              <p style={S.meta}>{d.marketJobsAnalysed} live role(s) analysed for market requirements · {d.matched.length}/{d.requiredSkills.length} required skills covered</p>
              {(rd.risks || []).length > 0 && <div style={S.chips}>{rd.risks.slice(0, 3).map((r: string, i: number) => <span key={i} style={S.riskChip}><IconAlert size={11} /> {r}</span>)}</div>}
            </div>

            <div style={S.cols}>
              <section style={S.col}>
                <h2 style={S.h2}><IconCheckCircle size={15} /> Skills you have</h2>
                {d.matched.length === 0 ? <p style={S.fine}>None of the role's core market skills yet.</p> : <div style={S.chips}>{d.matched.map((s: string) => <span key={s} style={S.okChip}>{s}</span>)}</div>}
              </section>
              <section style={S.col}>
                <h2 style={S.h2}><IconAlert size={15} /> Gaps to close</h2>
                {d.missing.length === 0 ? <p style={S.fine}>No skill gaps for this role — focus on depth + projects.</p> : <div style={S.chips}>{d.missing.map((s: string) => <span key={s} style={S.gapChip}>{s}</span>)}</div>}
              </section>
            </div>

            <div style={S.planHead}>
              <h2 style={S.h2}><IconBookmark size={15} /> Your learning plan</h2>
              <span style={S.sub}>{d.plan.summary}</span>
            </div>
            {d.plan.items.length > 0 && (
              <div style={S.list}>
                {d.plan.items.map((it: any) => (
                  <div key={it.skill} style={S.plan}>
                    <div style={S.planTop}>
                      <span style={S.planSkill}><span style={S.prio}>{it.priority}</span> {it.skill}</span>
                      <span style={S.weeks}>~{it.estWeeks}w</span>
                    </div>
                    <p style={S.why}>{it.why}</p>
                    {it.course
                      ? <a href={`/academy?course=${encodeURIComponent(it.course.slug)}`} style={S.courseLink}>Academy course: “{it.course.title}” →</a>
                      : <span style={S.noCourse}>No Academy course yet — project-based path below</span>}
                    <ul style={S.actions}>{it.actions.map((a: string, i: number) => <li key={i} style={S.action}>{a}</li>)}</ul>
                  </div>
                ))}
              </div>
            )}
            <p style={S.fine}>Assessed by the Enterprise Brain from your profile vs real market demand — the verdict carries its evidence, honest confidence and the gaps. Guidance to act on; you always decide.</p>
          </>
        )}
      </div>
    </AppShell>
  )
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 920, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 16 }, h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  h2: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 7 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 760 },
  fine: { fontSize: 12, color: "var(--v-ink-3)", lineHeight: 1.5, marginTop: 12 },
  err: { fontSize: 13, color: "var(--v-red)", marginTop: 10 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18, marginBottom: 14 },
  formRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "10px 12px", fontSize: 13.5, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none" },
  btn: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  rdTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 },
  rdLabel: { fontSize: 15, color: "var(--v-ink)" },
  verdict: { fontSize: 11.5, fontWeight: 700, border: "1px solid", borderRadius: 999, padding: "2px 10px", textTransform: "capitalize", whiteSpace: "nowrap" },
  why: { fontSize: 12.5, color: "var(--v-ink-2)", lineHeight: 1.55, margin: "6px 0 0" },
  meta: { fontSize: 11.5, color: "var(--v-ink-3)", marginTop: 8 },
  cols: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginBottom: 14 },
  col: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 16 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 },
  okChip: { fontSize: 11.5, color: "var(--v-green)", background: "var(--v-green-bg,#e9f9ef)", borderRadius: 999, padding: "3px 10px" },
  gapChip: { fontSize: 11.5, color: "#b7791f", background: "#fff7e6", borderRadius: 999, padding: "3px 10px" },
  riskChip: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--v-ink-2)", background: "var(--v-surface-2)", borderRadius: 999, padding: "2px 9px" },
  planHead: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, margin: "4px 0 12px" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  plan: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "13px 15px" },
  planTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  planSkill: { fontWeight: 600, color: "var(--v-ink)", fontSize: 14 },
  weeks: { fontSize: 11.5, fontWeight: 700, color: "var(--v-accent)", background: "var(--v-accent-bg,#eef0fb)", borderRadius: 999, padding: "2px 9px" },
  actions: { margin: "8px 0 0", paddingLeft: 18 },
  action: { fontSize: 12.5, color: "var(--v-ink-2)", lineHeight: 1.6 },
}
