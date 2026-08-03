"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconUsers, IconCheckCircle } from "@/components/ui/Icons"

const statusColor = (s: string) => s === "ACTIVE" ? "var(--v-green)" : s === "REQUESTED" ? "var(--v-amber)" : s === "COMPLETED" ? "var(--v-blue)" : "var(--v-ink-3)"

export default function MentoringPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [d, setD] = useState<any>(null)
  const [competency, setCompetency] = useState("")
  const [mentors, setMentors] = useState<any[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState("")

  async function load() {
    try { const r = await fetch("/api/mentoring"); if (r.status === 401) { setState("denied"); return } setD(await r.json()); setState("ok") } catch { setState("denied") }
  }
  useEffect(() => { load() }, [])
  async function discover(key: string) {
    setCompetency(key); setBusy("discover"); setErr("")
    try { const r = await fetch(`/api/mentoring?competency=${encodeURIComponent(key)}`).then(r => r.json()); setMentors(r.mentors || []) } finally { setBusy(null) }
  }
  async function request(mentorId: string) {
    setBusy(mentorId); setErr("")
    try { const r = await fetch("/api/mentoring", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mentorId, competencyKey: competency }) }).then(r => r.json()); if (r.error) setErr(r.error); else await load() } finally { setBusy(null) }
  }
  async function act(id: string, action: string) {
    setBusy(id + action); setErr("")
    try { const r = await fetch("/api/mentoring", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) }).then(r => r.json()); if (r.error) setErr(r.error); await load() } finally { setBusy(null) }
  }
  async function toggleAvail(v: boolean) { setBusy("avail"); try { await fetch("/api/mentoring", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "availability", value: v }) }); await load() } finally { setBusy(null) } }

  if (state === "loading") return <AppShell title="Mentoring"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Mentoring"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in</h1></div></div></AppShell>

  return (
    <AppShell title="Mentoring">
      <div style={S.page}>
        <header style={S.head}>
          <div><h1 style={S.h1}><IconUsers size={20} /> Mentoring</h1><p style={S.sub}>Find mentors by demonstrated competency (evidence, not claims). Request guidance; mentors accept and you grow together.</p></div>
          <label style={S.toggle}><input type="checkbox" checked={!!d?.openToMentor} disabled={busy === "avail"} onChange={e => toggleAvail(e.target.checked)} /> <span>I'm open to mentoring</span></label>
        </header>
        {err && <div style={S.err}>{err}</div>}

        <h2 style={S.h2}>Find a mentor</h2>
        <div style={S.card}>
          <div style={S.sub}>Pick a competency to grow (your weakest are suggested):</div>
          <div style={S.chips}>
            {(d?.myGaps || []).map((g: any) => <button key={g.key} style={{ ...S.chip, ...(competency === g.key ? S.chipOn : {}) }} onClick={() => discover(g.key)}>{g.key}</button>)}
            {(d?.myGaps || []).length === 0 && <span style={S.subS}>Record your competencies first (see Competencies) to get suggestions.</span>}
          </div>
          <div style={S.searchRow}>
            <input style={{ ...S.input, flex: 1 }} placeholder="…or type a competency key (e.g. system-design)" value={competency} onChange={e => setCompetency(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && competency.trim()) discover(competency.trim()) }} />
            <button style={S.cta} onClick={() => competency.trim() && discover(competency.trim())} disabled={busy === "discover"}>Find</button>
          </div>
          {mentors && (mentors.length === 0 ? <p style={S.subS}>No available mentors for “{competency}” yet.</p> : (
            <div style={S.list}>
              {mentors.map(m => (
                <div key={m.userId} style={S.mentorRow}>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={S.name}>{m.name}</div><div style={S.subS}>{m.headline || "—"} · {Math.round(m.proficiency * 100)}% proficiency</div></div>
                  <button style={S.cta} disabled={busy === m.userId} onClick={() => request(m.userId)}>Request</button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {(d?.incoming || []).length > 0 && (
          <>
            <h2 style={S.h2}>Requests to me</h2>
            <div style={S.list}>{d.incoming.map((m: any) => (
              <div key={m.id} style={S.mentorRow}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={S.name}>{m.counterpart || "A learner"}</div><div style={S.subS}>{m.competencyKey || "general"} · <b style={{ color: statusColor(m.status) }}>{m.status}</b></div></div>
                {m.status === "REQUESTED" && <><button style={S.mini} disabled={busy === m.id + "accept"} onClick={() => act(m.id, "accept")}><IconCheckCircle size={13} /> Accept</button><button style={S.ghost} disabled={busy === m.id + "decline"} onClick={() => act(m.id, "decline")}>Decline</button></>}
                {m.status === "ACTIVE" && <button style={S.ghost} disabled={busy === m.id + "complete"} onClick={() => act(m.id, "complete")}>Complete</button>}
              </div>
            ))}</div>
          </>
        )}

        {(d?.outgoing || []).length > 0 && (
          <>
            <h2 style={S.h2}>My requests</h2>
            <div style={S.list}>{d.outgoing.map((m: any) => (
              <div key={m.id} style={S.mentorRow}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={S.name}>{m.counterpart || "Mentor"}</div><div style={S.subS}>{m.competencyKey || "general"} · <b style={{ color: statusColor(m.status) }}>{m.status}</b></div></div>
                {(m.status === "REQUESTED" || m.status === "ACTIVE") && <button style={S.ghost} disabled={busy === m.id + "withdraw"} onClick={() => act(m.id, "withdraw")}>Withdraw</button>}
                {m.status === "ACTIVE" && <button style={S.ghost} disabled={busy === m.id + "complete"} onClick={() => act(m.id, "complete")}>Complete</button>}
              </div>
            ))}</div>
          </>
        )}
      </div>
    </AppShell>
  )
}
const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 800, margin: "0 auto", paddingBottom: 60 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 16 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  h2: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--v-ink)", margin: "20px 0 10px" },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 620 },
  subS: { fontSize: 12.5, color: "var(--v-ink-3)" },
  toggle: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--v-ink)", background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 999, padding: "8px 14px", cursor: "pointer" },
  err: { background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#B91C1C", margin: "12px 0" },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "44px 24px", textAlign: "center" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 16 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0" },
  chip: { fontSize: 12.5, color: "var(--v-ink)", background: "var(--v-surface-2)", border: "1px solid var(--v-line)", borderRadius: 999, padding: "5px 12px", cursor: "pointer", font: "inherit" },
  chipOn: { background: "var(--v-accent-soft)", color: "var(--v-accent-2)", borderColor: "var(--v-accent)" },
  searchRow: { display: "flex", gap: 8, marginTop: 8 },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, color: "var(--v-ink)", outline: "none", fontFamily: "inherit", background: "var(--v-surface)" },
  cta: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  list: { display: "flex", flexDirection: "column", gap: 8, marginTop: 12 },
  mentorRow: { display: "flex", alignItems: "center", gap: 10, background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "11px 14px", boxShadow: "var(--v-shadow-sm)" },
  name: { fontSize: 14, fontWeight: 600, color: "var(--v-ink)" },
  mini: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--v-green)", color: "#fff", border: "none", borderRadius: 9, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  ghost: { background: "var(--v-surface)", color: "var(--v-ink)", border: "1px solid var(--v-line)", borderRadius: 9, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
}
