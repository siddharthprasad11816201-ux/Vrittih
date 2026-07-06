"use client"
import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconAward, IconMonitor, IconActivity, IconBanknote, IconBookmark, IconCamera, IconShield, IconMessage } from "@/components/ui/Icons"

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  LEADERSHIP: <IconAward size={26} />,
  TECHNOLOGY: <IconMonitor size={26} />,
  HEALTHCARE: <IconActivity size={26} />,
  FINANCE: <IconBanknote size={26} />,
  EDUCATION: <IconBookmark size={26} />,
  MEDIA: <IconCamera size={26} />,
  LEGAL: <IconShield size={26} />,
  GENERAL: <IconMessage size={26} />,
}

export default function SpacePage() {
  const params = useParams()
  const id = params.id as string
  const [data, setData] = useState<any>(null)
  const [me, setMe] = useState<any>(null)
  const [input, setInput] = useState("")
  const [replyTo, setReplyTo] = useState<any>(null)
  const [replyInput, setReplyInput] = useState("")
  const [posting, setPosting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r=>r.json()),
      fetch(`/api/community/spaces/${id}`).then(r=>r.json()),
    ]).then(([meData, spaceData]) => {
      setMe(meData.user)
      setData(spaceData)
      setLoading(false)
    })
  }, [id])

  async function toggleJoin() {
    const res = await fetch(`/api/community/spaces/${id}/join`, { method: "POST" })
    const d = await res.json()
    if (d.success) {
      const updated = await fetch(`/api/community/spaces/${id}`).then(r=>r.json())
      setData(updated)
    }
  }

  async function post() {
    if (!input.trim() || posting) return
    setPosting(true)
    const res = await fetch(`/api/community/spaces/${id}/post`, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ content: input.trim() })
    })
    const d = await res.json()
    if (d.success) {
      setData((prev: any) => ({ ...prev, space: { ...prev.space, posts: [d.post, ...(prev.space?.posts||[])] } }))
      setInput("")
    }
    setPosting(false)
  }

  async function reply(postId: string) {
    if (!replyInput.trim()) return
    const res = await fetch(`/api/community/spaces/${id}/post`, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ content: replyInput.trim(), replyToId: postId })
    })
    const d = await res.json()
    if (d.success) {
      setData((prev: any) => ({
        ...prev, space: {
          ...prev.space,
          posts: prev.space.posts.map((p: any) => p.id === postId
            ? { ...p, replies: [...(p.replies||[]), d.reply] }
            : p)
        }
      }))
      setReplyInput(""); setReplyTo(null)
    }
  }

  const initials = (name: string) => name?.split(" ").map((n:string)=>n[0]).join("").slice(0,2).toUpperCase()||"?"
  const timeAgo = (iso: string) => { const m=Math.floor((Date.now()-new Date(iso).getTime())/60000); if(m<1)return "just now"; if(m<60)return `${m}m`; if(m<1440)return `${Math.floor(m/60)}h`; return `${Math.floor(m/1440)}d` }
  const colors = ["#534AB7","#059669","#0891B2","#B45309","#DC2626"]
  const getColor = (id: string) => colors[id?.charCodeAt(0)%colors.length||0]
  const roleColors: Record<string,string> = { SUPER_ADMIN:"#C026D3", ADMIN:"#534AB7", EMPLOYER:"#B45309", JOBSEEKER:"#059669" }

  if (loading) return <AppShell><div style={S.loading}>Loading space...</div></AppShell>
  if (!data?.space) return <AppShell><div style={S.loading}>Space not found</div></AppShell>

  const { space, isMember } = data

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <div style={S.headerLeft}>
              <div style={S.icon}>{CATEGORY_ICONS[space.category] || <IconMessage size={26} />}</div>
              <div>
                <div style={S.titleRow}>
                  <h1 style={S.title}>{space.name}</h1>
                  {space.verified && <span style={S.verified}>✓ Verified space</span>}
                </div>
                <div style={S.meta}>{space._count?.members} members · {space._count?.posts} posts · {space.category}</div>
                {space.description && <p style={S.desc}>{space.description}</p>}
              </div>
            </div>
            <div style={S.headerRight}>
              <Link href="/community" style={{fontSize:13,color:"#9ca3af",textDecoration:"none"}}>← All spaces</Link>
              <button onClick={toggleJoin} style={{...S.joinBtn,...(isMember?S.leaveBtn:{})}}>
                {isMember?"Leave space":"Join space"}
              </button>
            </div>
          </div>

          <div style={S.layout}>
            <div style={S.main}>
              {isMember && (
                <div style={S.compose}>
                  <div style={{...S.avatar,background:getColor(me?.id||"a")}}>{initials(me?.name||"?")}</div>
                  <div style={{flex:1}}>
                    <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Share something with this space..." style={S.textarea} rows={3} onKeyDown={e=>{if(e.key==="Enter"&&e.metaKey)post()}} />
                    <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                      <button onClick={post} disabled={!input.trim()||posting} style={S.postBtn}>{posting?"Posting...":"Post"}</button>
                    </div>
                  </div>
                </div>
              )}

              {!isMember && (
                <div style={S.joinPrompt}>
                  <span style={{color:"#534AB7"}}>{CATEGORY_ICONS[space.category] || <IconMessage size={20} />}</span>
                  <p style={{fontSize:14,color:"#3D3D4E",fontWeight:500}}>Join {space.name} to participate</p>
                  <button onClick={toggleJoin} style={S.joinBtn}>Join space</button>
                </div>
              )}

              <div style={S.posts}>
                {space.posts?.length === 0 && (
                  <div style={S.emptyPosts}><p style={{color:"#9ca3af",fontSize:14}}>No posts yet. Start the conversation!</p></div>
                )}
                {space.posts?.map((post: any) => (
                  <div key={post.id} style={S.post}>
                    <div style={{...S.avatar,background:getColor(post.userId)}}>{initials(post.user?.name)}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={S.postMeta}>
                        <span style={S.postName}>{post.user?.name}</span>
                        {post.user?.headline && <span style={{fontSize:12,color:"#9ca3af"}}>{post.user.headline}</span>}
                        {post.user?.role && <span style={{fontSize:11,fontWeight:500,padding:"1px 7px",borderRadius:999,background:"rgba(83,74,183,.08)",color:roleColors[post.user.role]||"#534AB7"}}>{post.user.role}</span>}
                        <span style={{fontSize:11,color:"#9ca3af",marginLeft:"auto"}}>{timeAgo(post.createdAt)}</span>
                      </div>
                      <div style={S.postContent}>{post.content}</div>
                      {post.replies?.map((r: any) => (
                        <div key={r.id} style={S.reply}>
                          <div style={{...S.avatar,width:26,height:26,fontSize:10,background:getColor(r.userId)}}>{initials(r.user?.name)}</div>
                          <div style={{flex:1}}>
                            <div style={S.postMeta}><span style={S.postName}>{r.user?.name}</span><span style={{fontSize:11,color:"#9ca3af"}}>{timeAgo(r.createdAt)}</span></div>
                            <div style={{...S.postContent,fontSize:13}}>{r.content}</div>
                          </div>
                        </div>
                      ))}
                      {isMember && (
                        replyTo?.id===post.id ? (
                          <div style={{display:"flex",gap:6,marginTop:10,alignItems:"center"}}>
                            <input value={replyInput} onChange={e=>setReplyInput(e.target.value)} placeholder="Reply..." style={{flex:1,border:"0.5px solid rgba(0,0,0,.1)",borderRadius:8,padding:"6px 10px",fontSize:13,outline:"none"}} onKeyDown={e=>{if(e.key==="Enter")reply(post.id)}} autoFocus />
                            <button onClick={()=>reply(post.id)} style={S.replyBtn}>Reply</button>
                            <button onClick={()=>setReplyTo(null)} style={{background:"none",border:"none",fontSize:12,color:"#9ca3af",cursor:"pointer"}}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={()=>setReplyTo(post)} style={{background:"none",border:"none",fontSize:12,color:"#9ca3af",cursor:"pointer",marginTop:8,padding:0}}>
                            Reply {post._count?.replies>0?`(${post._count.replies})`:""}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside style={S.sidebar}>
              <div style={S.sideCard}>
                <h3 style={S.sideTitle}>Members ({space._count?.members})</h3>
                {space.members?.slice(0,10).map((m: any) => (
                  <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <div style={{...S.avatar,width:30,height:30,fontSize:11,background:getColor(m.userId)}}>{initials(m.user?.name)}</div>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:"#0A0A0F"}}>{m.user?.name}</div>
                      {m.user?.headline && <div style={{fontSize:11,color:"#9ca3af"}}>{m.user.headline}</div>}
                    </div>
                    {m.role==="ADMIN" && <span style={{fontSize:10,color:"#534AB7",marginLeft:"auto",fontWeight:600}}>MOD</span>}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{ background:"#F7F7FA",minHeight:"calc(100vh - 60px)",padding:"2rem" },
  wrap:{ maxWidth:1100,margin:"0 auto" },
  loading:{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",fontSize:14,color:"#9ca3af" },
  header:{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.5rem",marginBottom:"1.25rem",flexWrap:"wrap" as const,gap:12 },
  headerLeft:{ display:"flex",gap:14,alignItems:"flex-start",flex:1 },
  icon:{ width:60,height:60,display:"flex",alignItems:"center",justifyContent:"center",background:"#EEEDF9",color:"#534AB7",borderRadius:14,flexShrink:0 },
  titleRow:{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const },
  title:{ fontSize:20,fontWeight:700,color:"#0A0A0F",letterSpacing:"-.3px" },
  verified:{ fontSize:12,background:"#ECFDF5",color:"#047857",padding:"3px 10px",borderRadius:999,fontWeight:500 },
  meta:{ fontSize:12,color:"#9ca3af",marginTop:4 },
  desc:{ fontSize:14,color:"#7B7B8F",marginTop:6,lineHeight:1.6 },
  headerRight:{ display:"flex",gap:10,alignItems:"center" },
  joinBtn:{ background:"#534AB7",color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",fontSize:13,fontWeight:500,cursor:"pointer" },
  leaveBtn:{ background:"#FEF2F2",color:"#B91C1C",border:"0.5px solid rgba(220,38,38,.2)" },
  layout:{ display:"grid",gridTemplateColumns:"1fr 260px",gap:"1.25rem" },
  main:{ display:"flex",flexDirection:"column" as const,gap:12 },
  compose:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.25rem",display:"flex",gap:12 },
  avatar:{ width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,color:"#fff",flexShrink:0 },
  textarea:{ width:"100%",border:"0.5px solid rgba(0,0,0,.1)",borderRadius:10,padding:"10px 12px",fontSize:14,fontFamily:"inherit",outline:"none",resize:"vertical" as const },
  postBtn:{ background:"#534AB7",color:"#fff",border:"none",borderRadius:8,padding:"7px 18px",fontSize:13,fontWeight:500,cursor:"pointer" },
  joinPrompt:{ background:"#EEEDF9",border:"0.5px solid rgba(83,74,183,.15)",borderRadius:12,padding:"1.5rem",display:"flex",flexDirection:"column" as const,alignItems:"center",gap:10,textAlign:"center" as const },
  posts:{ display:"flex",flexDirection:"column" as const,gap:8 },
  emptyPosts:{ background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center" as const },
  post:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.07)",borderRadius:12,padding:"1.1rem",display:"flex",gap:12 },
  postMeta:{ display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap" as const },
  postName:{ fontSize:14,fontWeight:600,color:"#0A0A0F" },
  postContent:{ fontSize:14,color:"#3D3D4E",lineHeight:1.72,wordBreak:"break-word" as const },
  reply:{ display:"flex",gap:8,marginTop:10,paddingLeft:12,borderLeft:"2px solid rgba(0,0,0,.06)" },
  replyBtn:{ background:"#534AB7",color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:500,cursor:"pointer",flexShrink:0 },
  sidebar:{ display:"flex",flexDirection:"column" as const,gap:12 },
  sideCard:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.1rem" },
  sideTitle:{ fontSize:14,fontWeight:600,color:"#0A0A0F",marginBottom:12,paddingBottom:8,borderBottom:"0.5px solid rgba(0,0,0,.06)" },
}