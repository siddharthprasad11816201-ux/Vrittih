"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconCalendar, IconClock, IconUsers, IconKey, IconVideo } from "@/components/ui/Icons"

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r=>r.json()),
      fetch("/api/interviews").then(r=>r.json()),
    ]).then(([meData, intData]) => {
      setMe(meData.user)
      setInterviews(intData.interviews || [])
      setLoading(false)
    })
  }, [])

  const now = new Date()
  const upcoming = interviews.filter(i => new Date(i.scheduledAt) > now)
  const past = interviews.filter(i => new Date(i.scheduledAt) <= now)

  const TYPE_LABELS: Record<string,string> = { ONE_ON_ONE:"1-on-1",PANEL:"Panel",GROUP:"Group",TECHNICAL:"Technical" }
  const STATUS_COLORS: Record<string,{bg:string,color:string}> = {
    SCHEDULED:{ bg:"#EFF4FF",color:"#6366F1" },
    LIVE:{ bg:"#ECFDF5",color:"#059669" },
    COMPLETED:{ bg:"#F3F4F6",color:"#6b7280" },
    CANCELLED:{ bg:"#FEF2F2",color:"#B91C1C" },
  }

  function InterviewCard({ interview }: { interview: any }) {
    const sc = STATUS_COLORS[interview.status] || STATUS_COLORS.SCHEDULED
    const isHost = interview.hostId === me?.id
    const isNow = Math.abs(new Date(interview.scheduledAt).getTime() - now.getTime()) < 30*60*1000
    return (
      <div style={S.card}>
        <div style={S.cardTop}>
          <div>
            <div style={S.cardTitle}>{interview.title}</div>
            <div style={S.cardMeta}>{TYPE_LABELS[interview.type]||interview.type} · {isHost?"You are hosting":"You are a participant"}</div>
          </div>
          <span style={{...S.pill,background:sc.bg,color:sc.color}}>{interview.status}</span>
        </div>
        <div style={S.cardInfo}>
          <span style={S.infoItem}><IconCalendar size={13} /> {new Date(interview.scheduledAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</span>
          <span style={S.infoItem}><IconClock size={13} /> {interview.duration} min</span>
          <span style={S.infoItem}><IconUsers size={13} /> {interview.participants?.length} participant{interview.participants?.length!==1?"s":""}</span>
          <span style={S.infoItem}><IconKey size={13} /> {interview.roomCode}</span>
        </div>
        <div style={S.cardActions}>
          <Link href={`/interviews/${interview.roomCode}`} style={{...S.joinBtn,...(!isNow&&interview.status==="COMPLETED"?S.joinBtnDisabled:{})}}>
            {interview.status==="COMPLETED"?"View room":"Join room"}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <div><h1 style={S.title}>Interviews</h1><p style={S.sub}>Your scheduled and past interview sessions</p></div>
            <Link href="/interviews/schedule" style={S.scheduleBtn}>+ Schedule interview</Link>
          </div>

          {loading ? <div style={S.empty}><p style={{color:"#9ca3af"}}>Loading...</p></div> : (
            <>
              {upcoming.length > 0 && (
                <div style={S.section}>
                  <div style={S.sectionTitle}>Upcoming</div>
                  <div style={S.list}>{upcoming.map(i=><InterviewCard key={i.id} interview={i}/>)}</div>
                </div>
              )}
              {past.length > 0 && (
                <div style={S.section}>
                  <div style={S.sectionTitle}>Past</div>
                  <div style={S.list}>{past.map(i=><InterviewCard key={i.id} interview={i}/>)}</div>
                </div>
              )}
              {interviews.length === 0 && (
                <div style={S.empty}>
                  <span style={{color:"#D1D5DB"}}><IconVideo size={44} /></span>
                  <p style={{fontSize:15,fontWeight:500,color:"#3D3D4E",marginTop:12}}>No interviews yet</p>
                  <p style={{fontSize:13,color:"#9ca3af",marginTop:4}}>Schedule your first interview session.</p>
                  <Link href="/interviews/schedule" style={{...S.scheduleBtn,marginTop:"1rem",display:"inline-block"}}>Schedule now</Link>
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
  page:{background:"#F7F7FA",minHeight:"calc(100vh - 60px)",padding:"2rem"},
  wrap:{maxWidth:800,margin:"0 auto"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1.5rem"},
  title:{fontSize:22,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px"},
  sub:{fontSize:13,color:"#7B7B8F",marginTop:3},
  scheduleBtn:{background:"#534AB7",color:"#fff",padding:"9px 18px",borderRadius:9,fontSize:13,fontWeight:500,textDecoration:"none"},
  section:{marginBottom:"2rem"},
  sectionTitle:{fontSize:12,fontWeight:600,color:"#9ca3af",textTransform:"uppercase" as const,letterSpacing:".08em",marginBottom:"1rem"},
  list:{display:"flex",flexDirection:"column" as const,gap:10},
  card:{background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.25rem 1.5rem"},
  cardTop:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10},
  cardTitle:{fontSize:16,fontWeight:600,color:"#0A0A0F"},
  cardMeta:{fontSize:13,color:"#7B7B8F",marginTop:3},
  pill:{fontSize:11,fontWeight:500,padding:"3px 10px",borderRadius:999},
  cardInfo:{display:"flex",gap:14,flexWrap:"wrap" as const,marginBottom:12},
  infoItem:{fontSize:12,color:"#9ca3af",display:"inline-flex",alignItems:"center",gap:5},
  cardActions:{display:"flex",gap:8},
  joinBtn:{background:"#534AB7",color:"#fff",padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:500,textDecoration:"none"},
  joinBtnDisabled:{background:"#9ca3af"},
  empty:{display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:"4rem",background:"#fff",borderRadius:14,border:"0.5px solid rgba(0,0,0,.07)",textAlign:"center" as const},
}