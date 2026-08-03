"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconMonitor, IconCheckCircle, IconAward, IconArrowRight } from "@/components/ui/Icons"
import { PPO_STATUSES, PPO_LABEL } from "@/lib/internship"

/* Internship OS — the intern's weekly roadmap + status, and (for the employer/
 * mentor/admin) management: milestones, PPO, stipend and evaluations. One page,
 * capability-scoped by the API (canManage). */

const MSTATE: Record<string, { bg: string; fg: string; label: string; next: string }> = {
  PENDING: { bg: "var(--v-surface-2)", fg: "var(--v-ink-3)", label: "Pending", next: "IN_PROGRESS" },
  IN_PROGRESS: { bg: "#FEF3E2", fg: "var(--warn)", label: "In progress", next: "DONE" },
  DONE: { bg: "var(--v-green-soft)", fg: "var(--v-green)", label: "Done", next: "PENDING" },
}

export default function InternshipPage() {
  const [items, setItems] = useState<any[] | null>(null)
  const [me, setMe] = useState<any>(null)
  const [msg, setMsg] = useState("")
  const [form, setForm] = useState({ email: "", title: "", track: "", durationWeeks: "8", mentorEmail: "", stipendAmount: "" })
  const [busy, setBusy] = useState(false)

  const load = () => fetch("/api/internships").then(r => r.json()).then(d => setItems(d.internships || [])).catch(() => setItems([]))
  useEffect(() => { fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user)).catch(() => {}); load() }, [])
  const canManageAny = me && ["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(me.role)

  async function create(e: any) {
    e.preventDefault(); setBusy(true); setMsg("")
    const d = await fetch("/api/internships", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(r => r.json()).catch(() => ({ error: "Network error" }))
    setBusy(false)
    if (d.internship) { setForm({ email: "", title: "", track: "", durationWeeks: "8", mentorEmail: "", stipendAmount: "" }); setMsg("Internship created."); load() }
    else setMsg(d.error || "Failed")
  }
  async function patch(id: string, body: any) {
    await fetch(`/api/internships/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {})
    load()
  }

  return (
    <AppShell>
      <div style={S.wrap}>
        <header style={S.head}>
          <span style={S.ic}><IconMonitor size={20} /></span>
          <div><h1 style={S.h1}>Internships</h1><p style={S.sub}>Your structured programme — weekly roadmap, mentor, evaluations and PPO.</p></div>
        </header>

        {canManageAny && (
          <form onSubmit={create} style={S.card}>
            <h2 style={S.h2}>Set up an internship</h2>
            {msg && <div style={S.note}>{msg}</div>}
            <div style={S.grid}>
              <F l="Intern email"><input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={S.in} type="email" required placeholder="intern@example.com" /></F>
              <F l="Title"><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={S.in} required placeholder="Backend Engineering Intern" /></F>
              <F l="Track (optional)"><input value={form.track} onChange={e => setForm(f => ({ ...f, track: e.target.value }))} style={S.in} placeholder="Platform" /></F>
              <F l="Weeks"><input value={form.durationWeeks} onChange={e => setForm(f => ({ ...f, durationWeeks: e.target.value }))} style={S.in} type="number" min={1} max={52} /></F>
              <F l="Mentor email (optional)"><input value={form.mentorEmail} onChange={e => setForm(f => ({ ...f, mentorEmail: e.target.value }))} style={S.in} type="email" placeholder="mentor@example.com" /></F>
              <F l="Stipend / month (optional)"><input value={form.stipendAmount} onChange={e => setForm(f => ({ ...f, stipendAmount: e.target.value }))} style={S.in} type="number" placeholder="15000" /></F>
            </div>
            <button type="submit" disabled={busy} style={S.btn}>{busy ? "Creating…" : "Create internship"}</button>
          </form>
        )}

        {items === null ? <div style={S.dim}>Loading…</div> : items.length === 0 ? (
          <div style={S.card}><p style={S.dim}>No internships yet.{canManageAny ? " Set one up above." : " When an employer enrols you, your roadmap appears here."}</p></div>
        ) : items.map(iv => (
          <section key={iv.id} style={S.card}>
            <div style={S.ivTop}>
              <div style={{ minWidth: 0 }}>
                <div style={S.ivTitle}>{iv.title}</div>
                <div style={S.ivMeta}>{iv.companyName}{iv.intern ? ` · ${iv.intern.name}` : ""}{iv.mentor ? ` · mentor ${iv.mentor.name}` : ""}{iv.stipendAmount ? ` · ${iv.stipendCurrency} ${iv.stipendAmount}/mo` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={S.pct}>{iv.completionPct}%</div>
                <div style={S.pctL}>complete</div>
              </div>
            </div>

            <div style={S.ppoRow}>
              <span style={{ ...S.ppoBadge, ...(iv.ppoStatus === "OFFERED" || iv.ppoStatus === "ACCEPTED" ? { background: "var(--v-green-soft)", color: "var(--v-green)" } : {}) }}>PPO: {PPO_LABEL[iv.ppoStatus] || iv.ppoStatus}</span>
              {iv.canManage && (
                <select value={iv.ppoStatus} onChange={e => patch(iv.id, { action: "ppo", ppoStatus: e.target.value })} style={S.sel}>
                  {PPO_STATUSES.map(s => <option key={s} value={s}>{PPO_LABEL[s]}</option>)}
                </select>
              )}
            </div>

            <div style={S.rail}>
              {iv.milestones.map((m: any) => {
                const st = MSTATE[m.status] || MSTATE.PENDING
                return (
                  <div key={m.id} style={S.ms}>
                    <button
                      onClick={() => iv.canManage && patch(iv.id, { action: "milestone", milestoneId: m.id, status: st.next })}
                      disabled={!iv.canManage}
                      title={iv.canManage ? "Click to advance" : ""}
                      style={{ ...S.msDot, background: st.bg, color: st.fg, cursor: iv.canManage ? "pointer" : "default" }}>
                      {m.status === "DONE" ? <IconCheckCircle size={15} /> : m.week}
                    </button>
                    <span style={S.msTitle}>{m.title}</span>
                    <span style={{ ...S.msStatus, color: st.fg }}>{st.label}</span>
                  </div>
                )
              })}
            </div>

            {iv.evaluations?.length > 0 && (
              <div style={S.evals}>
                <div style={S.evalsH}><IconAward size={14} /> Evaluations</div>
                {iv.evaluations.map((ev: any) => (
                  <div key={ev.id} style={S.eval}><b>{ev.kind}{ev.period ? ` · ${ev.period}` : ""}</b>{ev.overall != null ? ` · ${ev.overall}/5` : ""} — {ev.note || ev.strengths || "reviewed"} <span style={S.evalBy}>by {ev.reviewerName}</span></div>
                ))}
              </div>
            )}

            {iv.canManage && <ManageEval id={iv.id} onDone={load} />}
          </section>
        ))}
      </div>
    </AppShell>
  )
}

function ManageEval({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [ev, setEv] = useState({ kind: "weekly", period: "", overall: "", note: "" })
  const [busy, setBusy] = useState(false)
  if (!open) return <button onClick={() => setOpen(true)} style={S.addEval}>+ Add evaluation</button>
  return (
    <div style={S.evalForm}>
      <div style={S.grid}>
        <select value={ev.kind} onChange={e => setEv(v => ({ ...v, kind: e.target.value }))} style={S.in}>{["weekly", "milestone", "final"].map(k => <option key={k} value={k}>{k}</option>)}</select>
        <input value={ev.period} onChange={e => setEv(v => ({ ...v, period: e.target.value }))} style={S.in} placeholder="Week 3" />
        <input value={ev.overall} onChange={e => setEv(v => ({ ...v, overall: e.target.value }))} style={S.in} type="number" min={0} max={5} step="0.5" placeholder="Overall /5" />
      </div>
      <textarea value={ev.note} onChange={e => setEv(v => ({ ...v, note: e.target.value }))} style={{ ...S.in, minHeight: 60, marginTop: 8 }} placeholder="Strengths, feedback, next focus…" />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button disabled={busy} onClick={async () => { setBusy(true); await fetch(`/api/internships/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "evaluate", ...ev, overall: ev.overall ? Number(ev.overall) : null }) }).catch(() => {}); setBusy(false); setOpen(false); setEv({ kind: "weekly", period: "", overall: "", note: "" }); onDone() }} style={S.btn}>{busy ? "Saving…" : "Save evaluation"}</button>
        <button onClick={() => setOpen(false)} style={S.ghost}>Cancel</button>
      </div>
    </div>
  )
}

const F = ({ l, children }: any) => <label style={S.fg}><span style={S.lbl}>{l}</span>{children}</label>
const S: Record<string, any> = {
  wrap: { maxWidth: 940, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 },
  head: { display: "flex", alignItems: "center", gap: 12 },
  ic: { width: 40, height: 40, borderRadius: "var(--r-md)", background: "var(--v-accent-soft)", color: "var(--v-accent)", display: "grid", placeItems: "center", flex: "none" },
  h1: { font: "500 22px var(--font-display)", color: "var(--v-ink)", margin: 0 },
  sub: { font: "400 13.5px var(--font-sans)", color: "var(--v-ink-2)", marginTop: 2 },
  card: { background: "var(--v-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 18 },
  h2: { font: "500 16px var(--font-display)", color: "var(--v-ink)", margin: "0 0 12px" },
  note: { font: "500 13px var(--font-sans)", color: "var(--v-accent-2)", marginBottom: 10 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 10 },
  fg: { display: "flex", flexDirection: "column", gap: 5 },
  lbl: { font: "500 12px var(--font-sans)", color: "var(--v-ink-2)" },
  in: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "8px 11px", font: "400 13px var(--font-sans)", color: "var(--v-ink)", outline: "none", width: "100%", boxSizing: "border-box", background: "var(--v-surface)" },
  btn: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: "var(--r-md)", padding: "9px 18px", font: "500 13px var(--font-sans)", cursor: "pointer", marginTop: 12 },
  ghost: { background: "var(--v-surface)", color: "var(--v-ink-2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "9px 16px", font: "500 13px var(--font-sans)", cursor: "pointer", marginTop: 12 },
  dim: { font: "400 14px var(--font-sans)", color: "var(--v-ink-3)", padding: 8 },
  ivTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  ivTitle: { font: "500 16px var(--font-sans)", color: "var(--v-ink)" },
  ivMeta: { font: "400 12.5px var(--font-sans)", color: "var(--v-ink-3)", marginTop: 2 },
  pct: { font: "500 22px var(--font-display)", color: "var(--v-accent)", fontVariantNumeric: "tabular-nums" },
  pctL: { font: "400 11px var(--font-sans)", color: "var(--v-ink-3)" },
  ppoRow: { display: "flex", alignItems: "center", gap: 10, margin: "12px 0", flexWrap: "wrap" },
  ppoBadge: { font: "500 12px var(--font-sans)", background: "var(--v-surface-2)", color: "var(--v-ink-2)", borderRadius: "var(--r-pill)", padding: "4px 11px" },
  sel: { border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "6px 10px", font: "400 12.5px var(--font-sans)", color: "var(--v-ink)", background: "var(--v-surface)" },
  rail: { display: "flex", flexDirection: "column", gap: 8, marginTop: 6 },
  ms: { display: "flex", alignItems: "center", gap: 11 },
  msDot: { width: 30, height: 30, borderRadius: "50%", border: "none", display: "grid", placeItems: "center", font: "500 13px var(--font-sans)", flex: "none" },
  msTitle: { flex: 1, font: "400 13.5px var(--font-sans)", color: "var(--v-ink)" },
  msStatus: { font: "500 12px var(--font-sans)", flex: "none" },
  evals: { marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 },
  evalsH: { display: "flex", alignItems: "center", gap: 6, font: "600 12px var(--font-sans)", color: "var(--v-ink-2)", marginBottom: 8 },
  eval: { font: "400 12.5px var(--font-sans)", color: "var(--v-ink-2)", padding: "6px 0", lineHeight: 1.5 },
  evalBy: { color: "var(--v-ink-3)" },
  addEval: { marginTop: 12, background: "none", border: "1px dashed var(--border-strong)", color: "var(--v-accent)", borderRadius: "var(--r-md)", padding: "8px 14px", font: "500 12.5px var(--font-sans)", cursor: "pointer" },
  evalForm: { marginTop: 12, padding: 12, background: "var(--v-surface-2)", borderRadius: "var(--r-md)" },
}
