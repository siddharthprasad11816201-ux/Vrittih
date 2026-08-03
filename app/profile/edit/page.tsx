"use client"
import { useEffect, useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
import { processImage } from "@/lib/clientImage"
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/social/platforms"
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
  const [parseBusy, setParseBusy] = useState(false)
  const [parsed, setParsed] = useState<any>(null)
  const [parseMsg, setParseMsg] = useState("")
  const [links, setLinks] = useState<any[]>([])
  const [linkForm, setLinkForm] = useState({ platform: "linkedin", url: "" })
  const [linkBusy, setLinkBusy] = useState("")   // "" | "add" | <linkId being verified>
  const [linkMsg, setLinkMsg] = useState("")

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

  // Résumé parser — read an uploaded résumé in-house and prefill the profile.
  async function onResumeFile(file: File) {
    if (!file) return
    setParseBusy(true); setParseMsg(""); setParsed(null)
    try {
      const fd = new FormData(); fd.append("file", file)
      const d = await fetch("/api/resume/parse", { method:"POST", body: fd }).then(r => r.json())
      if (!d.ok) { setParseMsg(d.error || "We couldn't read that résumé."); return }
      const p = d.parsed; setParsed(p)
      // Prefill only EMPTY basic fields — never clobber what you've already typed.
      setForm(f => ({ ...f,
        name: f.name || p.name || "", headline: f.headline || p.headline || "",
        bio: f.bio || p.summary || "", location: f.location || p.location || "",
        phone: f.phone || p.phone || "", website: f.website || p.links?.website || "",
        github: f.github || p.links?.github || "", linkedin: f.linkedin || p.links?.linkedin || "",
        twitter: f.twitter || p.links?.twitter || "",
      }))
      const bits: string[] = []
      if (p.fieldsFound?.some((x: string) => ["name","headline","summary","location","phone","links"].includes(x))) bits.push("basic details filled")
      if (p.skills?.length) bits.push(`${p.skills.length} skills`)
      if (p.experience?.length) bits.push(`${p.experience.length} experience`)
      if (p.education?.length) bits.push(`${p.education.length} education`)
      setParseMsg(bits.length ? `Read your résumé — ${bits.join(" · ")}. Review, add the sections below, then Save.` : "Read the file but couldn't confidently find fields — please fill them in.")
    } catch { setParseMsg("Network error reading the résumé.") }
    finally { setParseBusy(false) }
  }
  async function applyParsedSkills() {
    for (const name of (parsed?.skills || []).slice(0, 40)) await fetch("/api/profile/skills", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name }) }).catch(()=>{})
    const d = await fetch("/api/profile").then(r => r.json()); setUser(d.user); setParsed((x:any)=> x ? { ...x, skills: [] } : x)
  }
  async function applyParsedExperience() {
    for (const e of (parsed?.experience || [])) await fetch("/api/profile/experience", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ company:e.company||"", title:e.title||"", location:"", startDate:e.start||"", endDate:e.end||"", description:"" }) }).catch(()=>{})
    const d = await fetch("/api/profile").then(r => r.json()); setUser(d.user); setParsed((x:any)=> x ? { ...x, experience: [] } : x)
  }
  async function applyParsedEducation() {
    for (const e of (parsed?.education || [])) await fetch("/api/profile/education", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ school:e.school||"", degree:e.degree||"", field:"", startYear:"", endYear:e.year||"" }) }).catch(()=>{})
    const d = await fetch("/api/profile").then(r => r.json()); setUser(d.user); setParsed((x:any)=> x ? { ...x, education: [] } : x)
  }

  // Professional links (verified).
  async function loadLinks() { const d = await fetch("/api/profile/links").then(r => r.json()).catch(() => ({})); setLinks(d.links || []) }
  useEffect(() => { if (tab === "links") loadLinks() }, [tab])
  async function addLink(e: any) {
    e.preventDefault(); if (!linkForm.url.trim()) return
    setLinkBusy("add"); setLinkMsg("")
    const d = await fetch("/api/profile/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(linkForm) }).then(r => r.json()).catch(() => ({ error: "Network error" }))
    setLinkBusy("")
    if (d.link) { setLinkForm(f => ({ platform: f.platform, url: "" })); loadLinks() } else setLinkMsg(d.error || "Couldn't add that link.")
  }
  async function verifyLink(id: string) {
    setLinkBusy(id); setLinkMsg("")
    const d = await fetch("/api/profile/links", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(r => r.json()).catch(() => ({}))
    setLinkBusy(""); setLinkMsg(d.verified ? "Verified — your link now shows a verified badge." : (d.reason || "Not verified yet.")); loadLinks()
  }
  async function delLink(id: string) { await fetch("/api/profile/links", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {}); loadLinks() }

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

  const TABS = [["basic","Basic info"],["experience","Experience"],["education","Education"],["skills","Skills"],["links","Links"],["uploads","Files"]]

  return (
    <AppShell>
      <style dangerouslySetInnerHTML={{ __html: PE_CSS }} />
      <div className="pe-wrap">
        <div className="pe-sidebar">
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

              {/* Résumé parser — fill the profile from an uploaded résumé (in-house). */}
              <div style={S.rp}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.rpTitle}>Fill from your résumé</div>
                  <div style={S.rpSub}>Upload a PDF or DOCX — we read it in-house and fill your profile. The file is not stored.</div>
                  {parseMsg && <div style={S.rpMsg}>{parseMsg}</div>}
                  {parsed && (parsed.skills?.length || parsed.experience?.length || parsed.education?.length) ? (
                    <div style={S.rpActions}>
                      {parsed.skills?.length ? <button type="button" onClick={applyParsedSkills} style={S.rpBtn}>Add {parsed.skills.length} skills</button> : null}
                      {parsed.experience?.length ? <button type="button" onClick={applyParsedExperience} style={S.rpBtn}>Add {parsed.experience.length} experience</button> : null}
                      {parsed.education?.length ? <button type="button" onClick={applyParsedEducation} style={S.rpBtn}>Add {parsed.education.length} education</button> : null}
                    </div>
                  ) : null}
                </div>
                <label role="button" tabIndex={0} aria-label="Upload résumé to fill your profile"
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.click() } }}
                  style={{ ...S.rpUpload, ...(parseBusy ? { opacity: .6, pointerEvents: "none" } : {}) }}>
                  {parseBusy ? "Reading…" : "Upload résumé"}
                  <input type="file" accept=".pdf,.docx,.doc,.html,.txt" tabIndex={-1} style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) onResumeFile(f); e.currentTarget.value = "" }} />
                </label>
              </div>

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

          {/* Professional links (verified) */}
          {tab === "links" && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Professional links</h3>
              <p style={{ fontSize: 13, color: "var(--v-ink-2)", marginBottom: 14, lineHeight: 1.55 }}>
                Add LinkedIn, GitHub, Linktree, your website and more. Each link is <b>ownership-verified</b>: we give you a token to place on the page (or your bio), then fetch it to confirm it's yours. Verified links show a badge on your profile.
              </p>
              <form onSubmit={addLink} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <select value={linkForm.platform} onChange={e => setLinkForm(f => ({ ...f, platform: e.target.value }))} style={{ ...S.input, maxWidth: 170, width: "auto" }}>
                  {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
                <input value={linkForm.url} onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))} placeholder={PLATFORMS.find(p => p.key === linkForm.platform)?.placeholder} style={{ ...S.input, flex: 1, minWidth: 200, width: "auto" }} />
                <button type="submit" disabled={linkBusy === "add"} style={S.saveBtn}>{linkBusy === "add" ? "Adding…" : "Add link"}</button>
              </form>
              {linkMsg && <div style={{ fontSize: 12.5, color: "var(--v-accent-2)", marginBottom: 12, fontWeight: 500 }}>{linkMsg}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {links.length === 0 && <p style={{ fontSize: 13, color: "var(--v-ink-3)" }}>No links added yet.</p>}
                {links.map(l => (
                  <div key={l.id} style={{ border: "1px solid var(--v-line-2)", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--v-ink)" }}>{PLATFORM_LABEL(l.platform)}</span>
                      {l.verified
                        ? <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--v-green)", background: "var(--v-green-soft)", borderRadius: 999, padding: "2px 9px" }}>✓ Verified</span>
                        : <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--warn)", background: "#FEF3E2", borderRadius: 999, padding: "2px 9px" }}>Unverified</span>}
                      <a href={l.url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "var(--v-accent)", textDecoration: "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.url}</a>
                      {!l.verified && <button onClick={() => verifyLink(l.id)} disabled={linkBusy === l.id} style={{ ...S.saveBtn, marginTop: 0, padding: "7px 12px" }}>{linkBusy === l.id ? "Checking…" : "Verify"}</button>}
                      <button onClick={() => delLink(l.id)} style={{ background: "none", border: "none", color: "#B91C1C", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Remove</button>
                    </div>
                    {!l.verified && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "var(--v-ink-2)", background: "var(--v-surface-2)", borderRadius: 8, padding: "9px 11px", lineHeight: 1.5 }}>
                        Place this token on the page (footer, bio, or a README), then click Verify:
                        <code style={{ display: "block", marginTop: 5, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--v-ink)", wordBreak: "break-all", userSelect: "all" }}>{l.verifyToken}</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
    <div style={{flex:"1 1 200px",minWidth:180,display:"flex",flexDirection:"column",gap:5}}>
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

// Responsive layout (Team G · UX). Two columns on desktop; on phones/tablets the
// sidebar becomes a horizontal tab strip and the form takes full width — fixing
// the mobile overlap. Scoped CSS (inline styles can't hold @media).
const PE_CSS = `
.pe-wrap { display:grid; grid-template-columns:220px 1fr; gap:1.5rem; padding:1.5rem 2rem; max-width:1000px; margin:0 auto; }
.pe-sidebar { display:flex; flex-direction:column; gap:4px; height:fit-content; position:sticky; top:72px; }
@media (max-width: 860px) {
  .pe-wrap { grid-template-columns:1fr; padding:1rem; gap:1rem; }
  .pe-sidebar { position:static; top:auto; flex-direction:row; flex-wrap:wrap; align-items:center; gap:6px; }
  .pe-sidebar h2 { width:100%; }
}
`

const S: Record<string,any> = {
  loading: { display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh", fontSize:14, color:"#9ca3af" },
  sideHead: { fontSize:16, fontWeight:600, color:"#0A0A0F", marginBottom:8, paddingBottom:10, borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  tabBtn: { background:"none", border:"none", padding:"9px 12px", borderRadius:8, fontSize:13, color:"#7B7B8F", textAlign:"left" as const, cursor:"pointer", transition:"all .15s" },
  tabBtnOn: { background:"#EFF4FF", color:"#6366F1", fontWeight:500 },
  viewBtn: { background:"none", border:"0.5px solid rgba(0,0,0,.1)", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#6b7280", marginTop:8, cursor:"pointer" },
  main: { display:"flex", flexDirection:"column", gap:12 },
  card: { background:"#fff", border:"0.5px solid rgba(0,0,0,.08)", borderRadius:14, padding:"1.5rem" },
  cardTitle: { fontSize:16, fontWeight:600, color:"#0A0A0F", marginBottom:16, paddingBottom:10, borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  rp: { display:"flex", alignItems:"flex-start", gap:14, flexWrap:"wrap", padding:"14px 16px", marginBottom:16, border:"1px solid var(--v-accent-soft)", background:"var(--v-accent-soft)", borderRadius:12 },
  rpTitle: { fontSize:14, fontWeight:600, color:"var(--v-ink)" },
  rpSub: { fontSize:12.5, color:"var(--v-ink-2)", marginTop:2, lineHeight:1.5 },
  rpMsg: { fontSize:12.5, color:"var(--v-accent-2)", marginTop:8, fontWeight:500, lineHeight:1.5 },
  rpActions: { display:"flex", gap:8, flexWrap:"wrap", marginTop:10 },
  rpBtn: { border:"1px solid var(--v-accent)", background:"var(--v-surface)", color:"var(--v-accent)", borderRadius:9, padding:"6px 12px", fontSize:12.5, fontWeight:600, cursor:"pointer" },
  rpUpload: { flexShrink:0, display:"inline-flex", alignItems:"center", gap:7, background:"var(--v-accent)", color:"#fff", borderRadius:10, padding:"10px 16px", fontSize:13.5, fontWeight:600, cursor:"pointer" },
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