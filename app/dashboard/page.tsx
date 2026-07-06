"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import {
  IconBriefcase, IconFileText, IconActivity, IconTarget, IconAward, IconCheckCircle,
  IconUsers, IconVideo, IconNetwork, IconMessage, IconSettings, IconClipboard,
  IconScan, IconShield, IconTrendingUp, IconArrowRight, IconCheck, IconLock, IconUser,
} from "@/components/ui/Icons"

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [applications, setApplications] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/me").then(r=>r.json()).then(d => {
      if (!d.user) { router.push("/login"); return }
      setUser(d.user)
      loadData(d.user)
    })
  }, [])

  async function loadData(u: any) {
    if (u.role === "EMPLOYER" || u.role === "ADMIN" || u.role === "SUPER_ADMIN") {
      const [jobsData, appsData] = await Promise.all([
        fetch("/api/jobs?mine=true").then(r=>r.json()),
        fetch("/api/applications?employer=true").then(r=>r.json()),
      ])
      setJobs(jobsData.jobs || [])
      setApplications(appsData.applications || [])
      const j = jobsData.jobs || []
      const a = appsData.applications || []
      setStats({
        totalJobs: j.length, activeJobs: j.filter((x:any)=>x.active).length,
        totalApplicants: a.length, hired: a.filter((x:any)=>x.status==="HIRED").length,
        shortlisted: a.filter((x:any)=>x.status==="SHORTLISTED").length,
        interviews: a.filter((x:any)=>x.status==="INTERVIEW").length,
      })
    } else {
      const appsData = await fetch("/api/applications").then(r=>r.json())
      const a = appsData.applications || []
      setApplications(a)
      setStats({
        total: a.length, active: a.filter((x:any)=>!["HIRED","REJECTED"].includes(x.status)).length,
        interviews: a.filter((x:any)=>x.status==="INTERVIEW").length,
        offers: a.filter((x:any)=>x.status==="OFFERED").length,
        hired: a.filter((x:any)=>x.status==="HIRED").length,
      })
    }
    setLoading(false)
  }

  const STATUS_COLOR: Record<string,{bg:string,color:string}> = {
    APPLIED:{bg:"#EFF4FF",color:"#1D4ED8"}, REVIEWED:{bg:"#EEEDF9",color:"#534AB7"},
    SHORTLISTED:{bg:"#ECFDF5",color:"#047857"}, INTERVIEW:{bg:"#FFFBEB",color:"#B45309"},
    ASSESSMENT:{bg:"#F0FDF4",color:"#16A34A"}, OFFERED:{bg:"#F0FDF4",color:"#059669"},
    HIRED:{bg:"#ECFDF5",color:"#047857"}, REJECTED:{bg:"#FEF2F2",color:"#B91C1C"},
  }
  const timeAgo = (iso: string) => {
    const d = Math.floor((Date.now()-new Date(iso).getTime())/86400000)
    return d===0 ? "Today" : d===1 ? "Yesterday" : `${d}d ago`
  }

  if (loading) return <AppShell title="Overview"><div style={S.loading}>Loading your workspace…</div></AppShell>

  const isEmployer = ["EMPLOYER","ADMIN","SUPER_ADMIN"].includes(user?.role)
  const first = user?.name?.split(" ")[0] || "there"
  const hour = new Date().getHours()
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })

  const steps = isEmployer ? [
    { done: !!(user?.headline && user?.location), title: "Complete your profile", desc: "Add a headline and location", href: "/profile/edit", icon: <IconUser size={16} /> },
    { done: !!user?.idVerified, title: "Verify your identity", desc: "Unlock full employer access", href: "/verify/doc-verify", icon: <IconShield size={16} /> },
    { done: jobs.length > 0, title: "Post your first job", desc: "Start receiving applicants", href: "/dashboard/post-job", icon: <IconBriefcase size={16} /> },
    { done: !!user?.twoFactorEnabled, title: "Turn on 2-factor security", desc: "Protect your account", href: "/settings", icon: <IconLock size={16} /> },
  ] : [
    { done: !!(user?.headline && user?.location), title: "Complete your profile", desc: "Add a headline and location", href: "/profile/edit", icon: <IconUser size={16} /> },
    { done: !!user?.idVerified, title: "Verify your identity", desc: "Stand out to employers", href: "/verify/doc-verify", icon: <IconShield size={16} /> },
    { done: applications.length > 0, title: "Apply to your first job", desc: "Browse matched roles", href: "/jobs", icon: <IconBriefcase size={16} /> },
    { done: !!user?.twoFactorEnabled, title: "Turn on 2-factor security", desc: "Protect your account", href: "/settings", icon: <IconLock size={16} /> },
  ]
  const doneCount = steps.filter(s => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)
  const showOnboarding = doneCount < steps.length

  const seekerStats = [
    { label:"Applications", val:stats?.total ?? 0, icon:<IconFileText size={16} />, color:"#534AB7" },
    { label:"Active", val:stats?.active ?? 0, icon:<IconActivity size={16} />, color:"#2563EB" },
    { label:"Interviews", val:stats?.interviews ?? 0, icon:<IconTarget size={16} />, color:"#B45309" },
    { label:"Offers", val:stats?.offers ?? 0, icon:<IconAward size={16} />, color:"#0891B2" },
    { label:"Hired", val:stats?.hired ?? 0, icon:<IconCheckCircle size={16} />, color:"#059669" },
  ]
  const employerStats = [
    { label:"Jobs posted", val:stats?.totalJobs ?? 0, icon:<IconBriefcase size={16} />, color:"#534AB7" },
    { label:"Active", val:stats?.activeJobs ?? 0, icon:<IconCheckCircle size={16} />, color:"#059669" },
    { label:"Applicants", val:stats?.totalApplicants ?? 0, icon:<IconUsers size={16} />, color:"#2563EB" },
    { label:"Shortlisted", val:stats?.shortlisted ?? 0, icon:<IconAward size={16} />, color:"#B45309" },
    { label:"Hired", val:stats?.hired ?? 0, icon:<IconTrendingUp size={16} />, color:"#0891B2" },
  ]
  const tiles = isEmployer ? employerStats : seekerStats

  return (
    <AppShell title="Overview">
      <div style={S.page}>
        <div style={S.wrap}>

          {/* Greeting */}
          <header style={S.head}>
            <div>
              <div style={S.kicker}>{today}</div>
              <h1 style={S.greeting}>Good {partOfDay}, <em style={S.greetingName}>{first}</em></h1>
              <p style={S.greetingSub}>{isEmployer ? "Here's what's happening with your hiring." : "Here's where your job search stands today."}</p>
            </div>
            <div style={S.headActions}>
              {isEmployer
                ? <Link href="/dashboard/post-job" style={S.primaryBtn}>Post a job <IconArrowRight size={15} /></Link>
                : <Link href="/jobs" style={S.primaryBtn}>Browse jobs <IconArrowRight size={15} /></Link>}
            </div>
          </header>

          {/* Stat tiles */}
          <div style={S.statRow}>
            {tiles.map(t => (
              <div key={t.label} style={S.tile}>
                <div style={S.tileTop}>
                  <span style={{...S.tileIcon, background:`${t.color}14`, color:t.color}}>{t.icon}</span>
                  <span style={S.tileLabel}>{t.label}</span>
                </div>
                <div style={S.tileNum}>{t.val}</div>
                <div style={{...S.tileBar, background:t.color, opacity: t.val ? 1 : 0.18}} />
              </div>
            ))}
          </div>

          <div style={S.grid}>
            {/* Left column */}
            <div style={S.col}>
              {showOnboarding && (
                <section style={S.onboard}>
                  <div style={S.onboardHead}>
                    <Ring pct={pct} />
                    <div>
                      <h2 style={S.onboardTitle}>{pct === 0 ? "Let's get you set up" : "Finish setting up"}</h2>
                      <p style={S.onboardSub}>{doneCount} of {steps.length} steps complete — a full profile gets {isEmployer ? "better applicants" : "seen by more employers"}.</p>
                    </div>
                  </div>
                  <div style={S.steps}>
                    {steps.map(s => (
                      <Link key={s.title} href={s.href} style={S.step}>
                        <span style={{...S.stepCheck, ...(s.done ? S.stepCheckDone : {})}}>
                          {s.done ? <IconCheck size={14} /> : s.icon}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{...S.stepTitle, ...(s.done ? { color: "#9A96A5", textDecoration: "line-through" } : {})}}>{s.title}</div>
                          <div style={S.stepDesc}>{s.desc}</div>
                        </div>
                        {!s.done && <IconArrowRight size={15} />}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Pipeline (active seekers) */}
              {!isEmployer && applications.length > 0 && (
                <section style={S.card}>
                  <div style={S.cardHead}>
                    <h2 style={S.cardTitle}>Application pipeline</h2>
                    <Link href="/dashboard/applications" style={S.link}>View all <IconArrowRight size={13} /></Link>
                  </div>
                  <div style={S.funnel}>
                    {["APPLIED","REVIEWED","SHORTLISTED","INTERVIEW","OFFERED","HIRED"].map(st => {
                      const count = applications.filter(a => a.status === st).length
                      const sc = STATUS_COLOR[st]
                      const max = Math.max(1, ...["APPLIED","REVIEWED","SHORTLISTED","INTERVIEW","OFFERED","HIRED"].map(x => applications.filter(a=>a.status===x).length))
                      return (
                        <div key={st} style={S.funnelRow}>
                          <span style={S.funnelLabel}>{st.charAt(0)+st.slice(1).toLowerCase()}</span>
                          <div style={S.funnelTrack}>
                            <div style={{...S.funnelFill, width:`${(count/max)*100}%`, background:sc.color, opacity: count?1:0}} />
                          </div>
                          <span style={{...S.funnelCount, color: count ? sc.color : "#C4C1CD"}}>{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Recent activity */}
              <section style={S.card}>
                <div style={S.cardHead}>
                  <h2 style={S.cardTitle}>{isEmployer ? "Recent applicants" : "Recent applications"}</h2>
                  <Link href={isEmployer?"/dashboard/recruiter":"/dashboard/applications"} style={S.link}>View all <IconArrowRight size={13} /></Link>
                </div>
                {applications.length === 0 ? (
                  <div style={S.empty}>
                    <span style={S.emptyIcon}><IconFileText size={22} /></span>
                    <p style={S.emptyTitle}>{isEmployer ? "No applicants yet" : "No applications yet"}</p>
                    <p style={S.emptySub}>{isEmployer ? "Post a job to start receiving candidates." : "Apply to a role and track it here in real time."}</p>
                    <Link href={isEmployer ? "/dashboard/post-job" : "/jobs"} style={S.emptyBtn}>{isEmployer ? "Post a job" : "Browse jobs"}</Link>
                  </div>
                ) : (
                  <div>
                    {applications.slice(0,6).map(a => {
                      const sc = STATUS_COLOR[a.status] || STATUS_COLOR.APPLIED
                      return (
                        <div key={a.id} style={S.appRow}>
                          <div style={{...S.appDot, background:sc.color}} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={S.appTitle}>{isEmployer ? a.user?.name : a.job?.title}</div>
                            <div style={S.appSub}>{(isEmployer ? a.job?.title : a.job?.company) || ""} · {timeAgo(a.appliedAt || a.updatedAt)}</div>
                          </div>
                          <span style={{...S.pill, background:sc.bg, color:sc.color}}>{a.status.charAt(0)+a.status.slice(1).toLowerCase()}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {isEmployer && jobs.length > 0 && (
                <section style={S.card}>
                  <div style={S.cardHead}>
                    <h2 style={S.cardTitle}>Your job posts</h2>
                    <Link href="/dashboard/post-job" style={S.link}>New job <IconArrowRight size={13} /></Link>
                  </div>
                  {jobs.slice(0,5).map(j => (
                    <div key={j.id} style={S.appRow}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.appTitle}>{j.title}</div>
                        <div style={S.appSub}>{j.company} · {j.location} · {j._count?.applications||0} applicants</div>
                      </div>
                      <span style={{...S.pill, background:j.active?"#ECFDF5":"#F3F4F6", color:j.active?"#047857":"#6b7280"}}>{j.active?"Active":"Inactive"}</span>
                      <Link href={`/jobs/${j.id}`} style={S.link}>View</Link>
                    </div>
                  ))}
                </section>
              )}
            </div>

            {/* Right column: quick access */}
            <aside style={S.card}>
              <div style={S.cardHead}><h2 style={S.cardTitle}>Quick access</h2></div>
              <div style={S.quick}>
                {(isEmployer ? [
                  { href:"/dashboard/post-job", icon:<IconFileText size={16} />, title:"Post a job", desc:"Create a listing" },
                  { href:"/dashboard/recruiter", icon:<IconUsers size={16} />, title:"Best candidates", desc:"AI-ranked applicants" },
                  { href:"/interviews/schedule", icon:<IconVideo size={16} />, title:"Schedule interview", desc:"Video, panel or group" },
                  { href:"/tests/create", icon:<IconClipboard size={16} />, title:"Create assessment", desc:"Skill & aptitude tests" },
                  { href:"/contacts", icon:<IconUsers size={16} />, title:"CRM", desc:"Contacts & pipeline" },
                  { href:"/settings", icon:<IconSettings size={16} />, title:"Settings", desc:"Security & billing" },
                ] : [
                  { href:"/jobs", icon:<IconBriefcase size={16} />, title:"Find jobs", desc:"Ranked by your fit" },
                  { href:"/jobs/match", icon:<IconTarget size={16} />, title:"Matched for you", desc:"Best-fit roles" },
                  { href:"/interviews", icon:<IconVideo size={16} />, title:"Interviews", desc:"Your scheduled calls" },
                  { href:"/tests", icon:<IconClipboard size={16} />, title:"Assessments", desc:"Prove your skills" },
                  { href:"/network", icon:<IconNetwork size={16} />, title:"Network", desc:"Connect & grow" },
                  { href:"/resume", icon:<IconFileText size={16} />, title:"Résumé", desc:"Build & export" },
                ]).map(item => (
                  <Link key={item.href} href={item.href} style={S.quickRow}>
                    <span style={S.quickIcon}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={S.quickTitle}>{item.title}</div>
                      <div style={S.quickDesc}>{item.desc}</div>
                    </div>
                    <IconArrowRight size={14} />
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function Ring({ pct }: { pct: number }) {
  const size = 78, sw = 8, r = (size - sw) / 2, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EDEBF6" strokeWidth={sw} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#534AB7" strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct/100)} transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={19} fontWeight={700} fill="#16151D" fontFamily="'Iowan Old Style', Palatino, Georgia, serif">{pct}%</text>
    </svg>
  )
}

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif"
const S: Record<string,any> = {
  page:{ background:"#F5F5F8", minHeight:"calc(100vh - 60px)", padding:"2.25rem 2rem 3rem" },
  wrap:{ maxWidth:1140, margin:"0 auto", display:"flex", flexDirection:"column" as const, gap:"1.5rem" },
  loading:{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh", fontSize:14, color:"#9A96A5" },

  head:{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap" as const, gap:14 },
  kicker:{ fontSize:12, fontWeight:600, color:"#9A96A5", textTransform:"uppercase" as const, letterSpacing:".08em", marginBottom:8 },
  greeting:{ fontFamily:SERIF, fontSize:32, fontWeight:600, color:"#16151D", letterSpacing:"-.02em", lineHeight:1.1 },
  greetingName:{ fontStyle:"italic", color:"#443AA3" },
  greetingSub:{ fontSize:15, color:"#57545F", marginTop:7 },
  headActions:{ display:"flex", gap:10 },
  primaryBtn:{ display:"inline-flex", alignItems:"center", gap:8, background:"#16151D", color:"#fff", padding:"12px 20px", borderRadius:10, fontSize:14, fontWeight:600, textDecoration:"none", boxShadow:"0 4px 14px rgba(20,19,29,.15)" },

  statRow:{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12 },
  tile:{ background:"#fff", border:"1px solid #ECEBF1", borderRadius:14, padding:"16px 18px", display:"flex", flexDirection:"column" as const, gap:10 },
  tileTop:{ display:"flex", alignItems:"center", gap:9 },
  tileIcon:{ width:30, height:30, borderRadius:8, display:"grid", placeItems:"center", flexShrink:0 },
  tileLabel:{ fontSize:12, fontWeight:600, color:"#8E8B99", textTransform:"uppercase" as const, letterSpacing:".03em" },
  tileNum:{ fontFamily:SERIF, fontSize:34, fontWeight:600, color:"#16151D", letterSpacing:"-.02em", lineHeight:1, fontVariantNumeric:"tabular-nums" as const },
  tileBar:{ height:3, borderRadius:2, width:"100%" },

  grid:{ display:"grid", gridTemplateColumns:"1fr 340px", gap:"1.5rem", alignItems:"start" },
  col:{ display:"flex", flexDirection:"column" as const, gap:"1.5rem" },

  onboard:{ background:"linear-gradient(135deg,#FBFAFF,#F4F1FE)", border:"1px solid #E7E1FB", borderRadius:16, padding:"1.5rem" },
  onboardHead:{ display:"flex", alignItems:"center", gap:18, marginBottom:18 },
  onboardTitle:{ fontFamily:SERIF, fontSize:21, fontWeight:600, color:"#16151D", letterSpacing:"-.01em" },
  onboardSub:{ fontSize:13.5, color:"#57545F", marginTop:4, maxWidth:"40ch" },
  steps:{ display:"flex", flexDirection:"column" as const, gap:8 },
  step:{ display:"flex", alignItems:"center", gap:13, background:"#fff", border:"1px solid #ECEAF3", borderRadius:11, padding:"12px 14px", textDecoration:"none", transition:"border-color .12s, transform .12s" },
  stepCheck:{ width:32, height:32, borderRadius:9, background:"#F4F1FE", color:"#534AB7", display:"grid", placeItems:"center", flexShrink:0 },
  stepCheckDone:{ background:"#059669", color:"#fff" },
  stepTitle:{ fontSize:14, fontWeight:600, color:"#16151D" },
  stepDesc:{ fontSize:12.5, color:"#8E8B99", marginTop:1 },

  card:{ background:"#fff", border:"1px solid #ECEBF1", borderRadius:16, padding:"1.35rem 1.5rem" },
  cardHead:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 },
  cardTitle:{ fontSize:16, fontWeight:650, color:"#16151D", letterSpacing:"-.01em" },
  link:{ display:"inline-flex", alignItems:"center", gap:4, fontSize:13, color:"#443AA3", textDecoration:"none", fontWeight:600 },

  funnel:{ display:"flex", flexDirection:"column" as const, gap:11 },
  funnelRow:{ display:"flex", alignItems:"center", gap:12 },
  funnelLabel:{ fontSize:12.5, color:"#57545F", width:82, flexShrink:0 },
  funnelTrack:{ flex:1, height:9, background:"#F1F0F5", borderRadius:5, overflow:"hidden" },
  funnelFill:{ height:9, borderRadius:5, transition:"width .5s ease" },
  funnelCount:{ fontSize:13, fontWeight:700, width:24, textAlign:"right" as const, fontVariantNumeric:"tabular-nums" as const },

  empty:{ textAlign:"center" as const, padding:"1.5rem 0 0.5rem" },
  emptyIcon:{ display:"grid", placeItems:"center", width:52, height:52, borderRadius:14, background:"#F4F1FE", color:"#534AB7", margin:"0 auto 12px" },
  emptyTitle:{ fontSize:15, fontWeight:650, color:"#16151D" },
  emptySub:{ fontSize:13, color:"#8E8B99", marginTop:4, maxWidth:"34ch", marginLeft:"auto", marginRight:"auto" },
  emptyBtn:{ display:"inline-block", marginTop:14, background:"#16151D", color:"#fff", padding:"9px 18px", borderRadius:9, fontSize:13, fontWeight:600, textDecoration:"none" },

  appRow:{ display:"flex", alignItems:"center", gap:12, padding:"11px 0", borderTop:"1px solid #F3F2F7" },
  appDot:{ width:8, height:8, borderRadius:"50%", flexShrink:0 },
  appTitle:{ fontSize:14, fontWeight:600, color:"#16151D", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const },
  appSub:{ fontSize:12.5, color:"#8E8B99", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const },
  pill:{ fontSize:11.5, fontWeight:600, padding:"4px 11px", borderRadius:999, flexShrink:0 },

  quick:{ display:"flex", flexDirection:"column" as const, gap:6 },
  quickRow:{ display:"flex", alignItems:"center", gap:12, padding:"11px 12px", borderRadius:11, textDecoration:"none", color:"#8E8B99", transition:"background .12s" },
  quickIcon:{ width:34, height:34, borderRadius:9, background:"#F4F1FE", color:"#443AA3", display:"grid", placeItems:"center", flexShrink:0 },
  quickTitle:{ fontSize:13.5, fontWeight:600, color:"#16151D" },
  quickDesc:{ fontSize:12, color:"#8E8B99", marginTop:1 },
}
