"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
const STATUSES = ["APPLIED","REVIEWED","SHORTLISTED","INTERVIEW","ASSESSMENT","OFFERED","HIRED","REJECTED"]
const STATUS_COLORS: Record<string, {bg:string,color:string}> = {
  APPLIED:{bg:"#E6F1FB",color:"#185FA5"}, REVIEWED:{bg:"#EDE9FE",color:"#5B21B6"},
  SHORTLISTED:{bg:"#DBEAFE",color:"#1E40AF"}, INTERVIEW:{bg:"#FEF3C7",color:"#92400E"},
  ASSESSMENT:{bg:"#FFE4E6",color:"#9F1239"}, OFFERED:{bg:"#D1FAE5",color:"#065F46"},
  HIRED:{bg:"#D1FAE5",color:"#065F46"}, REJECTED:{bg:"#FEE2E2",color:"#991B1B"},
}
function tier(s:number){ return s>=85?"#047857":s>=70?"#1D4ED8":s>=55?"#6D28D9":s>=40?"#B45309":"#6B7280" }
function tierBg(s:number){ return s>=85?"#ECFDF5":s>=70?"#EFF6FF":s>=55?"#F5F3FF":s>=40?"#FFFBEB":"#F3F4F6" }

export default function RecruiterDashboard() {
  const [jobs, setJobs] = useState<any[]>([])
  const [jobId, setJobId] = useState<string>("")
  const [pool, setPool] = useState<"applicants"|"all">("applicants")
  const [candidates, setCandidates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")

  useEffect(() => {
    fetch("/api/jobs?mine=true").then(r=>r.json()).then(d=>{
      const js = d.jobs || []
      setJobs(js)
      if (js.length) setJobId(js[0].id)
      else setLoading(false)
    }).catch(()=>{ setErr("Could not load your jobs"); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!jobId) return
    setLoading(true); setErr("")
    fetch(`/api/jobs/${jobId}/candidates?pool=${pool}`).then(r=>r.json()).then(d=>{
      if (d.error) setErr(d.error)
      else setCandidates(d.candidates || [])
      setLoading(false)
    }).catch(()=>{ setErr("Could not load candidates"); setLoading(false) })
  }, [jobId, pool])

  const selJob = jobs.find(j=>j.id===jobId)

  return (
    <AppShell>
      <div style={{maxWidth:"1000px",margin:"0 auto",padding:"1.5rem 2rem"}}>
        <div style={{marginBottom:"1.25rem"}}>
          <h1 style={{fontSize:"22px",fontWeight:600,letterSpacing:"-.01em"}}>Best candidates</h1>
          <p style={{fontSize:"13.5px",color:"#6b7280",marginTop:"3px"}}>Ranked by AI fit against the role — your applicants first, or source from the whole talent pool.</p>
        </div>

        {jobs.length === 0 && !loading ? (
          <div style={{background:"#fff",border:"1px solid #eee",borderRadius:"14px",padding:"3rem",textAlign:"center",color:"#6b7280"}}>
            <p style={{fontWeight:600,marginBottom:6}}>You haven&apos;t posted any jobs yet.</p>
            <Link href="/dashboard/post-job" style={{color:"#7C3AED",fontWeight:600}}>Post a job →</Link>
          </div>
        ) : (
          <>
            <div style={{display:"flex",gap:"12px",alignItems:"center",marginBottom:"1.25rem",flexWrap:"wrap"}}>
              <select value={jobId} onChange={e=>setJobId(e.target.value)}
                style={{border:"1px solid #e5e7eb",borderRadius:"10px",padding:"9px 12px",fontSize:"14px",minWidth:"260px",background:"#fff",cursor:"pointer"}}>
                {jobs.map(j=><option key={j.id} value={j.id}>{j.title} — {j.company}</option>)}
              </select>
              <div style={{display:"inline-flex",background:"#F3F4F6",borderRadius:"10px",padding:"3px"}}>
                {(["applicants","all"] as const).map(p=>(
                  <button key={p} onClick={()=>setPool(p)}
                    style={{border:"none",borderRadius:"8px",padding:"7px 14px",fontSize:"13px",fontWeight:600,cursor:"pointer",
                      background: pool===p?"#fff":"transparent", color: pool===p?"#111":"#6b7280",
                      boxShadow: pool===p?"0 1px 3px rgba(0,0,0,.08)":"none"}}>
                    {p==="applicants"?"Applicants":"Source all talent"}
                  </button>
                ))}
              </div>
              {selJob && <span style={{fontSize:"13px",color:"#9ca3af"}}>{candidates.length} candidate{candidates.length!==1?"s":""}</span>}
            </div>

            {err && <div style={{background:"#FEF2F2",border:"1px solid #FECACA",color:"#B91C1C",borderRadius:"10px",padding:"12px 14px",fontSize:"13px",marginBottom:"1rem"}}>{err}</div>}

            {loading ? (
              <div style={{background:"#fff",border:"1px solid #eee",borderRadius:"14px",padding:"3rem",textAlign:"center",color:"#9ca3af"}}>Ranking candidates…</div>
            ) : candidates.length === 0 ? (
              <div style={{background:"#fff",border:"1px solid #eee",borderRadius:"14px",padding:"3rem",textAlign:"center",color:"#6b7280"}}>
                {pool==="applicants" ? "No applicants yet — switch to “Source all talent” to find matches." : "No candidates found."}
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                {candidates.map((c,i)=>{
                  const s = c.match.score
                  const sc = STATUS_COLORS[c.status] || null
                  return (
                    <div key={c.userId} style={{background:"#fff",border:"1px solid #eee",borderRadius:"14px",padding:"1.1rem 1.3rem",display:"flex",gap:"14px",alignItems:"flex-start"}}>
                      <div style={{fontSize:"13px",fontWeight:700,color:"#9ca3af",width:"22px",textAlign:"center",paddingTop:"6px"}}>{i+1}</div>
                      <div style={{width:"44px",height:"44px",borderRadius:"11px",background:"linear-gradient(135deg,#F5F3FF,#EDE9FE)",border:"1px solid rgba(124,58,237,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",fontWeight:700,color:"#7C3AED",flexShrink:0}}>
                        {(c.name||"?").slice(0,2).toUpperCase()}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                          <span style={{fontSize:"15px",fontWeight:600,color:"#111"}}>{c.name}</span>
                          <span style={{display:"inline-flex",alignItems:"center",gap:"6px",background:tierBg(s),color:tier(s),padding:"3px 5px 3px 10px",borderRadius:"999px",fontSize:"11px",fontWeight:600}}>
                            {c.match.label} match
                            <span style={{background:tier(s),color:"#fff",padding:"2px 8px",borderRadius:"999px",fontWeight:700}}>{s}%</span>
                          </span>
                          {sc && <span style={{background:sc.bg,color:sc.color,padding:"3px 10px",borderRadius:"999px",fontSize:"11px",fontWeight:600}}>{c.status.charAt(0)+c.status.slice(1).toLowerCase()}</span>}
                        </div>
                        {c.headline && <div style={{fontSize:"13px",color:"#6b7280",marginTop:"3px"}}>{c.headline}{c.location?` · ${c.location}`:""}</div>}
                        {c.match.matchedSkills?.length>0 && (
                          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"9px"}}>
                            {c.match.matchedSkills.slice(0,8).map((sk:string)=>(
                              <span key={sk} style={{fontSize:"11.5px",color:"#374151",background:"#F3F4F6",border:"1px solid #eee",padding:"3px 9px",borderRadius:"6px"}}>{sk}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:"6px",alignItems:"flex-end"}}>
                        <Link href={`/messages`} style={{fontSize:"12.5px",fontWeight:600,color:"#7C3AED",whiteSpace:"nowrap"}}>Message →</Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
