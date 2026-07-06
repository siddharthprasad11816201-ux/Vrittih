"use client"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { IconFileText, IconTarget, IconMessage, IconAward, IconBell } from "@/components/ui/Icons"

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  async function load() {
    const d = await fetch("/api/notifications").then(r => r.json())
    setNotifications(d.notifications || [])
    setUnread(d.unread || 0)
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAllRead: true }) })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  async function deleteRead() {
    await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
    setNotifications(prev => prev.filter(n => !n.read))
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return "just now"
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  function getIcon(title: string) {
    const t = title.toLowerCase()
    if (t.includes("application") || t.includes("applied")) return { icon: <IconFileText size={15} />, color: "#534AB7" }
    if (t.includes("interview")) return { icon: <IconTarget size={15} />, color: "#B45309" }
    if (t.includes("message")) return { icon: <IconMessage size={15} />, color: "#0891B2" }
    if (t.includes("offer") || t.includes("hired")) return { icon: <IconAward size={15} />, color: "#059669" }
    return { icon: <IconBell size={15} />, color: "#6B7280" }
  }

  return (
    <div ref={ref} style={S.wrap}>
      <button onClick={() => { setOpen(!open); if (!open) load() }} style={S.bell} aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        {unread > 0 && <span style={S.badge}>{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div style={S.dropdown}>
          <div style={S.dropHead}>
            <span style={S.dropTitle}>Notifications</span>
            <div style={S.dropActions}>
              {unread > 0 && <button onClick={markAllRead} style={S.dropBtn}>Mark all read</button>}
              <button onClick={deleteRead} style={S.dropBtn}>Clear read</button>
            </div>
          </div>

          <div style={S.list}>
            {notifications.length === 0 && (
              <div style={S.empty}>
                <span style={{color:"#D1D5DB"}}><IconBell size={30} /></span>
                <p style={{fontSize:13,color:"#9ca3af",marginTop:8}}>No notifications yet</p>
              </div>
            )}
            {notifications.map(n => (
              <div key={n.id} onClick={() => { markRead(n.id); if (n.link) window.location.href = n.link }} style={{...S.item, ...(n.read ? {} : S.itemUnread)}}>
                {(() => { const g = getIcon(n.title); return <div style={{...S.itemIcon,background:`${g.color}14`,color:g.color}}>{g.icon}</div> })()}
                <div style={S.itemBody}>
                  <div style={S.itemTitle}>{n.title}</div>
                  <div style={S.itemText}>{n.body}</div>
                  <div style={S.itemTime}>{timeAgo(n.createdAt)}</div>
                </div>
                {!n.read && <div style={S.unreadDot} />}
              </div>
            ))}
          </div>

          <div style={S.dropFoot}>
            <Link href="/notifications" style={S.viewAll} onClick={() => setOpen(false)}>View all notifications</Link>
          </div>
        </div>
      )}
    </div>
  )
}

const S: Record<string,any> = {
  wrap: { position:"relative" as const },
  bell: { width:36, height:36, borderRadius:9, background:"rgba(255,255,255,.05)", border:"0.5px solid rgba(255,255,255,.1)", color:"rgba(255,255,255,.8)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", position:"relative" as const, transition:"all .15s" },
  badge: { position:"absolute" as const, top:-4, right:-4, background:"#EF4444", color:"#fff", borderRadius:999, fontSize:9, fontWeight:700, minWidth:16, height:16, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 4px", border:"2px solid #08080F" },
  dropdown: { position:"absolute" as const, right:0, top:"calc(100% + 10px)", width:360, background:"#fff", border:"0.5px solid rgba(0,0,0,.1)", borderRadius:16, boxShadow:"0 16px 48px rgba(0,0,0,.15)", zIndex:200, overflow:"hidden" },
  dropHead: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 16px", borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  dropTitle: { fontSize:15, fontWeight:600, color:"#0A0A0F" },
  dropActions: { display:"flex", gap:8 },
  dropBtn: { background:"none", border:"none", fontSize:12, color:"#534AB7", cursor:"pointer", padding:"3px 6px" },
  list: { maxHeight:380, overflowY:"auto" as const },
  empty: { display:"flex", flexDirection:"column" as const, alignItems:"center", justifyContent:"center", padding:"2rem" },
  item: { display:"flex", alignItems:"flex-start", gap:10, padding:"12px 16px", cursor:"pointer", borderBottom:"0.5px solid rgba(0,0,0,.05)", transition:"background .15s" },
  itemUnread: { background:"rgba(83,74,183,.04)" },
  itemIcon: { width:30, height:30, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 },
  itemBody: { flex:1, minWidth:0 },
  itemTitle: { fontSize:13, fontWeight:500, color:"#0A0A0F", marginBottom:2 },
  itemText: { fontSize:12, color:"#6b7280", lineHeight:1.5 },
  itemTime: { fontSize:11, color:"#9ca3af", marginTop:4 },
  unreadDot: { width:8, height:8, borderRadius:"50%", background:"#534AB7", flexShrink:0, marginTop:4 },
  dropFoot: { padding:"10px 16px", borderTop:"0.5px solid rgba(0,0,0,.07)", textAlign:"center" as const },
  viewAll: { fontSize:13, color:"#534AB7", textDecoration:"none", fontWeight:500 },
}