"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import CrmShell from "@/components/crm/CrmShell"
import { IconPlus, IconClipboard, IconUsers } from "@/components/ui/Icons"

export default function FormsPage() {
  const router = useRouter()
  const [forms, setForms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  async function load() {
    const d = await fetch("/api/crm/forms").then(r => r.json())
    setForms(d.forms || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create() {
    setCreating(true)
    const d = await fetch("/api/crm/forms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Untitled form" }) }).then(r => r.json())
    setCreating(false)
    if (d.success) router.push(`/forms/builder/${d.form.id}`)
  }

  return (
    <CrmShell>
      <div style={S.wrap}>
        <div style={S.head}>
          <div>
            <h1 style={S.title}>Forms</h1>
            <p style={S.sub}>Shareable lead-capture forms — every submission becomes a contact.</p>
          </div>
          <button onClick={create} disabled={creating} style={S.addBtn}><IconPlus size={16} /> {creating ? "Creating…" : "New form"}</button>
        </div>

        {loading ? <div style={S.empty}>Loading…</div> : forms.length === 0 ? (
          <div style={S.empty}>
            <span style={{ color: "#C7C4D1" }}><IconClipboard size={40} /></span>
            <p style={{ fontWeight: 600, color: "#4B4761", marginTop: 12 }}>No forms yet</p>
            <p style={{ fontSize: 13, color: "#8A8595", marginTop: 4 }}>Create a form to capture leads with a shareable link.</p>
            <button onClick={create} style={{ ...S.addBtn, marginTop: 16 }}><IconPlus size={16} /> New form</button>
          </div>
        ) : (
          <div style={S.list}>
            {forms.map(f => (
              <div key={f.id} onClick={() => router.push(`/forms/builder/${f.id}`)} style={S.row}>
                <div style={S.icon}><IconClipboard size={18} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.name}>{f.name}</div>
                  <div style={S.meta}>/forms/{f.slug}</div>
                </div>
                <span style={S.subs}><IconUsers size={13} /> {f.submissionCount}</span>
                <span style={{ ...S.status, ...(f.isLive ? S.live : S.draft) }}>{f.isLive ? "Live" : "Draft"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </CrmShell>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 900, margin: "0 auto", padding: "2rem" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 },
  title: { fontSize: 24, fontWeight: 700, color: "#1A1A2E", letterSpacing: "-.02em" },
  sub: { fontSize: 13.5, color: "#8A8595", marginTop: 3 },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 7, background: "#0F6E56", color: "#fff", padding: "10px 16px", borderRadius: 9, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: { display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "1px solid #ECEBF0", borderRadius: 12, padding: "14px 18px", cursor: "pointer" },
  icon: { width: 40, height: 40, borderRadius: 10, background: "#E1F5EE", color: "#0F6E56", display: "grid", placeItems: "center", flexShrink: 0 },
  name: { fontSize: 15, fontWeight: 600, color: "#1A1A2E" },
  meta: { fontSize: 12.5, color: "#9A96A5", marginTop: 2, fontFamily: "monospace" },
  subs: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "#6B6777" },
  status: { fontSize: 11.5, fontWeight: 600, padding: "4px 11px", borderRadius: 999 },
  live: { background: "#ECFDF5", color: "#047857" },
  draft: { background: "#F3F4F6", color: "#6B7280" },
  empty: { background: "#fff", border: "1px solid #ECEBF0", borderRadius: 14, padding: "3.5rem 2rem", textAlign: "center", color: "#8A8595" },
}
