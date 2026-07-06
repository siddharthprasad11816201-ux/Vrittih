"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AdminShell, { AdminTopBar } from "@/components/admin/AdminShell"

export default function AdminJobs() {
  const [jobs, setJobs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
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
    const d = await fetch("/api/admin/jobs?" + params).then(r => r.json())
    if (d.error) { setError(d.error); setLoading(false); return }
    setJobs(d.jobs || []); setTotal(d.total || 0); setLoading(false)
  }

  async function toggleActive(jobId: string, active: boolean) {
    await fetch("/api/admin/jobs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, active }) })
    load()
  }

  async function deleteJob(jobId: string) {
    if (!confirm("Delete this job permanently? Applications attached to it will also be removed.")) return
    await fetch("/api/admin/jobs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) })
    load()
  }

  return (
    <AdminShell>
      <AdminTopBar title={<>Jobs <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 16 }}>({total})</span></>} subtitle="Moderate every job posting on the platform" />
      <div style={S.toolbar}>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search title or company..." style={S.searchInput} />
      </div>
      {error ? <div style={S.errBox}>{error}<br /><small>Make sure your account role is ADMIN or SUPER_ADMIN.</small></div> : (
        <>
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead><tr style={S.thead}>{["Title", "Company", "Industry", "Posted by", "Apps", "Status", "Posted", "Actions"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} style={S.empty}>Loading...</td></tr> :
                  jobs.length === 0 ? <tr><td colSpan={8} style={S.empty}>No jobs found.</td></tr> :
                    jobs.map(j => (
                      <tr key={j.id} style={S.tr}>
                        <td style={S.td}><Link href={`/jobs/${j.id}`} style={S.bold}>{j.title}</Link></td>
                        <td style={S.td}><span style={S.muted}>{j.company}</span></td>
                        <td style={S.td}><span style={S.muted}>{j.industry}</span></td>
                        <td style={S.td}><span style={S.muted}>{j.postedBy?.name}</span></td>
                        <td style={S.td}><span style={S.muted}>{j._count?.applications ?? 0}</span></td>
                        <td style={S.td}><span style={{ ...S.pill, background: j.active ? "#ECFDF5" : "#FEF2F2", color: j.active ? "#047857" : "#B91C1C" }}>{j.active ? "Active" : "Inactive"}</span></td>
                        <td style={S.td}><span style={S.muted}>{new Date(j.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</span></td>
                        <td style={S.td}>
                          <div style={S.actions}>
                            <button onClick={() => toggleActive(j.id, !j.active)} style={S.actBtn}>{j.active ? "Deactivate" : "Activate"}</button>
                            <button onClick={() => deleteJob(j.id)} style={S.dangerBtn}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          <div style={S.pagination}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={S.pageBtn}>← Prev</button>
            <span style={{ fontSize: 13, color: "#6b7280" }}>Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={jobs.length < 20} style={S.pageBtn}>Next →</button>
          </div>
        </>
      )}
    </AdminShell>
  )
}

const S: Record<string, any> = {
  toolbar: { display: "flex", gap: 10, padding: "1rem 2rem", background: "#fff", borderBottom: "0.5px solid rgba(0,0,0,.06)" },
  searchInput: { flex: 1, maxWidth: 320, border: "0.5px solid rgba(0,0,0,.13)", borderRadius: 8, padding: "7px 12px", fontSize: 13, outline: "none" },
  errBox: { margin: "2rem", background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 12, padding: "1.5rem", fontSize: 14, color: "#B91C1C", textAlign: "center" as const },
  tableWrap: { overflowX: "auto" as const },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  thead: { background: "#F9F9FC" },
  th: { padding: "10px 14px", textAlign: "left" as const, fontSize: 11, color: "#9ca3af", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: ".05em", borderBottom: "0.5px solid rgba(0,0,0,.07)", whiteSpace: "nowrap" as const },
  tr: { borderBottom: "0.5px solid rgba(0,0,0,.04)" },
  td: { padding: "11px 14px", verticalAlign: "middle" as const },
  bold: { fontSize: 13, fontWeight: 500, color: "#0A0A0F", textDecoration: "none" },
  muted: { fontSize: 12, color: "#6b7280" },
  pill: { fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999 },
  empty: { padding: "2rem", textAlign: "center" as const, color: "#9ca3af" },
  actions: { display: "flex", gap: 6, flexWrap: "wrap" as const },
  actBtn: { background: "#0F6E56", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 500 },
  dangerBtn: { background: "none", border: "0.5px solid rgba(220,38,38,.2)", color: "#DC2626", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" },
  pagination: { display: "flex", alignItems: "center", gap: 12, padding: "1rem 2rem", background: "#fff", borderTop: "0.5px solid rgba(0,0,0,.07)" },
  pageBtn: { background: "none", border: "0.5px solid rgba(0,0,0,.13)", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", color: "#3D3D4E" },
}
