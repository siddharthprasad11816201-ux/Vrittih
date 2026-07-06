"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AdminShell from "@/components/admin/AdminShell"
import { IconInfo } from "@/components/ui/Icons"

export default function AdminGateway() {
  const [gateways, setGateways] = useState<any[]>([])
  const [testing, setTesting] = useState<string|null>(null)
  const [testResult, setTestResult] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/gateway").then(r=>r.json()).then(d=>{ setGateways(d.gateways||[]); setLoading(false) })
  }, [])

  async function gatewayAction(id: string, action: string) {
    const res = await fetch("/api/admin/gateway", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action, gatewayId:id }) })
    const d = await res.json()
    if (d.success) {
      setGateways(prev => prev.map(g => {
        if (action === "set_active") return { ...g, active: g.id === id }
        if (g.id === id) {
          if (action === "connect") return { ...g, connected:true }
          if (action === "disconnect") return { ...g, connected:false, active:false }
        }
        return g
      }))
    }
  }

  async function testGateway(id: string) {
    if (id !== "razorpay") { setTestResult(p=>({...p,[id]:{success:false,message:"Test only available for Razorpay"}})); return }
    setTesting(id)
    const res = await fetch("/api/payment/test-gateway", { method:"POST" })
    const d = await res.json()
    setTestResult(p=>({...p,[id]:d}))
    setTesting(null)
  }

  return (
    <AdminShell>
        <div style={S.topBar}>
          <div>
            <h1 style={S.pageTitle}>Payment Gateway Manager</h1>
            <p style={S.pageSub}>Connect, disconnect, switch, and test payment gateways</p>
          </div>
        </div>

        <div style={S.content}>
          <div style={S.notice}>
            <span style={{color:"#92400E",flexShrink:0}}><IconInfo size={17} /></span>
            <p style={{fontSize:13,color:"#92400E",lineHeight:1.55}}>Only one gateway can be active at a time. The active gateway processes all payments. Test before switching in production.</p>
          </div>

          {loading ? <p style={{color:"#9ca3af",padding:"2rem"}}>Loading...</p> :
          <div style={S.gwGrid}>
            {gateways.map(g=>(
              <div key={g.id} style={{...S.gwCard,...(g.active?S.gwCardActive:{})}}>
                <div style={S.gwTop}>
                  <div>
                    <div style={S.gwName}>{g.name}</div>
                    <div style={S.gwStatus}>
                      <span style={{...S.dot, background:g.connected?"#059669":"#9ca3af"}} />
                      {g.connected?"Connected":"Not connected"}
                    </div>
                  </div>
                  {g.active && <span style={S.activeBadge}>Active</span>}
                </div>

                {testResult[g.id] && (
                  <div style={{...S.testResult, background:testResult[g.id].success?"#ECFDF5":"#FEF2F2", color:testResult[g.id].success?"#047857":"#B91C1C"}}>
                    {testResult[g.id].success?"✓":"✗"} {testResult[g.id].message}
                  </div>
                )}

                <div style={S.gwActions}>
                  {!g.connected && <button onClick={()=>gatewayAction(g.id,"connect")} style={S.btnPrimary}>Connect</button>}
                  {g.connected && !g.active && <button onClick={()=>gatewayAction(g.id,"set_active")} style={S.btnPrimary}>Set active</button>}
                  {g.connected && <button onClick={()=>testGateway(g.id)} disabled={testing===g.id} style={S.btnOutline}>{testing===g.id?"Testing...":"Test"}</button>}
                  {g.connected && !g.active && <button onClick={()=>gatewayAction(g.id,"disconnect")} style={S.btnDanger}>Disconnect</button>}
                </div>
              </div>
            ))}
          </div>}
        </div>
    </AdminShell>
  )
}

const S: Record<string,any> = {
  page:{ display:"grid",gridTemplateColumns:"220px 1fr",minHeight:"100vh",background:"#F7F7FA" },
  sidebar:{ background:"#0F0A1E",display:"flex",flexDirection:"column" as const },
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
  pageSub:{ fontSize:13,color:"#7B7B8F",marginTop:3 },
  content:{ padding:"1.5rem 2rem" },
  notice:{ display:"flex",gap:10,background:"#FFFBEB",border:"0.5px solid #FCD34D",borderRadius:12,padding:"1rem 1.25rem",marginBottom:"1.5rem",alignItems:"flex-start" },
  gwGrid:{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12 },
  gwCard:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.5rem" },
  gwCardActive:{ border:"1.5px solid #534AB7",background:"rgba(83,74,183,.02)" },
  gwTop:{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12 },
  gwName:{ fontSize:16,fontWeight:600,color:"#0A0A0F",marginBottom:4 },
  gwStatus:{ display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#6b7280" },
  dot:{ width:7,height:7,borderRadius:"50%",flexShrink:0 },
  activeBadge:{ background:"#534AB7",color:"#fff",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:999 },
  testResult:{ fontSize:12,padding:"8px 12px",borderRadius:8,marginBottom:10 },
  gwActions:{ display:"flex",gap:8,flexWrap:"wrap" as const },
  btnPrimary:{ background:"#534AB7",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:500,cursor:"pointer" },
  btnOutline:{ background:"none",border:"0.5px solid rgba(0,0,0,.13)",color:"#3D3D4E",borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer" },
  btnDanger:{ background:"none",border:"0.5px solid rgba(220,38,38,.2)",color:"#DC2626",borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer" },
}