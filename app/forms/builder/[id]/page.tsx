"use client"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import CrmShell from "@/components/crm/CrmShell"
import { IconPlus, IconTrash, IconArrowRight } from "@/components/ui/Icons"

const FIELD_TYPES = [
  ["text", "Short text"], ["longtext", "Long text"], ["email", "Email"], ["phone", "Phone"],
  ["number", "Number"], ["select", "Dropdown"], ["checkbox", "Checkbox"],
] as const

let seq = 0
const newId = () => `f${Date.now().toString(36)}${seq++}`

export default function FormBuilder() {
  const { id } = useParams() as { id: string }
  const [form, setForm] = useState<any>(null)
  const [fields, setFields] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [tab, setTab] = useState<"build" | "submissions">("build")
  const [msg, setMsg] = useState("")
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const d = await fetch(`/api/crm/forms/${id}`).then(r => r.json())
    if (d.error) return
    setForm(d.form); setFields(d.form.fields); setSubmissions(d.submissions)
  }, [id])
  useEffect(() => { load() }, [load])

  async function save(patch: any) {
    const d = await fetch(`/api/crm/forms/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).then(r => r.json())
    if (d.success) { setForm(d.form); setMsg("Saved"); setTimeout(() => setMsg(""), 1500) }
  }
  const saveFields = (fs: any[]) => { setFields(fs); save({ fields: fs }) }
  const updateField = (i: number, patch: any) => saveFields(fields.map((f, idx) => idx === i ? { ...f, ...patch } : f))
  const addField = () => saveFields([...fields, { id: newId(), type: "text", label: "New field", required: false }])
  const removeField = (i: number) => saveFields(fields.filter((_, idx) => idx !== i))
  const moveField = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= fields.length) return
    const fs = [...fields];[fs[i], fs[j]] = [fs[j], fs[i]]; saveFields(fs)
  }

  if (!form) return <CrmShell><div style={{ padding: "3rem", color: "#8A8595" }}>Loading…</div></CrmShell>
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/forms/${form.slug}` : `/forms/${form.slug}`

  return (
    <CrmShell>
      <div style={S.wrap}>
        <Link href="/forms" style={S.back}>← Forms</Link>
        <div style={S.head}>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} onBlur={e => save({ name: e.target.value })} style={S.titleInput} />
          <div style={S.headRight}>
            {msg && <span style={S.saved}>{msg}</span>}
            <label style={S.toggle}>
              <input type="checkbox" checked={form.isLive} onChange={e => save({ isLive: e.target.checked })} />
              {form.isLive ? "Live" : "Draft"}
            </label>
          </div>
        </div>

        <div style={S.shareBar}>
          <span style={S.shareLabel}>Share link</span>
          <code style={S.shareUrl}>{shareUrl}</code>
          <button onClick={() => { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }} style={S.copyBtn}>{copied ? "Copied" : "Copy"}</button>
          <a href={`/forms/${form.slug}`} target="_blank" rel="noreferrer" style={S.openBtn}>Open <IconArrowRight size={13} /></a>
        </div>

        <div style={S.tabs}>
          <button onClick={() => setTab("build")} style={{ ...S.tab, ...(tab === "build" ? S.tabOn : {}) }}>Build</button>
          <button onClick={() => setTab("submissions")} style={{ ...S.tab, ...(tab === "submissions" ? S.tabOn : {}) }}>Submissions ({submissions.length})</button>
        </div>

        {tab === "build" ? (
          <div style={S.card}>
            {fields.map((f, i) => (
              <div key={f.id} style={S.field}>
                <div style={S.fieldTop}>
                  <input value={f.label} onChange={e => updateField(i, { label: e.target.value })} style={S.fieldLabel} placeholder="Field label" />
                  <select value={f.type} onChange={e => updateField(i, { type: e.target.value })} style={S.typeSelect}>
                    {FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <label style={S.req}><input type="checkbox" checked={!!f.required} onChange={e => updateField(i, { required: e.target.checked })} /> Required</label>
                  <div style={S.fieldActions}>
                    <button onClick={() => moveField(i, -1)} disabled={i === 0} style={S.arrowBtn}>↑</button>
                    <button onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} style={S.arrowBtn}>↓</button>
                    <button onClick={() => removeField(i)} style={S.delFieldBtn}><IconTrash size={14} /></button>
                  </div>
                </div>
                {f.type === "select" && (
                  <input value={(f.options || []).join(", ")} onChange={e => updateField(i, { options: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} placeholder="Options, comma separated" style={S.optionsInput} />
                )}
              </div>
            ))}
            <button onClick={addField} style={S.addField}><IconPlus size={15} /> Add field</button>
          </div>
        ) : (
          <div style={S.card}>
            {submissions.length === 0 ? <p style={S.muted}>No submissions yet. Share the link above to start collecting leads.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {submissions.map(s => (
                  <div key={s.id} style={S.sub}>
                    <div style={S.subHead}>
                      <span style={S.subTime}>{new Date(s.submittedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                      {s.contactId && <Link href={`/contacts/${s.contactId}`} style={S.subContact}>View contact →</Link>}
                    </div>
                    <div style={S.subData}>
                      {fields.map(f => s.data[f.id] != null && String(s.data[f.id]).trim() !== "" && (
                        <div key={f.id} style={S.kv}><span style={S.k}>{f.label}</span><span style={S.v}>{String(s.data[f.id])}</span></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </CrmShell>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 760, margin: "0 auto", padding: "2rem" },
  back: { fontSize: 13, color: "#8A8595", textDecoration: "none" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 16px", gap: 16 },
  titleInput: { fontSize: 22, fontWeight: 700, color: "#1A1A2E", border: "none", outline: "none", background: "transparent", flex: 1, borderBottom: "1px solid transparent", padding: "2px 0" },
  headRight: { display: "flex", alignItems: "center", gap: 14 },
  saved: { fontSize: 12.5, color: "#047857", fontWeight: 600 },
  toggle: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 600, color: "#4B4761", cursor: "pointer" },
  shareBar: { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #ECEBF0", borderRadius: 11, padding: "10px 14px", marginBottom: 18, flexWrap: "wrap" },
  shareLabel: { fontSize: 11, fontWeight: 600, color: "#A5A1AE", textTransform: "uppercase", letterSpacing: ".05em" },
  shareUrl: { flex: 1, fontFamily: "monospace", fontSize: 12.5, color: "#0F6E56", minWidth: 160, wordBreak: "break-all" },
  copyBtn: { background: "#E1F5EE", color: "#0F6E56", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  openBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "#0F6E56", color: "#fff", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, textDecoration: "none" },
  tabs: { display: "flex", gap: 4, marginBottom: 14 },
  tab: { background: "none", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 600, color: "#8A8595", cursor: "pointer" },
  tabOn: { background: "#E1F5EE", color: "#0F6E56" },
  card: { background: "#fff", border: "1px solid #ECEBF0", borderRadius: 14, padding: "1.25rem", display: "flex", flexDirection: "column", gap: 12 },
  field: { border: "1px solid #ECEBF0", borderRadius: 11, padding: 12, background: "#FAFAFC" },
  fieldTop: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  fieldLabel: { flex: 1, minWidth: 140, border: "1px solid #E1E0E7", borderRadius: 8, padding: "8px 11px", fontSize: 14, outline: "none", background: "#fff", color: "#1A1A2E" },
  typeSelect: { border: "1px solid #E1E0E7", borderRadius: 8, padding: "8px 10px", fontSize: 13, background: "#fff", color: "#4B4761", cursor: "pointer" },
  req: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#6B6777", whiteSpace: "nowrap" },
  fieldActions: { display: "flex", gap: 4 },
  arrowBtn: { border: "1px solid #E1E0E7", background: "#fff", borderRadius: 7, width: 28, height: 28, cursor: "pointer", color: "#6B6777" },
  delFieldBtn: { border: "1px solid #E1E0E7", background: "#fff", borderRadius: 7, width: 28, height: 28, cursor: "pointer", color: "#B91C1C", display: "grid", placeItems: "center" },
  optionsInput: { width: "100%", marginTop: 8, border: "1px solid #E1E0E7", borderRadius: 8, padding: "8px 11px", fontSize: 13, outline: "none" },
  addField: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, border: "1.5px dashed #D4D2DC", background: "none", borderRadius: 10, padding: "11px", fontSize: 13.5, fontWeight: 600, color: "#6B6777", cursor: "pointer" },
  muted: { fontSize: 13.5, color: "#9A96A5", textAlign: "center", padding: "1.5rem 0" },
  sub: { border: "1px solid #ECEBF0", borderRadius: 11, padding: 14 },
  subHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  subTime: { fontSize: 12.5, color: "#8A8595" },
  subContact: { fontSize: 12.5, color: "#0F6E56", fontWeight: 600, textDecoration: "none" },
  subData: { display: "flex", flexDirection: "column", gap: 5 },
  kv: { display: "flex", gap: 10, fontSize: 13.5 },
  k: { color: "#8A8595", minWidth: 130 },
  v: { color: "#1A1A2E", fontWeight: 500 },
}
