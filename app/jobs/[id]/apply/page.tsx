"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconCheck, IconFileText, IconUpload, IconAlert, IconArrowRight } from "@/components/ui/Icons"

/* Full application flow.
   Everything the employer asks for, in one place: their instructions, the
   candidate's own details prefilled from their profile but EDITABLE (people
   tailor an application per employer), screening questions, required documents,
   and an assessment if one is attached.

   What is submitted is frozen as a snapshot, so the employer sees what they were
   actually sent even if the candidate edits their profile afterwards. */

type Q = { id: string; label: string; type: string; options: string[]; required: boolean; help?: string }
type D = { id: string; label: string; required: boolean; accept: string; help?: string }

export default function ApplyPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  // editable copies
  const [me, setMe] = useState<any>({})
  const [cover, setCover] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [docs, setDocs] = useState<Record<string, { mediaId: string; filename: string; size: number }>>({})
  const [uploading, setUploading] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/jobs/${id}/form`).then(r => r.json()).then(d => {
      setData(d)
      if (d.profile) setMe({
        name: d.profile.name || "", email: d.profile.email || "", phone: d.profile.phone || "",
        location: d.profile.location || "", headline: d.profile.headline || "", bio: d.profile.bio || "",
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <AppShell title="Apply"><div style={S.dim}>Loading application…</div></AppShell>
  if (!data || data.error) return <AppShell title="Apply"><div style={S.dim}>This job could not be found.</div></AppShell>

  const form = data.form
  const questions: Q[] = form.questions || []
  const documents: D[] = form.documents || []

  if (!data.profile) return (
    <AppShell title="Apply">
      <div style={S.narrow}>
        <div style={S.card}>
          <h1 style={S.h1}>Sign in to apply</h1>
          <p style={S.sub}>Applying takes a minute — your profile fills most of it in.</p>
          <Link href={`/login?next=/jobs/${id}/apply`} style={S.primary}>Sign in <IconArrowRight size={15} /></Link>
        </div>
      </div>
    </AppShell>
  )

  if (data.alreadyApplied || done) return (
    <AppShell title="Apply">
      <div style={S.narrow}>
        <div style={{ ...S.card, textAlign: "center" }}>
          <div style={S.tick}><IconCheck size={26} /></div>
          <h1 style={S.h1}>{done ? "Application sent" : "You've already applied"}</h1>
          <p style={S.sub}>{done ? `${data.job.company} has your application. You can follow every stage live.` : `You applied to ${data.job.title} at ${data.job.company}.`}</p>
          <Link href="/dashboard/applications" style={S.primary}>Track your application <IconArrowRight size={15} /></Link>
        </div>
      </div>
    </AppShell>
  )

  // steps are built from what this employer actually asks for
  const steps = [
    { key: "you", label: "Your details" },
    ...(form.coverLetter !== "off" ? [{ key: "cover", label: "Cover letter" }] : []),
    ...(questions.length ? [{ key: "questions", label: "Questions" }] : []),
    ...(documents.length || form.requireResume ? [{ key: "docs", label: "Documents" }] : []),
    ...(form.testId ? [{ key: "test", label: "Assessment" }] : []),
    { key: "review", label: "Review" },
  ]
  const cur = steps[step]

  async function upload(slot: D, file: File) {
    setUploading(slot.id); setError("")
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("type", "document")
      const r = await fetch("/api/upload", { method: "POST", body: fd })
      const d = await r.json()
      if (!d.success) { setError(d.error || "Upload failed."); setUploading(null); return }
      setDocs(prev => ({ ...prev, [slot.id]: { mediaId: d.id, filename: file.name, size: d.size } }))
    } catch { setError("Upload failed. Please try again.") }
    setUploading(null)
  }

  function missingOn(key: string): string[] {
    const out: string[] = []
    if (key === "cover" && form.coverLetter === "required" && !cover.trim()) out.push("Cover letter")
    if (key === "questions") for (const q of questions) if (q.required && !String(answers[q.id] || "").trim()) out.push(q.label)
    if (key === "docs") for (const d of documents) if (d.required && !docs[d.id]) out.push(d.label)
    return out
  }

  function next() {
    const m = missingOn(cur.key)
    if (m.length) { setError(`Please complete: ${m.join(", ")}`); return }
    setError(""); setStep(s => Math.min(s + 1, steps.length - 1))
  }

  async function submit() {
    const all = steps.flatMap(s => missingOn(s.key))
    if (all.length) { setError(`Please complete: ${all.join(", ")}`); return }
    setBusy(true); setError("")
    const payload = {
      jobId: id,
      coverLetter: cover || null,
      resumeUrl: data.profile.resumeUrl || null,
      snapshot: {
        ...me,
        experience: data.profile.experience, education: data.profile.education, skills: data.profile.skills,
        submittedAt: new Date().toISOString(),
      },
      answers: questions.map(q => ({ questionId: q.id, label: q.label, value: answers[q.id] || "" })).filter(a => a.value),
      documents: Object.entries(docs).map(([slotId, f]) => ({
        slotId, label: documents.find(d => d.id === slotId)?.label || "Document",
        mediaId: f.mediaId, filename: f.filename, size: f.size,
      })),
    }
    const r = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    const d = await r.json()
    setBusy(false)
    if (!r.ok) { setError(d.error || "Could not submit. Please try again."); return }
    setDone(true)
  }

  const field = (label: string, key: string, type = "text") => (
    <label style={S.field}>
      <span style={S.label}>{label}</span>
      <input value={me[key] || ""} type={type} onChange={e => setMe({ ...me, [key]: e.target.value })} style={S.input} />
    </label>
  )

  return (
    <AppShell title="Apply">
      <div style={S.narrow}>
        <div style={S.head}>
          <h1 style={S.h1}>{data.job.title}</h1>
          <p style={S.sub}>{data.job.company}</p>
        </div>

        <div style={S.steps}>
          {steps.map((s, i) => (
            <button key={s.key} onClick={() => i < step && setStep(i)} style={{ ...S.stepPill, ...(i === step ? S.stepOn : i < step ? S.stepDone : {}) }}>
              {i < step ? <IconCheck size={12} /> : <span style={S.stepN}>{i + 1}</span>}{s.label}
            </button>
          ))}
        </div>

        {form.instructions && step === 0 && <div style={S.note}>{form.instructions}</div>}
        {error && <div style={S.err}><IconAlert size={15} /> {error}</div>}

        <div style={S.card}>
          {cur.key === "you" && (
            <>
              <h2 style={S.h2}>Your details</h2>
              <p style={S.hint}>Filled in from your profile. Edit anything you want to present differently to this employer — it won't change your profile.</p>
              <div style={S.grid2}>{field("Full name", "name")}{field("Email", "email", "email")}</div>
              <div style={S.grid2}>{field("Phone", "phone")}{field("Location", "location")}</div>
              {field("Headline", "headline")}
              <label style={S.field}><span style={S.label}>Summary</span>
                <textarea value={me.bio || ""} onChange={e => setMe({ ...me, bio: e.target.value })} style={{ ...S.input, minHeight: 96, resize: "vertical" }} />
              </label>
              <p style={S.hint}>Also included: {data.profile.experience?.length || 0} roles, {data.profile.education?.length || 0} qualifications, {data.profile.skills?.length || 0} skills. <Link href="/profile/edit" style={S.link}>Edit profile</Link></p>
            </>
          )}

          {cur.key === "cover" && (
            <>
              <h2 style={S.h2}>Cover letter {form.coverLetter === "optional" && <span style={S.opt}>optional</span>}</h2>
              <p style={S.hint}>Why you, for this role specifically.</p>
              <textarea value={cover} onChange={e => setCover(e.target.value)} placeholder="Dear hiring team…" style={{ ...S.input, minHeight: 220, resize: "vertical" }} />
            </>
          )}

          {cur.key === "questions" && (
            <>
              <h2 style={S.h2}>Questions from {data.job.company}</h2>
              {questions.map(q => (
                <label key={q.id} style={S.field}>
                  <span style={S.label}>{q.label}{q.required && <em style={S.req}> *</em>}</span>
                  {q.help && <span style={S.help}>{q.help}</span>}
                  {q.type === "textarea" ? (
                    <textarea value={answers[q.id] || ""} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} style={{ ...S.input, minHeight: 110, resize: "vertical" }} />
                  ) : q.type === "select" ? (
                    <select value={answers[q.id] || ""} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} style={S.input}>
                      <option value="">Choose…</option>
                      {q.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : q.type === "boolean" ? (
                    <select value={answers[q.id] || ""} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} style={S.input}>
                      <option value="">Choose…</option><option value="Yes">Yes</option><option value="No">No</option>
                    </select>
                  ) : (
                    <input type={q.type === "number" ? "number" : "text"} value={answers[q.id] || ""} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} style={S.input} />
                  )}
                </label>
              ))}
            </>
          )}

          {cur.key === "docs" && (
            <>
              <h2 style={S.h2}>Documents</h2>
              {form.requireResume && (
                <div style={S.docRow}>
                  <div><div style={S.docLabel}>Résumé</div>
                    <div style={S.docMeta}>{data.profile.resumeUrl ? "From your profile" : "No résumé on your profile yet"}</div></div>
                  {data.profile.resumeUrl
                    ? <a href={data.profile.resumeUrl} target="_blank" rel="noreferrer" style={S.ghost}>View</a>
                    : <Link href="/profile/edit" style={S.ghost}>Upload</Link>}
                </div>
              )}
              {documents.map(d => (
                <div key={d.id} style={S.docRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.docLabel}>{d.label}{d.required && <em style={S.req}> *</em>}</div>
                    <div style={S.docMeta}>{docs[d.id] ? `${docs[d.id].filename} · ${Math.round(docs[d.id].size / 1024)} KB` : (d.help || `Accepted: ${d.accept}`)}</div>
                  </div>
                  <label style={{ ...S.ghost, cursor: "pointer" }}>
                    {uploading === d.id ? "Uploading…" : docs[d.id] ? "Replace" : <><IconUpload size={14} /> Upload</>}
                    <input type="file" accept={d.accept} style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) upload(d, f); e.currentTarget.value = "" }} />
                  </label>
                </div>
              ))}
              {!documents.length && !form.requireResume && <p style={S.hint}>No documents required for this role.</p>}
            </>
          )}

          {cur.key === "test" && (
            <>
              <h2 style={S.h2}>Assessment</h2>
              <p style={S.hint}>
                {data.test ? `${data.job.company} asks candidates to complete "${data.test.title}"${data.test.duration ? ` (${data.test.duration} minutes)` : ""}.` : "This role includes an assessment."}
                {form.testRequired ? " It is required for this application." : " It is optional but strongly recommended."}
              </p>
              {form.testId && <Link href={`/tests/${form.testId}`} style={S.primary}>Open the assessment <IconArrowRight size={15} /></Link>}
              <p style={{ ...S.hint, marginTop: 12 }}>You can submit your application now and complete the assessment after — the employer sees both against the same application.</p>
            </>
          )}

          {cur.key === "review" && (
            <>
              <h2 style={S.h2}>Review and submit</h2>
              <div style={S.review}>
                <Row k="Name" v={me.name} /><Row k="Email" v={me.email} />
                <Row k="Phone" v={me.phone || "—"} /><Row k="Location" v={me.location || "—"} />
                {form.coverLetter !== "off" && <Row k="Cover letter" v={cover ? `${cover.trim().split(/\s+/).length} words` : "Not included"} />}
                {questions.length > 0 && <Row k="Questions" v={`${questions.filter(q => (answers[q.id] || "").trim()).length} of ${questions.length} answered`} />}
                {documents.length > 0 && <Row k="Documents" v={`${Object.keys(docs).length} of ${documents.length} uploaded`} />}
                <Row k="Profile" v={`${data.profile.experience?.length || 0} roles · ${data.profile.education?.length || 0} qualifications · ${data.profile.skills?.length || 0} skills`} />
              </div>
              <p style={S.hint}>What you send is saved as-is. Editing your profile later won't change this application.</p>
            </>
          )}
        </div>

        <div style={S.actions}>
          {step > 0 && <button onClick={() => { setError(""); setStep(s => s - 1) }} style={S.ghostBtn}>Back</button>}
          {step < steps.length - 1
            ? <button onClick={next} style={S.primary}>Continue <IconArrowRight size={15} /></button>
            : <button onClick={submit} disabled={busy} style={{ ...S.primary, ...(busy ? S.off : {}) }}>
                {busy ? "Submitting…" : <><IconFileText size={15} /> Submit application</>}
              </button>}
        </div>
      </div>
    </AppShell>
  )
}

const Row = ({ k, v }: { k: string; v: any }) => (
  <div style={S.rRow}><span style={S.rK}>{k}</span><span style={S.rV}>{v}</span></div>
)

const S: Record<string, any> = {
  narrow: { maxWidth: 720, margin: "0 auto", padding: "4px 4px 48px" },
  head: { marginBottom: 16 },
  h1: { fontSize: 24, fontWeight: 650, margin: 0, color: "var(--v-ink)", letterSpacing: "-.02em" },
  h2: { fontSize: 17, fontWeight: 650, margin: "0 0 4px", color: "var(--v-ink)" },
  sub: { fontSize: 14, color: "var(--v-ink-3)", marginTop: 4 },
  hint: { fontSize: 13, color: "var(--v-ink-3)", lineHeight: 1.6, margin: "6px 0 14px" },
  help: { fontSize: 12, color: "var(--v-ink-3)", marginTop: -2, marginBottom: 4 },
  steps: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 },
  stepPill: { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "1px solid var(--v-line-2)", background: "var(--v-surface)", fontSize: 12.5, fontWeight: 600, color: "var(--v-ink-3)", cursor: "pointer" },
  stepOn: { background: "var(--v-accent)", borderColor: "var(--v-accent)", color: "#fff" },
  stepDone: { color: "var(--v-accent)", borderColor: "var(--v-accent)" },
  stepN: { fontSize: 11, opacity: .75 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 22 },
  field: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 },
  label: { fontSize: 12.5, fontWeight: 600, color: "var(--v-ink-2)" },
  req: { color: "#D92D20", fontStyle: "normal" },
  opt: { fontSize: 12, fontWeight: 500, color: "var(--v-ink-3)" },
  input: { border: "1px solid var(--v-line-2)", borderRadius: 10, padding: "10px 12px", fontSize: 14, color: "var(--v-ink)", background: "var(--v-bg)", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  docRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--v-line)" },
  docLabel: { fontSize: 14, fontWeight: 600, color: "var(--v-ink)" },
  docMeta: { fontSize: 12.5, color: "var(--v-ink-3)", marginTop: 2, overflowWrap: "anywhere" },
  review: { display: "flex", flexDirection: "column", gap: 2, margin: "8px 0 4px" },
  rRow: { display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--v-line)", fontSize: 13.5 },
  rK: { color: "var(--v-ink-3)" },
  rV: { fontWeight: 500, color: "var(--v-ink)", textAlign: "right", overflowWrap: "anywhere" },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 },
  primary: { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 11, border: "none", background: "var(--v-accent)", color: "#fff", fontSize: 14.5, fontWeight: 600, cursor: "pointer", textDecoration: "none" },
  ghostBtn: { padding: "11px 18px", borderRadius: 11, border: "1px solid var(--v-line-2)", background: "var(--v-surface)", color: "var(--v-ink)", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  ghost: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid var(--v-line-2)", background: "var(--v-surface)", color: "var(--v-ink)", fontSize: 13, fontWeight: 600, textDecoration: "none", flexShrink: 0 },
  off: { opacity: .55, cursor: "not-allowed" },
  note: { background: "var(--v-accent-soft)", color: "var(--v-ink-2)", padding: "12px 15px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, marginBottom: 12 },
  err: { display: "flex", alignItems: "center", gap: 8, background: "#FEF3F2", color: "#B42318", padding: "11px 14px", borderRadius: 11, fontSize: 13.5, marginBottom: 12 },
  tick: { width: 54, height: 54, borderRadius: "50%", background: "var(--v-accent-soft)", color: "var(--v-accent)", display: "grid", placeItems: "center", margin: "0 auto 14px" },
  link: { color: "var(--v-accent)", fontWeight: 600 },
  dim: { padding: 40, textAlign: "center", color: "var(--v-ink-3)" },
}
