"use client"
import { useEffect, useState } from "react"
import AdminShell, { AdminTopBar } from "@/components/admin/AdminShell"
import { PLANS } from "@/lib/plans"

/* Admin · Coupons — create/manage discount + waiver codes. All enforcement is
 * server-side (lib/coupon + payment routes); this is the management surface. */

type Coupon = {
  id: string; code: string; description?: string; kind: string; value: number
  audience: string; planId?: string | null; maxRedemptions?: number | null
  redeemedCount: number; perUserLimit: number; active: boolean
  startsAt?: string | null; expiresAt?: string | null; createdAt: string
  _count?: { redemptions: number }
}

const BLANK = { code: "", description: "", kind: "percent", value: 10, audience: "all", planId: "", maxRedemptions: "", perUserLimit: "1", expiresAt: "" }

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const [form, setForm] = useState<any>({ ...BLANK })
  const [busy, setBusy] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const flash = (t: string, ok = true) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 3500) }
  const load = () => fetch("/api/admin/coupons").then(r => { if (r.status === 403) { setForbidden(true); return null } return r.json() })
    .then(d => { if (d?.coupons) setCoupons(d.coupons) }).catch(() => {})
  useEffect(() => { load() }, [])

  async function create(e: any) {
    e.preventDefault(); setBusy(true)
    const body: any = { ...form }
    if (form.kind === "waiver") body.value = 100
    const d = await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ error: "Network error" }))
    setBusy(false)
    if (d.coupon) { flash(`Coupon ${d.coupon.code} created`); setForm({ ...BLANK }); load() }
    else flash(d.error || "Failed", false)
  }
  async function toggle(c: Coupon) {
    const d = await fetch("/api/admin/coupons", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, active: !c.active }) }).then(r => r.json()).catch(() => ({}))
    if (d.coupon) load(); else flash(d.error || "Failed", false)
  }
  async function remove(c: Coupon) {
    if (!confirm(`Delete coupon ${c.code}? This cannot be undone.`)) return
    const d = await fetch("/api/admin/coupons", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) }).then(r => r.json()).catch(() => ({}))
    if (d.success) { flash("Deleted"); load() } else flash(d.error || "Failed", false)
  }

  const fmt = (c: Coupon) => c.kind === "waiver" ? "100% waiver" : c.kind === "percent" ? `${c.value}% off` : `${c.value} CHF off`
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  if (forbidden) return <AdminShell><AdminTopBar title="Coupons" /><div style={S.pad}><div style={S.err}>Admin access required. Sign in with an admin account.</div></div></AdminShell>

  return (
    <AdminShell>
      <AdminTopBar title="Coupons & waivers" subtitle="Discount codes and 100% payment waivers. All redemption is enforced server-side." />
      <div style={S.pad}>
        {msg && <div style={{ ...S.note, ...(msg.ok ? S.ok : S.err) }}>{msg.t}</div>}

        <form onSubmit={create} style={S.card}>
          <h3 style={S.h3}>Create a coupon</h3>
          <div style={S.grid}>
            <Field label="Code"><input value={form.code} onChange={e => set("code", e.target.value.toUpperCase())} style={S.in} placeholder="WELCOME50" required /></Field>
            <Field label="Type">
              <select value={form.kind} onChange={e => set("kind", e.target.value)} style={S.in}>
                <option value="percent">Percentage off</option>
                <option value="fixed">Fixed CHF off</option>
                <option value="waiver">Full waiver (100% free)</option>
              </select>
            </Field>
            {form.kind !== "waiver" && (
              <Field label={form.kind === "percent" ? "Percent (0-100)" : "Amount (CHF)"}>
                <input type="number" value={form.value} onChange={e => set("value", e.target.value)} style={S.in} min={0} step="0.01" />
              </Field>
            )}
            <Field label="Audience">
              <select value={form.audience} onChange={e => set("audience", e.target.value)} style={S.in}>
                <option value="all">All</option><option value="individual">Individuals</option><option value="employer">Employers</option>
              </select>
            </Field>
            <Field label="Plan (optional)">
              <select value={form.planId} onChange={e => set("planId", e.target.value)} style={S.in}>
                <option value="">Any plan</option>
                {PLANS.map(p => <option key={p.id} value={p.id}>{p.name} ({p.audience})</option>)}
              </select>
            </Field>
            <Field label="Max total uses"><input type="number" value={form.maxRedemptions} onChange={e => set("maxRedemptions", e.target.value)} style={S.in} placeholder="Unlimited" min={0} /></Field>
            <Field label="Expires (optional)"><input type="date" value={form.expiresAt} onChange={e => set("expiresAt", e.target.value)} style={S.in} /></Field>
          </div>
          <Field label="Description (optional)"><input value={form.description} onChange={e => set("description", e.target.value)} style={S.in} placeholder="Internal note" /></Field>
          <button type="submit" disabled={busy} style={S.btn}>{busy ? "Creating…" : "Create coupon"}</button>
        </form>

        <div style={S.card}>
          <h3 style={S.h3}>Active & past coupons</h3>
          {!coupons ? <p style={S.dim}>Loading…</p> : coupons.length === 0 ? <p style={S.dim}>No coupons yet.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead><tr>{["Code", "Discount", "Scope", "Used", "Limit", "Expires", "Status", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {coupons.map(c => (
                    <tr key={c.id} style={S.tr}>
                      <td style={S.td}><b>{c.code}</b>{c.description && <div style={S.sub}>{c.description}</div>}</td>
                      <td style={S.td}>{fmt(c)}</td>
                      <td style={S.td}>{c.audience}{c.planId ? ` · ${c.planId}` : ""}</td>
                      <td style={S.td}>{c._count?.redemptions ?? c.redeemedCount}</td>
                      <td style={S.td}>{c.maxRedemptions ?? "∞"}{c.perUserLimit ? ` · ${c.perUserLimit}/user` : ""}</td>
                      <td style={S.td}>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-GB") : "—"}</td>
                      <td style={S.td}><span style={{ ...S.pill, background: c.active ? "#ECFDF5" : "#F3F4F6", color: c.active ? "#047857" : "#6b7280" }}>{c.active ? "Active" : "Off"}</span></td>
                      <td style={S.td}>
                        <button onClick={() => toggle(c)} style={S.link}>{c.active ? "Disable" : "Enable"}</button>
                        <button onClick={() => remove(c)} style={{ ...S.link, color: "#B91C1C" }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  )
}

const Field = ({ label, children }: any) => <label style={S.fg}><span style={S.lbl}>{label}</span>{children}</label>

const S: Record<string, any> = {
  pad: { padding: "1.5rem 2rem", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1000 },
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "1.25rem 1.5rem" },
  h3: { fontSize: 15, fontWeight: 600, color: "#0A0A0F", margin: "0 0 14px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  fg: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 },
  lbl: { fontSize: 12, fontWeight: 500, color: "#7B7B8F" },
  in: { border: "1px solid #D8DEE7", borderRadius: 8, padding: "8px 11px", fontSize: 13, color: "#0A0A0F", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  btn: { background: "#6495ED", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 600, color: "#98A2B3", borderBottom: "1px solid #EAECF0", textTransform: "uppercase", letterSpacing: ".04em" },
  tr: { borderBottom: "1px solid #F2F4F7" },
  td: { padding: "10px", color: "#344054", verticalAlign: "top" },
  sub: { fontSize: 11.5, color: "#98A2B3", marginTop: 2 },
  pill: { fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 999 },
  link: { background: "none", border: "none", color: "#334EAC", fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginRight: 10, padding: 0 },
  note: { borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 500 },
  ok: { background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#047857" },
  err: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" },
  dim: { fontSize: 13, color: "#98A2B3" },
}
