"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import Link from "next/link"

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/analytics").then(r=>r.json()).then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading) return <AppShell><div style={S.loading}>Loading analytics...</div></AppShell>
  if (!data) return <AppShell><div style={S.loading}>No data</div></AppShell>

  const STATUS_COLORS: Record<string,string> = {
    APPLIED:"#6366F1",REVIEWED:"#534AB7",SHORTLISTED:"#059669",
    INTERVIEW:"#B45309",ASSESSMENT:"#0891B2",OFFERED:"#16A34A",
    HIRED:"#047857",REJECTED:"#DC2626"
  }

  const maxBarVal = Math.max(...(data.appsByDay||[]).map((d:any)=>d.count),1)

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <h1 style={S.title}>Analytics</h1>
            <p style={S.sub}>{data.isEmployer ? "Your hiring performance" : "Your job search performance"}</p>
          </div>

          {/* Top stats */}
          <div style={S.statsGrid}>
            {data.isEmployer ? (
              <>
                <div style={S.statCard}><div style={S.statNum}>{data.jobs?.length||0}</div><div style={S.statLabel}>Total jobs</div></div>
                <div style={S.statCard}><div style={{...S.statNum,color:"#059669"}}>{data.totalApps||0}</div><div style={S.statLabel}>Total applicants</div></div>
                <div style={S.statCard}><div style={{...S.statNum,color:"#B45309"}}>{data.statusCounts?.INTERVIEW||0}</div><div style={S.statLabel}>Interviews</div></div>
                <div style={S.statCard}><div style={{...S.statNum,color:"#047857"}}>{data.statusCounts?.HIRED||0}</div><div style={S.statLabel}>Hired</div></div>
                <div style={S.statCard}>
                  <div style={{...S.statNum,color:"#534AB7"}}>
                    {data.totalApps > 0 ? Math.round(((data.statusCounts?.HIRED||0)/data.totalApps)*100) : 0}%
                  </div>
                  <div style={S.statLabel}>Hire rate</div>
                </div>
              </>
            ) : (
              <>
                <div style={S.statCard}><div style={S.statNum}>{data.total||0}</div><div style={S.statLabel}>Applications</div></div>
                <div style={S.statCard}><div style={{...S.statNum,color:"#534AB7"}}>{data.responseRate||0}%</div><div style={S.statLabel}>Response rate</div></div>
                <div style={S.statCard}><div style={{...S.statNum,color:"#B45309"}}>{data.statusCounts?.INTERVIEW||0}</div><div style={S.statLabel}>Interviews</div></div>
                <div style={S.statCard}><div style={{...S.statNum,color:"#059669"}}>{data.statusCounts?.OFFERED||0}</div><div style={S.statLabel}>Offers</div></div>
                <div style={S.statCard}><div style={{...S.statNum,color:"#047857"}}>{data.statusCounts?.HIRED||0}</div><div style={S.statLabel}>Hired</div></div>
              </>
            )}
          </div>

          <div style={S.twoCol}>
            {/* Activity chart */}
            <div style={S.panel}>
              <h2 style={S.panelTitle}>Activity — last 30 days</h2>
              <div style={S.chart}>
                {(data.appsByDay||[]).map((d:any,i:number) => (
                  <div key={i} style={S.barWrap}>
                    <div style={{...S.bar,height:`${Math.max(4,(d.count/maxBarVal)*100)}%`,background:d.count>0?"#534AB7":"#E5E7EB"}} title={`${d.day}: ${d.count}`} />
                    {i % 5 === 0 && <div style={S.barLabel}>{d.day.split(" ")[0]}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Funnel or status breakdown */}
            <div style={S.panel}>
              <h2 style={S.panelTitle}>{data.isEmployer ? "Hiring funnel" : "Application status"}</h2>
              {data.isEmployer ? (
                <div style={S.funnel}>
                  {(data.funnel||[]).map((f:any,i:number) => {
                    const pct = data.funnel[0].count > 0 ? (f.count/data.funnel[0].count)*100 : 0
                    return (
                      <div key={f.stage} style={S.funnelRow}>
                        <div style={S.funnelLabel}>{f.stage}</div>
                        <div style={S.funnelBarWrap}>
                          <div style={{...S.funnelBar,width:`${pct}%`,background:["#534AB7","#6366F1","#059669","#B45309","#16A34A","#047857"][i]}} />
                        </div>
                        <div style={S.funnelCount}>{f.count}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={S.statusList}>
                  {Object.entries(data.statusCounts||{}).map(([status,count]:any) => (
                    <div key={status} style={S.statusRow}>
                      <div style={{...S.statusDot,background:STATUS_COLORS[status]||"#9ca3af"}} />
                      <span style={S.statusName}>{status.charAt(0)+status.slice(1).toLowerCase()}</span>
                      <div style={S.statusBarWrap}>
                        <div style={{...S.statusBar,width:`${Math.round((count/data.total)*100)}%`,background:STATUS_COLORS[status]||"#9ca3af"}} />
                      </div>
                      <span style={S.statusCount}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Industry breakdown (job seekers) */}
          {!data.isEmployer && data.byIndustry && Object.keys(data.byIndustry).length > 0 && (
            <div style={S.panel}>
              <h2 style={S.panelTitle}>Applications by industry</h2>
              <div style={S.industryGrid}>
                {Object.entries(data.byIndustry).sort(([,a]:any,[,b]:any)=>b-a).map(([ind,count]:any) => (
                  <div key={ind} style={S.industryCard}>
                    <div style={S.industryCount}>{count}</div>
                    <div style={S.industryLabel}>{ind}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Employer job performance */}
          {data.isEmployer && data.jobs?.length > 0 && (
            <div style={S.panel}>
              <h2 style={S.panelTitle}>Job performance</h2>
              <table style={S.table}>
                <thead><tr style={S.thead}>{["Job","Applicants","Shortlisted","Hired","Conversion"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.jobs.map((j:any) => {
                    const total = j._count.applications
                    const shortlisted = j.applications.filter((a:any)=>["SHORTLISTED","INTERVIEW","OFFERED","HIRED"].includes(a.status)).length
                    const hired = j.applications.filter((a:any)=>a.status==="HIRED").length
                    const conv = total > 0 ? Math.round((hired/total)*100) : 0
                    return (
                      <tr key={j.id} style={S.tr}>
                        <td style={S.td}><Link href={`/jobs/${j.id}`} style={{color:"#534AB7",textDecoration:"none",fontSize:13,fontWeight:500}}>{j.title}</Link></td>
                        <td style={S.td}><span style={S.num}>{total}</span></td>
                        <td style={S.td}><span style={S.num}>{shortlisted}</span></td>
                        <td style={S.td}><span style={S.num}>{hired}</span></td>
                        <td style={S.td}><span style={{...S.num,color:conv>10?"#047857":conv>0?"#B45309":"#9ca3af"}}>{conv}%</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  loading:{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",fontSize:14,color:"#9ca3af" },
  page:{ background:"#F7F7FA",minHeight:"calc(100vh - 60px)",padding:"2rem" },
  wrap:{ maxWidth:1100,margin:"0 auto",display:"flex",flexDirection:"column" as const,gap:"1.25rem" },
  header:{},
  title:{ fontSize:22,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px" },
  sub:{ fontSize:13,color:"#7B7B8F",marginTop:4 },
  statsGrid:{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10 },
  statCard:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.07)",borderRadius:14,padding:"1.25rem" },
  statNum:{ fontSize:28,fontWeight:700,letterSpacing:"-1px",color:"#0A0A0F" },
  statLabel:{ fontSize:12,color:"#9ca3af",marginTop:4 },
  twoCol:{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1.25rem" },
  panel:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.07)",borderRadius:14,padding:"1.5rem" },
  panelTitle:{ fontSize:15,fontWeight:600,color:"#0A0A0F",marginBottom:"1.25rem" },
  chart:{ display:"flex",alignItems:"flex-end",gap:3,height:120,padding:"0 4px" },
  barWrap:{ flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",height:"100%" },
  bar:{ width:"100%",borderRadius:"3px 3px 0 0",transition:"height .3s",minHeight:4 },
  barLabel:{ fontSize:9,color:"#9ca3af",marginTop:2,whiteSpace:"nowrap" as const },
  funnel:{ display:"flex",flexDirection:"column" as const,gap:8 },
  funnelRow:{ display:"flex",alignItems:"center",gap:10 },
  funnelLabel:{ fontSize:12,color:"#7B7B8F",width:80,flexShrink:0 },
  funnelBarWrap:{ flex:1,background:"#F3F4F6",borderRadius:999,height:10,overflow:"hidden" },
  funnelBar:{ height:10,borderRadius:999,transition:"width .5s",minWidth:4 },
  funnelCount:{ fontSize:13,fontWeight:600,color:"#0A0A0F",width:30,textAlign:"right" as const },
  statusList:{ display:"flex",flexDirection:"column" as const,gap:10 },
  statusRow:{ display:"flex",alignItems:"center",gap:10 },
  statusDot:{ width:10,height:10,borderRadius:"50%",flexShrink:0 },
  statusName:{ fontSize:13,color:"#3D3D4E",width:90,flexShrink:0 },
  statusBarWrap:{ flex:1,background:"#F3F4F6",borderRadius:999,height:8,overflow:"hidden" },
  statusBar:{ height:8,borderRadius:999,transition:"width .5s" },
  statusCount:{ fontSize:13,fontWeight:600,color:"#0A0A0F",width:24,textAlign:"right" as const },
  industryGrid:{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8 },
  industryCard:{ background:"#EEEDF9",border:"0.5px solid rgba(83,74,183,.15)",borderRadius:10,padding:"12px",textAlign:"center" as const },
  industryCount:{ fontSize:22,fontWeight:700,color:"#534AB7" },
  industryLabel:{ fontSize:11,color:"#7B7B8F",marginTop:4 },
  table:{ width:"100%",borderCollapse:"collapse" as const,fontSize:13 },
  thead:{ background:"#F9F9FC" },
  th:{ padding:"8px 12px",textAlign:"left" as const,fontSize:11,color:"#9ca3af",fontWeight:500,textTransform:"uppercase" as const,letterSpacing:".05em",borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  tr:{ borderBottom:"0.5px solid rgba(0,0,0,.04)" },
  td:{ padding:"10px 12px" },
  num:{ fontSize:14,fontWeight:600,color:"#0A0A0F" },
}