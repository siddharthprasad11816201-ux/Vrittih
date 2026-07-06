"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
const TYPES = [
  { value:"ONE_ON_ONE", label:"1-on-1 Interview", desc:"Single candidate with one interviewer" },
  { value:"PANEL", label:"Panel Interview", desc:"Multiple interviewers, one candidate" },
  { value:"GROUP", label:"Group Discussion", desc:"Multiple candidates discuss a topic" },
  { value:"TECHNICAL", label:"Technical Interview", desc:"Coding and technical assessment" },
]

export default function ScheduleInterview() {
  const router = useRouter()
  const [form, setForm] = useState({ title:"", type:"ONE_ON_ONE", scheduledAt:"", duration:"60", notes:"" })
  const [participantEmail, setParticipantEmail] = useState("")
  const [participants, setParticipants] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  async function addParticipant() {
    if (!participantEmail.trim()) return
    setSearching(true)
    const res = await fetch(`/api/users/search?email=${encodeURIComponent(participantEmail)}`)
    const data = await res.json()
    if (data.user) {
      if (!participants.find(p => p.id === data.user.id)) {
        setParticipants(prev => [...prev, data.user])
      }
      setParticipantEmail("")
    } else setError("User not found with that email")
    setSearching(false)
  }

  async function submit(e: any) {
    e.preventDefault()
    if (!form.title || !form.scheduledAt) { setError("Title and scheduled time required"); return }
    setSubmitting(true); setError("")
    const res = await fetch("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        duration: parseInt(form.duration),
        participantIds: participants.map(p => p.id),
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (data.success) router.push(`/interviews/${data.interview.roomCode}`)
    else setError(data.error || "Failed to schedule")
  }

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.card}>
          <h1 style={S.title}>Schedule interview</h1>
          <p style={S.sub}>Set up a video interview room. Participants will be notified automatically.</p>
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
            <div style={S.fg}><label style={S.label}>Add participants by email</label>
              <div style={S.addRow}>
                <input value={participantEmail} onChange={e=>setParticipantEmail(e.target.value)} style={{...S.input,flex:1}} placeholder="participant@email.com" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addParticipant()}}} />
                <button type="button" onClick={addParticipant} disabled={searching} style={S.addBtn}>{searching?"...":"Add"}</button>
              </div>
              {participants.length > 0 && (
                <div style={S.participantList}>
                  {participants.map(p=>(
                    <div key={p.id} style={S.participantItem}>
                      <div style={S.pAvatar}>{p.name?.[0]||"?"}</div>
                      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{p.name}</div><div style={{fontSize:12,color:"#9ca3af"}}>{p.email}</div></div>
                      <button type="button" onClick={()=>setParticipants(prev=>prev.filter(x=>x.id!==p.id))} style={S.removeBtn}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={S.fg}><label style={S.label}>Notes (optional)</label>
              <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} style={S.textarea} rows={3} placeholder="Interview instructions, topics to cover, etc." />
            </div>
            <button type="submit" disabled={submitting} style={S.submitBtn}>{submitting?"Scheduling...":"Schedule & create room"}</button>
          </form>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{minHeight:"calc(100vh-60px)",background:"#F7F7FA",padding:"2rem",display:"flex",justifyContent:"center"},
  card:{background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:16,padding:"2rem",width:"100%",maxWidth:620,height:"fit-content"},
  title:{fontSize:20,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px",marginBottom:6},
  sub:{fontSize:13,color:"#7B7B8F",marginBottom:"1.5rem",lineHeight:1.6},
  err:{background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#B91C1C",marginBottom:12},
  fg:{display:"flex",flexDirection:"column" as const,gap:5,marginBottom:14},
  label:{fontSize:12,fontWeight:500,color:"#7B7B8F",marginBottom:6},
  input:{border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"8px 11px",fontSize:13,color:"#0A0A0F",outline:"none",fontFamily:"inherit",width:"100%"},
  textarea:{border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"8px 11px",fontSize:13,color:"#0A0A0F",outline:"none",fontFamily:"inherit",resize:"vertical" as const,width:"100%"},
  typeGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14},
  typeCard:{background:"#F9F9FC",border:"0.5px solid rgba(0,0,0,.1)",borderRadius:10,padding:"12px",textAlign:"left" as const,cursor:"pointer",transition:"all .15s"},
  typeCardOn:{border:"1.5px solid #534AB7",background:"#EEEDF9"},
  typeLabel:{fontSize:13,fontWeight:600,color:"#0A0A0F",marginBottom:3},
  typeDesc:{fontSize:11,color:"#9ca3af"},
  row:{display:"flex",gap:12},
  addRow:{display:"flex",gap:8},
  addBtn:{background:"#534AB7",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:13,cursor:"pointer",flexShrink:0},
  participantList:{display:"flex",flexDirection:"column" as const,gap:6,marginTop:10},
  participantItem:{display:"flex",alignItems:"center",gap:10,background:"#F9F9FC",border:"0.5px solid rgba(0,0,0,.07)",borderRadius:8,padding:"8px 12px"},
  pAvatar:{width:32,height:32,borderRadius:"50%",background:"#534AB7",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,flexShrink:0},
  removeBtn:{background:"none",border:"none",fontSize:18,color:"#9ca3af",cursor:"pointer"},
  submitBtn:{width:"100%",background:"#534AB7",color:"#fff",border:"none",borderRadius:9,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:4},
}