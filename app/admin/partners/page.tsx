"use client"
import { useEffect, useState } from "react"
import AdminShell, { AdminTopBar } from "@/components/admin/AdminShell"

type Partner = { id: string; name: string; email: string; plan: string; approved: boolean; keys: number; domains: { domain: string; verified: boolean }[]; verifiedDomains: number; liveJobs: number; createdAt: string }

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")

  async function load() {
    try {
      const r = await fetch("/api/admin/partners")
      if (!r.ok) { setErr(r.status === 403 ? "Admins only." : "Failed to load."); return }
      const d = await r.json(); setPartners(d.partners || [])
    } catch {
      setErr("Failed to load.")
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function setApproved(id: string, approved: boolean) {
    setPartners((cur) => cur.map((p) => p.id === id ? { ...p, approved } : p))
    await fetch("/api/admin/partners", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ employerId: id, approved }) })
  }

  return (
    <AdminShell>
      <AdminTopBar title="Partners" subtitle="Approve companies that integrate via the API before their jobs go public" />
      {err && <div style={S.err}>{err}</div>}
      {loading ? <div style={S.muted}>Loading…</div> : (
        <div style={S.tableWrap}>
          <table style={S.table}><tbody>
            <tr>
              {["Company", "Plan", "Keys", "Domains", "Live jobs", "Status", ""].map((h) => <th key={h} style={S.th}>{h}</th>)}
            </tr>
            {partners.map((p) => (
              <tr key={p.id}>
                <td style={S.td}><div style={S.name}>{p.name}</div><div style={S.email}>{p.email}</div></td>
                <td style={S.td}>{p.plan}</td>
                <td style={S.td}>{p.keys}</td>
                <td style={S.td}>{p.domains.length ? p.domains.map((d) => (
                  <span key={d.domain} style={{ ...S.dpill, ...(d.verified ? S.dok : S.dpend) }}>{d.domain}{d.verified ? " ✓" : ""}</span>
                )) : <span style={S.muted}>none</span>}</td>
                <td style={S.td}>{p.liveJobs}</td>
                <td style={S.td}><span style={{ ...S.pill, ...(p.approved ? S.ok : S.pend) }}>{p.approved ? "approved" : "pending"}</span></td>
                <td style={{ ...S.td, textAlign: "right" }}>
                  {p.approved
                    ? <button onClick={() => setApproved(p.id, false)} style={S.revoke}>Revoke</button>
                    : <button onClick={() => setApproved(p.id, true)} style={S.approve}>Approve</button>}
                </td>
              </tr>
            ))}
            {partners.length === 0 && <tr><td style={S.td} colSpan={7}><span style={S.muted}>No API partners yet.</span></td></tr>}
          </tbody></table>
        </div>
      )}
    </AdminShell>
  )
}

const S: Record<string, any> = {
  err: { margin: "12px 0", color: "#DC2626", fontSize: 14 },
  muted: { color: "#9ca3af", fontSize: 13 },
  tableWrap: { overflowX: "auto", marginTop: 16, background: "#fff", border: "1px solid #eee", borderRadius: 12 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: { textAlign: "left", padding: "12px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", color: "#9ca3af", borderBottom: "1px solid #eee" },
  td: { padding: "12px 14px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle", color: "#1f2937" },
  name: { fontWeight: 600 }, email: { fontSize: 12, color: "#9ca3af" },
  pill: { fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "3px 10px" },
  ok: { background: "#dcfce7", color: "#166534" }, pend: { background: "#fef3c7", color: "#92400e" },
  dpill: { display: "inline-block", fontSize: 11, borderRadius: 6, padding: "2px 7px", margin: "2px 4px 2px 0" },
  dok: { background: "#dcfce7", color: "#166534" }, dpend: { background: "#f3f4f6", color: "#6b7280" },
  approve: { background: "#6495ED", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  revoke: { background: "transparent", color: "#DC2626", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
}
