"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconEdit, IconMessage } from "@/components/ui/Icons"

// Production sets NEXT_PUBLIC_WS_URL to a wss:// endpoint; dev falls back to localhost.
const WS_URL = process.env.NEXT_PUBLIC_WS_URL
  || (typeof window !== "undefined" && window.location.protocol === "https:"
    ? `wss://${window.location.host.replace(/:\d+$/, "")}:3001`
    : "ws://localhost:3001")

export default function MessagesPage() {
  const [user, setUser] = useState<any>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [active, setActive] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const [wsReady, setWsReady] = useState(false)
  const [newUserId, setNewUserId] = useState("")
  const [showNew, setShowNew] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<any>(null)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.user) {
        setUser(d.user)
        loadConversations()
        initWS(d.user)
      }
    })
  }, [])

  function initWS(u: any) {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    ws.onopen = () => {
      const token = document.cookie.split(";").find(c => c.trim().startsWith("er_token="))?.split("=")[1]
      if (token) ws.send(JSON.stringify({ type: "AUTH", token }))
    }
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === "AUTH_OK") { setWsReady(true) }
      if (msg.type === "NEW_MESSAGE") {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.message.id)) return prev
          return [...prev, msg.message]
        })
        setConversations(prev => prev.map(c =>
          c.id === msg.message.conversationId
            ? { ...c, messages: [msg.message], updatedAt: new Date().toISOString() }
            : c
        ).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()))
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      }
      if (msg.type === "TYPING") { setTyping(true); clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => setTyping(false), 2000) }
    }
    ws.onclose = () => { setWsReady(false); setTimeout(() => initWS(u), 3000) }
  }

  async function loadConversations() {
    const d = await fetch("/api/messages/conversations").then(r => r.json())
    setConversations(d.conversations || [])
  }

  async function openConvo(convo: any) {
    setActive(convo)
    setTyping(false)
    const d = await fetch(`/api/messages/${convo.id}`).then(r => r.json())
    setMessages(d.messages || [])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 50)
    wsRef.current?.send(JSON.stringify({ type: "READ", conversationId: convo.id }))
  }

  function sendMessage() {
    if (!input.trim() || !active || !wsReady) return
    wsRef.current?.send(JSON.stringify({ type: "MESSAGE", conversationId: active.id, content: input.trim() }))
    setInput("")
  }

  function onType(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value)
    if (active && wsReady) wsRef.current?.send(JSON.stringify({ type: "TYPING", conversationId: active.id }))
  }

  async function startConvo() {
    if (!newUserId.trim()) return
    const res = await fetch("/api/messages/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientId: newUserId.trim() }) })
    const data = await res.json()
    if (data.conversation) { setShowNew(false); setNewUserId(""); await loadConversations(); openConvo(data.conversation) }
  }

  const getOther = (convo: any) => convo.participants?.find((p: any) => p.userId !== user?.id)?.user
  const initials = (name: string) => name?.split(" ").map((n: string) => n[0]).join("").slice(0,2).toUpperCase() || "?"
  const timeStr = (iso: string) => { const d = new Date(iso); return d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}) }
  const dateStr = (iso: string) => { const d = new Date(iso); const now = new Date(); if(d.toDateString()===now.toDateString()) return timeStr(iso); return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"}) }

  return (
    <AppShell>
      <style>{MSG_CSS}</style>
      <div style={S.shell} className="msgShell" data-active={active ? "true" : "false"}>
        {/* Sidebar */}
        <aside style={S.sidebar} className="msgSide">
          <div style={S.sideHead}>
            <span style={S.sideTitle}>Messages</span>
            <button onClick={() => setShowNew(!showNew)} style={S.newBtn} title="New message"><IconEdit size={15} /></button>
          </div>
          {showNew && (
            <div style={S.newConvo}>
              <input value={newUserId} onChange={e=>setNewUserId(e.target.value)} placeholder="Enter user ID to message" style={S.newInput} />
              <button onClick={startConvo} style={S.newSend}>Start</button>
            </div>
          )}
          <div style={S.convoList}>
            {conversations.length === 0 && <p style={S.empty}>No conversations yet.</p>}
            {conversations.map(c => {
              const other = getOther(c)
              const last = c.messages?.[0]
              return (
                <div key={c.id} onClick={() => openConvo(c)} style={{...S.convoItem, ...(active?.id===c.id?S.convoItemOn:{})}}>
                  <div style={{...S.avatar, background:"#0F6E56"}}>{initials(other?.name||"?")}</div>
                  <div style={S.convoInfo}>
                    <div style={S.convoName}>{other?.name || "Unknown"}</div>
                    <div style={S.convoLast}>{last?.content ? (last.content.length>35?last.content.slice(0,35)+"...":last.content) : "Start a conversation"}</div>
                  </div>
                  {last && <div style={S.convoTime}>{dateStr(last.createdAt)}</div>}
                </div>
              )
            })}
          </div>
        </aside>

        {/* Chat area */}
        <div style={S.chat} className="msgChat">
          {!active ? (
            <div style={S.empty2}>
              <div style={{color:"#D1D5DB",marginBottom:12}}><IconMessage size={38} /></div>
              <p style={{fontSize:16,fontWeight:500,color:"#3D3D4E"}}>Select a conversation</p>
              <p style={{fontSize:13,color:"#9ca3af",marginTop:4}}>Or start a new one with the compose button above</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={S.chatHead}>
                <button className="msgBack" onClick={() => setActive(null)} aria-label="Back">←</button>
                <div style={{...S.avatar, background:"#0F6E56", width:38, height:38, fontSize:14}}>{initials(getOther(active)?.name||"?")}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:"#0A0A0F"}}>{getOther(active)?.name || "Unknown"}</div>
                  <div style={{fontSize:12,color: wsReady?"#059669":"#9ca3af"}}>{wsReady?"Online":"Connecting..."}</div>
                </div>
              </div>

              {/* Messages */}
              <div style={S.msgArea}>
                {messages.map((m, i) => {
                  const isMe = m.senderId === user?.id
                  const showDate = i === 0 || new Date(messages[i-1].createdAt).toDateString() !== new Date(m.createdAt).toDateString()
                  return (
                    <div key={m.id}>
                      {showDate && <div style={S.dateSep}>{new Date(m.createdAt).toLocaleDateString("en-IN",{weekday:"long",month:"long",day:"numeric"})}</div>}
                      <div style={{...S.msgRow, justifyContent: isMe?"flex-end":"flex-start"}}>
                        {!isMe && <div style={{...S.avatar, width:28,height:28,fontSize:11,background:"#0F6E56",flexShrink:0}}>{initials(m.sender?.name||"?")}</div>}
                        <div style={{...S.bubble, ...(isMe?S.bubbleMe:S.bubbleThem)}}>
                          <div style={S.bubbleText}>{m.content}</div>
                          <div style={S.bubbleTime}>{timeStr(m.createdAt)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {typing && (
                  <div style={{...S.msgRow, justifyContent:"flex-start"}}>
                    <div style={{...S.bubble,...S.bubbleThem, padding:"8px 14px"}}>
                      <span style={{letterSpacing:2, fontSize:18, color:"#9ca3af"}}>···</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={S.inputRow}>
                <input
                  value={input}
                  onChange={onType}
                  onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage()} }}
                  placeholder="Type a message..."
                  style={S.msgInput}
                />
                <button onClick={sendMessage} disabled={!input.trim()||!wsReady} style={S.sendBtn}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

const MSG_CSS = `
.msgBack{ display:none; }
@media (max-width:820px){
  .msgShell{ grid-template-columns:1fr !important; }
  .msgShell[data-active="true"] .msgSide{ display:none !important; }
  .msgShell[data-active="false"] .msgChat{ display:none !important; }
  .msgBack{ display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; margin-right:2px; border:none; background:#F3F0E7; border-radius:8px; font-size:18px; color:#0F6E56; cursor:pointer; }
}
`
const S: Record<string,any> = {
  shell: { display:"grid", gridTemplateColumns:"300px 1fr", height:"calc(100vh - 60px)", overflow:"hidden", background:"#FAF8F2" },
  sidebar: { background:"#fff", borderRight:"0.5px solid rgba(0,0,0,.08)", display:"flex", flexDirection:"column", overflow:"hidden" },
  sideHead: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1rem 1.25rem", borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  sideTitle: { fontSize:16, fontWeight:600, color:"#0A0A0F" },
  newBtn: { background:"none", border:"0.5px solid rgba(0,0,0,.1)", borderRadius:8, width:32, height:32, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  newConvo: { padding:"10px 1.25rem", borderBottom:"0.5px solid rgba(0,0,0,.07)", display:"flex", gap:8 },
  newInput: { flex:1, border:"0.5px solid rgba(0,0,0,.13)", borderRadius:8, padding:"7px 10px", fontSize:13, outline:"none" },
  newSend: { background:"#0F6E56", color:"#fff", border:"none", borderRadius:8, padding:"7px 14px", fontSize:13, cursor:"pointer" },
  convoList: { flex:1, overflowY:"auto" as const, padding:"8px 0" },
  convoItem: { display:"flex", alignItems:"center", gap:10, padding:"10px 1.25rem", cursor:"pointer", transition:"background .15s" },
  convoItemOn: { background:"#E1F5EE" },
  avatar: { width:42, height:42, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:600, color:"#fff", flexShrink:0 },
  convoInfo: { flex:1, minWidth:0 },
  convoName: { fontSize:14, fontWeight:500, color:"#0A0A0F", whiteSpace:"nowrap" as const, overflow:"hidden", textOverflow:"ellipsis" },
  convoLast: { fontSize:12, color:"#9ca3af", marginTop:2, whiteSpace:"nowrap" as const, overflow:"hidden", textOverflow:"ellipsis" },
  convoTime: { fontSize:11, color:"#9ca3af", flexShrink:0 },
  empty: { fontSize:13, color:"#9ca3af", padding:"1rem 1.25rem" },
  chat: { display:"flex", flexDirection:"column" as const, height:"100%", overflow:"hidden" },
  empty2: { flex:1, display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center" },
  chatHead: { display:"flex", alignItems:"center", gap:10, padding:"1rem 1.5rem", background:"#fff", borderBottom:"0.5px solid rgba(0,0,0,.08)" },
  msgArea: { flex:1, overflowY:"auto" as const, padding:"1.25rem 1.5rem", display:"flex", flexDirection:"column" as const, gap:4 },
  dateSep: { textAlign:"center" as const, fontSize:12, color:"#9ca3af", margin:"12px 0", padding:"4px 12px", background:"rgba(0,0,0,.04)", borderRadius:999, display:"inline-block", alignSelf:"center" as const },
  msgRow: { display:"flex", alignItems:"flex-end", gap:8 },
  bubble: { maxWidth:"65%", padding:"9px 14px", borderRadius:14 },
  bubbleMe: { background:"#0F6E56", color:"#fff", borderBottomRightRadius:4 },
  bubbleThem: { background:"#fff", border:"0.5px solid rgba(0,0,0,.08)", color:"#0A0A0F", borderBottomLeftRadius:4 },
  bubbleText: { fontSize:14, lineHeight:1.55, wordBreak:"break-word" as const },
  bubbleTime: { fontSize:10, marginTop:4, opacity:.6, textAlign:"right" as const },
  inputRow: { display:"flex", gap:8, padding:"1rem 1.5rem", background:"#fff", borderTop:"0.5px solid rgba(0,0,0,.08)", alignItems:"center" },
  msgInput: { flex:1, border:"0.5px solid rgba(0,0,0,.13)", borderRadius:12, padding:"10px 14px", fontSize:14, outline:"none", fontFamily:"inherit" },
  sendBtn: { width:42, height:42, borderRadius:12, background:"#0F6E56", border:"none", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, transition:"background .15s" },
}