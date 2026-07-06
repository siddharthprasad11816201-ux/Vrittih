"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconUsers, IconMapPin, IconInbox, IconZap } from "@/components/ui/Icons"

export default function NetworkPage() {
  const [tab, setTab] = useState<"connections"|"requests"|"suggestions">("suggestions")
  const [connections, setConnections] = useState<any[]>([])
  const [received, setReceived] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [netData, sugData] = await Promise.all([
      fetch("/api/network").then(r => r.json()),
      fetch("/api/network/suggestions").then(r => r.json()),
    ])
    const pending = (netData.received || []).filter((c: any) => c.status === "PENDING")
    const accepted = (netData.connections || [])
    setReceived(pending)
    setConnections(accepted)
    setSuggestions(sugData.suggestions || [])
    setLoading(false)
  }

  async function connect(userId: string) {
    setPending(p => new Set([...p, userId]))
    await fetch("/api/network/connect", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ recipientId:userId }) })
    setSuggestions(prev => prev.filter(u => u.id !== userId))
  }

  async function respond(connectionId: string, action: "ACCEPTED"|"REJECTED") {
    await fetch("/api/network/respond", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ connectionId, action }) })
    setReceived(prev => prev.filter(c => c.id !== connectionId))
    if (action === "ACCEPTED") load()
  }

  const initials = (name: string) => name?.split(" ").map((n:string)=>n[0]).join("").slice(0,2).toUpperCase()||"?"
  const colors = ["#534AB7","#059669","#B45309","#DC2626","#0891B2","#534AB7"]
  const getColor = (id: string) => colors[id.charCodeAt(0) % colors.length]

  const filteredConnections = connections.filter(c => {
    const other = c.userId === c.connectedId ? c.user : (c.user?.name ? c.user : c.connected)
    return other?.name?.toLowerCase().includes(search.toLowerCase())
  })

  const TABS = [
    { key:"suggestions", label:"Suggestions", count: suggestions.length },
    { key:"requests", label:"Requests", count: received.length },
    { key:"connections", label:"My network", count: connections.length },
  ]

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <h1 style={S.title}>Network</h1>
            <p style={S.sub}>Build your professional network</p>
          </div>

          <div style={S.tabs}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key as any)} style={{...S.tab,...(tab===t.key?S.tabOn:{})}}>
                {t.label}
                {t.count > 0 && <span style={{...S.badge,...(tab===t.key?S.badgeOn:{})}}>{t.count}</span>}
              </button>
            ))}
          </div>

          {tab === "connections" && (
            <div>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your connections..." style={S.search} />
              {loading ? <div style={S.empty}><p style={{color:"#9ca3af"}}>Loading...</p></div> :
              filteredConnections.length === 0 ? (
                <div style={S.empty}>
                  <span style={{color:"#D1D5DB"}}><IconUsers size={38} /></span>
                  <p style={{fontSize:15,fontWeight:500,color:"#3D3D4E",marginTop:12}}>No connections yet</p>
                  <p style={{fontSize:13,color:"#9ca3af",marginTop:4}}>Start connecting with people in your industry.</p>
                </div>
              ) : (
                <div style={S.grid}>
                  {filteredConnections.map(c => {
                    const other = c.user?.id !== c.connectedId ? c.connected : c.user
                    if (!other) return null
                    return (
                      <div key={c.id} style={S.card}>
                        <div style={{...S.avatar, background:getColor(other.id)}}>{initials(other.name)}</div>
                        <div style={S.cardName}>{other.name}</div>
                        {other.headline && <div style={S.cardHead}>{other.headline}</div>}
                        {other.location && <div style={{...S.cardLoc,display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}><IconMapPin size={12} /> {other.location}</div>}
                        <div style={S.cardActions}>
                          <button onClick={async()=>{ const res=await fetch("/api/messages/conversations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipientId:other.id})}); const d=await res.json(); if(d.conversation) window.location.href="/messages" }} style={S.msgBtn}>Message</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "requests" && (
            <div>
              {received.length === 0 ? (
                <div style={S.empty}>
                  <span style={{color:"#D1D5DB"}}><IconInbox size={38} /></span>
                  <p style={{fontSize:15,fontWeight:500,color:"#3D3D4E",marginTop:12}}>No pending requests</p>
                </div>
              ) : (
                <div style={S.grid}>
                  {received.map(c => (
                    <div key={c.id} style={S.card}>
                      <div style={{...S.avatar, background:getColor(c.user.id)}}>{initials(c.user.name)}</div>
                      <div style={S.cardName}>{c.user.name}</div>
                      {c.user.headline && <div style={S.cardHead}>{c.user.headline}</div>}
                      {c.user.location && <div style={{...S.cardLoc,display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}><IconMapPin size={12} /> {c.user.location}</div>}
                      <div style={S.cardActions}>
                        <button onClick={() => respond(c.id,"ACCEPTED")} style={S.acceptBtn}>Accept</button>
                        <button onClick={() => respond(c.id,"REJECTED")} style={S.rejectBtn}>Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "suggestions" && (
            <div>
              {loading ? <div style={S.empty}><p style={{color:"#9ca3af"}}>Loading...</p></div> :
              suggestions.length === 0 ? (
                <div style={S.empty}>
                  <span style={{color:"#D1D5DB"}}><IconZap size={38} /></span>
                  <p style={{fontSize:15,fontWeight:500,color:"#3D3D4E",marginTop:12}}>No suggestions right now</p>
                  <p style={{fontSize:13,color:"#9ca3af",marginTop:4}}>Check back later as more people join.</p>
                </div>
              ) : (
                <div style={S.grid}>
                  {suggestions.map(u => (
                    <div key={u.id} style={S.card}>
                      <div style={{...S.avatar, background:getColor(u.id)}}>{initials(u.name)}</div>
                      <div style={S.cardName}>{u.name}</div>
                      {u.headline && <div style={S.cardHead}>{u.headline}</div>}
                      {u.location && <div style={{...S.cardLoc,display:"flex",alignItems:"center",gap:4,justifyContent:"center"}}><IconMapPin size={12} /> {u.location}</div>}
                      <span style={{...S.rolePill, background:u.role==="EMPLOYER"?"#FEF3C7":"#EFF4FF", color:u.role==="EMPLOYER"?"#92400E":"#534AB7"}}>{u.role}</span>
                      <div style={S.cardActions}>
                        <button
                          onClick={() => connect(u.id)}
                          disabled={pending.has(u.id)}
                          style={{...S.connectBtn,...(pending.has(u.id)?S.connectBtnDone:{})}}
                        >
                          {pending.has(u.id) ? "Request sent ✓" : "+ Connect"}
                        </button>
                      </div>
                    </div>
                  ))}
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
  page: { background:"#F7F7FA", minHeight:"calc(100vh - 60px)", padding:"2rem" },
  wrap: { maxWidth:1100, margin:"0 auto" },
  header: { marginBottom:"1.5rem" },
  title: { fontSize:22, fontWeight:600, color:"#0A0A0F", letterSpacing:"-.3px" },
  sub: { fontSize:13, color:"#7B7B8F", marginTop:3 },
  tabs: { display:"flex", gap:4, marginBottom:"1.5rem", background:"#fff", padding:4, borderRadius:12, border:"0.5px solid rgba(0,0,0,.07)", width:"fit-content" },
  tab: { display:"flex", alignItems:"center", gap:7, padding:"7px 16px", borderRadius:9, border:"none", background:"none", fontSize:13, color:"#7B7B8F", cursor:"pointer", transition:"all .15s", fontWeight:400 },
  tabOn: { background:"#534AB7", color:"#fff", fontWeight:500 },
  badge: { background:"rgba(0,0,0,.08)", color:"#7B7B8F", borderRadius:999, fontSize:11, fontWeight:600, padding:"1px 7px" },
  badgeOn: { background:"rgba(255,255,255,.2)", color:"#fff" },
  search: { width:"100%", maxWidth:400, border:"0.5px solid rgba(0,0,0,.13)", borderRadius:10, padding:"9px 14px", fontSize:14, outline:"none", marginBottom:"1.25rem", fontFamily:"inherit" },
  grid: { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12 },
  card: { background:"#fff", border:"0.5px solid rgba(0,0,0,.08)", borderRadius:14, padding:"1.5rem", display:"flex", flexDirection:"column" as const, alignItems:"center", textAlign:"center" as const, gap:6, transition:"box-shadow .2s" },
  avatar: { width:60, height:60, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:600, color:"#fff", marginBottom:4 },
  cardName: { fontSize:15, fontWeight:600, color:"#0A0A0F" },
  cardHead: { fontSize:12, color:"#6b7280", lineHeight:1.4 },
  cardLoc: { fontSize:12, color:"#9ca3af" },
  rolePill: { fontSize:11, fontWeight:500, padding:"3px 10px", borderRadius:999 },
  cardActions: { display:"flex", gap:8, marginTop:8, width:"100%" },
  connectBtn: { flex:1, background:"#534AB7", color:"#fff", border:"none", borderRadius:8, padding:"8px 0", fontSize:13, fontWeight:500, cursor:"pointer", transition:"all .15s" },
  connectBtnDone: { background:"#EFF4FF", color:"#534AB7", cursor:"default" },
  acceptBtn: { flex:1, background:"#534AB7", color:"#fff", border:"none", borderRadius:8, padding:"8px 0", fontSize:13, fontWeight:500, cursor:"pointer" },
  rejectBtn: { flex:1, background:"none", border:"0.5px solid rgba(0,0,0,.13)", color:"#6b7280", borderRadius:8, padding:"8px 0", fontSize:13, cursor:"pointer" },
  msgBtn: { flex:1, background:"none", border:"0.5px solid rgba(83,74,183,.3)", color:"#534AB7", borderRadius:8, padding:"8px 0", fontSize:13, fontWeight:500, cursor:"pointer" },
  empty: { display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", padding:"4rem", background:"#fff", borderRadius:14, border:"0.5px solid rgba(0,0,0,.07)" },
}