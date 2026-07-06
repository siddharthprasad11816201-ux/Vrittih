"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"

export default function PublicFormPage() {
  const { slug } = useParams() as { slug: string }
  const [form, setForm] = useState<any>(null)
  const [values, setValues] = useState<Record<string, any>>({})
  const [state, setState] = useState<"loading" | "ready" | "done" | "gone">("loading")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/forms/${slug}`).then(r => r.json()).then(d => {
      if (d.error) { setState("gone"); return }
      setForm(d.form); setState("ready")
    }).catch(() => setState("gone"))
  }, [slug])

  const set = (id: string, v: any) => setValues(p => ({ ...p, [id]: v }))

  async function submit(e: any) {
    e.preventDefault()
    setSubmitting(true); setError("")
    const res = await fetch(`/api/forms/${slug}/submissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: values }) })
    const d = await res.json()
    setSubmitting(false)
    if (d.success) { setMessage(d.message); setState("done") }
    else setError(d.error || "Submission failed")
  }

  if (state === "loading") return <div style={S.page}><div style={S.card}><p style={S.muted}>Loading…</p></div></div>
  if (state === "gone") return <div style={S.page}><div style={S.card}><h1 style={S.h1}>Form unavailable</h1><p style={S.muted}>This form is not accepting responses.</p></div></div>
  if (state === "done") return (
    <div style={S.page}><div style={{ ...S.card, textAlign: "center" }}>
      <div style={S.check}><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>
      <h1 style={S.h1}>Thank you</h1>
      <p style={S.muted}>{message}</p>
    </div></div>
  )

  return (
    <div style={S.page}>
      <form onSubmit={submit} style={S.card}>
        <h1 style={S.h1}>{form.name}</h1>
        {error && <div style={S.err}>{error}</div>}
        {form.fields.map((f: any) => (
          <div key={f.id} style={S.field}>
            <label style={S.label}>{f.label}{f.required && <span style={{ color: "#DC2626" }}> *</span>}</label>
            {f.type === "longtext" ? (
              <textarea value={values[f.id] || ""} onChange={e => set(f.id, e.target.value)} required={f.required} rows={4} style={{ ...S.input, resize: "vertical" }} placeholder={f.placeholder} />
            ) : f.type === "select" ? (
              <select value={values[f.id] || ""} onChange={e => set(f.id, e.target.value)} required={f.required} style={S.input}>
                <option value="">Select…</option>
                {(f.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "checkbox" ? (
              <label style={S.checkRow}><input type="checkbox" checked={!!values[f.id]} onChange={e => set(f.id, e.target.checked)} /> Yes</label>
            ) : (
              <input type={f.type === "email" ? "email" : f.type === "number" ? "number" : f.type === "phone" ? "tel" : "text"}
                value={values[f.id] || ""} onChange={e => set(f.id, e.target.value)} required={f.required} style={S.input} placeholder={f.placeholder} />
            )}
          </div>
        ))}
        <button type="submit" disabled={submitting} style={S.submit}>{submitting ? "Submitting…" : "Submit"}</button>
        <p style={S.brand}>Powered by <strong>Vrittih</strong></p>
      </form>
    </div>
  )
}

const S: Record<string, any> = {
  page: { minHeight: "100vh", background: "#F0EFF5", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3rem 1.25rem" },
  card: { background: "#fff", borderRadius: 18, padding: "2.25rem", width: "100%", maxWidth: 520, boxShadow: "0 8px 40px rgba(35,25,70,.08)", border: "1px solid #EAE8F0", display: "flex", flexDirection: "column", gap: 16 },
  h1: { fontSize: 22, fontWeight: 700, color: "#1A1A2E", letterSpacing: "-.02em" },
  muted: { fontSize: 14, color: "#8A8595", lineHeight: 1.6 },
  field: { display: "flex", flexDirection: "column", gap: 7 },
  label: { fontSize: 13.5, fontWeight: 600, color: "#3A3752" },
  input: { border: "1px solid #DAD8E2", borderRadius: 10, padding: "11px 13px", fontSize: 14.5, color: "#1A1A2E", outline: "none", fontFamily: "inherit", background: "#fff" },
  checkRow: { display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: "#3A3752" },
  submit: { marginTop: 6, background: "#534AB7", color: "#fff", border: "none", borderRadius: 11, padding: "13px", fontSize: 15, fontWeight: 600, cursor: "pointer" },
  err: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", borderRadius: 9, padding: "10px 13px", fontSize: 13 },
  check: { width: 56, height: 56, borderRadius: "50%", background: "#534AB7", display: "grid", placeItems: "center", margin: "0 auto 6px" },
  brand: { textAlign: "center", fontSize: 12, color: "#A5A1AE", marginTop: 4 },
}
