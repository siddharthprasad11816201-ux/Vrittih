"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
export default function CreatePage() {
  const router = useRouter()
  const [form, setForm] = useState({ title:"", bio:"", badge:"" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function submit(e: any) {
    e.preventDefault()
    setLoading(true); setError("")
    const res = await fetch("/api/community/pages", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify(form)
    })
    const data = await res.json()
    setLoading(false)
    if (data.success) router.push(`/community/pages/${data.page.id}`)
    else setError(data.error || "Failed to create page")
  }

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.card}>
          <h1 style={S.title}>Create your professional page</h1>
          <p style={S.sub}>Your page is your professional identity on the platform. Others can follow you, ask questions, and engage with your posts.</p>
          {error && <div style={S.err}>{error}</div>}
          <form onSubmit={submit}>
            <div style={S.fg}><label style={S.label}>Professional title</label>
              <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} style={S.input} placeholder="e.g. CEO & Founder, Senior Engineer, Healthcare Professional" required />
            </div>
            <div style={S.fg}><label style={S.label}>Badge (optional)</label>
              <input value={form.badge} onChange={e=>setForm(p=>({...p,badge:e.target.value}))} style={S.input} placeholder="e.g. Hiring, Open to work, Expert in AI" />
            </div>
            <div style={S.fg}><label style={S.label}>Bio (optional)</label>
              <textarea value={form.bio} onChange={e=>setForm(p=>({...p,bio:e.target.value}))} style={S.textarea} rows={4} placeholder="Tell your professional story..." />
            </div>
            <button type="submit" disabled={loading||!form.title} style={S.btn}>{loading?"Creating...":"Create page"}</button>
          </form>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{ background:"#FAF8F2",minHeight:"calc(100vh - 60px)",padding:"2rem",display:"flex",justifyContent:"center" },
  card:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:16,padding:"2rem",width:"100%",maxWidth:520,height:"fit-content" },
  title:{ fontSize:20,fontWeight:700,color:"#0A0A0F",letterSpacing:"-.3px",marginBottom:8 },
  sub:{ fontSize:13,color:"#7B7B8F",lineHeight:1.65,marginBottom:"1.5rem",paddingBottom:"1rem",borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  err:{ background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:8,padding:"10px",fontSize:13,color:"#B91C1C",marginBottom:12 },
  fg:{ display:"flex",flexDirection:"column" as const,gap:5,marginBottom:14 },
  label:{ fontSize:12,fontWeight:500,color:"#7B7B8F" },
  input:{ border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",fontFamily:"inherit" },
  textarea:{ border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none",fontFamily:"inherit",resize:"vertical" as const },
  btn:{ width:"100%",background:"#0F6E56",color:"#fff",border:"none",borderRadius:9,padding:"11px",fontSize:14,fontWeight:600,cursor:"pointer" },
}