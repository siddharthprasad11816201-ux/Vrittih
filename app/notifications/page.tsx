"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconFileText, IconTarget, IconMessage, IconAward, IconNetwork, IconBell } from "@/components/ui/Icons"

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unread, setUnread] = useState(0)
  const [filter, setFilter] = useState<"all"|"unread">("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const d = await fetch("/api/notifications").then(r => r.json())
    setNotifications(d.notifications || [])
    setUnread(d.unread || 0)
    setLoading(false)
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id }) })
    setNotifications(prev => prev.map(n => n.id === id ? {...n, read:true} : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ markAllRead:true }) })
    setNotifications(prev => prev.map(n => ({...n, read:true})))
    setUnread(0)
  }

  async function deleteNotif(id: string) {
    await fetch("/api/notifications", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id }) })
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return "just now"
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h/24)}d ago`
  }

  function getIcon(title: string) {
    const t = title.toLowerCase()
    if (t.includes("application") || t.includes("applied")) return { icon: <IconFileText size={17} />, color: "#534AB7" }
    if (t.includes("interview")) return { icon: <IconTarget size={17} />, color: "#B45309" }
    if (t.includes("message")) return { icon: <IconMessage size={17} />, color: "#0891B2" }
    if (t.includes("offer") || t.includes("hired")) return { icon: <IconAward size={17} />, color: "#059669" }
    if (t.includes("connection")) return { icon: <IconNetwork size={17} />, color: "#1D4ED8" }
    return { icon: <IconBell size={17} />, color: "#6B7280" }
  }

  const filtered = filter === "unread" ? notifications.filter(n => !n.read) : notifications

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <div>
              <h1 style={S.title}>Notifications</h1>
              {unread > 0 && <p style={S.sub}>{unread} unread notification{unread !== 1 ? "s" : ""}</p>}
            </div>
            <div style={S.actions}>
              {unread > 0 && <button onClick={markAllRead} style={S.btn}>Mark all as read</button>}
            </div>
          </div>

          <div style={S.filters}>
            {(["all","unread"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{...S.filterBtn, ...(filter===f?S.filterOn:{})}}>
                {f === "all" ? "All" : `Unread (${unread})`}
              </button>
            ))}
          </div>

          <div style={S.list}>
            {loading && <div style={S.empty}><p style={{color:"#9ca3af"}}>Loading...</p></div>}
            {!loading && filtered.length === 0 && (
              <div style={S.empty}>
                <span style={{color:"#D1D5DB"}}><IconBell size={44} /></span>
                <p style={{fontSize:15,fontWeight:500,color:"#3D3D4E",marginTop:12}}>
                  {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
                <p style={{fontSize:13,color:"#9ca3af",marginTop:4}}>
                  {filter === "unread" ? "You are all caught up!" : "Activity on your account will appear here."}
                </p>
              </div>
            )}
            {filtered.map(n => (
              <div key={n.id} style={{...S.item, ...(n.read?{}:S.itemUnread)}}>
                {(() => { const g = getIcon(n.title); return <div style={{...S.icon,background:`${g.color}14`,color:g.color}}>{g.icon}</div> })()}
                <div style={S.body} onClick={() => { markRead(n.id); if(n.link) window.location.href = n.link }}>
                  <div style={S.ntitle}>{n.title}</div>
                  <div style={S.ntext}>{n.body}</div>
                  <div style={S.ntime}>{timeAgo(n.createdAt)}</div>
                </div>
                <div style={S.itemRight}>
                  {!n.read && <div style={S.dot} />}
                  <button onClick={() => deleteNotif(n.id)} style={S.del} title="Delete">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page: { background:"#F7F7FA", minHeight:"calc(100vh - 60px)", padding:"2rem" },
  wrap: { maxWidth:680, margin:"0 auto" },
  header: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.5rem" },
  title: { fontSize:22, fontWeight:600, color:"#0A0A0F", letterSpacing:"-.3px" },
  sub: { fontSize:13, color:"#7B7B8F", marginTop:3 },
  actions: { display:"flex", gap:8 },
  btn: { background:"#534AB7", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:500, cursor:"pointer" },
  filters: { display:"flex", gap:8, marginBottom:"1.25rem" },
  filterBtn: { background:"none", border:"0.5px solid rgba(0,0,0,.1)", borderRadius:8, padding:"6px 14px", fontSize:13, color:"#7B7B8F", cursor:"pointer", transition:"all .15s" },
  filterOn: { background:"#534AB7", color:"#fff", border:"0.5px solid #534AB7", fontWeight:500 },
  list: { display:"flex", flexDirection:"column" as const, gap:8 },
  empty: { display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", padding:"4rem", background:"#fff", borderRadius:14, border:"0.5px solid rgba(0,0,0,.07)" },
  item: { display:"flex", alignItems:"flex-start", gap:12, padding:"1rem 1.25rem", background:"#fff", border:"0.5px solid rgba(0,0,0,.07)", borderRadius:12, cursor:"pointer", transition:"all .15s" },
  itemUnread: { background:"rgba(83,74,183,.03)", borderColor:"rgba(83,74,183,.15)" },
  icon: { width:34, height:34, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 },
  body: { flex:1, minWidth:0 },
  ntitle: { fontSize:14, fontWeight:500, color:"#0A0A0F", marginBottom:3 },
  ntext: { fontSize:13, color:"#6b7280", lineHeight:1.55 },
  ntime: { fontSize:12, color:"#9ca3af", marginTop:5 },
  itemRight: { display:"flex", flexDirection:"column" as const, alignItems:"center", gap:8, flexShrink:0 },
  dot: { width:8, height:8, borderRadius:"50%", background:"#534AB7" },
  del: { background:"none", border:"none", fontSize:18, color:"#9ca3af", cursor:"pointer", lineHeight:1, padding:0 },
}