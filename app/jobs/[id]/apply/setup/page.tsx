"use client"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconCheck, IconTrash, IconPlus, IconFileText } from "@/components/ui/Icons"

/* Employer application-form builder. Defines exactly what a candidate must submit
   for THIS job — beyond the profile Vrittih already holds: screening questions,
   required documents, and an optional assessment. Saves to the ApplicationForm
   the apply page and submission handler already read. Owner or admin only. */

type Q = { id: string; label: string; type: "text" | "textarea" | "select" | "boolean" | "number"; options: string[]; required: boolean; help?: string | null }
type D = { id: string; label: string; required: boolean; accept: string; help?: string | null }

const QTYPES: [Q["type"], string][] = [["text", "Short text"], ["textarea", "Paragraph"], ["select", "Choose one"], ["boolean", "Yes / No"], ["number", "Number"]]
const rid = (p: string) => p + Math.random().toString(36).slice(2, 7)

export default function ApplicationSetup() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [job, setJob] = useState<any>(null)
  const [tests, setTests] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const [useProfile, setUseProfile] = useState(true)
  const [requireResume, setRequireResume] = useState(true)
  const [coverLetter, setCoverLetter] = useState<"required" | "optional" | "off">("optional")
  const [instructions, setInstructions] = useState("")
  const [questions, setQuestions] = useState<Q[]>([])
  const [documents, setDocuments] = useState<D[]>([])
  const [testId, setTestId] = useState<string | null>(null)
  const [testRequired, setTestRequired] = useState(false)

  useEffect(() => {
    (async () => {
      const [me, f, t] = await Promise.all([
        fetch("/api/auth/me").then(r => r.json()).catch(() => ({})),
        fetch(`/api/jobs/${id}/form`).then(r => r.json()).catch(() => null),
        fetch("/api/tests").then(r => r.json()).catch(() => ({ tests: [] })),
      ])
      const meId = me?.user?.id, role = me?.user?.role
      const admin = role === "ADMIN" || role === "SUPER_ADMIN"
      if (!f?.job) { setLoading(false); return }
      if (f.job.postedById !== meId && !admin) { setDenied(true); setLoading(false); return }
      setJob(f.job)
      setTests((t.tests || []).filter((x: any) => x.title))
      const form = f.form || {}
      setUseProfile(form.useProfile !== false)
      setRequireResume(form.requireResume !== false)
      setCoverLetter(["required", "optional", "off"].includes(form.coverLetter) ? form.coverLetter : "optional")
      setInstructions(form.instructions || "")
      setQuestions((form.questions || []).map((q: any) => ({ ...q, options: q.options || [] })))
      setDocuments(form.documents || [])
      setTestId(form.testId || null)
      setTestRequired(!!form.testRequired)
      setLoading(false)
    })()
  }, [id])

  const preview = useMemo(() => {
    const steps = ["Your details"]
    if (coverLetter !== "off") steps.push("Cover letter")
    if (questions.length) steps.push(`${questions.length} question${questions.length === 1 ? "" : "s"}`)
    if (documents.length || requireResume) steps.push("Documents")
    if (testId) steps.push("Assessment")
    return steps
  }, [coverLetter, questions, documents, requireResume, testId])

  async function save() {
    setBusy(true); setMsg(null)
    const r = await fetch(`/api/jobs/${id}/form`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useProfile, requireResume, coverLetter, instructions, questions, documents, testId, testRequired }),
    })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg({ kind: "err", text: d.error || "Could not save." }); return }
    setMsg({ kind: "ok", text: `Saved. Candidates will complete ${preview.length} step${preview.length === 1 ? "" : "s"}.` })
  }

  if (loading) return <AppShell title="Application form"><div style={S.dim}>Loading…</div></AppShell>
  if (denied) return <AppShell title="Application form"><div style={S.dim}>You don’t manage this job.</div></AppShell>
  if (!job) return <AppShell title="Application form"><div style={S.dim}>Job not found.</div></AppShell>

  return (
    <AppShell title="Application form">
      <div style={S.wrap}>
        <div style={S.head}>
          <div>
            <h1 style={S.h1}>Application form</h1>
            <p style={S.sub}>{job.title} · {job.company} — decide what candidates submit for this role.</p>
          </div>
          <Link href={`/jobs/${id}`} style={S.ghost}>View job</Link>
        </div>

        <div style={S.previewBar}>
          <span style={S.previewLabel}>Candidate will complete:</span>
          {preview.map((p, i) => <span key={i} style={S.chip}>{i + 1}. {p}</span>)}
        </div>

        {msg && <div style={{ ...S.msg, ...(msg.kind === "err" ? S.msgErr : S.msgOk) }}>{msg.text}</div>}

        {/* Basics */}
        <section style={S.card}>
          <h2 style={S.h2}>The basics</h2>
          <Toggle on={useProfile} set={setUseProfile} label="Prefill from the candidate's profile"
            help="Their name, headline, experience, education and skills fill the form automatically — they can still edit before submitting." />
          <Toggle on={requireResume} set={setRequireResume} label="Require a résumé"
            help="Candidates attach a résumé (or reuse the one on their profile)." />
          <div style={S.field}>
            <span style={S.label}>Cover letter</span>
            <div style={S.segRow}>
              {(["required", "optional", "off"] as const).map(v => (
                <button key={v} onClick={() => setCoverLetter(v)} style={{ ...S.seg, ...(coverLetter === v ? S.segOn : {}) }}>
                  {v === "off" ? "Not asked" : v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={S.field}>
            <span style={S.label}>Instructions (optional)</span>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} maxLength={2000}
              placeholder="Anything the candidate should know before applying — shown at the top of the form." style={S.input} />
          </div>
        </section>

        {/* Questions */}
        <section style={S.card}>
          <div style={S.cardHead}>
            <h2 style={S.h2}>Screening questions <span style={S.count}>{questions.length}</span></h2>
            <button onClick={() => setQuestions([...questions, { id: rid("q"), label: "", type: "text", options: [], required: true, help: "" }])} disabled={questions.length >= 30} style={S.add}><IconPlus size={14} /> Add question</button>
          </div>
          {questions.length === 0 && <p style={S.empty}>No screening questions. Add ones specific to this role — availability, notice period, work authorisation, a short prompt.</p>}
          {questions.map((q, i) => (
            <div key={q.id} style={S.builder}>
              <div style={S.builderTop}>
                <input value={q.label} onChange={e => upd(setQuestions, questions, i, { label: e.target.value })} placeholder="Question the candidate answers" style={{ ...S.input, flex: 1 }} />
                <select value={q.type} onChange={e => upd(setQuestions, questions, i, { type: e.target.value as Q["type"] })} style={S.select}>
                  {QTYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button onClick={() => setQuestions(questions.filter((_, j) => j !== i))} style={S.del} aria-label="Remove"><IconTrash size={15} /></button>
              </div>
              {q.type === "select" && (
                <input value={(q.options || []).join(", ")} onChange={e => upd(setQuestions, questions, i, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  placeholder="Options, comma-separated — e.g. Immediately, 1 month, 2+ months" style={{ ...S.input, marginTop: 8 }} />
              )}
              <div style={S.builderFoot}>
                <label style={S.check}><input type="checkbox" checked={q.required} onChange={e => upd(setQuestions, questions, i, { required: e.target.checked })} /> Required</label>
                <input value={q.help || ""} onChange={e => upd(setQuestions, questions, i, { help: e.target.value })} placeholder="Help text (optional)" style={{ ...S.input, flex: 1, fontSize: 12.5 }} />
              </div>
            </div>
          ))}
        </section>

        {/* Documents */}
        <section style={S.card}>
          <div style={S.cardHead}>
            <h2 style={S.h2}>Required documents <span style={S.count}>{documents.length}</span></h2>
            <button onClick={() => setDocuments([...documents, { id: rid("d"), label: "", required: true, accept: ".pdf,.doc,.docx,.png,.jpg,.jpeg", help: "" }])} disabled={documents.length >= 15} style={S.add}><IconPlus size={14} /> Add document</button>
          </div>
          {documents.length === 0 && <p style={S.empty}>No documents beyond the résumé. Add what this role needs — portfolio, certificates, ID, references.</p>}
          {documents.map((d, i) => (
            <div key={d.id} style={S.builder}>
              <div style={S.builderTop}>
                <input value={d.label} onChange={e => upd(setDocuments, documents, i, { label: e.target.value })} placeholder="Document name — e.g. Portfolio, Degree certificate" style={{ ...S.input, flex: 1 }} />
                <input value={d.accept} onChange={e => upd(setDocuments, documents, i, { accept: e.target.value })} placeholder=".pdf,.png" style={{ ...S.input, width: 150 }} />
                <button onClick={() => setDocuments(documents.filter((_, j) => j !== i))} style={S.del} aria-label="Remove"><IconTrash size={15} /></button>
              </div>
              <div style={S.builderFoot}>
                <label style={S.check}><input type="checkbox" checked={d.required} onChange={e => upd(setDocuments, documents, i, { required: e.target.checked })} /> Required</label>
                <input value={d.help || ""} onChange={e => upd(setDocuments, documents, i, { help: e.target.value })} placeholder="Help text (optional)" style={{ ...S.input, flex: 1, fontSize: 12.5 }} />
              </div>
            </div>
          ))}
        </section>

        {/* Assessment */}
        <section style={S.card}>
          <h2 style={S.h2}><IconFileText size={16} /> Assessment</h2>
          {tests.length === 0 ? (
            <p style={S.empty}>You haven’t created any assessments yet. <Link href="/tests/create" style={S.link}>Create one</Link> and it’ll appear here to attach.</p>
          ) : (
            <>
              <div style={S.field}>
                <span style={S.label}>Attach an assessment (optional)</span>
                <select value={testId || ""} onChange={e => setTestId(e.target.value || null)} style={S.input}>
                  <option value="">No assessment</option>
                  {tests.map(t => <option key={t.id} value={t.id}>{t.title}{t.duration ? ` · ${t.duration} min` : ""}</option>)}
                </select>
              </div>
              {testId && <Toggle on={testRequired} set={setTestRequired} label="Assessment must be completed to apply"
                help="If off, it's offered but the candidate can submit without it." />}
            </>
          )}
        </section>

        <div style={S.bar}>
          <span style={S.barText}>Changes apply to new applications only.</span>
          <button onClick={save} disabled={busy} style={{ ...S.primary, ...(busy ? S.off : {}) }}>
            {busy ? "Saving…" : <><IconCheck size={15} /> Save application form</>}
          </button>
        </div>
      </div>
    </AppShell>
  )
}

function upd<T>(setter: (v: T[]) => void, list: T[], i: number, patch: Partial<T>) {
  const next = [...list]; next[i] = { ...next[i], ...patch }; setter(next)
}
function Toggle({ on, set, label, help }: { on: boolean; set: (v: boolean) => void; label: string; help?: string }) {
  return (
    <label style={S.toggleRow}>
      <button type="button" onClick={() => set(!on)} aria-pressed={on} style={{ ...S.switch, background: on ? "var(--v-accent)" : "var(--v-line-2)" }}>
        <span style={{ ...S.knob, left: on ? 21 : 3 }} />
      </button>
      <span><span style={S.toggleLabel}>{label}</span>{help && <span style={S.toggleHelp}>{help}</span>}</span>
    </label>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 780, margin: "0 auto", padding: "4px 4px 48px", display: "flex", flexDirection: "column", gap: 14 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
  h1: { fontSize: 23, fontWeight: 650, margin: 0, color: "var(--v-ink)", letterSpacing: "-.02em" },
  sub: { fontSize: 13.5, color: "var(--v-ink-3)", marginTop: 4 },
  ghost: { padding: "8px 14px", borderRadius: 10, border: "1px solid var(--v-line-2)", fontSize: 13, fontWeight: 600, color: "var(--v-ink)", textDecoration: "none", whiteSpace: "nowrap" },
  previewBar: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", background: "var(--v-surface-2)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "12px 14px" },
  previewLabel: { fontSize: 12.5, fontWeight: 600, color: "var(--v-ink-3)" },
  chip: { fontSize: 12.5, fontWeight: 600, color: "var(--v-accent)", background: "var(--v-accent-soft)", padding: "4px 10px", borderRadius: 999 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 12 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  h2: { display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 650, margin: 0, color: "var(--v-ink)" },
  count: { fontSize: 12, fontWeight: 700, color: "var(--v-accent)", background: "var(--v-accent-soft)", padding: "2px 9px", borderRadius: 999 },
  add: { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: "1px solid var(--v-accent)", background: "transparent", color: "var(--v-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  empty: { fontSize: 13, color: "var(--v-ink-3)", lineHeight: 1.6, margin: 0 },
  link: { color: "var(--v-accent)", fontWeight: 600 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".04em" },
  input: { border: "1px solid var(--v-line-2)", borderRadius: 9, padding: "9px 11px", fontSize: 14, color: "var(--v-ink)", background: "var(--v-bg)", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  select: { border: "1px solid var(--v-line-2)", borderRadius: 9, padding: "9px 11px", fontSize: 13.5, color: "var(--v-ink)", background: "var(--v-bg)", outline: "none", fontFamily: "inherit" },
  segRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  seg: { padding: "8px 14px", borderRadius: 9, border: "1px solid var(--v-line-2)", background: "transparent", fontSize: 13, fontWeight: 600, color: "var(--v-ink-2)", cursor: "pointer" },
  segOn: { background: "var(--v-accent-soft)", color: "var(--v-accent)", borderColor: "var(--v-accent)" },
  builder: { border: "1px solid var(--v-line)", borderRadius: 11, padding: 12, background: "var(--v-bg)", display: "flex", flexDirection: "column", gap: 8 },
  builderTop: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  builderFoot: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" },
  check: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--v-ink-2)", whiteSpace: "nowrap" },
  del: { width: 36, height: 36, flexShrink: 0, borderRadius: 8, border: "1px solid var(--v-line-2)", background: "transparent", color: "var(--v-ink-3)", cursor: "pointer", display: "grid", placeItems: "center" },
  toggleRow: { display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" },
  switch: { position: "relative", width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer", flexShrink: 0, transition: "background .15s", padding: 0 },
  knob: { position: "absolute", top: 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .16s", boxShadow: "0 1px 2px rgba(0,0,0,.25)" },
  toggleLabel: { display: "block", fontSize: 14, fontWeight: 600, color: "var(--v-ink)" },
  toggleHelp: { display: "block", fontSize: 12.5, color: "var(--v-ink-3)", marginTop: 2, lineHeight: 1.5 },
  bar: { position: "sticky", bottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 14, padding: "12px 16px", boxShadow: "0 8px 26px rgba(16,24,40,.10)", flexWrap: "wrap" },
  barText: { fontSize: 12.5, color: "var(--v-ink-3)" },
  primary: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 11, border: "none", background: "var(--v-accent)", color: "#fff", fontSize: 14, fontWeight: 650, cursor: "pointer" },
  off: { opacity: .5, cursor: "not-allowed" },
  msg: { padding: "11px 14px", borderRadius: 11, fontSize: 13.5 },
  msgOk: { background: "var(--v-accent-soft)", color: "var(--v-accent)" },
  msgErr: { background: "#FEF3F2", color: "#B42318" },
  dim: { padding: 40, textAlign: "center", color: "var(--v-ink-3)" },
}
