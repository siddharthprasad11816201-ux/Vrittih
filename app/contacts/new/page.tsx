"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import CrmShell from "@/components/crm/CrmShell"
import { STAGES, STAGE_META } from "@/lib/crmMeta"

export default function NewContactPage() {
  const router = useRouter()
  const [form, setForm] = useState<any>({ firstName: "", lastName: "", email: "", phone: "", company: "", jobTitle: "", city: "", country: "", stage: "LEAD", value: "", currency: "CHF", source: "", notes: "" })
  const [tagsText, setTagsText] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  async function submit(e: any) {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) { setError("First and last name are required"); return }
    setSaving(true); setError("")
    const body: any = { ...form, value: form.value ? Number(form.value) : 0, tags: tagsText.split(",").map(t => t.trim()).filter(Boolean) }
    if (!body.email) delete body.email
    const res = await fetch("/api/crm/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const d = await res.json()
    setSaving(false)
    if (d.success) router.push(`/contacts/${d.contact.id}`)
    else setError(d.error || "Could not save contact")
  }

  const field = (label: string, key: string, opts: any = {}) => (
    <div style={{ flex: opts.flex || 1 }}>
      <label style={S.label}>{label}</label>
      <input value={form[key]} onChange={e => set(key, e.target.value)} placeholder={opts.placeholder} type={opts.type || "text"} style={S.input} />
    </div>
  )

  return (
    <CrmShell>
      <div style={S.wrap}>
        <Link href="/contacts" style={S.back}>← Contacts</Link>
        <h1 style={S.title}>New contact</h1>
        {error && <div style={S.err}>{error}</div>}
        <form onSubmit={submit} style={S.card}>
          <div style={S.rowF}>{field("First name *", "firstName")}{field("Last name *", "lastName")}</div>
          <div style={S.rowF}>{field("Email", "email", { type: "email", placeholder: "name@company.com" })}{field("Phone", "phone", { placeholder: "+41 …" })}</div>
          <div style={S.rowF}>{field("Company", "company")}{field("Job title", "jobTitle")}</div>
          <div style={S.rowF}>{field("City", "city")}{field("Country", "country")}</div>

          <div style={S.rowF}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Stage</label>
              <select value={form.stage} onChange={e => set("stage", e.target.value)} style={S.input}>
                {STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
              </select>
            </div>
            {field("Deal value", "value", { type: "number", placeholder: "0" })}
            <div style={{ width: 110 }}>
              <label style={S.label}>Currency</label>
              <input value={form.currency} onChange={e => set("currency", e.target.value)} style={S.input} />
            </div>
          </div>
          <div style={S.rowF}>{field("Source", "source", { placeholder: "referral, form, event…" })}
            <div style={{ flex: 1 }}><label style={S.label}>Tags (comma separated)</label><input value={tagsText} onChange={e => setTagsText(e.target.value)} placeholder="vip, warm" style={S.input} /></div>
          </div>
          <div>
            <label style={S.label}>Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={4} style={{ ...S.input, resize: "vertical" }} placeholder="Anything worth remembering…" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button type="submit" disabled={saving} style={S.saveBtn}>{saving ? "Saving…" : "Create contact"}</button>
            <Link href="/contacts" style={S.cancel}>Cancel</Link>
          </div>
        </form>
      </div>
    </CrmShell>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 720, margin: "0 auto", padding: "2rem" },
  back: { fontSize: 13, color: "#8A8595", textDecoration: "none" },
  title: { fontSize: 24, fontWeight: 700, color: "#1A1A2E", letterSpacing: "-.02em", margin: "10px 0 20px" },
  card: { background: "#fff", border: "1px solid #ECEBF0", borderRadius: 14, padding: "1.75rem", display: "flex", flexDirection: "column", gap: 16 },
  rowF: { display: "flex", gap: 14 },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, color: "#6B6777", marginBottom: 6 },
  input: { width: "100%", border: "1px solid #E1E0E7", borderRadius: 9, padding: "10px 12px", fontSize: 14, color: "#1A1A2E", outline: "none", background: "#fff", fontFamily: "inherit" },
  err: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", borderRadius: 9, padding: "10px 14px", fontSize: 13, marginBottom: 14 },
  saveBtn: { background: "#0F6E56", color: "#fff", border: "none", borderRadius: 9, padding: "11px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  cancel: { display: "inline-flex", alignItems: "center", padding: "11px 18px", fontSize: 14, color: "#6B6777", textDecoration: "none" },
}
