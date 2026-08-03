"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
import FeatureGate from "@/components/vrittih/FeatureGate"
import {
  evaluatePanel, ROLE_LEVELS, ROLE_LEVEL_LABEL, VISIBILITY, VISIBILITY_LABEL,
  ATTENDEE_ROLES, SENIORITY_LABEL, type AttendeeRole,
} from "@/lib/interview/governance"

const TYPES = [
  { value:"ONE_ON_ONE", label:"1-on-1 Interview", desc:"Single candidate with one interviewer" },
  { value:"PANEL", label:"Panel Interview", desc:"Multiple interviewers, one candidate" },
  { value:"GROUP", label:"Group Discussion", desc:"Multiple candidates discuss a topic" },
  { value:"TECHNICAL", label:"Technical Interview", desc:"Coding and technical assessment" },
]
// Roles the host can assign to an added attendee (host is implicit).
const ROLE_CHOICES: AttendeeRole[] = ATTENDEE_ROLES.filter(r => r !== "HOST") as AttendeeRole[]
const ROLE_LABEL: Record<string, string> = {
  PANELIST: "Panelist", INTERVIEWER: "Interviewer", COORDINATOR: "Coordinator", OBSERVER: "Observer", CANDIDATE: "Candidate",
}

export default function ScheduleInterviewPage() {
  return <FeatureGate feature="interviews" title="Schedule interview"><ScheduleInterview /></FeatureGate>
}

function ScheduleInterview() {
  const router = useRouter()
  const [me, setMe] = useState<any>(null)
  const [form, setForm] = useState({ title:"", type:"ONE_ON_ONE", scheduledAt:"", duration:"60", notes:"" })
  const [roleLevel, setRoleLevel] = useState<string>("IC")
  const [visibility, setVisibility] = useState<string>("PARTICIPANTS")
  const [confidential, setConfidential] = useState(false)
  const [participantEmail, setParticipantEmail] = useState("")
  const [participants, setParticipants] = useState<any[]>([]) // each: {id,name,email,seniority,role}
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [serverGov, setServerGov] = useState<any>(null)  // governance block returned by the API (422)
  const [override, setOverride] = useState(false)

  useEffect(() => { fetch("/api/auth/me").then(r=>r.json()).then(d=>setMe(d.user)).catch(()=>{}) }, [])

  const canOverride = !!me && (me.role === "ADMIN" || me.role === "SUPER_ADMIN" || (me.seniority||"").toUpperCase() === "EXECUTIVE")

  // Live governance preview using the same pure engine the server uses.
  const preview = useMemo(() => evaluatePanel({
    roleLevel,
    attendees: [
      { userId: me?.id || "host", name: me?.name, role: "HOST", seniority: me?.seniority },
      ...participants.map(p => ({ userId: p.id, name: p.name, role: p.role || "CANDIDATE", seniority: p.seniority })),
    ],
    override: override && canOverride,
  }), [roleLevel, participants, me, override, canOverride])

  async function addParticipant() {
    if (!participantEmail.trim()) return
    setSearching(true); setError("")
    try {
      const res = await fetch(`/api/users/search?email=${encodeURIComponent(participantEmail)}`)
      const data = await res.json()
      if (data.user) {
        if (!participants.find(p => p.id === data.user.id)) {
          setParticipants(prev => [...prev, { ...data.user, role: "CANDIDATE" }])
        }
        setParticipantEmail("")
      } else setError("No user found with that email")
    } catch { setError("Couldn't search — try again.") }
    setSearching(false)
  }

  function setPartRole(id: string, role: string) {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, role } : p))
  }

  async function submit(e: any) {
    e.preventDefault()
    if (!form.title || !form.scheduledAt) { setError("Title and scheduled time required"); return }
    setSubmitting(true); setError(""); setServerGov(null)
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          duration: parseInt(form.duration),
          roleLevel, visibility, confidential,
          override: override && canOverride,
          attendees: participants.map(p => ({ userId: p.id, role: p.role || "CANDIDATE" })),
        }),
      })
      const data = await res.json()
      setSubmitting(false)
      if (res.ok && data.success) { router.push(`/interviews/${data.interview.roomCode}`); return }
      if (res.status === 422 && data.governance) {
        setServerGov(data.governance)
        setError(data.needsOverride ? "This panel needs an authorized approver to override." : (data.error || "Panel governance blocked scheduling."))
      } else setError(data.error || "Failed to schedule")
    } catch { setSubmitting(false); setError("Network error — try again.") }
  }

  const blocked = !preview.ok

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.card}>
          <h1 style={S.title}>Schedule interview</h1>
          <p style={S.sub}>Set up a video interview room. Attendance governance keeps panels appropriately senior and controls who can join.</p>
          {error && <div style={S.err}>{error}</div>}
          <form onSubmit={submit}>
            <div style={S.fg}><label style={S.label}>Interview title</label>
              <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} style={S.input} placeholder="e.g. Frontend Engineer — Round 2" required />
            </div>
            <div style={S.label}>Interview type</div>
            <div style={S.typeGrid}>
              {TYPES.map(t=>(
                <button key={t.value} type="button" onClick={()=>setForm(p=>({...p,type:t.value}))} style={{...S.typeCard,...(form.type===t.value?S.typeCardOn:{})}}>
                  <div style={S.typeLabel}>{t.label}</div>
                  <div style={S.typeDesc}>{t.desc}</div>
                </button>
              ))}
            </div>
            <div style={S.row}>
              <div style={S.fg}><label style={S.label}>Date & time</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={e=>setForm(p=>({...p,scheduledAt:e.target.value}))} style={S.input} required />
              </div>
              <div style={S.fg}><label style={S.label}>Duration (minutes)</label>
                <select value={form.duration} onChange={e=>setForm(p=>({...p,duration:e.target.value}))} style={S.input}>
                  {[30,45,60,90,120].map(d=><option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
            </div>

            {/* ── Governance ── */}
            <div style={S.govBox}>
              <div style={S.govHead}>Attendance governance</div>
              <div style={S.row}>
                <div style={S.fg}><label style={S.label}>Position level</label>
                  <select value={roleLevel} onChange={e=>setRoleLevel(e.target.value)} style={S.input}>
                    {ROLE_LEVELS.map(l=><option key={l} value={l}>{ROLE_LEVEL_LABEL[l]}</option>)}
                  </select>
                </div>
                <div style={S.fg}><label style={S.label}>Who may attend</label>
                  <select value={visibility} onChange={e=>setVisibility(e.target.value)} style={S.input}>
                    {VISIBILITY.map(v=><option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>)}
                  </select>
                </div>
              </div>
              <label style={S.check}>
                <input type="checkbox" checked={confidential} onChange={e=>setConfidential(e.target.checked)} />
                <span>Confidential — hide notes &amp; recording from observers and the candidate</span>
              </label>
              <p style={S.govNote}>
                Requires at least a <b>{SENIORITY_LABEL[preview.requiredSeniority]}</b> interviewer.
                {" "}Most senior on this panel: <b>{preview.topPanelSeniority ? SENIORITY_LABEL[preview.topPanelSeniority] : "—"}</b>.
              </p>
              {preview.violations.map((v,i)=><div key={"v"+i} style={S.govViolation}>{v}</div>)}
              {preview.warnings.map((w,i)=><div key={"w"+i} style={S.govWarn}>{w}</div>)}
            </div>

            <div style={S.fg}><label style={S.label}>Add attendees by email</label>
              <div style={S.addRow}>
                <input value={participantEmail} onChange={e=>setParticipantEmail(e.target.value)} style={{...S.input,flex:1}} placeholder="attendee@email.com" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addParticipant()}}} />
                <button type="button" onClick={addParticipant} disabled={searching} style={S.addBtn}>{searching?"...":"Add"}</button>
              </div>
              {me && (
                <div style={{...S.participantItem, marginTop:10}}>
                  <div style={S.pAvatar}>{me.name?.[0]||"?"}</div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{me.name} <span style={S.youTag}>You · Host</span></div><div style={{fontSize:12,color:"#9ca3af"}}>{SENIORITY_LABEL[(me.seniority||"MID").toUpperCase() as keyof typeof SENIORITY_LABEL] || me.seniority || "Mid-level"}</div></div>
                </div>
              )}
              {participants.length > 0 && (
                <div style={S.participantList}>
                  {participants.map(p=>(
                    <div key={p.id} style={S.participantItem}>
                      <div style={S.pAvatar}>{p.name?.[0]||"?"}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                        <div style={{fontSize:12,color:"#9ca3af"}}>{p.email} · {SENIORITY_LABEL[(p.seniority||"MID").toUpperCase() as keyof typeof SENIORITY_LABEL] || "Mid-level"}</div>
                      </div>
                      <select value={p.role||"CANDIDATE"} onChange={e=>setPartRole(p.id, e.target.value)} style={S.roleSel} aria-label="Attendee role">
                        {ROLE_CHOICES.map(r=><option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                      <button type="button" onClick={()=>setParticipants(prev=>prev.filter(x=>x.id!==p.id))} style={S.removeBtn}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={S.fg}><label style={S.label}>Notes (optional)</label>
              <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} style={S.textarea} rows={3} placeholder="Interview instructions, topics to cover, etc." />
            </div>

            {serverGov && !serverGov.ok && (
              <div style={S.err}>
                {serverGov.violations?.map((v:string,i:number)=><div key={i}>{v}</div>)}
              </div>
            )}
            {blocked && canOverride && (
              <label style={{...S.check, marginBottom:12}}>
                <input type="checkbox" checked={override} onChange={e=>setOverride(e.target.checked)} />
                <span>Override governance — I'm an authorized approver and accept this panel composition</span>
              </label>
            )}
            {blocked && !canOverride && (
              <p style={S.blockedNote}>Scheduling is blocked until the panel meets the required seniority, or an authorized approver (admin / executive) overrides it.</p>
            )}

            <button type="submit" disabled={submitting || (blocked && !(override && canOverride))} style={{...S.submitBtn, ...((blocked && !(override && canOverride))?S.submitDisabled:{})}}>
              {submitting?"Scheduling...":"Schedule & create room"}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{minHeight:"calc(100dvh - 60px)",background:"#F7F9FC",padding:"2rem",display:"flex",justifyContent:"center"},
  card:{background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:16,padding:"2rem",width:"100%",maxWidth:620,height:"fit-content"},
  title:{fontSize:20,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px",marginBottom:6},
  sub:{fontSize:13,color:"#7B7B8F",marginBottom:"1.5rem",lineHeight:1.6},
  err:{background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#B91C1C",marginBottom:12,lineHeight:1.5},
  fg:{display:"flex",flexDirection:"column" as const,gap:5,marginBottom:14,minWidth:0},
  label:{fontSize:12,fontWeight:500,color:"#7B7B8F",marginBottom:6},
  input:{border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"8px 11px",fontSize:13,color:"#0A0A0F",outline:"none",fontFamily:"inherit",width:"100%"},
  textarea:{border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"8px 11px",fontSize:13,color:"#0A0A0F",outline:"none",fontFamily:"inherit",resize:"vertical" as const,width:"100%"},
  typeGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14},
  typeCard:{background:"#F9F9FC",border:"0.5px solid rgba(0,0,0,.1)",borderRadius:10,padding:"12px",textAlign:"left" as const,cursor:"pointer",transition:"all .15s"},
  typeCardOn:{border:"1.5px solid #6495ED",background:"#EAF1FE"},
  typeLabel:{fontSize:13,fontWeight:600,color:"#0A0A0F",marginBottom:3},
  typeDesc:{fontSize:11,color:"#9ca3af"},
  row:{display:"flex",gap:12},
  addRow:{display:"flex",gap:8},
  addBtn:{background:"#6495ED",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:13,cursor:"pointer",flexShrink:0},
  participantList:{display:"flex",flexDirection:"column" as const,gap:6,marginTop:10},
  participantItem:{display:"flex",alignItems:"center",gap:10,background:"#F9F9FC",border:"0.5px solid rgba(0,0,0,.07)",borderRadius:8,padding:"8px 12px"},
  pAvatar:{width:32,height:32,borderRadius:"50%",background:"#6495ED",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,flexShrink:0},
  youTag:{fontSize:10.5,fontWeight:600,color:"#6495ED",background:"#EAF1FE",padding:"1px 6px",borderRadius:999,marginLeft:6},
  roleSel:{border:"0.5px solid rgba(0,0,0,.13)",borderRadius:7,padding:"5px 8px",fontSize:12,color:"#0A0A0F",background:"#fff",fontFamily:"inherit",flexShrink:0},
  removeBtn:{background:"none",border:"none",fontSize:18,color:"#9ca3af",cursor:"pointer",flexShrink:0},
  submitBtn:{width:"100%",background:"#6495ED",color:"#fff",border:"none",borderRadius:9,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:4},
  submitDisabled:{opacity:.5,cursor:"not-allowed"},
  govBox:{border:"0.5px solid rgba(100,149,237,.35)",background:"#F6F9FF",borderRadius:12,padding:"14px 16px",marginBottom:16},
  govHead:{fontSize:12,fontWeight:700,color:"#3455B0",letterSpacing:".02em",textTransform:"uppercase" as const,marginBottom:10},
  govNote:{fontSize:12,color:"#5B6472",margin:"8px 0 0",lineHeight:1.5},
  govViolation:{fontSize:12.5,color:"#B42318",background:"#FEF3F2",border:"0.5px solid #FECACA",borderRadius:8,padding:"8px 11px",marginTop:8,lineHeight:1.5},
  govWarn:{fontSize:12.5,color:"#B54708",background:"#FFFAEB",border:"0.5px solid #FEDF89",borderRadius:8,padding:"8px 11px",marginTop:8,lineHeight:1.5},
  check:{display:"flex",gap:9,alignItems:"flex-start",fontSize:12.5,color:"#3F4756",lineHeight:1.5,cursor:"pointer",marginTop:4},
  blockedNote:{fontSize:12.5,color:"#B54708",background:"#FFFAEB",border:"0.5px solid #FEDF89",borderRadius:8,padding:"9px 12px",marginBottom:12,lineHeight:1.5},
}
