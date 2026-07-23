"use client"
import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import CrmShell from "@/components/crm/CrmShell"
import { IconMail, IconPhone, IconBriefcase, IconMapPin, IconTrash, IconActivity, IconMessage, IconFileText } from "@/components/ui/Icons"
import { STAGES, STAGE_META, formatMoney, initials, avatarColor } from "@/lib/crmMeta"

const ACTIVITY_LABEL: Record<string, (p: any) => string> = {
  "contact.created": () => "Contact created",
  "contact.updated": () => "Details updated",
  "stage.changed": (p) => `Stage moved ${STAGE_META[p.from]?.label || p.from} → ${STAGE_META[p.to]?.label || p.to}`,
  "message.sent": (p) => `You sent: “${p.preview || ""}”`,
  "message.received": (p) => `Received: “${p.preview || ""}”`,
  "note.added": () => "Note added",
}

export default function ContactDetail() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState<"activity" | "messages" | "notes">("activity")
  const [msg, setMsg] = useState("")
  const [notes, setNotes] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const d = await fetch(`/api/crm/contacts/${id}`).then(r => r.json())
    if (d.error) { router.push("/contacts"); return }
    setData(d); setNotes(d.contact.notes || "")
  }, [id, router])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (tab === "messages") setTimeout(() => bottomRef.current?.scrollIntoView(), 50) }, [tab, data])

  async function patch(body: any) {
    const d = await fetch(`/api/crm/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json())
    if (d.success) load()
  }
  async function send(direction: "in" | "out") {
    if (!msg.trim()) return
    setSending(true)
    await fetch(`/api/crm/contacts/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: msg.trim(), direction }) })
    setMsg(""); setSending(false); load()
  }
  async function remove() {
    if (!confirm("Delete this contact? This cannot be undone.")) return
    await fetch(`/api/crm/contacts/${id}`, { method: "DELETE" }); router.push("/contacts")
  }

  if (!data) return <CrmShell><div style={{ padding: "3rem", color: "#8A8595" }}>Loading…</div></CrmShell>
  const c = data.contact
  const m = STAGE_META[c.stage] || STAGE_META.LEAD
  const timeAgo = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if (d < 1) return "just now"; if (d < 60) return `${d}m ago`; const h = Math.floor(d / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago` }

  return (
    <CrmShell>
      <div style={S.wrap}>
        <Link href="/contacts" style={S.back}>← Contacts</Link>

        <div style={S.header}>
          <div style={{ ...S.avatar, background: avatarColor(c.id) }}>{initials(c.firstName, c.lastName)}</div>
          <div style={{ flex: 1 }}>
            <h1 style={S.name}>{c.firstName} {c.lastName}</h1>
            <div style={S.role}>{[c.jobTitle, c.company].filter(Boolean).join(" · ") || "No company"}</div>
            <div style={S.contactRow}>
              {c.email && <span style={S.ci}><IconMail size={13} /> {c.email}</span>}
              {c.phone && <span style={S.ci}><IconPhone size={13} /> {c.phone}</span>}
              {(c.city || c.country) && <span style={S.ci}><IconMapPin size={13} /> {[c.city, c.country].filter(Boolean).join(", ")}</span>}
            </div>
          </div>
          <button onClick={remove} style={S.delBtn} title="Delete contact"><IconTrash size={16} /></button>
        </div>

        <div style={S.crmStrip}>
          <div style={S.stripItem}>
            <span style={S.stripLabel}>Stage</span>
            <select value={c.stage} onChange={e => patch({ stage: e.target.value })} style={{ ...S.stageSelect, color: m.color, background: m.bg }}>
              {STAGES.map(s => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
            </select>
          </div>
          <div style={S.stripItem}><span style={S.stripLabel}>Value</span><span style={S.stripValue}>{formatMoney(c.value, c.currency)}</span></div>
          <div style={S.stripItem}><span style={S.stripLabel}>Tags</span><span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{c.tags.length ? c.tags.map((t: string) => <span key={t} style={S.tag}>{t}</span>) : <span style={{ color: "#B4B0BE", fontSize: 13 }}>—</span>}</span></div>
        </div>

        <div style={S.tabs}>
          {([["activity", "Activity", <IconActivity size={15} key="a" />], ["messages", "Messages", <IconMessage size={15} key="m" />], ["notes", "Notes", <IconFileText size={15} key="n" />]] as const).map(([k, label, icon]) => (
            <button key={k} onClick={() => setTab(k as any)} style={{ ...S.tab, ...(tab === k ? S.tabOn : {}) }}>{icon} {label}</button>
          ))}
        </div>

        {tab === "activity" && (
          <div style={S.card}>
            {data.activities.length === 0 ? <p style={S.muted}>No activity yet.</p> : (
              <div style={S.timeline}>
                {data.activities.map((a: any) => (
                  <div key={a.id} style={S.item}>
                    <div style={S.dot} />
                    <div style={{ flex: 1 }}>
                      <div style={S.tText}>{(ACTIVITY_LABEL[a.type] || (() => a.type))(a.payload)}</div>
                      <div style={S.tTime}>{timeAgo(a.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "messages" && (
          <div style={S.card}>
            <div style={S.chat}>
              {data.messages.length === 0 && <p style={S.muted}>No messages yet. Start the conversation below.</p>}
              {data.messages.map((mm: any) => (
                <div key={mm.id} style={{ display: "flex", justifyContent: mm.direction === "out" ? "flex-end" : "flex-start" }}>
                  <div style={{ ...S.bubble, ...(mm.direction === "out" ? S.bubbleOut : S.bubbleIn) }}>
                    {mm.body}
                    <span style={S.bubbleTime}>{new Date(mm.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div style={S.composer}>
              <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send("out") }} placeholder="Type a message…" style={S.composerInput} />
              <button onClick={() => send("in")} disabled={sending || !msg.trim()} style={S.logBtn} title="Log an incoming message">Log received</button>
              <button onClick={() => send("out")} disabled={sending || !msg.trim()} style={S.sendBtn}>Send</button>
            </div>
          </div>
        )}

        {tab === "notes" && (
          <div style={S.card}>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={10} style={S.notes} placeholder="Write notes about this contact…" />
            <div style={{ marginTop: 10 }}><button onClick={() => patch({ notes })} style={S.sendBtn}>Save notes</button></div>
          </div>
        )}
      </div>
    </CrmShell>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 820, margin: "0 auto", padding: "2rem" },
  back: { fontSize: 13, color: "#8A8595", textDecoration: "none" },
  header: { display: "flex", gap: 16, alignItems: "flex-start", margin: "14px 0 18px" },
  avatar: { width: 60, height: 60, borderRadius: 15, color: "#fff", display: "grid", placeItems: "center", fontSize: 20, fontWeight: 700, flexShrink: 0 },
  name: { fontSize: 23, fontWeight: 700, color: "#1A1A2E", letterSpacing: "-.02em" },
  role: { fontSize: 14, color: "#6B6777", marginTop: 2 },
  contactRow: { display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 },
  ci: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B6777" },
  delBtn: { background: "#fff", border: "1px solid #ECEBF0", borderRadius: 9, padding: 9, color: "#B91C1C", cursor: "pointer", display: "flex" },
  crmStrip: { display: "flex", gap: 28, background: "#fff", border: "1px solid #ECEBF0", borderRadius: 12, padding: "14px 20px", marginBottom: 18, flexWrap: "wrap" },
  stripItem: { display: "flex", flexDirection: "column", gap: 6 },
  stripLabel: { fontSize: 11, fontWeight: 600, color: "#A5A1AE", textTransform: "uppercase", letterSpacing: ".05em" },
  stageSelect: { border: "none", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", outline: "none" },
  stripValue: { fontSize: 15, fontWeight: 700, color: "#1A1A2E" },
  tag: { fontSize: 11, color: "#6B6777", background: "#F3F4F6", border: "1px solid #ECEBF0", padding: "3px 8px", borderRadius: 6 },
  tabs: { display: "flex", gap: 4, marginBottom: 14 },
  tab: { display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 600, color: "#8A8595", cursor: "pointer" },
  tabOn: { background: "#E1F5EE", color: "#0F6E56" },
  card: { background: "#fff", border: "1px solid #ECEBF0", borderRadius: 14, padding: "1.5rem" },
  muted: { fontSize: 13.5, color: "#9A96A5", textAlign: "center", padding: "1.5rem 0" },
  timeline: { display: "flex", flexDirection: "column", gap: 2 },
  item: { display: "flex", gap: 12, padding: "9px 0" },
  dot: { width: 9, height: 9, borderRadius: "50%", background: "#0F6E56", marginTop: 5, flexShrink: 0 },
  tText: { fontSize: 14, color: "#2A2A3E" },
  tTime: { fontSize: 12, color: "#A5A1AE", marginTop: 2 },
  chat: { display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto", paddingRight: 4, marginBottom: 14 },
  bubble: { maxWidth: "72%", padding: "9px 13px 20px", borderRadius: 14, fontSize: 14, lineHeight: 1.5, position: "relative", wordBreak: "break-word" },
  bubbleOut: { background: "#d4f0dd", color: "#0A2E1A", borderBottomRightRadius: 4 },
  bubbleIn: { background: "#F3F4F6", color: "#1A1A2E", borderBottomLeftRadius: 4 },
  bubbleTime: { position: "absolute", bottom: 5, right: 12, fontSize: 10, color: "rgba(0,0,0,.4)" },
  composer: { display: "flex", flexWrap: "wrap" as const, gap: 8 },
  composerInput: { minWidth: 0, flex: 1, border: "1px solid #E1E0E7", borderRadius: 10, padding: "11px 14px", fontSize: 14, outline: "none", color: "#1A1A2E" },
  logBtn: { background: "#fff", border: "1px solid #E1E0E7", borderRadius: 10, padding: "0 14px", fontSize: 12.5, fontWeight: 600, color: "#6B6777", cursor: "pointer" },
  sendBtn: { background: "#0F6E56", color: "#fff", border: "none", borderRadius: 10, padding: "0 22px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  notes: { width: "100%", border: "1px solid #E1E0E7", borderRadius: 10, padding: "12px 14px", fontSize: 14, lineHeight: 1.6, outline: "none", resize: "vertical", fontFamily: "inherit", color: "#1A1A2E" },
}
