"use client"
import { useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconZap, IconArrowRight, IconCheckCircle } from "@/components/ui/Icons"

const STARTERS = ["Make me a 14-day study plan", "Quiz me on system design", "Give me practice for React", "Explain hash tables", "Recommend resources for Go"]

export default function TutorPage() {
  const [q, setQ] = useState("")
  const [thread, setThread] = useState<{ q: string; res: any }[]>([])
  const [busy, setBusy] = useState(false)

  async function ask(question: string) {
    if (!question.trim() || busy) return
    setBusy(true); setQ("")
    try {
      const res = await fetch("/api/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) }).then(r => r.json())
      setThread(t => [...t, { q: question, res }])
    } catch { setThread(t => [...t, { q: question, res: { error: "Network error." } }]) } finally { setBusy(false) }
  }

  return (
    <AppShell title="AI Tutor">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconZap size={20} /> AI Tutor</h1>
          <p style={S.sub}>In‑house, explainable, no black box. Ask for a study plan, practice, a quiz, an explanation, or resources — structured from your competency gaps and the curated resource graph. Runs through AIOS (audited).</p>
        </header>

        {thread.length === 0 && (
          <div style={S.starters}>{STARTERS.map(s => <button key={s} style={S.starter} onClick={() => ask(s)}>{s}</button>)}</div>
        )}

        <div style={S.thread}>
          {thread.map((t, i) => (
            <div key={i} style={S.turn}>
              <div style={S.qBubble}>{t.q}</div>
              <div style={S.aBubble}><TutorAnswer res={t.res} /></div>
            </div>
          ))}
        </div>

        <form style={S.composer} onSubmit={e => { e.preventDefault(); ask(q) }}>
          <input style={S.input} value={q} onChange={e => setQ(e.target.value)} placeholder="Ask the tutor…" disabled={busy} />
          <button style={S.send} disabled={busy || !q.trim()}>{busy ? "…" : <IconArrowRight size={16} />}</button>
        </form>
      </div>
    </AppShell>
  )
}

function TutorAnswer({ res }: { res: any }) {
  if (!res) return null
  if (res.error) return <span style={{ color: "var(--v-red)" }}>{res.error}</span>
  return (
    <div>
      <div style={S.msg}>{res.message}</div>
      {res.studyPlan?.length > 0 && (
        <div style={S.block}>{res.studyPlan.map((s: any) => (
          <div key={s.day} style={S.planRow}><span style={S.day}>Day {s.day}</span><span style={S.planSkill}>{s.skill}</span><span style={S.planAct}>{s.activity} · {s.minutes}m</span></div>
        ))}</div>
      )}
      {res.quiz?.length > 0 && (
        <ol style={S.quiz}>{res.quiz.map((qi: any, i: number) => <li key={i} style={S.quizItem}>{qi.prompt} <em style={S.bloom}>{qi.bloom}</em></li>)}</ol>
      )}
      {res.practice?.items?.length > 0 && (
        <div style={S.block}>{res.practice.items.map((r: any, i: number) => <ResLink key={i} r={r} />)}</div>
      )}
      {res.resources?.length > 0 && (
        <div style={S.block}>{res.resources.map((r: any, i: number) => <ResLink key={i} r={r} />)}</div>
      )}
      {res.conceptMap && (
        <div style={S.concept}><span style={S.conceptC}>{res.conceptMap.center}</span><span style={S.conceptCat}>{res.conceptMap.category}</span>{res.conceptMap.related.map((r: string) => <span key={r} style={S.conceptR}>{r}</span>)}</div>
      )}
      {res.explanation && <div style={S.why}>{res.explanation}</div>}
    </div>
  )
}
function ResLink({ r }: { r: any }) {
  const inner = <><IconCheckCircle size={13} /> <b>{r.title}</b> <em style={S.resType}>{r.provider} · {r.type}</em></>
  return r.url ? <a href={r.url} target="_blank" rel="noreferrer" style={S.res}>{inner}</a> : <div style={S.res}>{inner}</div>
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 760, margin: "0 auto", paddingBottom: 40, display: "flex", flexDirection: "column", minHeight: "calc(100dvh - 60px)" },
  head: { marginBottom: 14 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 640 },
  starters: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  starter: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 999, padding: "8px 14px", fontSize: 13, color: "var(--v-ink)", cursor: "pointer", font: "inherit" },
  thread: { flex: 1, display: "flex", flexDirection: "column", gap: 16 },
  turn: { display: "flex", flexDirection: "column", gap: 8 },
  qBubble: { alignSelf: "flex-end", background: "var(--v-accent)", color: "#fff", padding: "9px 14px", borderRadius: "14px 14px 4px 14px", fontSize: 14, maxWidth: "80%" },
  aBubble: { alignSelf: "flex-start", background: "var(--v-surface)", border: "1px solid var(--v-line)", padding: "12px 15px", borderRadius: "14px 14px 14px 4px", fontSize: 14, maxWidth: "92%", boxShadow: "var(--v-shadow-sm)" },
  msg: { color: "var(--v-ink)", lineHeight: 1.5 },
  block: { display: "flex", flexDirection: "column", gap: 5, marginTop: 10 },
  planRow: { display: "flex", gap: 10, alignItems: "baseline", fontSize: 13 },
  day: { width: 52, color: "var(--v-ink-3)", fontWeight: 600, flexShrink: 0 },
  planSkill: { fontWeight: 600, color: "var(--v-ink)", width: 120 },
  planAct: { color: "var(--v-ink-2)" },
  quiz: { margin: "10px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 7 },
  quizItem: { fontSize: 13.5, color: "var(--v-ink)", lineHeight: 1.5 },
  bloom: { fontStyle: "normal", fontSize: 10.5, color: "var(--v-accent-2)", background: "var(--v-accent-soft)", padding: "1px 6px", borderRadius: 999, marginLeft: 4 },
  res: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--v-ink)", textDecoration: "none", padding: "3px 0" },
  resType: { fontStyle: "normal", fontSize: 11.5, color: "var(--v-ink-3)" },
  concept: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 10 },
  conceptC: { fontSize: 12.5, fontWeight: 700, color: "#fff", background: "var(--v-accent)", padding: "3px 10px", borderRadius: 999 },
  conceptCat: { fontSize: 11.5, color: "var(--v-ink-3)" },
  conceptR: { fontSize: 12, color: "var(--v-ink-2)", background: "var(--v-surface-2)", padding: "3px 9px", borderRadius: 999 },
  why: { fontSize: 11.5, color: "var(--v-ink-3)", marginTop: 10, lineHeight: 1.5, borderTop: "1px solid var(--v-line-2)", paddingTop: 8 },
  composer: { display: "flex", gap: 8, marginTop: 16, position: "sticky", bottom: 12 },
  input: { flex: 1, border: "1px solid var(--v-line)", borderRadius: 12, padding: "12px 15px", fontSize: 14, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none" },
  send: { width: 46, borderRadius: 12, border: "none", background: "var(--v-accent)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" },
}
