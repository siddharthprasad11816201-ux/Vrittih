"use client"
import { useEffect, useState, useRef } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconGlobe, IconMonitor, IconNetwork, IconAlert } from "@/components/ui/Icons"
import Link from "next/link"

const TEMPLATES = [
  { id:"classic", label:"Classic", desc:"Clean, professional, ATS-friendly" },
  { id:"modern", label:"Modern", desc:"Bold headings, accent color" },
  { id:"minimal", label:"Minimal", desc:"Maximum whitespace, elegant" },
]

export default function ResumeBuilder() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [template, setTemplate] = useState("classic")
  const [printing, setPrinting] = useState(false)
  const resumeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/resume").then(r=>r.json()).then(d => {
      setUser(d.user); setLoading(false)
    })
  }, [])

  async function downloadPDF() {
    setPrinting(true)
    window.print()
    setTimeout(() => setPrinting(false), 1000)
  }

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-IN",{month:"short",year:"numeric"}) : ""

  if (loading) return <AppShell><div style={S.loading}>Building your resume...</div></AppShell>
  if (!user) return <AppShell><div style={S.loading}>Please log in</div></AppShell>

  const accentColor = template === "modern" ? "#0F6E56" : template === "minimal" ? "#0A0A0F" : "#1E40AF"

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .resume-page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="no-print"></div>
      <div style={S.page}>
        <div className="no-print" style={S.controls}>
          <div style={S.controlsLeft}>
            <h1 style={S.title}>Resume builder</h1>
            <p style={S.sub}>Your profile data, formatted as a professional resume</p>
          </div>
          <div style={S.controlsRight}>
            <div style={S.templatePicker}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={()=>setTemplate(t.id)} style={{...S.templateBtn,...(template===t.id?S.templateBtnOn:{})}}>
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={downloadPDF} disabled={printing} style={S.downloadBtn}>
              {printing?"Preparing...":"⬇ Download PDF"}
            </button>
            <Link href="/profile/edit" style={S.editBtn}>Edit profile</Link>
          </div>
        </div>

        {/* Resume */}
        <div ref={resumeRef} className="resume-page" style={{...S.resume,...(template==="modern"?S.resumeModern:template==="minimal"?S.resumeMinimal:{})}}>

          {/* Header */}
          <div style={{...S.resumeHeader,...(template==="modern"?{background:accentColor,color:"#fff",padding:"2rem",margin:"-2rem -2rem 1.5rem"}:{})}}>
            <h1 style={{...S.resumeName,...(template==="modern"?{color:"#fff"}:{color:accentColor})}}>{user.name}</h1>
            {user.headline && <div style={{...S.resumeHeadline,...(template==="modern"?{color:"rgba(255,255,255,.8)"}:{})}}>{user.headline}</div>}
            <div style={{...S.resumeContact,...(template==="modern"?{color:"rgba(255,255,255,.7)"}:{})}}>
              <span>{user.email}</span>
              {user.phone && <><span>·</span><span>{user.phone}</span></>}
              {user.location && <><span>·</span><span>{user.location}</span></>}
              {user.profile?.linkedin && <><span>·</span><span>{user.profile.linkedin}</span></>}
              {user.profile?.github && <><span>·</span><span>{user.profile.github}</span></>}
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <div style={S.section}>
              <div style={{...S.sectionTitle,color:accentColor}}>Professional Summary</div>
              <div style={{...S.sectionBorder,borderColor:accentColor}} />
              <p style={S.bioText}>{user.bio}</p>
            </div>
          )}

          {/* Experience */}
          {user.experience?.length > 0 && (
            <div style={S.section}>
              <div style={{...S.sectionTitle,color:accentColor}}>Experience</div>
              <div style={{...S.sectionBorder,borderColor:accentColor}} />
              {user.experience.map((exp: any) => (
                <div key={exp.id} style={S.expItem}>
                  <div style={S.expHeader}>
                    <div>
                      <div style={S.expTitle}>{exp.title}</div>
                      <div style={S.expCompany}>{exp.company}{exp.location?` · ${exp.location}`:""}</div>
                    </div>
                    <div style={S.expDate}>{fmtDate(exp.startDate)} — {exp.endDate?fmtDate(exp.endDate):"Present"}</div>
                  </div>
                  {exp.description && <p style={S.expDesc}>{exp.description}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Education */}
          {user.education?.length > 0 && (
            <div style={S.section}>
              <div style={{...S.sectionTitle,color:accentColor}}>Education</div>
              <div style={{...S.sectionBorder,borderColor:accentColor}} />
              {user.education.map((edu: any) => (
                <div key={edu.id} style={S.expItem}>
                  <div style={S.expHeader}>
                    <div>
                      <div style={S.expTitle}>{edu.degree} in {edu.field}</div>
                      <div style={S.expCompany}>{edu.school}</div>
                    </div>
                    <div style={S.expDate}>{edu.startYear} — {edu.endYear || "Present"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Skills */}
          {user.skills?.length > 0 && (
            <div style={S.section}>
              <div style={{...S.sectionTitle,color:accentColor}}>Skills</div>
              <div style={{...S.sectionBorder,borderColor:accentColor}} />
              <div style={S.skillsGrid}>
                {user.skills.map((s: any) => (
                  <span key={s.skillId} style={{...S.resumeSkill,background:`${accentColor}10`,color:accentColor,border:`0.5px solid ${accentColor}30`}}>
                    {s.skill?.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {(user.profile?.website || user.profile?.github || user.profile?.linkedin) && (
            <div style={S.section}>
              <div style={{...S.sectionTitle,color:accentColor}}>Links</div>
              <div style={{...S.sectionBorder,borderColor:accentColor}} />
              <div style={S.linksRow}>
                {user.profile?.website && <span style={{display:"inline-flex",alignItems:"center",gap:5}}><IconGlobe size={12} /> {user.profile.website}</span>}
                {user.profile?.github && <span style={{display:"inline-flex",alignItems:"center",gap:5}}><IconMonitor size={12} /> {user.profile.github}</span>}
                {user.profile?.linkedin && <span style={{display:"inline-flex",alignItems:"center",gap:5}}><IconNetwork size={12} /> {user.profile.linkedin}</span>}
              </div>
            </div>
          )}

          <div style={S.resumeFooter}>Generated via Vrittih · {new Date().toLocaleDateString("en-IN",{year:"numeric",month:"long"})}</div>
        </div>

        {user.experience?.length === 0 && user.skills?.length === 0 && (
          <div className="no-print" style={S.incomplete}>
            <span style={{color:"#B45309"}}><IconAlert size={22} /></span>
            <p style={{fontSize:14,color:"#B45309",fontWeight:500}}>Your resume is incomplete</p>
            <p style={{fontSize:13,color:"#92400E"}}>Add experience, education, and skills to your profile for a complete resume.</p>
            <Link href="/profile/edit" style={{...S.downloadBtn,marginTop:8,display:"inline-block",textDecoration:"none"}}>Complete your profile →</Link>
          </div>
        )}
      </div>
    </>
  )
}

const S: Record<string,any> = {
  loading:{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",fontSize:14,color:"#9ca3af" },
  page:{ background:"#F0F0F5",minHeight:"calc(100vh - 60px)",padding:"2rem" },
  controls:{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",maxWidth:820,margin:"0 auto 1.5rem",flexWrap:"wrap" as const,gap:12 },
  controlsLeft:{},
  controlsRight:{ display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" as const },
  title:{ fontSize:22,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px" },
  sub:{ fontSize:13,color:"#7B7B8F",marginTop:4 },
  templatePicker:{ display:"flex",gap:4,background:"#fff",padding:3,borderRadius:8,border:"0.5px solid rgba(0,0,0,.1)" },
  templateBtn:{ background:"none",border:"none",borderRadius:6,padding:"5px 12px",fontSize:12,cursor:"pointer",color:"#7B7B8F" },
  templateBtnOn:{ background:"#0F6E56",color:"#fff",fontWeight:500 },
  downloadBtn:{ background:"#0F6E56",color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:13,fontWeight:500,cursor:"pointer" },
  editBtn:{ background:"none",border:"0.5px solid rgba(0,0,0,.13)",color:"#3D3D4E",borderRadius:9,padding:"8px 16px",fontSize:13,textDecoration:"none" },
  resume:{ background:"#fff",maxWidth:820,margin:"0 auto",padding:"2rem 2.5rem",boxShadow:"0 4px 32px rgba(0,0,0,.1)",borderRadius:4,minHeight:"29.7cm" },
  resumeModern:{ fontFamily:"system-ui,sans-serif" },
  resumeMinimal:{ fontFamily:"Georgia,serif" },
  resumeHeader:{ marginBottom:"1.5rem" },
  resumeName:{ fontSize:28,fontWeight:700,letterSpacing:"-.5px",marginBottom:4 },
  resumeHeadline:{ fontSize:15,color:"#3D3D4E",marginBottom:6 },
  resumeContact:{ fontSize:12,color:"#6b7280",display:"flex",gap:8,flexWrap:"wrap" as const },
  section:{ marginBottom:"1.25rem" },
  sectionTitle:{ fontSize:13,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:".1em",marginBottom:4 },
  sectionBorder:{ height:1.5,borderRadius:999,marginBottom:10 },
  bioText:{ fontSize:13,color:"#3D3D4E",lineHeight:1.7 },
  expItem:{ marginBottom:12 },
  expHeader:{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4 },
  expTitle:{ fontSize:14,fontWeight:600,color:"#0A0A0F" },
  expCompany:{ fontSize:13,color:"#6b7280" },
  expDate:{ fontSize:12,color:"#9ca3af",flexShrink:0,marginLeft:16 },
  expDesc:{ fontSize:13,color:"#3D3D4E",lineHeight:1.65,marginTop:4 },
  skillsGrid:{ display:"flex",flexWrap:"wrap" as const,gap:6 },
  resumeSkill:{ fontSize:12,padding:"3px 10px",borderRadius:999,fontWeight:500 },
  linksRow:{ display:"flex",gap:16,fontSize:13,color:"#3D3D4E",flexWrap:"wrap" as const },
  resumeFooter:{ fontSize:11,color:"#d1d5db",textAlign:"center" as const,marginTop:"2rem",paddingTop:"1rem",borderTop:"0.5px solid #f3f4f6" },
  incomplete:{ maxWidth:820,margin:"1rem auto 0",background:"#FFFBEB",border:"0.5px solid #FCD34D",borderRadius:12,padding:"1.25rem",textAlign:"center" as const },
}