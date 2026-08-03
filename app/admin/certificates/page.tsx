"use client"
import { useState } from "react"
import AdminShell, { AdminTopBar } from "@/components/admin/AdminShell"
import { CERT_KINDS } from "@/lib/certificate"

/* Admin · issue a verifiable certificate to any Vrittih user (by email). The
 * recipient sees it in their account; anyone can verify it at the public link. */
const BLANK = { email: "", title: "", kind: "internship", skills: "", note: "", expiresAt: "" }

export default function AdminCertificatesPage() {
  const [form, setForm] = useState<any>({ ...BLANK })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok: boolean; url?: string } | null>(null)
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  async function issue(e: any) {
    e.preventDefault(); setBusy(true); setMsg(null)
    const d = await fetch("/api/certificates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(r => r.json()).catch(() => ({ error: "Network error" }))
    setBusy(false)
    if (d.certificate) { setMsg({ t: `Issued ${d.certificate.serial} to ${form.email}`, ok: true, url: d.certificate.verifyUrl }); setForm({ ...BLANK }) }
    else setMsg({ t: d.error || "Failed to issue", ok: false })
  }

  return (
    <AdminShell>
      <AdminTopBar title="Certificates" subtitle="Issue verifiable credentials — publicly verifiable, revocable." />
      <div style={S.pad}>
        {msg && (
          <div style={{ ...S.note, ...(msg.ok ? S.ok : S.err) }}>
            {msg.t}{msg.url && <> · <a href={msg.url} target="_blank" rel="noreferrer" style={{ color: "inherit", fontWeight: 700 }}>view verification page ↗</a></>}
          </div>
        )}
        <form onSubmit={issue} style={S.card}>
          <h3 style={S.h3}>Issue a certificate</h3>
          <div style={S.grid}>
            <Field label="Recipient email"><input value={form.email} onChange={e => set("email", e.target.value)} style={S.in} placeholder="person@example.com" required type="email" /></Field>
            <Field label="Type">
              <select value={form.kind} onChange={e => set("kind", e.target.value)} style={S.in}>
                {CERT_KINDS.map(k => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
              </select>
            </Field>
            <Field label="Title"><input value={form.title} onChange={e => set("title", e.target.value)} style={S.in} placeholder="Backend Engineering Internship — Completed" required /></Field>
            <Field label="Expires (optional)"><input type="date" value={form.expiresAt} onChange={e => set("expiresAt", e.target.value)} style={S.in} /></Field>
            <Field label="Skills (comma-separated)"><input value={form.skills} onChange={e => set("skills", e.target.value)} style={S.in} placeholder="Node.js, PostgreSQL, System design" /></Field>
            <Field label="Note (optional)"><input value={form.note} onChange={e => set("note", e.target.value)} style={S.in} placeholder="Top 5% of the cohort" /></Field>
          </div>
          <button type="submit" disabled={busy} style={S.btn}>{busy ? "Issuing…" : "Issue certificate"}</button>
          <p style={S.hint}>The recipient must already have a Vrittih account (matched by email).</p>
        </form>
      </div>
    </AdminShell>
  )
}
const Field = ({ label, children }: any) => <label style={S.fg}><span style={S.lbl}>{label}</span>{children}</label>
const S: Record<string, any> = {
  pad: { padding: "1.5rem 2rem", display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 },
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "1.25rem 1.5rem" },
  h3: { fontSize: 15, fontWeight: 600, color: "#0A0A0F", margin: "0 0 14px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  fg: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 },
  lbl: { fontSize: 12, fontWeight: 500, color: "#7B7B8F" },
  in: { border: "1px solid #D8DEE7", borderRadius: 8, padding: "8px 11px", fontSize: 13, color: "#0A0A0F", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  btn: { background: "#6495ED", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  hint: { fontSize: 12, color: "#98A2B3", marginTop: 10 },
  note: { borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 500 },
  ok: { background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#047857" },
  err: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" },
}
