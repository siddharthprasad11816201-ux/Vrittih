"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconAward, IconMonitor, IconActivity, IconBanknote, IconBookmark, IconCamera, IconShield, IconMessage } from "@/components/ui/Icons"

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  LEADERSHIP: <IconAward size={24} />,
  TECHNOLOGY: <IconMonitor size={24} />,
  HEALTHCARE: <IconActivity size={24} />,
  FINANCE: <IconBanknote size={24} />,
  EDUCATION: <IconBookmark size={24} />,
  MEDIA: <IconCamera size={24} />,
  LEGAL: <IconShield size={24} />,
  GENERAL: <IconMessage size={24} />,
}

type Tab = "spaces" | "jobs" | "pages"

export default function CommunityHub() {
  const [spaces, setSpaces] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("spaces")
  const [joining, setJoining] = useState<string|null>(null)
  const [me, setMe] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r=>r.json()),
      fetch("/api/community/spaces").then(r=>r.json()),
      fetch("/api/jobs?limit=20").then(r=>r.json()),
    ]).then(([meData, spacesData, jobsData]) => {
      setMe(meData.user)
      setSpaces(spacesData.spaces || [])
      setJobs(jobsData.jobs || [])
      setLoading(false)
    })
  }, [])

  async function toggleJoin(spaceId: string) {
    setJoining(spaceId)
    const res = await fetch(`/api/community/spaces/${spaceId}/join`, { method: "POST" })
    const data = await res.json()
    if (data.success) {
      setSpaces(prev => prev.map(s => s.id === spaceId ? {
        ...s,
        members: data.joined
          ? [...s.members, { userId: me?.id }]
          : s.members.filter((m: any) => m.userId !== me?.id),
        _count: { ...s._count, members: s._count.members + (data.joined ? 1 : -1) }
      } : s))
    }
    setJoining(null)
  }

  const isMember = (s: any) => s.members?.some((m: any) => m.userId === me?.id)
  const colors = ["#0F6E56","#059669","#0891B2","#B45309","#DC2626"]
  const getColor = (id: string) => colors[id?.charCodeAt(0)%colors.length||0]

  const TABS: { key: Tab; label: string }[] = [
    { key:"spaces", label:"Professional spaces" },
    { key:"jobs", label:"Job communities" },
    { key:"pages", label:"Professional pages" },
  ]

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <div>
              <h1 style={S.title}>Community</h1>
              <p style={S.sub}>Connect with professionals, ask questions, get hired — every job post has its own space</p>
            </div>
          </div>

          <div style={S.tabs}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{...S.tab,...(tab===t.key?S.tabOn:{})}}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? <div style={S.empty}><p style={{color:"#9ca3af"}}>Loading...</p></div> : (
            <>
              {tab === "spaces" && (
                <div style={S.grid}>
                  {spaces.map(s => (
                    <div key={s.id} style={S.card}>
                      <div style={S.cardTop}>
                        <div style={S.spaceIcon}>{CATEGORY_ICONS[s.category] || <IconMessage size={24} />}</div>
                        <div style={S.spaceInfo}>
                          <div style={S.spaceName}>
                            {s.name}
                            {s.verified && <span style={S.verifiedBadge}>✓ Verified</span>}
                          </div>
                          <div style={S.spaceMeta}>{s._count?.members || 0} members · {s._count?.posts || 0} posts</div>
                        </div>
                      </div>
                      {s.description && <p style={S.spaceDesc}>{s.description}</p>}
                      <div style={S.cardActions}>
                        <Link href={`/community/space/${s.id}`} style={S.viewBtn}>View space</Link>
                        <button
                          onClick={() => toggleJoin(s.id)}
                          disabled={joining === s.id}
                          style={{...S.joinBtn,...(isMember(s)?S.joinBtnOn:{})}}
                        >
                          {joining===s.id?"...":isMember(s)?"Joined":"Join"}
                        </button>
                      </div>
                    </div>
                  ))}
                  {spaces.length === 0 && <div style={{...S.empty,gridColumn:"1/-1"}}><p style={{color:"#9ca3af"}}>No spaces yet</p></div>}
                </div>
              )}

              {tab === "jobs" && (
                <div style={S.grid}>
                  {jobs.map(j => (
                    <div key={j.id} style={S.card}>
                      <div style={S.cardTop}>
                        <div style={{...S.jobLogo,background:getColor(j.id)}}>{j.company.slice(0,2).toUpperCase()}</div>
                        <div style={S.spaceInfo}>
                          <div style={S.spaceName}>{j.title}</div>
                          <div style={S.spaceMeta}>{j.company} · {j.location}</div>
                        </div>
                      </div>
                      <div style={S.jobTags}>
                        <span style={S.tag}>{j.type}</span>
                        <span style={S.tag}>{j.industry}</span>
                        {j.remote && <span style={S.tag}>Remote</span>}
                      </div>
                      <div style={S.cardActions}>
                        <Link href={`/community/job/${j.id}`} style={S.viewBtn}>Open community</Link>
                        <Link href={`/jobs/${j.id}`} style={S.secondBtn}>View job</Link>
                      </div>
                    </div>
                  ))}
                  {jobs.length === 0 && <div style={{...S.empty,gridColumn:"1/-1"}}><p style={{color:"#9ca3af"}}>No job communities yet</p></div>}
                </div>
              )}

              {tab === "pages" && (
                <div style={S.grid}>
                  <div style={{gridColumn:"1/-1",textAlign:"center" as const}}>
                    <Link href="/community/pages" style={{...S.viewBtn,display:"inline-block",padding:"10px 24px"}}>
                      View all professional pages →
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{ background:"#FAF8F2",minHeight:"calc(100vh - 60px)",padding:"2rem" },
  wrap:{ maxWidth:1100,margin:"0 auto" },
  header:{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1.5rem" },
  title:{ fontSize:22,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px" },
  sub:{ fontSize:13,color:"#7B7B8F",marginTop:4,maxWidth:520 },
  tabs:{ display:"flex",gap:4,marginBottom:"1.5rem",background:"#fff",padding:4,borderRadius:12,border:"0.5px solid rgba(0,0,0,.07)",width:"fit-content" },
  tab:{ padding:"7px 18px",borderRadius:9,border:"none",background:"none",fontSize:13,color:"#7B7B8F",cursor:"pointer" },
  tabOn:{ background:"#0F6E56",color:"#fff",fontWeight:500 },
  grid:{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12 },
  card:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.25rem",display:"flex",flexDirection:"column" as const,gap:10 },
  cardTop:{ display:"flex",gap:12,alignItems:"flex-start" },
  spaceIcon:{ flexShrink:0,width:52,height:52,display:"flex",alignItems:"center",justifyContent:"center",background:"#E1F5EE",color:"#0F6E56",borderRadius:12 },
  jobLogo:{ width:52,height:52,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",flexShrink:0 },
  spaceInfo:{ flex:1,minWidth:0 },
  spaceName:{ fontSize:15,fontWeight:600,color:"#0A0A0F",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const },
  verifiedBadge:{ fontSize:11,background:"#ECFDF5",color:"#047857",padding:"2px 8px",borderRadius:999,fontWeight:500 },
  spaceMeta:{ fontSize:12,color:"#9ca3af",marginTop:3 },
  spaceDesc:{ fontSize:13,color:"#7B7B8F",lineHeight:1.6 },
  jobTags:{ display:"flex",gap:6,flexWrap:"wrap" as const },
  tag:{ background:"#E1F5EE",color:"#0F6E56",fontSize:11,fontWeight:500,padding:"2px 9px",borderRadius:999 },
  cardActions:{ display:"flex",gap:8,marginTop:4 },
  viewBtn:{ flex:1,background:"#0F6E56",color:"#fff",padding:"8px 0",borderRadius:8,fontSize:13,fontWeight:500,textDecoration:"none",textAlign:"center" as const },
  secondBtn:{ flex:1,background:"none",border:"0.5px solid rgba(0,0,0,.12)",color:"#3D3D4E",padding:"8px 0",borderRadius:8,fontSize:13,textDecoration:"none",textAlign:"center" as const },
  joinBtn:{ padding:"8px 16px",borderRadius:8,border:"0.5px solid rgba(0,0,0,.12)",background:"none",color:"#3D3D4E",fontSize:13,cursor:"pointer",flexShrink:0 },
  joinBtnOn:{ background:"#E1F5EE",color:"#0F6E56",borderColor:"rgba(15,110,86,.2)" },
  empty:{ padding:"3rem",textAlign:"center" as const },
}