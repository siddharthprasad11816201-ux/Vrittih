"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
import { IconMapPin, IconFileText, IconMessage } from "@/components/ui/Icons"
import Link from "next/link"

export default function ProfessionalPageView() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [data, setData] = useState<any>(null)
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [postContent, setPostContent] = useState("")
  const [posting, setPosting] = useState(false)
  const [replyTo, setReplyTo] = useState<string|null>(null)
  const [replyContent, setReplyContent] = useState("")

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r=>r.json()),
      fetch(`/api/community/pages/${id}`).then(r=>r.json()),
    ]).then(([meData, pageData]) => {
      setMe(meData.user)
      setData(pageData)
      setLoading(false)
    })
  }, [id])

  async function follow() {
    await fetch(`/api/community/pages/${id}/follow`, { method: "POST" })
    const d = await fetch(`/api/community/pages/${id}`).then(r=>r.json())
    setData(d)
  }

  async function createPost() {
    if (!postContent.trim() || posting) return
    setPosting(true)
    const res = await fetch(`/api/community/pages/${id}/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: postContent.trim() })
    })
    const d = await res.json()
    if (d.success) {
      const updated = await fetch(`/api/community/pages/${id}`).then(r=>r.json())
      setData(updated)
      setPostContent("")
    }
    setPosting(false)
  }

  const timeAgo = (iso: string) => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 1) return "just now"
    if (m < 60) return `${m}m ago`
    if (m < 1440) return `${Math.floor(m/60)}h ago`
    return `${Math.floor(m/1440)}d ago`
  }

  const initials = (name: string) => name?.split(" ").map((n:string)=>n[0]).join("").slice(0,2).toUpperCase()||"?"
  const colors = ["#7C3AED","#059669","#0891B2","#B45309","#DC2626"]
  const getColor = (uid: string) => colors[uid?.charCodeAt(0)%colors.length||0]

  if (loading) return <AppShell><div style={S.loading}>Loading...</div></AppShell>
  if (!data?.page) return <AppShell><div style={S.loading}>Page not found</div></AppShell>

  const { page, isOwner, isFollowing } = data

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          {/* Profile header */}
          <div style={S.profileCard}>
            <div style={S.profileTop}>
              {page.user?.avatar
                ? <img src={page.user.avatar} style={S.avatar} alt={page.user.name} />
                : <div style={{...S.avatarFallback, background:getColor(page.userId)}}>{initials(page.user?.name)}</div>
              }
              <div style={S.profileInfo}>
                <div style={S.nameRow}>
                  <h1 style={S.name}>{page.user?.name}</h1>
                  {page.verified && <span style={S.verified}>✓ Verified</span>}
                </div>
                <div style={S.proTitle}>{page.title}</div>
                {page.badge && <div style={S.badge}>{page.badge}</div>}
                {page.user?.headline && <div style={S.headline}>{page.user.headline}</div>}
                {page.user?.location && <div style={{...S.location,display:"flex",alignItems:"center",gap:4}}><IconMapPin size={12} /> {page.user.location}</div>}
                <div style={S.stats}>
                  <span>{page._count?.pageFollows || page.followers || 0} followers</span>
                  <span>·</span>
                  <span>{page._count?.pagePosts || 0} posts</span>
                </div>
              </div>
              <div style={S.profileActions}>
                {!isOwner && (
                  <button onClick={follow} style={{...S.followBtn,...(isFollowing?S.followingBtn:{})}}>
                    {isFollowing ? "Following ✓" : "Follow"}
                  </button>
                )}
                {isOwner && (
                  <Link href="/profile/edit" style={S.editBtn}>Edit profile</Link>
                )}
                <Link href="/community/pages" style={S.backBtn}>← All pages</Link>
              </div>
            </div>
            {page.bio && <p style={S.bio}>{page.bio}</p>}
          </div>

          <div style={S.layout}>
            {/* Posts */}
            <div style={S.main}>
              {isOwner && (
                <div style={S.composeCard}>
                  <div style={{...S.composeAvatar,background:getColor(me?.id||"a")}}>{initials(me?.name||"?")}</div>
                  <div style={{flex:1}}>
                    <textarea
                      value={postContent}
                      onChange={e => setPostContent(e.target.value)}
                      placeholder="Share something with your followers..."
                      style={S.composeTextarea}
                      rows={3}
                    />
                    <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
                      <button onClick={createPost} disabled={!postContent.trim()||posting} style={S.postBtn}>
                        {posting ? "Posting..." : "Post"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {page.pagePosts?.length === 0 && (
                <div style={S.empty}>
                  <span style={{color:"#D1D5DB"}}><IconFileText size={34} /></span>
                  <p style={{fontSize:14,color:"#9ca3af",marginTop:10}}>No posts yet</p>
                </div>
              )}

              {page.pagePosts?.map((post: any) => (
                <div key={post.id} style={S.postCard}>
                  <div style={S.postTop}>
                    {page.user?.avatar
                      ? <img src={page.user.avatar} style={{...S.avatar,width:40,height:40}} alt="" />
                      : <div style={{...S.avatarFallback,width:40,height:40,fontSize:14,background:getColor(page.userId)}}>{initials(page.user?.name)}</div>
                    }
                    <div>
                      <div style={S.postAuthor}>{page.user?.name}</div>
                      <div style={S.postTime}>{timeAgo(post.createdAt)}</div>
                    </div>
                  </div>
                  <div style={S.postContent}>{post.content}</div>

                  {post.replies?.map((r: any) => (
                    <div key={r.id} style={S.reply}>
                      <div style={{...S.avatarFallback,width:28,height:28,fontSize:11,flexShrink:0,background:getColor(r.userId)}}>{initials(r.user?.name)}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:"#0A0A0F"}}>{r.user?.name} <span style={{fontSize:11,color:"#9ca3af",fontWeight:400}}>{timeAgo(r.createdAt)}</span></div>
                        <div style={{fontSize:13,color:"#3D3D4E",lineHeight:1.6}}>{r.content}</div>
                      </div>
                    </div>
                  ))}

                  {replyTo === post.id ? (
                    <div style={S.replyForm}>
                      <input
                        value={replyContent}
                        onChange={e => setReplyContent(e.target.value)}
                        placeholder="Write a reply..."
                        style={S.replyInput}
                        autoFocus
                        onKeyDown={async e => {
                          if (e.key === "Enter" && replyContent.trim()) {
                            const res = await fetch(`/api/community/pages/${id}/post`, {
                              method: "POST",
                              headers: {"Content-Type":"application/json"},
                              body: JSON.stringify({ content: replyContent.trim(), replyToId: post.id })
                            })
                            if ((await res.json()).success) {
                              const updated = await fetch(`/api/community/pages/${id}`).then(r=>r.json())
                              setData(updated)
                              setReplyContent("")
                              setReplyTo(null)
                            }
                          }
                        }}
                      />
                      <button onClick={() => setReplyTo(null)} style={{background:"none",border:"none",fontSize:12,color:"#9ca3af",cursor:"pointer"}}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setReplyTo(post.id)} style={{...S.replyToggle,display:"inline-flex",alignItems:"center",gap:5}}>
                      <IconMessage size={12} /> Reply {post.replies?.length > 0 ? `(${post.replies.length})` : ""}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Sidebar */}
            <aside style={S.sidebar}>
              <div style={S.sideCard}>
                <h3 style={S.sideTitle}>About</h3>
                <div style={S.aboutRow}><span style={S.aboutLabel}>Title</span><span style={S.aboutVal}>{page.title}</span></div>
                {page.user?.location && <div style={S.aboutRow}><span style={S.aboutLabel}>Location</span><span style={S.aboutVal}>{page.user.location}</span></div>}
                <div style={S.aboutRow}><span style={S.aboutLabel}>Member since</span><span style={S.aboutVal}>{new Date(page.user?.createdAt).toLocaleDateString("en-IN",{month:"short",year:"numeric"})}</span></div>
                <div style={S.aboutRow}><span style={S.aboutLabel}>Followers</span><span style={S.aboutVal}>{page._count?.pageFollows || 0}</span></div>
              </div>
              {!isOwner && (
                <div style={S.sideCard}>
                  <p style={{fontSize:13,color:"#7B7B8F",marginBottom:10,lineHeight:1.6}}>
                    Interested in working with or for {page.user?.name}?
                  </p>
                  <Link href="/jobs" style={S.browseBtn}>Browse open roles</Link>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{ background:"#F7F7FA",minHeight:"calc(100vh - 60px)",padding:"2rem" },
  wrap:{ maxWidth:1000,margin:"0 auto" },
  loading:{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",fontSize:14,color:"#9ca3af" },
  profileCard:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:16,padding:"2rem",marginBottom:"1.25rem" },
  profileTop:{ display:"flex",gap:20,alignItems:"flex-start",flexWrap:"wrap" as const },
  avatar:{ width:80,height:80,borderRadius:"50%",objectFit:"cover" as const,flexShrink:0 },
  avatarFallback:{ width:80,height:80,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:700,color:"#fff",flexShrink:0 },
  profileInfo:{ flex:1,minWidth:0 },
  nameRow:{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const,marginBottom:4 },
  name:{ fontSize:22,fontWeight:700,color:"#0A0A0F",letterSpacing:"-.3px" },
  verified:{ fontSize:12,background:"#ECFDF5",color:"#047857",padding:"3px 10px",borderRadius:999,fontWeight:500 },
  proTitle:{ fontSize:15,color:"#7C3AED",fontWeight:500,marginBottom:4 },
  badge:{ display:"inline-block",background:"#F5F3FF",color:"#7C3AED",fontSize:12,padding:"3px 12px",borderRadius:999,border:"0.5px solid rgba(124,58,237,.2)",marginBottom:6 },
  headline:{ fontSize:14,color:"#7B7B8F",marginBottom:4 },
  location:{ fontSize:13,color:"#9ca3af",marginBottom:6 },
  stats:{ fontSize:13,color:"#9ca3af",display:"flex",gap:8 },
  profileActions:{ display:"flex",flexDirection:"column" as const,gap:8,flexShrink:0 },
  followBtn:{ background:"#7C3AED",color:"#fff",border:"none",borderRadius:9,padding:"9px 22px",fontSize:14,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap" as const },
  followingBtn:{ background:"#F5F3FF",color:"#7C3AED",border:"0.5px solid rgba(124,58,237,.2)" },
  editBtn:{ background:"none",border:"0.5px solid rgba(0,0,0,.13)",color:"#3D3D4E",borderRadius:9,padding:"8px 18px",fontSize:13,textDecoration:"none",textAlign:"center" as const },
  backBtn:{ fontSize:13,color:"#9ca3af",textDecoration:"none",textAlign:"center" as const },
  bio:{ fontSize:14,color:"#3D3D4E",lineHeight:1.7,marginTop:"1rem",paddingTop:"1rem",borderTop:"0.5px solid rgba(0,0,0,.07)" },
  layout:{ display:"grid",gridTemplateColumns:"1fr 260px",gap:"1.25rem" },
  main:{ display:"flex",flexDirection:"column" as const,gap:12 },
  composeCard:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.25rem",display:"flex",gap:12 },
  composeAvatar:{ width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,color:"#fff",flexShrink:0,marginTop:4 },
  composeTextarea:{ width:"100%",border:"0.5px solid rgba(0,0,0,.1)",borderRadius:10,padding:"10px 12px",fontSize:14,fontFamily:"inherit",outline:"none",resize:"vertical" as const },
  postBtn:{ background:"#7C3AED",color:"#fff",border:"none",borderRadius:8,padding:"7px 18px",fontSize:13,fontWeight:500,cursor:"pointer" },
  empty:{ display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:"3rem",background:"#fff",borderRadius:14,border:"0.5px solid rgba(0,0,0,.07)" },
  postCard:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.25rem" },
  postTop:{ display:"flex",gap:10,alignItems:"flex-start",marginBottom:10 },
  postAuthor:{ fontSize:14,fontWeight:600,color:"#0A0A0F" },
  postTime:{ fontSize:12,color:"#9ca3af" },
  postContent:{ fontSize:14,color:"#3D3D4E",lineHeight:1.75,wordBreak:"break-word" as const },
  reply:{ display:"flex",gap:8,marginTop:12,paddingTop:12,borderTop:"0.5px solid rgba(0,0,0,.06)",alignItems:"flex-start" },
  replyForm:{ display:"flex",gap:8,marginTop:10,alignItems:"center" },
  replyInput:{ flex:1,border:"0.5px solid rgba(0,0,0,.1)",borderRadius:8,padding:"7px 10px",fontSize:13,outline:"none" },
  replyToggle:{ background:"none",border:"none",fontSize:12,color:"#9ca3af",cursor:"pointer",marginTop:10,padding:0 },
  sidebar:{ display:"flex",flexDirection:"column" as const,gap:12 },
  sideCard:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.1rem" },
  sideTitle:{ fontSize:14,fontWeight:600,color:"#0A0A0F",marginBottom:12,paddingBottom:8,borderBottom:"0.5px solid rgba(0,0,0,.06)" },
  aboutRow:{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"0.5px solid rgba(0,0,0,.04)",fontSize:13 },
  aboutLabel:{ color:"#9ca3af" },
  aboutVal:{ color:"#0A0A0F",fontWeight:500 },
  browseBtn:{ display:"block",background:"#7C3AED",color:"#fff",padding:"9px 0",borderRadius:8,fontSize:13,fontWeight:500,textDecoration:"none",textAlign:"center" as const },
}