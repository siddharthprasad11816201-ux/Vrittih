"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconActivity, IconMonitor, IconTarget, IconClipboard, IconFileText, IconClock, IconHelp, IconUsers, IconCheck } from "@/components/ui/Icons"

const TYPE_META: Record<string,{label:string,color:string,bg:string,icon:React.ReactNode}> = {
  APTITUDE:    { label:"Aptitude",    color:"#1D4ED8", bg:"#EFF4FF", icon:<IconActivity size={20} /> },
  TECHNICAL:   { label:"Technical",  color:"#047857", bg:"#ECFDF5", icon:<IconMonitor size={20} /> },
  PSYCHOMETRIC:{ label:"Personality",color:"#B45309", bg:"#FFFBEB", icon:<IconTarget size={20} /> },
  CODING:      { label:"Coding",     color:"#0F6E56", bg:"#E1F5EE", icon:<IconClipboard size={20} /> },
}

export default function TestsPage() {
  const [tests, setTests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r=>r.json()),
      fetch("/api/tests").then(r=>r.json()),
    ]).then(([meData, testsData]) => {
      setMe(meData.user)
      setTests(testsData.tests || [])
      setLoading(false)
    })
  }, [])

  const canCreate = me && ["EMPLOYER","ADMIN","SUPER_ADMIN"].includes(me.role)

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <div>
              <h1 style={S.title}>Assessments</h1>
              <p style={S.sub}>Complete tests to strengthen your profile and demonstrate your skills to employers</p>
            </div>
            {canCreate && <Link href="/tests/create" style={S.createBtn}>+ Create test</Link>}
          </div>

          {loading ? <div style={S.empty}><p style={{color:"#9ca3af"}}>Loading...</p></div> : (
            <div style={S.grid}>
              {tests.map(t => {
                const meta = TYPE_META[t.type] || { label:t.type,color:"#0F6E56",bg:"#E1F5EE",icon:<IconFileText size={20} /> }
                return (
                  <div key={t.id} style={S.card}>
                    <div style={S.cardTop}>
                      <span style={{...S.cardIcon,color:meta.color}}>{meta.icon}</span>
                      <span style={{...S.typePill,background:meta.bg,color:meta.color}}>{meta.label}</span>
                    </div>
                    <h3 style={S.cardTitle}>{t.title}</h3>
                    {t.description && <p style={S.cardDesc}>{t.description}</p>}
                    <div style={S.cardMeta}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:4}}><IconClock size={12} /> {t.duration} min</span>
                      <span style={{display:"inline-flex",alignItems:"center",gap:4}}><IconHelp size={12} /> {t._count?.questions} questions</span>
                      <span style={{display:"inline-flex",alignItems:"center",gap:4}}><IconUsers size={12} /> {t._count?.attempts} taken</span>
                      {t.passingScore > 0 && <span style={{display:"inline-flex",alignItems:"center",gap:4}}><IconCheck size={12} /> Pass: {t.passingScore}%</span>}
                    </div>
                    <Link href={`/tests/${t.id}`} style={S.startBtn}>Start assessment</Link>
                  </div>
                )
              })}
              {tests.length === 0 && (
                <div style={{...S.empty,gridColumn:"1/-1"}}>
                  <span style={{color:"#D1D5DB"}}><IconFileText size={38} /></span>
                  <p style={{fontSize:15,fontWeight:500,color:"#3D3D4E",marginTop:12}}>No assessments available yet</p>
                </div>
              )}
            </div>
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
  createBtn:{ background:"#0F6E56",color:"#fff",padding:"9px 18px",borderRadius:9,fontSize:13,fontWeight:500,textDecoration:"none" },
  grid:{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12 },
  card:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.5rem",display:"flex",flexDirection:"column" as const,gap:10 },
  cardTop:{ display:"flex",justifyContent:"space-between",alignItems:"center" },
  cardIcon:{ fontSize:28 },
  typePill:{ fontSize:12,fontWeight:500,padding:"3px 12px",borderRadius:999 },
  cardTitle:{ fontSize:16,fontWeight:600,color:"#0A0A0F" },
  cardDesc:{ fontSize:13,color:"#7B7B8F",lineHeight:1.6 },
  cardMeta:{ display:"flex",gap:12,fontSize:12,color:"#9ca3af",flexWrap:"wrap" as const },
  startBtn:{ background:"#0F6E56",color:"#fff",padding:"10px 0",borderRadius:9,fontSize:14,fontWeight:500,textDecoration:"none",textAlign:"center" as const,marginTop:4 },
  empty:{ display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:"4rem",background:"#fff",borderRadius:14,border:"0.5px solid rgba(0,0,0,.07)",textAlign:"center" as const },
}