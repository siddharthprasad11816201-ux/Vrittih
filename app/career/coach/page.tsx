"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { STARTERS } from "@/lib/career/coach"

/* ICIRE — AI Career Coach chat. In-house (no external LLM): every answer is
 * composed from the applicant's real profile + live jobs by /api/career/coach. */

type Card = { kind: "jobs" | "chips" | "list" | "meter"; title?: string; items: any[] }
type Msg = { role: "user" | "coach"; text: string; cards?: Card[]; cta?: { label: string; href: string } | null; suggestions?: string[] }

const tier = (n: number) => (n >= 75 ? "#16A34A" : n >= 55 ? "#6495ED" : n >= 35 ? "#B45309" : "#94A3B8")

export default function CoachPage() {
  const [msgs, setMsgs] = useState<Msg[]>([{
    role: "coach",
    text: "Hi — I'm your in-house career coach. I read your real profile and live roles (no guesswork) to help you decide what to do next. Ask me anything, or start here:",
    suggestions: STARTERS,
  }])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [anon, setAnon] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs, busy])

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    setInput("")
    setMsgs((m) => [...m, { role: "user", text: q }])
    setBusy(true)
    try {
      const r = await fetch("/api/career/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: q }) })
      if (r.status === 401) { setAnon(true); setBusy(false); return }
      const d = await r.json().catch(() => null)
      if (!d || d.error) { setMsgs((m) => [...m, { role: "coach", text: "I couldn't answer that just now — please try again." }]); setBusy(false); return }
      setMsgs((m) => [...m, { role: "coach", text: d.reply, cards: d.cards, cta: d.cta, suggestions: d.suggestions }])
    } catch {
      setMsgs((m) => [...m, { role: "coach", text: "I couldn't answer that just now — please try again." }])
    }
    setBusy(false)
  }

  if (anon) return (
    <AppShell title="Career coach">
      <div style={S.wrap}><div style={S.card}>
        <h1 style={S.h1}>AI Career Coach</h1>
        <p style={S.muted}>Sign in and the coach will answer from your real profile and live roles — what to learn, your best-fit jobs, résumé and interview help, and your career path.</p>
        <Link href="/login?next=/career/coach" style={S.cta}>Sign in</Link>
      </div></div>
    </AppShell>
  )

  return (
    <AppShell title="Career coach">
      <div style={S.wrap}>
        <div style={S.head}>
          <div style={S.title}>AI Career Coach</div>
          <div style={S.sub}>In-house · answers from your real profile and live roles</div>
        </div>

        <div style={S.thread}>
          {msgs.map((m, i) => (
            <div key={i} style={{ ...S.row, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ ...S.bubble, ...(m.role === "user" ? S.userBubble : S.coachBubble) }}>
                <div style={S.msgText}>{m.text}</div>
                {m.cards?.map((c, j) => <CardView key={j} card={c} />)}
                {m.cta && <Link href={m.cta.href} style={S.ctaBtn}>{m.cta.label} →</Link>}
                {m.suggestions && m.suggestions.length > 0 && (
                  <div style={S.chips}>
                    {m.suggestions.map((s) => <button key={s} style={S.chip} onClick={() => send(s)} disabled={busy}>{s}</button>)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div style={{ ...S.row, justifyContent: "flex-start" }}><div style={{ ...S.bubble, ...S.coachBubble }}><span style={S.typing}>Thinking…</span></div></div>}
          <div ref={endRef} />
        </div>

        <form style={S.inputBar} onSubmit={(e) => { e.preventDefault(); send(input) }}>
          <input style={S.input} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about jobs, skills, résumé, interviews…" aria-label="Ask the coach" />
          <button style={{ ...S.sendBtn, opacity: input.trim() && !busy ? 1 : 0.5 }} disabled={!input.trim() || busy}>Send</button>
        </form>
      </div>
    </AppShell>
  )
}

function CardView({ card }: { card: Card }) {
  if (!card.items?.length) return null
  return (
    <div style={S.cardBox}>
      {card.title && <div style={S.cardTitle}>{card.title}</div>}
      {card.kind === "jobs" && (
        <div style={S.jobList}>
          {card.items.map((it: any, i: number) => (
            <Link key={i} href={`/jobs/${it.id}`} style={S.jobItem}>
              <span style={S.jobMain}><b>{it.title}</b><span style={S.jobSub}>{it.subtitle}</span></span>
              {typeof it.score === "number" && <span style={{ ...S.jobScore, color: tier(it.score) }}>{it.score}%</span>}
            </Link>
          ))}
        </div>
      )}
      {card.kind === "chips" && <div style={S.cardChips}>{card.items.map((s: string, i: number) => <span key={i} style={S.cardChip}>{s}</span>)}</div>}
      {card.kind === "list" && <ul style={S.list}>{card.items.map((s: string, i: number) => <li key={i} style={S.li}>{s}</li>)}</ul>}
      {card.kind === "meter" && (
        <div style={S.meters}>
          {card.items.map((m: any, i: number) => (
            <div key={i} style={S.meterRow}>
              <span style={S.meterLabel}>{m.label}</span>
              <div style={S.meterTrack}><div style={{ ...S.meterFill, width: `${m.value}%`, background: tier(m.value) }} /></div>
              <span style={S.meterVal}>{m.value}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 760, margin: "0 auto", padding: "8px 4px 24px", display: "flex", flexDirection: "column", height: "calc(100dvh - 120px)", minHeight: 420 },
  head: { marginBottom: 12 },
  title: { font: "700 20px var(--font-sans)", color: "#1F2937", letterSpacing: "-.02em" },
  sub: { font: "400 12.5px var(--font-sans)", color: "#94A3B8", marginTop: 2 },
  thread: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "4px 2px 12px" },
  row: { display: "flex", width: "100%" },
  bubble: { maxWidth: "88%", borderRadius: 16, padding: "12px 15px", boxShadow: "0 1px 2px rgba(16,24,40,.05)" },
  userBubble: { background: "#6495ED", color: "#fff", borderBottomRightRadius: 5 },
  coachBubble: { background: "#fff", color: "#1F2937", border: "1px solid #E5E7EB", borderBottomLeftRadius: 5 },
  msgText: { font: "400 14px/1.6 var(--font-sans)", whiteSpace: "pre-wrap" },
  typing: { font: "400 13.5px var(--font-sans)", color: "#94A3B8" },
  cardBox: { marginTop: 10, background: "#F7F9FC", border: "1px solid #E9EDF2", borderRadius: 12, padding: "10px 12px" },
  cardTitle: { font: "700 10.5px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".05em", color: "#94A3B8", marginBottom: 8 },
  jobList: { display: "flex", flexDirection: "column", gap: 7 },
  jobItem: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#fff", border: "1px solid #E9EDF2", borderRadius: 10, padding: "9px 11px", textDecoration: "none" },
  jobMain: { display: "flex", flexDirection: "column", minWidth: 0, font: "600 13px var(--font-sans)", color: "#1F2937" },
  jobSub: { font: "400 12px var(--font-sans)", color: "#94A3B8", fontWeight: 400 },
  jobScore: { font: "700 14px var(--font-sans)", flexShrink: 0 },
  cardChips: { display: "flex", flexWrap: "wrap", gap: 6 },
  cardChip: { font: "500 12px var(--font-sans)", color: "#334EAC", background: "#EAF1FE", border: "1px solid #DCE8FD", borderRadius: 999, padding: "3px 10px" },
  list: { margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 6 },
  li: { font: "400 13px/1.5 var(--font-sans)", color: "#334155" },
  meters: { display: "flex", flexDirection: "column", gap: 7 },
  meterRow: { display: "flex", alignItems: "center", gap: 9 },
  meterLabel: { font: "500 12px var(--font-sans)", color: "#475569", width: 140, flexShrink: 0 },
  meterTrack: { flex: 1, height: 7, background: "#EEF2F6", borderRadius: 999, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 999 },
  meterVal: { font: "600 11.5px var(--font-sans)", color: "#64748B", width: 34, textAlign: "right" },
  ctaBtn: { display: "inline-block", marginTop: 10, font: "600 12.5px var(--font-sans)", color: "#334EAC", background: "#F3F6FF", border: "1px solid #E1E9FE", borderRadius: 9, padding: "7px 13px", textDecoration: "none" },
  chips: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 11 },
  chip: { font: "500 12px var(--font-sans)", color: "#475569", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 999, padding: "6px 12px", cursor: "pointer", textAlign: "left" },
  inputBar: { display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid #EEF2F6" },
  input: { flex: 1, font: "400 14px var(--font-sans)", color: "#1F2937", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 14px", outline: "none", background: "#fff" },
  sendBtn: { font: "600 13.5px var(--font-sans)", color: "#fff", background: "#6495ED", border: "none", borderRadius: 12, padding: "0 20px", cursor: "pointer" },
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "28px 26px", maxWidth: 520, margin: "20px auto" },
  h1: { font: "700 24px var(--font-sans)", color: "#1F2937", letterSpacing: "-.02em", margin: 0 },
  muted: { font: "400 14px/1.6 var(--font-sans)", color: "#64748B", margin: "10px 0 18px" },
  cta: { display: "inline-block", background: "#6495ED", color: "#fff", borderRadius: 11, padding: "10px 18px", font: "600 13.5px var(--font-sans)", textDecoration: "none" },
}
