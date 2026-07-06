"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconUser } from "@/components/ui/Icons"

export default function ProfessionalPagesHub() {
  const [pages, setPages] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [myPage, setMyPage] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r=>r.json()),
      fetch("/api/community/pages").then(r=>r.json()),
    ]).then(([meData, pagesData]) => {
      setMe(meData.user)
      setPages(pagesData.pages || [])
      const mine = pagesData.pages?.find((p: any) => p.userId === meData.user?.id)
      setMyPage(mine || null)
      setLoading(false)
    })
  }, [])

  async function follow(pageId: string) {
    await fetch(`/api/community/pages/${pageId}/follow`, { method: "POST" })
    const d = await fetch("/api/community/pages").then(r=>r.json())
    setPages(d.pages || [])
  }

  const initials = (name: string) => name?.split(" ").map((n:string)=>n[0]).join("").slice(0,2).toUpperCase()||"?"
  const colors = ["#534AB7","#059669","#0891B2","#B45309","#DC2626"]
  const getColor = (id: string) => colors[id?.charCodeAt(0)%colors.length||0]

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <div>
              <h1 style={S.title}>Professional Pages</h1>
              <p style={S.sub}>Follow industry leaders, founders, and professionals. Ask questions, learn, get hired.</p>
            </div>
            {me && !myPage && <Link href="/community/pages/create" style={S.createBtn}>+ Create your page</Link>}
            {myPage && <Link href={`/community/pages/${myPage.id}`} style={S.myPageBtn}>View my page →</Link>}
          </div>

          {loading ? <div style={S.empty}><p style={{color:"#9ca3af"}}>Loading...</p></div> : (
            <>
              {pages.length === 0 && (
                <div style={S.emptyState}>
                  <span style={{color:"#D1D5DB"}}><IconUser size={44} /></span>
                  <h2 style={{fontSize:18,fontWeight:600,color:"#3D3D4E",marginTop:12}}>No professional pages yet</h2>
                  <p style={{fontSize:14,color:"#9ca3af",marginTop:6}}>Be the first to create a professional page</p>
                  <Link href="/community/pages/create" style={{...S.createBtn,marginTop:"1rem",display:"inline-block"}}>Create page</Link>
                </div>
              )}
              <div style={S.grid}>
                {pages.map(page => {
                  const isFollowing = page.pageFollows?.length > 0
                  const isOwn = page.userId === me?.id
                  return (
                    <div key={page.id} style={S.card}>
                      <div style={S.cardTop}>
                        {page.user?.avatar
                          ? <img src={page.user.avatar} alt={page.user.name} style={S.avatar} />
                          : <div style={{...S.avatarFallback,background:getColor(page.userId)}}>{initials(page.user?.name)}</div>
                        }
                        {page.verified && <span style={S.verifiedBadge}>✓</span>}
                      </div>
                      <div style={S.cardName}>{page.user?.name}</div>
                      <div style={S.cardTitle2}>{page.title}</div>
                      {page.badge && <div style={S.badge}>{page.badge}</div>}
                      {page.bio && <p style={S.bio}>{page.bio.slice(0,80)}{page.bio.length>80?"...":""}</p>}
                      <div style={S.followers}>{page._count?.pageFollows||0} followers · {page._count?.pagePosts||0} posts</div>
                      <div style={S.cardActions}>
                        <Link href={`/community/pages/${page.id}`} style={S.viewBtn}>View page</Link>
                        {!isOwn && (
                          <button onClick={()=>follow(page.id)} style={{...S.followBtn,...(isFollowing?S.followBtnOn:{})}}>
                            {isFollowing?"Following":"Follow"}
                          </button>
                        )}
                        {isOwn && <span style={S.ownTag}>Your page</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{ background:"#F7F7FA",minHeight:"calc(100vh - 60px)",padding:"2rem" },
  wrap:{ maxWidth:1100,margin:"0 auto" },
  header:{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1.5rem" },
  title:{ fontSize:22,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px" },
  sub:{ fontSize:13,color:"#7B7B8F",marginTop:4,maxWidth:520 },
  createBtn:{ background:"#534AB7",color:"#fff",padding:"9px 18px",borderRadius:9,fontSize:13,fontWeight:500,textDecoration:"none" },
  myPageBtn:{ background:"#EEEDF9",color:"#534AB7",padding:"9px 18px",borderRadius:9,fontSize:13,fontWeight:500,textDecoration:"none",border:"0.5px solid rgba(83,74,183,.2)" },
  grid:{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12 },
  card:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.5rem",display:"flex",flexDirection:"column" as const,alignItems:"center",textAlign:"center" as const,gap:8,position:"relative" as const },
  cardTop:{ position:"relative" as const },
  avatar:{ width:72,height:72,borderRadius:"50%",objectFit:"cover" as const },
  avatarFallback:{ width:72,height:72,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:600,color:"#fff" },
  verifiedBadge:{ position:"absolute" as const,bottom:0,right:0,background:"#059669",color:"#fff",width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,border:"2px solid #fff" },
  cardName:{ fontSize:16,fontWeight:700,color:"#0A0A0F" },
  cardTitle2:{ fontSize:13,color:"#534AB7",fontWeight:500 },
  badge:{ background:"#EEEDF9",color:"#534AB7",fontSize:12,padding:"3px 12px",borderRadius:999,border:"0.5px solid rgba(83,74,183,.2)" },
  bio:{ fontSize:12,color:"#9ca3af",lineHeight:1.55 },
  followers:{ fontSize:12,color:"#9ca3af" },
  cardActions:{ display:"flex",gap:8,width:"100%",marginTop:4 },
  viewBtn:{ flex:1,background:"#534AB7",color:"#fff",padding:"8px 0",borderRadius:8,fontSize:13,fontWeight:500,textDecoration:"none",textAlign:"center" as const },
  followBtn:{ flex:1,background:"none",border:"0.5px solid rgba(0,0,0,.13)",color:"#3D3D4E",borderRadius:8,padding:"8px 0",fontSize:13,cursor:"pointer" },
  followBtnOn:{ background:"#EEEDF9",color:"#534AB7",border:"0.5px solid rgba(83,74,183,.2)" },
  ownTag:{ fontSize:12,color:"#9ca3af",padding:"8px 0" },
  emptyState:{ background:"#fff",borderRadius:14,padding:"3rem",textAlign:"center" as const,border:"0.5px solid rgba(0,0,0,.07)" },
  empty:{ padding:"3rem",textAlign:"center" as const },
}