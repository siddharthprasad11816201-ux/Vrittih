"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AdminShell from "@/components/admin/AdminShell"

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState("")
  const [role, setRole] = useState("")
  const [paid, setPaid] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string|null>(null)

  useEffect(() => { load() }, [q, role, paid, page])

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (role) params.set("role", role)
    if (paid) params.set("paid", paid)
    params.set("page", String(page))
    const d = await fetch("/api/admin/users?" + params).then(r => r.json())
    setUsers(d.users || []); setTotal(d.total || 0); setLoading(false)
  }

  async function action(userId: string, act: string) {
    setActing(userId + act)
    await fetch("/api/admin/users", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, action:act }) })
    setActing(null); load()
  }

  async function deleteUser(userId: string) {
    if (!confirm("Delete this user permanently?")) return
    await fetch("/api/admin/users", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId }) })
    load()
  }

  return (
    <AdminShell>
        <div style={S.topBar}>
          <div><h1 style={S.pageTitle}>Users <span style={{color:"#9ca3af",fontWeight:400,fontSize:16}}>({total})</span></h1></div>
        </div>
        <div style={S.toolbar}>
          <input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Search name or email..." style={S.searchInput} />
          <select value={role} onChange={e=>{setRole(e.target.value);setPage(1)}} style={S.sel}><option value="">All roles</option><option value="JOBSEEKER">Job seeker</option><option value="EMPLOYER">Employer</option><option value="ADMIN">Admin</option></select>
          <select value={paid} onChange={e=>{setPaid(e.target.value);setPage(1)}} style={S.sel}><option value="">All status</option><option value="true">Paid</option><option value="false">Unpaid</option></select>
        </div>
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr style={S.thead}>{["Name","Email","Role","Paid","Verified","Applications","Joined","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} style={{padding:"2rem",textAlign:"center",color:"#9ca3af"}}>Loading...</td></tr> :
              users.map(u=>(
                <tr key={u.id} style={S.tr}>
                  <td style={S.td}><span style={S.bold}>{u.name}</span></td>
                  <td style={S.td}><span style={S.muted}>{u.email}</span></td>
                  <td style={S.td}><span style={{...S.pill, background:u.role==="ADMIN"?"#FEF3C7":u.role==="EMPLOYER"?"#EFF4FF":"#EEEDF9", color:u.role==="ADMIN"?"#92400E":u.role==="EMPLOYER"?"#1D4ED8":"#534AB7"}}>{u.role}</span></td>
                  <td style={S.td}><span style={{...S.pill, background:u.paid?"#ECFDF5":"#FEF2F2", color:u.paid?"#047857":"#B91C1C"}}>{u.paid?"Yes":"No"}</span></td>
                  <td style={S.td}><span style={{...S.pill, background:u.idVerified?"#ECFDF5":"#F3F4F6", color:u.idVerified?"#047857":"#6b7280"}}>{u.idVerified?"Verified":"No"}</span></td>
                  <td style={S.td}><span style={S.muted}>{u._count?.applications||0}</span></td>
                  <td style={S.td}><span style={S.muted}>{new Date(u.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"2-digit"})}</span></td>
                  <td style={S.td}>
                    <div style={S.actions}>
                      {!u.paid && <button onClick={()=>action(u.id,"markPaid")} disabled={acting===u.id+"markPaid"} style={S.actBtn}>Mark paid</button>}
                      {!u.idVerified && <button onClick={()=>action(u.id,"verify")} disabled={acting===u.id+"verify"} style={S.actBtn}>Verify</button>}
                      {u.idVerified && <button onClick={()=>action(u.id,"unverify")} style={S.dangerBtn}>Unverify</button>}
                      <button onClick={()=>deleteUser(u.id)} style={S.dangerBtn}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={S.pagination}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={S.pageBtn}>← Prev</button>
          <span style={{fontSize:13,color:"#6b7280"}}>Page {page}</span>
          <button onClick={()=>setPage(p=>p+1)} disabled={users.length<20} style={S.pageBtn}>Next →</button>
        </div>
    </AdminShell>
  )
}

const S: Record<string,any> = {
  page:{ display:"grid",gridTemplateColumns:"220px 1fr",minHeight:"100vh",background:"#F7F7FA" },
  sidebar:{ background:"#0F0A1E",display:"flex",flexDirection:"column" as const,borderRight:"0.5px solid rgba(255,255,255,.06)" },
  brand:{ display:"flex",alignItems:"center",gap:10,padding:"1.25rem 1.5rem",borderBottom:"0.5px solid rgba(255,255,255,.06)" },
  brandMark:{ width:32,height:32,borderRadius:9,background:"#534AB7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 },
  brandText:{ fontSize:14,fontWeight:600,color:"#fff" },
  nav:{ padding:"1rem .75rem",flex:1,display:"flex",flexDirection:"column" as const,gap:2 },
  navLink:{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,fontSize:13,color:"rgba(255,255,255,.6)",textDecoration:"none" },
  navLinkOn:{ background:"rgba(83,74,183,.2)",color:"#B9B2E6" },
  sideBottom:{ padding:"1rem 1.5rem",borderTop:"0.5px solid rgba(255,255,255,.06)" },
  backLink:{ fontSize:13,color:"rgba(255,255,255,.4)",textDecoration:"none" },
  main:{ overflow:"auto" },
  topBar:{ padding:"1.5rem 2rem",background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  pageTitle:{ fontSize:20,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px" },
  toolbar:{ display:"flex",gap:10,padding:"1rem 2rem",background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,.06)" },
  searchInput:{ flex:1,maxWidth:320,border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"7px 12px",fontSize:13,outline:"none" },
  sel:{ border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"7px 10px",fontSize:13,background:"#fff",cursor:"pointer" },
  tableWrap:{ overflowX:"auto" as const },
  table:{ width:"100%",borderCollapse:"collapse" as const,fontSize:13 },
  thead:{ background:"#F9F9FC" },
  th:{ padding:"10px 14px",textAlign:"left" as const,fontSize:11,color:"#9ca3af",fontWeight:500,textTransform:"uppercase" as const,letterSpacing:".05em",borderBottom:"0.5px solid rgba(0,0,0,.07)",whiteSpace:"nowrap" as const },
  tr:{ borderBottom:"0.5px solid rgba(0,0,0,.04)",transition:"background .1s" },
  td:{ padding:"11px 14px",verticalAlign:"middle" as const },
  bold:{ fontSize:13,fontWeight:500,color:"#0A0A0F" },
  muted:{ fontSize:12,color:"#6b7280" },
  pill:{ fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:999 },
  actions:{ display:"flex",gap:6,flexWrap:"wrap" as const },
  actBtn:{ background:"#534AB7",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:500 },
  dangerBtn:{ background:"none",border:"0.5px solid rgba(220,38,38,.2)",color:"#DC2626",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer" },
  pagination:{ display:"flex",alignItems:"center",gap:12,padding:"1rem 2rem",background:"#fff",borderTop:"0.5px solid rgba(0,0,0,.07)" },
  pageBtn:{ background:"none",border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"6px 14px",fontSize:13,cursor:"pointer",color:"#3D3D4E" },
}