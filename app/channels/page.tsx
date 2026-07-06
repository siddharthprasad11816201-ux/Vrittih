"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconMessage, IconBookmark } from "@/components/ui/Icons"

export default function ChannelsPage() {
  const [channels, setChannels] = useState<any[]>([])
  const [active, setActive] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [input, setInput] = useState("")
  const [replyTo, setReplyTo] = useState<any>(null)
  const [replyInput, setReplyInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newChannel, setNewChannel] = useState({ name:"", description:"" })
  const [createErr, setCreateErr] = useState("")

  useEffect(() => {
    fetch("/api/auth/me").then(r=>r.json()).then(d => setMe(d.user))
    loadChannels()
  }, [])

  async function loadChannels() {
    setLoading(true)
    const d = await fetch("/api/channels").then(r => r.json())
    setChannels(d.channels || [])
    setLoading(false)
  }

  async function openChannel(ch: any) {
    setActive(ch)
    setReplyTo(null)
    const d = await fetch(`/api/channels/${ch.id}`).then(r => r.json())
    setPosts(d.channel?.posts?.slice().reverse() || [])
  }

  async function joinChannel(channelId: string) {
    await fetch(`/api/channels/${channelId}/join`, { method:"POST" })
    loadChannels()
    if (active?.id === channelId) openChannel(active)
  }

  async function sendPost() {
    if (!input.trim() || !active || posting) return
    setPosting(true)
    const res = await fetch(`/api/channels/${active.id}/post`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ content:input.trim() }) })
    const d = await res.json()
    if (d.success) { setPosts(prev => [...prev, d.post]); setInput("") }
    setPosting(false)
  }

  async function sendReply(postId: string) {
    if (!replyInput.trim()) return
    const res = await fetch(`/api/channels/${active.id}/post`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ content:replyInput.trim(), replyToId:postId }) })
    const d = await res.json()
    if (d.success) {
      setPosts(prev => prev.map(p => p.id === postId ? {...p, replies:[...p.replies||[],d.reply], _count:{...p._count,replies:(p._count?.replies||0)+1}} : p))
      setReplyInput(""); setReplyTo(null)
    }
  }

  async function createChannel(e: any) {
    e.preventDefault(); setCreateErr("")
    const res = await fetch("/api/channels", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(newChannel) })
    const d = await res.json()
    if (d.success) { setShowCreate(false); setNewChannel({ name:"", description:"" }); loadChannels() }
    else setCreateErr(d.error || "Failed")
  }

  const initials = (name: string) => name?.split(" ").map((n:string)=>n[0]).join("").slice(0,2).toUpperCase()||"?"
  const timeAgo = (iso: string) => { const m=Math.floor((Date.now()-new Date(iso).getTime())/60000); if(m<1)return "just now"; if(m<60)return `${m}m`; if(m<1440)return `${Math.floor(m/60)}h`; return `${Math.floor(m/1440)}d` }
  const colors = ["#7C3AED","#059669","#0891B2","#B45309","#DC2626"]
  const getColor = (id: string) => colors[id?.charCodeAt(0)%colors.length||0]
  const isMember = (ch: any) => ch.members?.length > 0

  return (
    <AppShell>
      <div style={S.shell}>
        {/* Channel list */}
        <aside style={S.sidebar}>
          <div style={S.sideHead}>
            <span style={S.sideTitle}>Channels</span>
            <button onClick={() => setShowCreate(!showCreate)} style={S.newBtn} title="Create channel">+</button>
          </div>
          {showCreate && (
            <div style={S.createForm}>
              {createErr && <div style={S.createErr}>{createErr}</div>}
              <form onSubmit={createChannel}>
                <input value={newChannel.name} onChange={e=>setNewChannel(p=>({...p,name:e.target.value}))} placeholder="channel-name" style={S.createInput} required />
                <input value={newChannel.description} onChange={e=>setNewChannel(p=>({...p,description:e.target.value}))} placeholder="Description (optional)" style={S.createInput} />
                <button type="submit" style={S.createBtn}>Create</button>
              </form>
            </div>
          )}
          <div style={S.channelList}>
            {loading && <p style={{fontSize:12,color:"#9ca3af",padding:"8px 12px"}}>Loading...</p>}
            {channels.map(ch => (
              <button key={ch.id} onClick={() => openChannel(ch)} style={{...S.channelBtn,...(active?.id===ch.id?S.channelBtnOn:{})}}>
                <span style={S.channelHash}>#</span>
                <span style={S.channelName}>{ch.name}</span>
                {isMember(ch) && <span style={S.memberDot} title="Joined" />}
              </button>
            ))}
          </div>
        </aside>

        {/* Posts area */}
        <div style={S.main}>
          {!active ? (
            <div style={S.empty}>
              <span style={{color:"#D1D5DB"}}><IconMessage size={44} /></span>
              <p style={{fontSize:16,fontWeight:500,color:"#3D3D4E",marginTop:12}}>Select a channel</p>
              <p style={{fontSize:13,color:"#9ca3af",marginTop:4}}>Join channels to participate in discussions</p>
            </div>
          ) : (
            <>
              <div style={S.channelHead}>
                <div>
                  <div style={S.channelHeadName}># {active.name}</div>
                  {active.description && <div style={S.channelDesc}>{active.description}</div>}
                </div>
                <div style={S.channelMeta}>
                  <span style={{fontSize:12,color:"#9ca3af"}}>{active._count?.members||0} members</span>
                  {!isMember(active) && (
                    <button onClick={() => joinChannel(active.id)} style={S.joinBtn}>Join channel</button>
                  )}
                </div>
              </div>

              <div style={S.postsArea}>
                {posts.length === 0 && (
                  <div style={S.emptyPosts}>
                    <p style={{fontSize:14,color:"#9ca3af"}}>No posts yet. Be the first to post!</p>
                  </div>
                )}
                {posts.map(post => (
                  <div key={post.id} style={S.post}>
                    <div style={{...S.postAvatar,background:getColor(post.userId)}}>{initials(post.user?.name)}</div>
                    <div style={S.postBody}>
                      <div style={S.postMeta}>
                        <span style={S.postName}>{post.user?.name}</span>
                        <span style={S.postTime}>{timeAgo(post.createdAt)}</span>
                        {post.pinned && <span style={{...S.pinnedTag,display:"inline-flex",alignItems:"center",gap:4}}><IconBookmark size={11} /> Pinned</span>}
                      </div>
                      <div style={S.postContent}>{post.content}</div>
                      {post.replies?.map((r: any) => (
                        <div key={r.id} style={S.reply}>
                          <div style={{...S.postAvatar,width:26,height:26,fontSize:10,background:getColor(r.userId)}}>{initials(r.user?.name)}</div>
                          <div>
                            <div style={S.postMeta}><span style={S.postName}>{r.user?.name}</span><span style={S.postTime}>{timeAgo(r.createdAt)}</span></div>
                            <div style={{...S.postContent,fontSize:13}}>{r.content}</div>
                          </div>
                        </div>
                      ))}
                      {isMember(active) && (
                        replyTo?.id === post.id ? (
                          <div style={S.replyForm}>
                            <input value={replyInput} onChange={e=>setReplyInput(e.target.value)} placeholder="Write a reply..." style={S.replyInput} onKeyDown={e=>{if(e.key==="Enter")sendReply(post.id)}} autoFocus />
                            <button onClick={() => sendReply(post.id)} style={S.replyBtn}>Reply</button>
                            <button onClick={() => setReplyTo(null)} style={S.cancelReplyBtn}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setReplyTo(post)} style={{...S.replyToggle,display:"inline-flex",alignItems:"center",gap:5}}>
                            <IconMessage size={12} /> Reply{post._count?.replies > 0 ? ` (${post._count.replies})` : ""}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {isMember(active) ? (
                <div style={S.inputRow}>
                  <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendPost()}}} placeholder={`Post in #${active.name}...`} style={S.postInput} />
                  <button onClick={sendPost} disabled={!input.trim()||posting} style={S.postBtn}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
              ) : (
                <div style={S.joinPrompt}>
                  <button onClick={() => joinChannel(active.id)} style={S.joinPromptBtn}>Join # {active.name} to post</button>
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
  shell:{ display:"grid",gridTemplateColumns:"220px 1fr",height:"calc(100vh - 60px)",overflow:"hidden",background:"#F7F7FA" },
  sidebar:{ background:"#0F0A1E",display:"flex",flexDirection:"column" as const,overflow:"hidden" },
  sideHead:{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.25rem",borderBottom:"0.5px solid rgba(255,255,255,.07)" },
  sideTitle:{ fontSize:14,fontWeight:600,color:"#fff" },
  newBtn:{ width:28,height:28,borderRadius:7,background:"rgba(255,255,255,.1)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 },
  createForm:{ padding:"10px 1rem",borderBottom:"0.5px solid rgba(255,255,255,.07)" },
  createErr:{ fontSize:12,color:"#FCA5A5",marginBottom:6 },
  createInput:{ width:"100%",background:"rgba(255,255,255,.08)",border:"0.5px solid rgba(255,255,255,.12)",borderRadius:7,padding:"6px 10px",fontSize:12,color:"#fff",outline:"none",marginBottom:6 },
  createBtn:{ width:"100%",background:"#7C3AED",color:"#fff",border:"none",borderRadius:7,padding:"7px",fontSize:12,fontWeight:500,cursor:"pointer" },
  channelList:{ flex:1,overflowY:"auto" as const,padding:"8px 0" },
  channelBtn:{ display:"flex",alignItems:"center",gap:6,width:"100%",background:"none",border:"none",padding:"7px 1.25rem",fontSize:13,color:"rgba(255,255,255,.55)",cursor:"pointer",textAlign:"left" as const,transition:"all .12s" },
  channelBtnOn:{ background:"rgba(124,58,237,.25)",color:"#C4B5FD" },
  channelHash:{ fontSize:16,color:"rgba(255,255,255,.3)",flexShrink:0 },
  channelName:{ flex:1 },
  memberDot:{ width:6,height:6,borderRadius:"50%",background:"#7C3AED",flexShrink:0 },
  main:{ display:"flex",flexDirection:"column" as const,overflow:"hidden",background:"#fff" },
  empty:{ flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center" },
  channelHead:{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"0.5px solid rgba(0,0,0,.07)",flexShrink:0 },
  channelHeadName:{ fontSize:16,fontWeight:600,color:"#0A0A0F" },
  channelDesc:{ fontSize:12,color:"#9ca3af",marginTop:2 },
  channelMeta:{ display:"flex",alignItems:"center",gap:10 },
  joinBtn:{ background:"#7C3AED",color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:500,cursor:"pointer" },
  postsArea:{ flex:1,overflowY:"auto" as const,padding:"1rem 1.5rem",display:"flex",flexDirection:"column" as const,gap:12 },
  emptyPosts:{ textAlign:"center" as const,padding:"3rem 0" },
  post:{ display:"flex",gap:10,alignItems:"flex-start" },
  postAvatar:{ width:34,height:34,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:"#fff",flexShrink:0 },
  postBody:{ flex:1,minWidth:0 },
  postMeta:{ display:"flex",alignItems:"center",gap:8,marginBottom:4 },
  postName:{ fontSize:13,fontWeight:600,color:"#0A0A0F" },
  postTime:{ fontSize:11,color:"#9ca3af" },
  pinnedTag:{ fontSize:11,color:"#B45309" },
  postContent:{ fontSize:14,color:"#3D3D4E",lineHeight:1.65,wordBreak:"break-word" as const },
  reply:{ display:"flex",gap:8,marginTop:8,paddingLeft:10,borderLeft:"2px solid rgba(0,0,0,.06)" },
  replyForm:{ display:"flex",gap:6,marginTop:8,alignItems:"center" },
  replyInput:{ flex:1,border:"0.5px solid rgba(0,0,0,.12)",borderRadius:8,padding:"6px 10px",fontSize:13,outline:"none" },
  replyBtn:{ background:"#7C3AED",color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:500,cursor:"pointer" },
  cancelReplyBtn:{ background:"none",border:"none",fontSize:12,color:"#9ca3af",cursor:"pointer" },
  replyToggle:{ background:"none",border:"none",fontSize:12,color:"#9ca3af",cursor:"pointer",marginTop:6,padding:0 },
  inputRow:{ display:"flex",gap:8,padding:"1rem 1.5rem",borderTop:"0.5px solid rgba(0,0,0,.07)",flexShrink:0,background:"#fff" },
  postInput:{ flex:1,border:"0.5px solid rgba(0,0,0,.12)",borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",fontFamily:"inherit" },
  postBtn:{ width:42,height:42,borderRadius:12,background:"#7C3AED",border:"none",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0 },
  joinPrompt:{ padding:"1rem 1.5rem",borderTop:"0.5px solid rgba(0,0,0,.07)",textAlign:"center" as const },
  joinPromptBtn:{ background:"#7C3AED",color:"#fff",border:"none",borderRadius:9,padding:"10px 24px",fontSize:14,fontWeight:500,cursor:"pointer" },
}
