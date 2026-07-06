"use client"
import { useEffect, useState } from "react"
import AdminShell, { AdminTopBar } from "@/components/admin/AdminShell"

export default function AdminPayments() {
  const [data, setData] = useState<any>(null)
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => { load() }, [q, page])

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    params.set("page", String(page))
    const d = await fetch("/api/admin/payments?" + params).then(r => r.json())
    if (d.error) { setError(d.error); setLoading(false); return }
    setData(d); setLoading(false)
  }

  async function refund(userId: string) {
    if (!confirm("Refund this user? Their paid status will be revoked.")) return
    const res = await fetch("/api/admin/payments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action: "refund" }) })
    const d = await res.json()
    if (!res.ok) { alert(d.error || "Refund failed"); return }
    load()
  }

  const cur = data?.currency || "CHF"

  return (
    <AdminShell>
      <AdminTopBar title="Payments" subtitle="Revenue, transactions, and refunds" />
      {error ? <div style={S.errBox}>{error}<br /><small>Make sure your account role is ADMIN or SUPER_ADMIN.</small></div> : (
        <>
          <div style={S.statsGrid}>
            <div style={S.statCard}><div style={{ ...S.statNum, color: "#059669" }}>{data ? `${data.revenue} ${cur}` : "—"}</div><div style={S.statLabel}>Total revenue</div><div style={S.statSub}>{data?.fee} {cur} per member</div></div>
            <div style={S.statCard}><div style={{ ...S.statNum, color: "#0F6E56" }}>{data?.paidCount ?? "—"}</div><div style={S.statLabel}>Paying members</div><div style={S.statSub}>lifetime access</div></div>
            <div style={S.statCard}><div style={{ ...S.statNum, color: "#0891B2" }}>{data?.fee} {cur}</div><div style={S.statLabel}>Joining fee</div><div style={S.statSub}>set in Super Control</div></div>
          </div>

          <div style={S.toolbar}>
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search member name or email..." style={S.searchInput} />
          </div>

          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead><tr style={S.thead}>{["Member", "Email", "Role", "Payment ID", "Paid on", "Actions"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={S.empty}>Loading...</td></tr> :
                  (data?.payments?.length ?? 0) === 0 ? <tr><td colSpan={6} style={S.empty}>No payments yet.</td></tr> :
                    data.payments.map((p: any) => (
                      <tr key={p.id} style={S.tr}>
                        <td style={S.td}><span style={S.bold}>{p.name}</span></td>
                        <td style={S.td}><span style={S.muted}>{p.email}</span></td>
                        <td style={S.td}><span style={S.muted}>{p.role}</span></td>
                        <td style={S.td}><span style={S.mono}>{p.paymentId || "—"}</span></td>
                        <td style={S.td}><span style={S.muted}>{p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span></td>
                        <td style={S.td}><button onClick={() => refund(p.id)} style={S.dangerBtn}>Refund</button></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <div style={S.pagination}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={S.pageBtn}>← Prev</button>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={(data?.payments?.length ?? 0) < 20} style={S.pageBtn}>Next →</button>
          </div>
        </>
      )}
    </AdminShell>
  )
}

const S: Record<string, any> = {
  errBox: { margin: "2rem", background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 12, padding: "1.5rem", fontSize: 14, color: "#B91C1C", textAlign: "center" as const },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "rgba(0,0,0,.07)", borderBottom: "0.5px solid rgba(0,0,0,.07)" },
  statCard: { background: "#fff", padding: "1.25rem 1.5rem" },
  statNum: { fontSize: 28, fontWeight: 700, letterSpacing: "-1px" },
  statLabel: { fontSize: 13, fontWeight: 500, color: "#0A0A0F", marginTop: 3 },
  statSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  toolbar: { display: "flex", gap: 10, padding: "1rem 2rem", background: "#fff", borderBottom: "0.5px solid rgba(0,0,0,.06)" },
  searchInput: { flex: 1, maxWidth: 320, border: "0.5px solid rgba(0,0,0,.13)", borderRadius: 8, padding: "7px 12px", fontSize: 13, outline: "none" },
  tableWrap: { overflowX: "auto" as const },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  thead: { background: "#F9F9FC" },
  th: { padding: "10px 14px", textAlign: "left" as const, fontSize: 11, color: "#9ca3af", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: ".05em", borderBottom: "0.5px solid rgba(0,0,0,.07)", whiteSpace: "nowrap" as const },
  tr: { borderBottom: "0.5px solid rgba(0,0,0,.04)" },
  td: { padding: "11px 14px", verticalAlign: "middle" as const },
  bold: { fontSize: 13, fontWeight: 500, color: "#0A0A0F" },
  muted: { fontSize: 12, color: "#6b7280" },
  mono: { fontSize: 11, color: "#6b7280", fontFamily: "ui-monospace,Menlo,monospace" },
  empty: { padding: "2rem", textAlign: "center" as const, color: "#9ca3af" },
  dangerBtn: { background: "none", border: "0.5px solid rgba(220,38,38,.2)", color: "#DC2626", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" },
  pagination: { display: "flex", alignItems: "center", gap: 12, padding: "1rem 2rem", background: "#fff", borderTop: "0.5px solid rgba(0,0,0,.07)" },
  pageBtn: { background: "none", border: "0.5px solid rgba(0,0,0,.13)", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", color: "#3D3D4E" },
}
