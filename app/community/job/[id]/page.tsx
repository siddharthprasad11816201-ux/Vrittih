"use client"
import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconMessage } from "@/components/ui/Icons"

export default function JobCommunityPage() {
  const params = useParams()
  const id = params.id as string
  const [data, setData] = useState<any>(null)
  const [me, setMe] = useState<any>(null)
  const [input, setInput] = useState("")
  const [replyTo, setReplyTo] = useState<any>(null)
  const [replyInput, setReplyInput] = useState("")
  const [posting, setPosting] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r=>r.json()),
      fetch(`/api/community/job/${id}`).then(r=>r.json()),
    ]).then(([meData, comData]) => {
      setMe(meData.user)
      setData(comData)
      setLoading(false)
    })
  }, [id])

  async function join() {
    await fetch(`/api/community/job/${id}`, { method: "POST" })
    const d = await fetch(`/api/community/job/${id}`).then(r=>r.json())
    setData(d)
  }

  async function post() {
    if (!input.trim() || posting) return
    setPosting(true)
    const res = await fetch(`/api/community/job/${id}/post`, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ content: input.trim() })
    })
    const d = await res.json()
    if (d.success) {
      setData((prev: any) => ({ ...prev, community: { ...prev.community, posts: [d.post, ...(prev.community?.posts||[])] } }))
      setInput("")
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
    }
    setPosting(false)
  }

  async function reply(postId: string) {
    if (!replyInput.trim()) return
    const res = await fetch(`/api/community/job/${id}/post`, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ content: replyInput.trim(), replyToId: postId })
    })
    const d = await res.json()
    if (d.success) {
      setData((prev: any) => ({
        ...prev, community: {
          ...prev.community,
          posts: prev.community.posts.map((p: any) => p.id === postId
            ? { ...p, replies: [...(p.replies||[]), d.reply], _count: { replies: (p._count?.replies||0)+1 } }
            : p)
        }
      }))
      setReplyInput(""); setReplyTo(null)
    }
  }

  const initials = (name: string) => name?.split(" ").map((n:string)=>n[0]).join("").slice(0,2).toUpperCase()||"?"
  const timeAgo = (iso: string) => { const m=Math.floor((Date.now()-new Date(iso).getTime())/60000); if(m<1)return "just now"; if(m<60)return `${m}m`; if(m<1440)return `${Math.floor(m/60)}h`; return `${Math.floor(m/1440)}d` }
  const colors = ["#0F6E56","#059669","#0891B2","#B45309","#DC2626"]
  const getColor = (id: string) => colors[id?.charCodeAt(0)%colors.length||0]

  if (loading) return <AppShell><div style={S.loading}>Loading community...</div></AppShell>
  if (!data?.community) return <AppShell><div style={S.loading}>Community not found</div></AppShell>

  const { community, isMember } = data
  const job = community.job

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          {/* Header */}
          <div style={S.header}>
            <div style={S.headerLeft}>
              <div style={{...S.logo,background:getColor(job?.id||"a")}}>{job?.company?.slice(0,2).toUpperCase()}</div>
              <div>
                <h1 style={S.title}>{community.name}</h1>
                <div style={S.meta}>
                  {job?.location} · {job?.type} · {community._count?.members} members · {community._count?.posts} posts
                </div>
                {community.description && <p style={S.desc}>{community.description}</p>}
              </div>
            </div>
            <div style={S.headerRight}>
              <Link href={`/jobs/${job?.id}`} style={S.jobLink}>View job listing →</Link>
              {!isMember && <button onClick={join} style={S.joinBtn}>Join community</button>}
              {isMember && <span style={S.joinedTag}>✓ Joined</span>}
            </div>
          </div>

          <div style={S.layout}>
            {/* Posts */}
            <div style={S.main}>
              {isMember && (
                <div style={S.compose}>
                  <div style={{...S.composeAvatar,background:getColor(me?.id||"a")}}>{initials(me?.name||"?")}</div>
                  <div style={S.composeInput}>
                    <textarea
                      value={input}
                      onChange={e=>setInput(e.target.value)}
                      placeholder="Ask a question, share your experience, or introduce yourself..."
                      style={S.textarea}
                      rows={3}
                      onKeyDown={e=>{if(e.key==="Enter"&&e.metaKey)post()}}
                    />
                    <div style={S.composeActions}>
                      <span style={{fontSize:12,color:"#9ca3af"}}>Cmd+Enter to post</span>
                      <button onClick={post} disabled={!input.trim()||posting} style={S.postBtn}>{posting?"Posting...":"Post"}</button>
                    </div>
                  </div>
                </div>
              )}

              {!isMember && (
                <div style={S.joinPrompt}>
                  <span style={{color:"#0F6E56"}}><IconMessage size={16} /></span>
                  <p style={{fontSize:14,color:"#3D3D4E",fontWeight:500}}>Join this community to post and interact</p>
                  <button onClick={join} style={S.joinBtn}>Join now</button>
                </div>
              )}

              <div style={S.posts}>
                {community.posts?.length === 0 && (
                  <div style={S.emptyPosts}><p style={{color:"#9ca3af"}}>No posts yet. Be the first to start a conversation!</p></div>
                )}
                {community.posts?.map((post: any) => (
                  <div key={post.id} style={S.post}>
                    <div style={{...S.postAvatar,background:getColor(post.userId)}}>{initials(post.user?.name)}</div>
                    <div style={S.postBody}>
                      <div style={S.postMeta}>
                        <span style={S.postName}>{post.user?.name}</span>
                        {post.user?.headline && <span style={S.postHeadline}>{post.user.headline}</span>}
                        <span style={S.postTime}>{timeAgo(post.createdAt)}</span>
                      </div>
                      <div style={S.postContent}>{post.content}</div>

                      {/* Replies */}
                      {post.replies?.map((r: any) => (
                        <div key={r.id} style={S.reply}>
                          <div style={{...S.postAvatar,width:28,height:28,fontSize:11,background:getColor(r.userId)}}>{initials(r.user?.name)}</div>
                          <div style={S.postBody}>
                            <div style={S.postMeta}>
                              <span style={S.postName}>{r.user?.name}</span>
                              <span style={S.postTime}>{timeAgo(r.createdAt)}</span>
                            </div>
                            <div style={{...S.postContent,fontSize:13}}>{r.content}</div>
                          </div>
                        </div>
                      ))}

                      {isMember && (
                        replyTo?.id === post.id ? (
                          <div style={S.replyForm}>
                            <input value={replyInput} onChange={e=>setReplyInput(e.target.value)} placeholder="Write a reply..." style={S.replyInput} onKeyDown={e=>{if(e.key==="Enter")reply(post.id)}} autoFocus />
                            <button onClick={()=>reply(post.id)} style={S.replyBtn}>Reply</button>
                            <button onClick={()=>setReplyTo(null)} style={S.cancelBtn}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={()=>setReplyTo(post)} style={S.replyToggle}>
                            Reply {post._count?.replies>0?`(${post._count.replies})`:""}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Sidebar */}
            <aside style={S.sidebar}>
              <div style={S.sideCard}>
                <h3 style={S.sideTitle}>Members ({community._count?.members})</h3>
                <div style={S.memberList}>
                  {community.members?.slice(0,10).map((m: any) => (
                    <div key={m.id} style={S.memberRow}>
                      <div style={{...S.memberAvatar,background:getColor(m.userId)}}>{initials(m.user?.name)}</div>
                      <div>
                        <div style={S.memberName}>{m.user?.name}</div>
                        {m.role==="HOST" && <div style={S.hostTag}>Employer</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={S.sideCard}>
                <h3 style={S.sideTitle}>About this job</h3>
                <div style={S.jobInfo}>
                  <div style={S.jobInfoRow}><span>Company</span><span>{job?.company}</span></div>
                  <div style={S.jobInfoRow}><span>Location</span><span>{job?.location}</span></div>
                  <div style={S.jobInfoRow}><span>Type</span><span>{job?.type}</span></div>
                  <div style={S.jobInfoRow}><span>Industry</span><span>{job?.industry}</span></div>
                </div>
                <Link href={`/jobs/${job?.id}`} style={S.applyLink}>Apply for this role →</Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{ background:"#FAF8F2",minHeight:"calc(100vh - 60px)",padding:"2rem" },
  wrap:{ maxWidth:1100,margin:"0 auto" },
  loading:{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",fontSize:14,color:"#9ca3af" },
  header:{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.5rem",marginBottom:"1.25rem",flexWrap:"wrap" as const,gap:12 },
  headerLeft:{ display:"flex",gap:14,alignItems:"flex-start",flex:1 },
  logo:{ width:52,height:52,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",flexShrink:0 },
  title:{ fontSize:18,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px" },
  meta:{ fontSize:12,color:"#9ca3af",marginTop:4 },
  desc:{ fontSize:13,color:"#7B7B8F",marginTop:6,lineHeight:1.6 },
  headerRight:{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" as const },
  jobLink:{ fontSize:13,color:"#0F6E56",textDecoration:"none" },
  joinBtn:{ background:"#0F6E56",color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:500,cursor:"pointer" },
  joinedTag:{ fontSize:13,color:"#059669",fontWeight:500 },
  layout:{ display:"grid",gridTemplateColumns:"1fr 280px",gap:"1.25rem" },
  main:{ display:"flex",flexDirection:"column" as const,gap:12 },
  compose:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.25rem",display:"flex",gap:12 },
  composeAvatar:{ width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,color:"#fff",flexShrink:0,marginTop:4 },
  composeInput:{ flex:1 },
  textarea:{ width:"100%",border:"0.5px solid rgba(0,0,0,.1)",borderRadius:10,padding:"10px 12px",fontSize:14,fontFamily:"inherit",outline:"none",resize:"vertical" as const },
  composeActions:{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8 },
  postBtn:{ background:"#0F6E56",color:"#fff",border:"none",borderRadius:8,padding:"7px 18px",fontSize:13,fontWeight:500,cursor:"pointer" },
  joinPrompt:{ background:"#E1F5EE",border:"0.5px solid rgba(15,110,86,.15)",borderRadius:12,padding:"1.5rem",display:"flex",flexDirection:"column" as const,alignItems:"center",gap:10,textAlign:"center" as const },
  posts:{ display:"flex",flexDirection:"column" as const,gap:1 },
  emptyPosts:{ background:"#fff",borderRadius:12,padding:"3rem",textAlign:"center" as const },
  post:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.07)",borderRadius:12,padding:"1.1rem",display:"flex",gap:12,marginBottom:8 },
  postAvatar:{ width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,color:"#fff",flexShrink:0 },
  postBody:{ flex:1,minWidth:0 },
  postMeta:{ display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap" as const },
  postName:{ fontSize:14,fontWeight:600,color:"#0A0A0F" },
  postHeadline:{ fontSize:12,color:"#9ca3af" },
  postTime:{ fontSize:11,color:"#9ca3af",marginLeft:"auto" },
  postContent:{ fontSize:14,color:"#3D3D4E",lineHeight:1.7,wordBreak:"break-word" as const },
  reply:{ display:"flex",gap:8,marginTop:10,paddingLeft:12,borderLeft:"2px solid rgba(0,0,0,.06)" },
  replyForm:{ display:"flex",gap:6,marginTop:10,alignItems:"center" },
  replyInput:{ flex:1,border:"0.5px solid rgba(0,0,0,.1)",borderRadius:8,padding:"6px 10px",fontSize:13,outline:"none" },
  replyBtn:{ background:"#0F6E56",color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:500,cursor:"pointer",flexShrink:0 },
  cancelBtn:{ background:"none",border:"none",fontSize:12,color:"#9ca3af",cursor:"pointer" },
  replyToggle:{ background:"none",border:"none",fontSize:12,color:"#9ca3af",cursor:"pointer",marginTop:8,padding:0 },
  sidebar:{ display:"flex",flexDirection:"column" as const,gap:12 },
  sideCard:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.1rem" },
  sideTitle:{ fontSize:14,fontWeight:600,color:"#0A0A0F",marginBottom:12,paddingBottom:8,borderBottom:"0.5px solid rgba(0,0,0,.06)" },
  memberList:{ display:"flex",flexDirection:"column" as const,gap:10 },
  memberRow:{ display:"flex",alignItems:"center",gap:9 },
  memberAvatar:{ width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:"#fff",flexShrink:0 },
  memberName:{ fontSize:13,fontWeight:500,color:"#0A0A0F" },
  hostTag:{ fontSize:11,color:"#0F6E56",fontWeight:500 },
  jobInfo:{ display:"flex",flexDirection:"column" as const,gap:2,marginBottom:12 },
  jobInfoRow:{ display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderBottom:"0.5px solid rgba(0,0,0,.04)" },
  applyLink:{ display:"block",background:"#0F6E56",color:"#fff",padding:"9px 0",borderRadius:8,fontSize:13,fontWeight:500,textDecoration:"none",textAlign:"center" as const,marginTop:8 },
}