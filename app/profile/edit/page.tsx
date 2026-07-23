"use client"
import { useEffect, useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
import { processImage } from "@/lib/clientImage"
export default function EditProfile() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [form, setForm] = useState({ name:"", headline:"", bio:"", location:"", phone:"", website:"", github:"", linkedin:"", twitter:"", birthDate:"", birthTime:"", birthPlace:"", openToWork:false })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expForm, setExpForm] = useState({ company:"", title:"", location:"", startDate:"", endDate:"", description:"" })
  const [eduForm, setEduForm] = useState({ school:"", degree:"", field:"", startYear:"", endYear:"" })
  const [skillInput, setSkillInput] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState("")
  const [tab, setTab] = useState("basic")

  useEffect(() => {
    fetch("/api/profile").then(r => r.json()).then(d => {
      if (!d.user) { router.push("/login"); return }
      setUser(d.user)
      setForm({
        name: d.user.name || "", headline: d.user.headline || "",
        bio: d.user.bio || "", location: d.user.location || "",
        phone: d.user.phone || "", website: d.user.profile?.website || "",
        github: d.user.profile?.github || "", linkedin: d.user.profile?.linkedin || "",
        twitter: d.user.profile?.twitter || "",
        birthDate: d.user.profile?.birthDate ? new Date(d.user.profile.birthDate).toISOString().slice(0, 10) : "",
        birthTime: d.user.profile?.birthTime || "", birthPlace: d.user.profile?.birthPlace || "",
        openToWork: !!d.user.openToWork,
      })
    })
  }, [])

  async function saveBasic(e: any) {
    e.preventDefault(); setSaving(true)
    await fetch("/api/profile", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function addExp(e: any) {
    e.preventDefault()
    await fetch("/api/profile/experience", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(expForm) })
    setExpForm({ company:"", title:"", location:"", startDate:"", endDate:"", description:"" })
    const d = await fetch("/api/profile").then(r => r.json())
    setUser(d.user)
  }

  async function delExp(id: string) {
    await fetch("/api/profile/experience", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id }) })
    const d = await fetch("/api/profile").then(r => r.json())
    setUser(d.user)
  }

  async function addEdu(e: any) {
    e.preventDefault()
    await fetch("/api/profile/education", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(eduForm) })
    setEduForm({ school:"", degree:"", field:"", startYear:"", endYear:"" })
    const d = await fetch("/api/profile").then(r => r.json())
    setUser(d.user)
  }

  async function delEdu(id: string) {
    await fetch("/api/profile/education", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id }) })
    const d = await fetch("/api/profile").then(r => r.json())
    setUser(d.user)
  }

  async function addSkill(e: any) {
    e.preventDefault()
    if (!skillInput.trim()) return
    await fetch("/api/profile/skills", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name: skillInput.trim() }) })
    setSkillInput("")
    const d = await fetch("/api/profile").then(r => r.json())
    setUser(d.user)
  }

  async function delSkill(skillId: string) {
    await fetch("/api/profile/skills", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ skillId }) })
    const d = await fetch("/api/profile").then(r => r.json())
    setUser(d.user)
  }

  async function uploadFile(e: any, type: string) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setUploadMsg("")
    try {
      let res: Response
      if (type === "avatar" && file.type.startsWith("image/")) {
        // resize + re-encode in-browser so we upload ~40-80 KB, not the raw photo
        setUploadMsg("Optimising image…")
        const img = await processImage(file, { box: 512, mode: "cover", maxBytes: 220_000 })
        res = await fetch("/api/upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "avatar", dataUrl: img.dataUrl, width: img.width, height: img.height, filename: file.name }),
        })
      } else {
        // résumés / documents: multipart (no base64 inflation on large PDFs)
        const fd = new FormData(); fd.append("file", file); fd.append("type", type)
        res = await fetch("/api/upload", { method: "POST", body: fd })
      }
      const data = await res.json()
      if (data.success) {
        const kb = data.size ? ` (${Math.round(data.size / 1024)} KB)` : ""
        setUploadMsg(`${type === "resume" ? "Résumé" : "Photo"} uploaded${kb}`)
        const d = await fetch("/api/profile").then(r => r.json()); setUser(d.user)
      } else setUploadMsg(data.error || "Upload failed")
    } catch (err: any) {
      setUploadMsg(err?.message || "Upload failed")
    } finally {
      setUploading(false)
      if (e?.target) e.target.value = "" // allow re-selecting the same file
    }
  }

  if (!user) return <AppShell><div style={S.loading}>Loading...</div></AppShell>

  const TABS = [["basic","Basic info"],["experience","Experience"],["education","Education"],["skills","Skills"],["uploads","Files"]]

  return (
    <AppShell>
      <div style={S.wrap}>
        <div style={S.sidebar}>
          <h2 style={S.sideHead}>Edit profile</h2>
          {TABS.map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)} style={{...S.tabBtn, ...(tab===key?S.tabBtnOn:{})}}>
              {label}
            </button>
          ))}
          <button onClick={() => router.push("/profile")} style={S.viewBtn}>View profile →</button>
        </div>

        <div style={S.main}>
          {/* Basic info */}
          {tab === "basic" && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Basic information</h3>
              {saved && <div style={S.savedMsg}>Saved successfully</div>}
              <form onSubmit={saveBasic}>
                <label style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", border:"1px solid var(--v-line-2)", borderRadius:12, marginBottom:16, cursor:"pointer", background: form.openToWork ? "var(--brand-100)" : "var(--v-surface)" }}>
                  <span onClick={()=>setForm(p=>({...p,openToWork:!p.openToWork}))} data-on={form.openToWork} style={{ position:"relative", width:42, height:24, borderRadius:999, background: form.openToWork ? "var(--brand-600)" : "var(--v-line-2)", transition:"background .15s", flexShrink:0 }}>
                    <span style={{ position:"absolute", top:3, left: form.openToWork ? 21 : 3, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left .18s var(--v-spring)", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }} />
                  </span>
                  <span style={{ flex:1 }}>
                    <span style={{ display:"block", fontSize:13.5, fontWeight:600, color:"var(--v-ink)" }}>Open to work</span>
                    <span style={{ display:"block", fontSize:12, color:"var(--v-ink-3)" }}>Show recruiters you're available — adds a badge to your profile.</span>
                  </span>
                </label>
                <div style={S.row}>{fg("Full name","name","text",form.name,e=>setForm(p=>({...p,name:e.target.value})))}{fg("Headline","headline","text",form.headline,e=>setForm(p=>({...p,headline:e.target.value})))}</div>
                {fga("Bio",form.bio,e=>setForm(p=>({...p,bio:e.target.value})))}
                <div style={S.row}>{fg("Location","location","text",form.location,e=>setForm(p=>({...p,location:e.target.value})))}{fg("Phone","phone","tel",form.phone,e=>setForm(p=>({...p,phone:e.target.value})))}</div>
                <div style={S.row}>{fg("Website","website","url",form.website,e=>setForm(p=>({...p,website:e.target.value})))}{fg("GitHub","github","url",form.github,e=>setForm(p=>({...p,github:e.target.value})))}</div>
                <div style={S.row}>{fg("LinkedIn","linkedin","url",form.linkedin,e=>setForm(p=>({...p,linkedin:e.target.value})))}{fg("Twitter","twitter","url",form.twitter,e=>setForm(p=>({...p,twitter:e.target.value})))}</div>
                <div style={{ borderTop:"1px solid var(--v-line)", margin:"6px 0 14px", paddingTop:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"var(--v-ink)" }}>Birth details</div>
                  <div style={{ fontSize:12, color:"var(--v-ink-3)", marginTop:2, marginBottom:10 }}>Used only for your in-house astrological, guna and Ayurvedic career analysis. Date is enough; time &amp; place refine it.</div>
                  <div style={S.row}>{fg("Date of birth","birthDate","date",form.birthDate,e=>setForm(p=>({...p,birthDate:e.target.value})))}{fg("Birth time (optional)","birthTime","time",form.birthTime,e=>setForm(p=>({...p,birthTime:e.target.value})))}</div>
                  {fg("Birth place (optional)","birthPlace","text",form.birthPlace,e=>setForm(p=>({...p,birthPlace:e.target.value})))}
                </div>
                <button type="submit" style={S.saveBtn} disabled={saving}>{saving?"Saving...":"Save changes"}</button>
              </form>
            </div>
          )}

          {/* Experience */}
          {tab === "experience" && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Work experience</h3>
              {user.experience?.map((e: any) => (
                <div key={e.id} style={S.listItem}>
                  <div><strong style={{fontSize:14}}>{e.title}</strong> at <strong style={{fontSize:14}}>{e.company}</strong><div style={{fontSize:12,color:"#9ca3af",marginTop:2}}>{new Date(e.startDate).getFullYear()} – {e.endDate?new Date(e.endDate).getFullYear():"Present"}</div></div>
                  <button onClick={() => delExp(e.id)} style={S.delBtn}>Remove</button>
                </div>
              ))}
              <div style={S.divider}>Add experience</div>
              <form onSubmit={addExp}>
                <div style={S.row}>{fg("Job title","title","text",expForm.title,e=>setExpForm(p=>({...p,title:e.target.value})))}{fg("Company","company","text",expForm.company,e=>setExpForm(p=>({...p,company:e.target.value})))}</div>
                <div style={S.row}>{fg("Location","location","text",expForm.location,e=>setExpForm(p=>({...p,location:e.target.value})))}</div>
                <div style={S.row}>{fg("Start date","startDate","date",expForm.startDate,e=>setExpForm(p=>({...p,startDate:e.target.value})))}{fg("End date (leave blank if current)","endDate","date",expForm.endDate,e=>setExpForm(p=>({...p,endDate:e.target.value})))}</div>
                {fga("Description",expForm.description,e=>setExpForm(p=>({...p,description:e.target.value})))}
                <button type="submit" style={S.saveBtn}>Add experience</button>
              </form>
            </div>
          )}

          {/* Education */}
          {tab === "education" && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Education</h3>
              {user.education?.map((e: any) => (
                <div key={e.id} style={S.listItem}>
                  <div><strong style={{fontSize:14}}>{e.degree} in {e.field}</strong><div style={{fontSize:13,color:"#6b7280"}}>{e.school}</div><div style={{fontSize:12,color:"#9ca3af"}}>{e.startYear} – {e.endYear||"Present"}</div></div>
                  <button onClick={() => delEdu(e.id)} style={S.delBtn}>Remove</button>
                </div>
              ))}
              <div style={S.divider}>Add education</div>
              <form onSubmit={addEdu}>
                <div style={S.row}>{fg("School / University","school","text",eduForm.school,e=>setEduForm(p=>({...p,school:e.target.value})))}{fg("Degree","degree","text",eduForm.degree,e=>setEduForm(p=>({...p,degree:e.target.value})))}</div>
                <div style={S.row}>{fg("Field of study","field","text",eduForm.field,e=>setEduForm(p=>({...p,field:e.target.value})))}</div>
                <div style={S.row}>{fg("Start year","startYear","number",eduForm.startYear,e=>setEduForm(p=>({...p,startYear:e.target.value})))}{fg("End year","endYear","number",eduForm.endYear,e=>setEduForm(p=>({...p,endYear:e.target.value})))}</div>
                <button type="submit" style={S.saveBtn}>Add education</button>
              </form>
            </div>
          )}

          {/* Skills */}
          {tab === "skills" && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Skills</h3>
              <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
                {user.skills?.map((s: any) => (
                  <span key={s.skillId} style={S.skillChip}>
                    {s.skill.name}
                    <button onClick={() => delSkill(s.skillId)} style={S.chipDel}>×</button>
                  </span>
                ))}
              </div>
              <form onSubmit={addSkill} style={{display:"flex",gap:8}}>
                <input value={skillInput} onChange={e=>setSkillInput(e.target.value)} placeholder="Add a skill (e.g. React, SQL)" style={S.input} />
                <button type="submit" style={S.saveBtn}>Add</button>
              </form>
            </div>
          )}

          {/* Uploads */}
          {tab === "uploads" && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Files & uploads</h3>
              {uploadMsg && <div style={uploadMsg.includes("success")?S.savedMsg:S.errorMsg}>{uploadMsg}</div>}
              <div style={S.uploadSection}>
                <div style={S.uploadLabel}>Profile photo</div>
                <p style={{fontSize:13,color:"#9ca3af",marginBottom:8}}>JPG, PNG or WebP. Max 5MB.</p>
                {user.avatar && <img src={user.avatar} alt="Avatar" style={{width:64,height:64,borderRadius:"50%",objectFit:"cover",marginBottom:8}} />}
                <input type="file" accept="image/*" onChange={e=>uploadFile(e,"avatar")} style={{fontSize:13}} disabled={uploading} />
              </div>
              <div style={{...S.uploadSection,marginTop:20}}>
                <div style={S.uploadLabel}>Resume / CV</div>
                <p style={{fontSize:13,color:"#9ca3af",marginBottom:8}}>PDF or Word. Max 5MB.</p>
                {user.resumeUrl && <a href={user.resumeUrl} target="_blank" rel="noreferrer" style={{fontSize:13,color:"#6366F1",display:"block",marginBottom:8}}>View current resume</a>}
                <input type="file" accept=".pdf,.doc,.docx" onChange={e=>uploadFile(e,"resume")} style={{fontSize:13}} disabled={uploading} />
                {uploading && <p style={{fontSize:13,color:"#6366F1",marginTop:6}}>Uploading...</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function fg(label: string, name: string, type: string, value: string, onChange: (e: ChangeEvent<HTMLInputElement>) => void) {
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:12,fontWeight:500,color:"#7B7B8F"}}>{label}</label>
      <input name={name} type={type} value={value} onChange={onChange} style={S.input} />
    </div>
  )
}
function fga(label: string, value: string, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
      <label style={{fontSize:12,fontWeight:500,color:"#7B7B8F"}}>{label}</label>
      <textarea value={value} onChange={onChange} rows={4} style={{...S.input,resize:"vertical"}} />
    </div>
  )
}

const S: Record<string,any> = {
  wrap: { display:"grid", gridTemplateColumns:"220px 1fr", gap:"1.5rem", padding:"1.5rem 2rem", maxWidth:"1000px", margin:"0 auto" },
  loading: { display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh", fontSize:14, color:"#9ca3af" },
  sidebar: { display:"flex", flexDirection:"column", gap:4, height:"fit-content", position:"sticky", top:72 },
  sideHead: { fontSize:16, fontWeight:600, color:"#0A0A0F", marginBottom:8, paddingBottom:10, borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  tabBtn: { background:"none", border:"none", padding:"9px 12px", borderRadius:8, fontSize:13, color:"#7B7B8F", textAlign:"left" as const, cursor:"pointer", transition:"all .15s" },
  tabBtnOn: { background:"#EFF4FF", color:"#6366F1", fontWeight:500 },
  viewBtn: { background:"none", border:"0.5px solid rgba(0,0,0,.1)", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#6b7280", marginTop:8, cursor:"pointer" },
  main: { display:"flex", flexDirection:"column", gap:12 },
  card: { background:"#fff", border:"0.5px solid rgba(0,0,0,.08)", borderRadius:14, padding:"1.5rem" },
  cardTitle: { fontSize:16, fontWeight:600, color:"#0A0A0F", marginBottom:16, paddingBottom:10, borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  row: { display:"flex", flexWrap:"wrap" as const, gap:12, marginBottom:12 },
  input: { width:"100%", border:"0.5px solid rgba(0,0,0,.13)", borderRadius:8, padding:"8px 11px", fontSize:13, color:"#0A0A0F", outline:"none", fontFamily:"inherit" },
  saveBtn: { background:"#6366F1", color:"#fff", border:"none", padding:"9px 20px", borderRadius:8, fontSize:13, fontWeight:500, cursor:"pointer", marginTop:4 },
  savedMsg: { background:"#ECFDF5", border:"0.5px solid #A7F3D0", borderRadius:8, padding:"8px 12px", fontSize:13, color:"#047857", marginBottom:12 },
  errorMsg: { background:"#FEF2F2", border:"0.5px solid #FECACA", borderRadius:8, padding:"8px 12px", fontSize:13, color:"#B91C1C", marginBottom:12 },
  listItem: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"12px 0", borderBottom:"0.5px solid rgba(0,0,0,.05)" },
  delBtn: { background:"none", border:"0.5px solid rgba(220,38,38,.2)", color:"#DC2626", borderRadius:6, padding:"4px 10px", fontSize:12, cursor:"pointer" },
  divider: { fontSize:12, fontWeight:600, color:"#9ca3af", textTransform:"uppercase" as const, letterSpacing:".06em", margin:"16px 0 12px" },
  skillChip: { display:"inline-flex", alignItems:"center", gap:5, background:"#EFF4FF", border:"0.5px solid rgba(99,102,241,.2)", borderRadius:8, padding:"5px 10px", fontSize:12, color:"#6366F1" },
  chipDel: { background:"none", border:"none", color:"#6366F1", cursor:"pointer", fontSize:15, lineHeight:1, padding:0 },
  uploadSection: { paddingBottom:16, borderBottom:"0.5px solid rgba(0,0,0,.06)" },
  uploadLabel: { fontSize:14, fontWeight:600, color:"#0A0A0F", marginBottom:6 },
}