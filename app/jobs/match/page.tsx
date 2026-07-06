"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconTarget } from "@/components/ui/Icons"

export default function JobMatchPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(0)

  useEffect(() => {
    fetch("/api/jobs/match").then(r=>r.json()).then(d => {
      setJobs(d.jobs || [])
      setSkills(d.userSkills || [])
      setLoading(false)
    })
  }, [])

  const filtered = jobs.filter(j => j.matchScore >= filter)

  const getScoreColor = (score: number) => {
    if (score >= 70) return { bg:"#ECFDF5", color:"#047857", label:"Strong match" }
    if (score >= 40) return { bg:"#FFFBEB", color:"#B45309", label:"Good match" }
    return { bg:"#F3F4F6", color:"#6b7280", label:"Partial match" }
  }

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <div>
              <h1 style={S.title}>Matched for you</h1>
              <p style={S.sub}>Jobs ranked by how well they match your profile, skills, and location</p>
            </div>
            <Link href="/jobs" style={S.browseBtn}>Browse all jobs</Link>
          </div>

          {skills.length > 0 && (
            <div style={S.skillsBar}>
              <span style={S.skillsLabel}>Matching on:</span>
              {skills.slice(0,8).map(s => (
                <span key={s} style={S.skillChip}>{s}</span>
              ))}
              {skills.length > 8 && <span style={S.skillChip}>+{skills.length-8} more</span>}
              <Link href="/profile/edit" style={S.addSkillsBtn}>+ Add skills to improve matches</Link>
            </div>
          )}

          <div style={S.filterBar}>
            <span style={S.filterLabel}>Minimum match score:</span>
            {[0,30,50,70].map(v => (
              <button key={v} onClick={()=>setFilter(v)} style={{...S.filterBtn,...(filter===v?S.filterBtnOn:{})}}>
                {v === 0 ? "All" : `${v}%+`}
              </button>
            ))}
            <span style={{fontSize:13,color:"#9ca3af",marginLeft:"auto"}}>{filtered.length} jobs</span>
          </div>

          {loading ? (
            <div style={S.empty}><p style={{color:"#9ca3af"}}>Finding your best matches...</p></div>
          ) : filtered.length === 0 ? (
            <div style={S.empty}>
              <span style={{color:"#D1D5DB"}}><IconTarget size={38} /></span>
              <p style={{fontSize:15,fontWeight:500,color:"#3D3D4E",marginTop:12}}>No matches found</p>
              <p style={{fontSize:13,color:"#9ca3af",marginTop:4}}>Add more skills to your profile to improve matches</p>
              <Link href="/profile/edit" style={{...S.browseBtn,marginTop:"1rem",display:"inline-block"}}>Update profile</Link>
            </div>
          ) : (
            <div style={S.list}>
              {filtered.map((job, i) => {
                const sc = getScoreColor(job.matchScore)
                return (
                  <div key={job.id} style={S.card}>
                    <div style={S.cardLeft}>
                      <div style={S.rank}>#{i+1}</div>
                      <div style={S.jobLogo}>{job.company.slice(0,2).toUpperCase()}</div>
                      <div style={S.jobInfo}>
                        <div style={S.jobTitle}>{job.title}</div>
                        <div style={S.jobMeta}>{job.company} · {job.location} {job.remote&&"· Remote"}</div>
                        <div style={S.jobTags}>
                          <span style={S.tag}>{job.type}</span>
                          <span style={S.tag}>{job.industry}</span>
                          {job.salary && <span style={S.tag}>{job.salary}</span>}
                        </div>
                        {job.skills?.length > 0 && (
                          <div style={S.matchedSkills}>
                            {job.skills.slice(0,5).map((s: any) => {
                              const isMatched = skills.map(sk=>sk.toLowerCase()).includes(s.skill?.name?.toLowerCase())
                              return (
                                <span key={s.skillId} style={{...S.skillTag,...(isMatched?S.skillTagMatched:{})}}>
                                  {isMatched && "✓ "}{s.skill?.name}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={S.cardRight}>
                      <div style={{...S.scoreBadge,background:sc.bg,color:sc.color}}>
                        <div style={S.scoreNum}>{job.matchScore}%</div>
                        <div style={S.scoreLabel}>{sc.label}</div>
                      </div>
                      <Link href={`/jobs/${job.id}`} style={S.applyBtn}>View & apply</Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{ background:"#F7F7FA",minHeight:"calc(100vh - 60px)",padding:"2rem" },
  wrap:{ maxWidth:900,margin:"0 auto" },
  header:{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1.25rem" },
  title:{ fontSize:22,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px" },
  sub:{ fontSize:13,color:"#7B7B8F",marginTop:4 },
  browseBtn:{ background:"#534AB7",color:"#fff",padding:"9px 18px",borderRadius:9,fontSize:13,fontWeight:500,textDecoration:"none" },
  skillsBar:{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const,background:"#fff",border:"0.5px solid rgba(0,0,0,.07)",borderRadius:12,padding:"12px 16px",marginBottom:"1rem" },
  skillsLabel:{ fontSize:12,color:"#9ca3af",fontWeight:500 },
  skillChip:{ background:"#EEEDF9",color:"#534AB7",fontSize:12,padding:"3px 10px",borderRadius:999,border:"0.5px solid rgba(83,74,183,.15)" },
  addSkillsBtn:{ fontSize:12,color:"#534AB7",textDecoration:"none",marginLeft:"auto",fontWeight:500 },
  filterBar:{ display:"flex",alignItems:"center",gap:8,marginBottom:"1.25rem" },
  filterLabel:{ fontSize:13,color:"#9ca3af" },
  filterBtn:{ background:"none",border:"0.5px solid rgba(0,0,0,.12)",borderRadius:8,padding:"5px 14px",fontSize:13,cursor:"pointer",color:"#7B7B8F" },
  filterBtnOn:{ background:"#534AB7",color:"#fff",border:"0.5px solid #534AB7",fontWeight:500 },
  list:{ display:"flex",flexDirection:"column" as const,gap:10 },
  card:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.25rem",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16 },
  cardLeft:{ display:"flex",gap:12,flex:1,minWidth:0 },
  rank:{ fontSize:12,fontWeight:700,color:"#9ca3af",width:24,flexShrink:0,paddingTop:2 },
  jobLogo:{ width:44,height:44,borderRadius:10,background:"#534AB7",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,flexShrink:0 },
  jobInfo:{ flex:1,minWidth:0 },
  jobTitle:{ fontSize:15,fontWeight:600,color:"#0A0A0F",marginBottom:3 },
  jobMeta:{ fontSize:13,color:"#9ca3af",marginBottom:6 },
  jobTags:{ display:"flex",gap:6,flexWrap:"wrap" as const,marginBottom:8 },
  tag:{ background:"#F3F4F6",color:"#6b7280",fontSize:11,padding:"2px 8px",borderRadius:999 },
  matchedSkills:{ display:"flex",gap:6,flexWrap:"wrap" as const },
  skillTag:{ fontSize:11,padding:"2px 8px",borderRadius:999,background:"#F3F4F6",color:"#6b7280" },
  skillTagMatched:{ background:"#ECFDF5",color:"#047857",border:"0.5px solid #A7F3D0" },
  cardRight:{ display:"flex",flexDirection:"column" as const,alignItems:"center",gap:10,flexShrink:0 },
  scoreBadge:{ borderRadius:12,padding:"10px 16px",textAlign:"center" as const,minWidth:90 },
  scoreNum:{ fontSize:22,fontWeight:700 },
  scoreLabel:{ fontSize:11,marginTop:2 },
  applyBtn:{ background:"#534AB7",color:"#fff",padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:500,textDecoration:"none",whiteSpace:"nowrap" as const },
  empty:{ display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:"4rem",background:"#fff",borderRadius:14,border:"0.5px solid rgba(0,0,0,.07)",textAlign:"center" as const },
}