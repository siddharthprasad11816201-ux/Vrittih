"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AdminShell from "@/components/admin/AdminShell"
import { IconActivity } from "@/components/ui/Icons"

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/admin/stats").then(r => r.json()).then(d => {
      if (d.error) setError(d.error)
      else setStats(d)
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={S.loading}>Loading admin panel...</div>
  if (error) return <div style={S.loading}><div style={S.errBox}>{error}<br/><small>Make sure your account role is ADMIN</small></div></div>

  const STATS = [
    { label:"Total users", value:stats.totalUsers, sub:`${stats.paidUsers} paid`, color:"#7C3AED" },
    { label:"Revenue", value:`${stats.paidUsers} CHF`, sub:"1 CHF per user", color:"#059669" },
    { label:"Active jobs", value:stats.activeJobs, sub:`${stats.totalJobs} total`, color:"#B45309" },
    { label:"Applications", value:stats.totalApplications, sub:"all time", color:"#0891B2" },
    { label:"Messages", value:stats.totalMessages, sub:"sent total", color:"#7C3AED" },
  ]

  return (
    <AdminShell>
        <div style={S.topBar}>
          <div>
            <h1 style={S.pageTitle}>Overview</h1>
            <p style={S.pageSub}>Platform health at a glance</p>
          </div>
          <div style={{...S.liveTag,display:"inline-flex",alignItems:"center",gap:6}}><span style={{width:7,height:7,borderRadius:"50%",background:"#059669",display:"inline-block"}} /> Live</div>
        </div>

        <div style={S.statsGrid}>
          {STATS.map(s=>(
            <div key={s.label} style={S.statCard}>
              <div style={{...S.statNum, color:s.color}}>{s.value}</div>
              <div style={S.statLabel}>{s.label}</div>
              <div style={S.statSub}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={S.twoCol}>
          <div style={S.panel}>
            <div style={S.panelHead}><h2 style={S.panelTitle}>Recent users</h2><Link href="/admin/users" style={S.panelLink}>View all</Link></div>
            <table style={S.table}>
              <thead><tr>{["Name","Email","Role","Paid","Joined"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {stats.recentUsers.map((u: any)=>(
                  <tr key={u.id}>
                    <td style={S.td}><span style={S.userName}>{u.name}</span></td>
                    <td style={S.td}><span style={S.email}>{u.email}</span></td>
                    <td style={S.td}><span style={{...S.pill, background:u.role==="ADMIN"?"#FEF3C7":u.role==="EMPLOYER"?"#EFF4FF":"#F5F3FF", color:u.role==="ADMIN"?"#92400E":u.role==="EMPLOYER"?"#1D4ED8":"#7C3AED"}}>{u.role}</span></td>
                    <td style={S.td}><span style={{...S.pill, background:u.paid?"#ECFDF5":"#FEF2F2", color:u.paid?"#047857":"#B91C1C"}}>{u.paid?"Yes":"No"}</span></td>
                    <td style={S.td}><span style={S.email}>{new Date(u.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={S.panel}>
            <div style={S.panelHead}><h2 style={S.panelTitle}>Recent jobs</h2><Link href="/admin/jobs" style={S.panelLink}>View all</Link></div>
            <table style={S.table}>
              <thead><tr>{["Title","Company","Apps","Active"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {stats.recentJobs.map((j: any)=>(
                  <tr key={j.id}>
                    <td style={S.td}><span style={S.userName}>{j.title}</span></td>
                    <td style={S.td}><span style={S.email}>{j.company}</span></td>
                    <td style={S.td}><span style={S.email}>{j._count.applications}</span></td>
                    <td style={S.td}><span style={{...S.pill, background:j.active?"#ECFDF5":"#FEF2F2", color:j.active?"#047857":"#B91C1C"}}>{j.active?"Active":"Inactive"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
    </AdminShell>
  )
}

const S: Record<string,any> = {
  page: { display:"grid", gridTemplateColumns:"220px 1fr", minHeight:"100vh", background:"#F7F7FA" },
  loading: { display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", fontSize:14, color:"#9ca3af" },
  errBox: { background:"#FEF2F2", border:"0.5px solid #FECACA", borderRadius:12, padding:"1.5rem", fontSize:14, color:"#B91C1C", textAlign:"center" as const },
  sidebar: { background:"#0F0A1E", display:"flex", flexDirection:"column" as const, borderRight:"0.5px solid rgba(255,255,255,.06)" },
  brand: { display:"flex", alignItems:"center", gap:10, padding:"1.25rem 1.5rem", borderBottom:"0.5px solid rgba(255,255,255,.06)" },
  brandMark: { width:32, height:32, borderRadius:9, background:"#7C3AED", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 },
  brandText: { fontSize:14, fontWeight:600, color:"#fff" },
  nav: { padding:"1rem .75rem", flex:1, display:"flex", flexDirection:"column" as const, gap:2 },
  navLink: { display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, fontSize:13, color:"rgba(255,255,255,.6)", textDecoration:"none", transition:"all .15s" },
  sideBottom: { padding:"1rem 1.5rem", borderTop:"0.5px solid rgba(255,255,255,.06)" },
  backLink: { fontSize:13, color:"rgba(255,255,255,.4)", textDecoration:"none" },
  main: { padding:0, overflow:"auto" },
  topBar: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1.5rem 2rem", background:"#fff", borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  pageTitle: { fontSize:20, fontWeight:600, color:"#0A0A0F", letterSpacing:"-.3px" },
  pageSub: { fontSize:13, color:"#7B7B8F", marginTop:2 },
  liveTag: { background:"#ECFDF5", border:"0.5px solid #A7F3D0", borderRadius:999, padding:"4px 12px", fontSize:12, color:"#047857", fontWeight:500 },
  statsGrid: { display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:1, background:"rgba(0,0,0,.07)", borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  statCard: { background:"#fff", padding:"1.25rem 1.5rem" },
  statNum: { fontSize:28, fontWeight:700, letterSpacing:"-1px" },
  statLabel: { fontSize:13, fontWeight:500, color:"#0A0A0F", marginTop:3 },
  statSub: { fontSize:12, color:"#9ca3af", marginTop:2 },
  twoCol: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, background:"rgba(0,0,0,.07)", padding:0 },
  panel: { background:"#fff", padding:"1.5rem" },
  panelHead: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, paddingBottom:10, borderBottom:"0.5px solid rgba(0,0,0,.06)" },
  panelTitle: { fontSize:14, fontWeight:600, color:"#0A0A0F" },
  panelLink: { fontSize:12, color:"#7C3AED", textDecoration:"none" },
  table: { width:"100%", borderCollapse:"collapse" as const, fontSize:13 },
  th: { padding:"6px 8px", textAlign:"left" as const, fontSize:11, color:"#9ca3af", fontWeight:500, textTransform:"uppercase" as const, letterSpacing:".05em", borderBottom:"0.5px solid rgba(0,0,0,.06)" },
  td: { padding:"10px 8px", borderBottom:"0.5px solid rgba(0,0,0,.04)" },
  userName: { fontSize:13, fontWeight:500, color:"#0A0A0F" },
  email: { fontSize:12, color:"#6b7280" },
  pill: { fontSize:11, fontWeight:500, padding:"2px 8px", borderRadius:999 },
}