"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconEdit, IconInbox, IconStar, IconArchive, IconTrash, IconMail } from "@/components/ui/Icons"

export default function MailPage() {
  const [folder, setFolder] = useState("inbox")
  const [mails, setMails] = useState<any[]>([])
  const [unread, setUnread] = useState(0)
  const [selected, setSelected] = useState<any>(null)
  const [composing, setComposing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [compose, setCompose] = useState({ toEmail:"", subject:"", body:"" })
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState("")
  const [me, setMe] = useState<any>(null)

  useEffect(() => {
    fetch("/api/auth/me").then(r=>r.json()).then(d => setMe(d.user))
  }, [])

  useEffect(() => { loadMails() }, [folder, q])

  async function loadMails() {
    setLoading(true)
    setSelected(null)
    const params = new URLSearchParams({ folder })
    if (q) params.set("q", q)
    const d = await fetch("/api/mail?" + params).then(r => r.json())
    setMails(d.mails || [])
    setUnread(d.unread || 0)
    setLoading(false)
  }

  async function openMail(mail: any) {
    setSelected(mail)
    setComposing(false)
    if (!mail.read && mail.toId === me?.id) {
      await fetch("/api/mail", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id:mail.id, action:"read" }) })
      setMails(prev => prev.map(m => m.id === mail.id ? {...m, read:true} : m))
      setUnread(prev => Math.max(0, prev-1))
    }
  }

  async function mailAction(id: string, action: string) {
    await fetch("/api/mail", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id, action }) })
    loadMails()
    setSelected(null)
  }

  async function sendMail(e: any) {
    e.preventDefault()
    setSending(true); setSendMsg("")
    const res = await fetch("/api/mail/send", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(compose) })
    const d = await res.json()
    setSending(false)
    if (d.success) { setSendMsg("Mail sent successfully"); setCompose({ toEmail:"", subject:"", body:"" }); setTimeout(() => { setComposing(false); setSendMsg("") }, 1500) }
    else setSendMsg(d.error || "Failed to send")
  }

  const initials = (name: string) => name?.split(" ").map((n:string)=>n[0]).join("").slice(0,2).toUpperCase()||"?"
  const timeStr = (iso: string) => {
    const d = new Date(iso), now = new Date()
    if (d.toDateString()===now.toDateString()) return d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})
    return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"})
  }

  const FOLDERS = [
    { key:"inbox", label:"Inbox", count:unread },
    { key:"sent", label:"Sent", count:0 },
    { key:"starred", label:"Starred", count:0 },
    { key:"archived", label:"Archived", count:0 },
  ]

  return (
    <AppShell>
      <style>{MAIL_CSS}</style>
      <div style={S.shell} className="mailShell" data-detail={(selected || composing) ? "true" : "false"}>
        {/* Sidebar */}
        <aside style={S.sidebar} className="mailSide">
          <button onClick={() => { setComposing(true); setSelected(null) }} style={{...S.composeBtn,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><IconEdit size={15} /> Compose</button>
          <div style={S.searchWrap}>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search mail..." style={S.searchInput} />
          </div>
          {FOLDERS.map(f => (
            <button key={f.key} onClick={() => { setFolder(f.key); setComposing(false) }} style={{...S.folderBtn,...(folder===f.key?S.folderBtnOn:{})}}>
              <span>{f.label}</span>
              {f.count > 0 && <span style={S.badge}>{f.count}</span>}
            </button>
          ))}
        </aside>

        {/* Mail list */}
        <div style={S.mailList} className="mailListPane">
          <div className="mailMobileBar">
            <button onClick={() => { setComposing(true); setSelected(null) }} style={{ ...S.composeBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><IconEdit size={15} /> Compose</button>
            <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
              {FOLDERS.map(f => (
                <button key={f.key} onClick={() => { setFolder(f.key); setComposing(false) }} style={{ flexShrink: 0, background: folder === f.key ? "#0F6E56" : "#F3F0E7", color: folder === f.key ? "#fff" : "#4A5750", border: "none", borderRadius: 999, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{f.label}</button>
              ))}
            </div>
          </div>
          <div style={S.listHead}>
            <span style={S.listTitle}>{FOLDERS.find(f=>f.key===folder)?.label}</span>
            <span style={{fontSize:12,color:"#9ca3af"}}>{mails.length} messages</span>
          </div>
          {loading ? <div style={S.empty}><p style={{color:"#9ca3af"}}>Loading...</p></div> :
          mails.length === 0 ? (
            <div style={S.empty}><span style={{color:"#D1D5DB"}}><IconInbox size={34} /></span><p style={{fontSize:14,color:"#9ca3af",marginTop:10}}>No mail in {folder}</p></div>
          ) : mails.map(m => (
            <div key={m.id} onClick={() => openMail(m)} style={{...S.mailItem,...(selected?.id===m.id?S.mailItemOn:{})}}>
              <div style={{...S.mailAvatar,background:"#0F6E56"}}>{initials(folder==="sent"?m.to?.name:m.from?.name)}</div>
              <div style={S.mailInfo}>
                <div style={S.mailFrom}>{folder==="sent"?`To: ${m.to?.name}`:m.from?.name}{!m.read&&folder==="inbox"&&<span style={S.unreadDot}/>}</div>
                <div style={{...S.mailSubject,...(!m.read&&folder==="inbox"?{fontWeight:600,color:"#0A0A0F"}:{})}}>{m.subject}</div>
                <div style={S.mailPreview}>{m.body.slice(0,60)}...</div>
              </div>
              <div style={S.mailTime}>{timeStr(m.createdAt)}</div>
            </div>
          ))}
        </div>

        {/* Read pane / Compose */}
        <div style={S.readPane} className="mailRead">
          <button className="mailBack" onClick={() => { setSelected(null); setComposing(false) }}>← Back to mail</button>
          {composing && (
            <div style={S.composePane}>
              <div style={S.composeHead}>
                <span style={S.composeTitle}>New mail</span>
                <button onClick={() => setComposing(false)} style={S.closeBtn}>×</button>
              </div>
              {sendMsg && <div style={{...S.alert,...(sendMsg.includes("success")?S.alertOk:S.alertErr)}}>{sendMsg}</div>}
              <form onSubmit={sendMail} style={S.composeForm}>
                <div style={S.composeField}><label style={S.composeLabel}>To</label><input value={compose.toEmail} onChange={e=>setCompose(p=>({...p,toEmail:e.target.value}))} placeholder="Recipient email address" style={S.composeInput} required /></div>
                <div style={S.composeField}><label style={S.composeLabel}>Subject</label><input value={compose.subject} onChange={e=>setCompose(p=>({...p,subject:e.target.value}))} placeholder="Subject" style={S.composeInput} required /></div>
                <div style={{...S.composeField,flex:1}}><label style={S.composeLabel}>Message</label><textarea value={compose.body} onChange={e=>setCompose(p=>({...p,body:e.target.value}))} style={S.composeTextarea} rows={12} required /></div>
                <div style={S.composeActions}>
                  <button type="submit" disabled={sending} style={S.sendBtn}>{sending?"Sending...":"Send mail"}</button>
                  <button type="button" onClick={() => setComposing(false)} style={S.discardBtn}>Discard</button>
                </div>
              </form>
            </div>
          )}

          {selected && !composing && (
            <div style={S.readMail}>
              <div style={S.readHead}>
                <h2 style={S.readSubject}>{selected.subject}</h2>
                <div style={S.readActions}>
                  <button onClick={() => mailAction(selected.id,"star")} style={S.actionBtn} title="Star"><IconStar size={15} /></button>
                  <button onClick={() => mailAction(selected.id,"archive")} style={S.actionBtn} title="Archive"><IconArchive size={15} /></button>
                  <button onClick={() => mailAction(selected.id,"delete")} style={S.actionBtn} title="Delete"><IconTrash size={15} /></button>
                  <button onClick={() => { setComposing(true); setCompose(p=>({...p,toEmail:selected.from?.email,subject:`Re: ${selected.subject}`})) }} style={S.replyBtn}>Reply</button>
                </div>
              </div>
              <div style={S.readMeta}>
                <div style={{...S.mailAvatar,width:36,height:36,fontSize:13,background:"#0F6E56"}}>{initials(selected.from?.name)}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:500,color:"#0A0A0F"}}>{selected.from?.name}</div>
                  <div style={{fontSize:12,color:"#9ca3af"}}>{selected.from?.email} → {selected.to?.email}</div>
                  <div style={{fontSize:12,color:"#9ca3af"}}>{new Date(selected.createdAt).toLocaleString("en-IN",{dateStyle:"long",timeStyle:"short"})}</div>
                </div>
              </div>
              <div style={S.readBody}>{selected.body}</div>
            </div>
          )}

          {!selected && !composing && (
            <div style={S.empty}>
              <span style={{color:"#D1D5DB"}}><IconMail size={44} /></span>
              <p style={{fontSize:15,fontWeight:500,color:"#3D3D4E",marginTop:12}}>Select a mail to read</p>
              <p style={{fontSize:13,color:"#9ca3af",marginTop:4}}>Or compose a new one</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

const MAIL_CSS = `
.mailMobileBar{ display:none; }
.mailBack{ display:none; }
@media (max-width:820px){
  .mailShell{ grid-template-columns:1fr !important; }
  .mailSide{ display:none !important; }
  .mailMobileBar{ display:flex; flex-direction:column; gap:10px; padding:12px 14px; border-bottom:0.5px solid rgba(0,0,0,.07); background:#fff; }
  .mailShell[data-detail="true"] .mailListPane{ display:none !important; }
  .mailShell[data-detail="false"] .mailRead{ display:none !important; }
  .mailBack{ display:inline-flex; align-items:center; gap:6px; background:#fff; border:none; border-bottom:0.5px solid rgba(0,0,0,.06); color:#0F6E56; font-weight:600; font-size:13px; padding:12px 16px; cursor:pointer; width:100%; }
}
`
const S: Record<string,any> = {
  shell:{ display:"grid",gridTemplateColumns:"200px 280px 1fr",height:"calc(100vh - 60px)",overflow:"hidden",background:"#FAF8F2" },
  sidebar:{ background:"#fff",borderRight:"0.5px solid rgba(0,0,0,.07)",padding:"1rem .75rem",display:"flex",flexDirection:"column" as const,gap:4 },
  composeBtn:{ background:"#0F6E56",color:"#fff",border:"none",borderRadius:10,padding:"10px 14px",fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:8,textAlign:"left" as const },
  searchWrap:{ marginBottom:8 },
  searchInput:{ width:"100%",border:"0.5px solid rgba(0,0,0,.1)",borderRadius:8,padding:"6px 10px",fontSize:12,outline:"none" },
  folderBtn:{ display:"flex",justifyContent:"space-between",alignItems:"center",background:"none",border:"none",padding:"8px 10px",borderRadius:8,fontSize:13,color:"#7B7B8F",cursor:"pointer",textAlign:"left" as const },
  folderBtnOn:{ background:"#E1F5EE",color:"#0F6E56",fontWeight:500 },
  badge:{ background:"#0F6E56",color:"#fff",borderRadius:999,fontSize:10,fontWeight:700,padding:"1px 6px",minWidth:18,textAlign:"center" as const },
  mailList:{ background:"#fff",borderRight:"0.5px solid rgba(0,0,0,.07)",overflow:"auto",display:"flex",flexDirection:"column" as const },
  listHead:{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.25rem",borderBottom:"0.5px solid rgba(0,0,0,.06)" },
  listTitle:{ fontSize:14,fontWeight:600,color:"#0A0A0F" },
  mailItem:{ display:"flex",alignItems:"flex-start",gap:10,padding:"12px 1.25rem",borderBottom:"0.5px solid rgba(0,0,0,.04)",cursor:"pointer",transition:"background .12s" },
  mailItemOn:{ background:"#E1F5EE" },
  mailAvatar:{ width:38,height:38,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,color:"#fff",flexShrink:0 },
  mailInfo:{ flex:1,minWidth:0 },
  mailFrom:{ fontSize:13,fontWeight:500,color:"#0A0A0F",display:"flex",alignItems:"center",gap:6 },
  mailSubject:{ fontSize:12,color:"#3D3D4E",marginTop:1 },
  mailPreview:{ fontSize:11,color:"#9ca3af",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const },
  mailTime:{ fontSize:11,color:"#9ca3af",flexShrink:0,marginTop:2 },
  unreadDot:{ width:7,height:7,borderRadius:"50%",background:"#0F6E56",flexShrink:0 },
  readPane:{ overflow:"auto",display:"flex",flexDirection:"column" as const },
  composePane:{ display:"flex",flexDirection:"column" as const,height:"100%",padding:"1.25rem" },
  composeHead:{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem" },
  composeTitle:{ fontSize:16,fontWeight:600,color:"#0A0A0F" },
  closeBtn:{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#9ca3af",lineHeight:1 },
  composeForm:{ display:"flex",flexDirection:"column" as const,gap:10,flex:1 },
  composeField:{ display:"flex",flexDirection:"column" as const,gap:4 },
  composeLabel:{ fontSize:11,fontWeight:500,color:"#9ca3af",textTransform:"uppercase" as const,letterSpacing:".06em" },
  composeInput:{ border:"0.5px solid rgba(0,0,0,.12)",borderRadius:8,padding:"8px 11px",fontSize:13,outline:"none",color:"#0A0A0F" },
  composeTextarea:{ border:"0.5px solid rgba(0,0,0,.12)",borderRadius:8,padding:"10px 12px",fontSize:13,outline:"none",resize:"vertical" as const,fontFamily:"inherit",flex:1 },
  composeActions:{ display:"flex",gap:8 },
  sendBtn:{ background:"#0F6E56",color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",fontSize:13,fontWeight:500,cursor:"pointer" },
  discardBtn:{ background:"none",border:"0.5px solid rgba(0,0,0,.1)",color:"#6b7280",borderRadius:8,padding:"9px 16px",fontSize:13,cursor:"pointer" },
  alert:{ borderRadius:8,padding:"8px 12px",fontSize:13,marginBottom:8 },
  alertOk:{ background:"#ECFDF5",color:"#047857" },
  alertErr:{ background:"#FEF2F2",color:"#B91C1C" },
  readMail:{ padding:"1.5rem",overflow:"auto" },
  readHead:{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1rem",gap:12 },
  readSubject:{ fontSize:20,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px",flex:1 },
  readActions:{ display:"flex",gap:6,flexShrink:0 },
  actionBtn:{ background:"none",border:"0.5px solid rgba(0,0,0,.1)",borderRadius:8,padding:"6px 10px",fontSize:14,cursor:"pointer" },
  replyBtn:{ background:"#0F6E56",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:500,cursor:"pointer" },
  readMeta:{ display:"flex",gap:10,alignItems:"flex-start",padding:"1rem",background:"#F9F9FC",borderRadius:10,marginBottom:"1.25rem" },
  readBody:{ fontSize:14,color:"#3D3D4E",lineHeight:1.8,whiteSpace:"pre-wrap" as const },
  empty:{ flex:1,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",color:"#9ca3af" },
}