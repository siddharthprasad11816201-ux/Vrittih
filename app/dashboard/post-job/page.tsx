"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
const INDUSTRIES = ["Technology","Finance","Healthcare","Education","Manufacturing","Retail","Legal","Government","Logistics","Energy","Agriculture","Media","Hospitality","Real Estate","Pharma","Consulting","NGO","Other"]
const JOB_TYPES = ["FULLTIME","PARTTIME","CONTRACT","INTERNSHIP","FREELANCE"]
const EXPERIENCE_LEVELS = ["Entry level","Mid level","Senior","Lead","Manager","Director","C-Level","Any"]
const CURRENCIES = ["INR","USD","EUR","CHF","GBP","AED","SGD"]

export default function PostJob() {
  const router = useRouter()
  const [form, setForm] = useState({
    title:"", company:"", industry:"Technology", location:"",
    type:"FULLTIME", remote:false, description:"",
    salaryMin:"", salaryMax:"", salaryCurrency:"INR", salaryPeriod:"year",
    experience:"", openings:"1", deadline:"", requirements:"", benefits:""
  })
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function addSkill() {
    const s = skillInput.trim()
    if (s && !skills.includes(s)) setSkills(prev => [...prev, s])
    setSkillInput("")
  }

  async function submit(e: any) {
    e.preventDefault()
    if (!form.title || !form.company || !form.location || !form.description) {
      setError("Title, company, location and description are required")
      return
    }
    setLoading(true); setError("")
    const salary = form.salaryMin && form.salaryMax
      ? `${form.salaryCurrency} ${Number(form.salaryMin).toLocaleString("en-IN")} - ${Number(form.salaryMax).toLocaleString("en-IN")} / ${form.salaryPeriod}`
      : form.salaryMin ? `${form.salaryCurrency} ${Number(form.salaryMin).toLocaleString("en-IN")} / ${form.salaryPeriod}` : null
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title, company: form.company, industry: form.industry,
        location: form.location, type: form.type, remote: form.remote,
        description: form.description, salary,
        requirements: form.requirements || null,
        benefits: form.benefits || null,
        experience: form.experience || null,
        openings: parseInt(form.openings) || 1,
        deadline: form.deadline ? new Date(form.deadline) : null,
        skills,
      })
    })
    const data = await res.json()
    setLoading(false)
    if (data.success) router.push(`/jobs/${data.job.id}`)
    else setError(data.error || "Failed to post job")
  }

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <h1 style={S.title}>Post a job</h1>
            <p style={S.sub}>Fill in the details to attract the right candidates</p>
          </div>
          {error && <div style={S.err}>{error}</div>}
          <form onSubmit={submit}>

            {/* Basic info */}
            <div style={S.section}>
              <h2 style={S.sectionTitle}>Basic information</h2>
              <div style={S.row}>
                <div style={S.fg}><label style={S.label}>Job title *</label>
                  <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} style={S.input} placeholder="e.g. Senior Software Engineer" required />
                </div>
                <div style={S.fg}><label style={S.label}>Company name *</label>
                  <input value={form.company} onChange={e=>setForm(p=>({...p,company:e.target.value}))} style={S.input} placeholder="Your company name" required />
                </div>
              </div>
              <div style={S.row}>
                <div style={S.fg}><label style={S.label}>Industry *</label>
                  <select value={form.industry} onChange={e=>setForm(p=>({...p,industry:e.target.value}))} style={S.input}>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div style={S.fg}><label style={S.label}>Job type *</label>
                  <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))} style={S.input}>
                    {JOB_TYPES.map(t => <option key={t} value={t}>{t.charAt(0)+t.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
              </div>
              <div style={S.row}>
                <div style={S.fg}><label style={S.label}>Location *</label>
                  <input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} style={S.input} placeholder="e.g. Bengaluru, Delhi, Mumbai" required />
                </div>
                <div style={S.fg}><label style={S.label}>Experience level</label>
                  <select value={form.experience} onChange={e=>setForm(p=>({...p,experience:e.target.value}))} style={S.input}>
                    <option value="">Select level</option>
                    {EXPERIENCE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div style={S.row}>
                <div style={S.fg}><label style={S.label}>Number of openings</label>
                  <input type="number" min={1} value={form.openings} onChange={e=>setForm(p=>({...p,openings:e.target.value}))} style={S.input} />
                </div>
                <div style={S.fg}><label style={S.label}>Application deadline</label>
                  <input type="date" value={form.deadline} onChange={e=>setForm(p=>({...p,deadline:e.target.value}))} style={S.input} />
                </div>
              </div>
              <div style={S.checkRow}>
                <input type="checkbox" id="remote" checked={form.remote} onChange={e=>setForm(p=>({...p,remote:e.target.checked}))} style={{accentColor:"#534AB7"}} />
                <label htmlFor="remote" style={{fontSize:13,color:"#3D3D4E",cursor:"pointer"}}>This is a remote-friendly role</label>
              </div>
            </div>

            {/* Salary */}
            <div style={S.section}>
              <h2 style={S.sectionTitle}>Compensation</h2>
              <div style={S.row}>
                <div style={{...S.fg,maxWidth:120}}>
                  <label style={S.label}>Currency</label>
                  <select value={form.salaryCurrency} onChange={e=>setForm(p=>({...p,salaryCurrency:e.target.value}))} style={S.input}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={S.fg}><label style={S.label}>Minimum salary</label>
                  <input type="number" value={form.salaryMin} onChange={e=>setForm(p=>({...p,salaryMin:e.target.value}))} style={S.input} placeholder="e.g. 1200000" />
                </div>
                <div style={S.fg}><label style={S.label}>Maximum salary</label>
                  <input type="number" value={form.salaryMax} onChange={e=>setForm(p=>({...p,salaryMax:e.target.value}))} style={S.input} placeholder="e.g. 1800000" />
                </div>
                <div style={{...S.fg,maxWidth:120}}>
                  <label style={S.label}>Per</label>
                  <select value={form.salaryPeriod} onChange={e=>setForm(p=>({...p,salaryPeriod:e.target.value}))} style={S.input}>
                    <option value="year">Year</option>
                    <option value="month">Month</option>
                    <option value="day">Day</option>
                    <option value="hour">Hour</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={S.section}>
              <h2 style={S.sectionTitle}>Job details</h2>
              <div style={S.fg}><label style={S.label}>Description *</label>
                <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} style={S.textarea} rows={6} placeholder="Describe the role, responsibilities, team, and what makes this opportunity exciting..." required />
              </div>
              <div style={S.fg}><label style={S.label}>Requirements</label>
                <textarea value={form.requirements} onChange={e=>setForm(p=>({...p,requirements:e.target.value}))} style={S.textarea} rows={4} placeholder="List qualifications, education, and experience requirements..." />
              </div>
              <div style={S.fg}><label style={S.label}>Benefits & perks</label>
                <textarea value={form.benefits} onChange={e=>setForm(p=>({...p,benefits:e.target.value}))} style={S.textarea} rows={3} placeholder="Health insurance, equity, flexible hours, remote work, learning budget..." />
              </div>
            </div>

            {/* Skills */}
            <div style={S.section}>
              <h2 style={S.sectionTitle}>Required skills</h2>
              <div style={S.skillInput}>
                <input value={skillInput} onChange={e=>setSkillInput(e.target.value)} style={{...S.input,flex:1}} placeholder="e.g. React, Python, SQL" onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addSkill()}}} />
                <button type="button" onClick={addSkill} style={S.addSkillBtn}>Add</button>
              </div>
              {skills.length > 0 && (
                <div style={S.skillTags}>
                  {skills.map(s => (
                    <span key={s} style={S.skillTag}>
                      {s}
                      <button type="button" onClick={()=>setSkills(prev=>prev.filter(x=>x!==s))} style={S.skillRemove}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={S.actions}>
              <button type="submit" disabled={loading} style={S.submitBtn}>{loading?"Posting...":"Post job"}</button>
              <button type="button" onClick={() => router.back()} style={S.cancelBtn}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{ background:"#F7F7FA",minHeight:"calc(100vh - 60px)",padding:"2rem" },
  wrap:{ maxWidth:800,margin:"0 auto" },
  header:{ marginBottom:"1.5rem" },
  title:{ fontSize:22,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px" },
  sub:{ fontSize:13,color:"#7B7B8F",marginTop:4 },
  err:{ background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#B91C1C",marginBottom:"1rem" },
  section:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.5rem",marginBottom:12 },
  sectionTitle:{ fontSize:15,fontWeight:600,color:"#0A0A0F",marginBottom:"1.25rem" },
  row:{ display:"flex",gap:12 },
  fg:{ display:"flex",flexDirection:"column" as const,gap:5,marginBottom:12,flex:1 },
  label:{ fontSize:12,fontWeight:500,color:"#7B7B8F" },
  input:{ border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"9px 11px",fontSize:13,color:"#0A0A0F",outline:"none",fontFamily:"inherit",width:"100%" },
  textarea:{ border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"9px 11px",fontSize:13,color:"#0A0A0F",outline:"none",fontFamily:"inherit",resize:"vertical" as const,width:"100%" },
  checkRow:{ display:"flex",alignItems:"center",gap:8,marginTop:4 },
  skillInput:{ display:"flex",gap:8,marginBottom:10 },
  addSkillBtn:{ background:"#534AB7",color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontSize:13,cursor:"pointer",flexShrink:0 },
  skillTags:{ display:"flex",flexWrap:"wrap" as const,gap:8 },
  skillTag:{ background:"#EEEDF9",color:"#534AB7",border:"0.5px solid rgba(83,74,183,.2)",borderRadius:999,padding:"5px 12px",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:6 },
  skillRemove:{ background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#534AB7",lineHeight:1,padding:0 },
  actions:{ display:"flex",gap:10 },
  submitBtn:{ flex:1,background:"#534AB7",color:"#fff",border:"none",borderRadius:9,padding:"12px",fontSize:15,fontWeight:600,cursor:"pointer" },
  cancelBtn:{ background:"none",border:"0.5px solid rgba(0,0,0,.1)",color:"#6b7280",borderRadius:9,padding:"12px 22px",fontSize:14,cursor:"pointer" },
}