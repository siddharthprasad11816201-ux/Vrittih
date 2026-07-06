"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { IconBriefcase, IconEye, IconEyeOff } from "@/components/ui/Icons"

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name:"", email:"", password:"", role:"JOBSEEKER" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPass, setShowPass] = useState(false)

  const rules = [
    { ok: form.password.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Z]/.test(form.password), label: "One uppercase letter" },
    { ok: /[0-9]/.test(form.password), label: "One number" },
    { ok: /[^A-Za-z0-9]/.test(form.password), label: "One special character" },
  ]

  async function submit(e: any) {
    e.preventDefault()
    const failed = rules.find(r => !r.ok)
    if (failed) { setError(failed.label + " is required in your password"); return }
    setLoading(true); setError("")
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      // Surface the specific field problem, not just "Validation failed"
      const issues = data.issues as Record<string, string[]> | undefined
      const first = issues && Object.values(issues).flat()[0]
      setError(first || data.error || "Registration failed")
      return
    }
    router.push("/pay")
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <Link href="/" style={S.brand}>
          <div style={S.brandMark}><IconBriefcase size={17} /></div>
          <span style={S.brandName}>Vrittih</span>
        </Link>
        <h1 style={S.title}>Create account</h1>
        <p style={S.sub}>Join for a one-time fee of 1 CHF</p>
        {error && <div style={S.err}>{error}</div>}
        <form onSubmit={submit}>
          <div style={S.fg}>
            <label style={S.label}>Full name</label>
            <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={S.input} placeholder="Your full name" required autoFocus />
          </div>
          <div style={S.fg}>
            <label style={S.label}>Email</label>
            <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} style={S.input} placeholder="you@email.com" required />
          </div>
          <div style={S.fg}>
            <label style={S.label}>Password</label>
            <div style={S.passWrap}>
              <input type={showPass?"text":"password"} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} style={{...S.input,paddingRight:44}} placeholder="Create a strong password" required />
              <button type="button" onClick={()=>setShowPass(p=>!p)} style={S.eyeBtn} aria-label={showPass?"Hide password":"Show password"}>{showPass?<IconEyeOff size={16} />:<IconEye size={16} />}</button>
            </div>
            {form.password.length > 0 && (
              <div style={S.rules}>
                {rules.map(r=>(
                  <span key={r.label} style={{...S.rule,color:r.ok?"#047857":"#9ca3af"}}>
                    <span style={{...S.ruleDot,background:r.ok?"#047857":"transparent",borderColor:r.ok?"#047857":"#D1D5DB"}} />{r.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={S.fg}>
            <label style={S.label}>I am a</label>
            <div style={S.roleRow}>
              {[["JOBSEEKER","Job seeker","Looking for work"],["EMPLOYER","Employer","Hiring talent"]].map(([val,label,desc])=>(
                <button key={val} type="button" onClick={()=>setForm(p=>({...p,role:val}))}
                  style={{...S.roleBtn,...(form.role===val?S.roleBtnOn:{})}}>
                  <div style={S.roleBtnLabel}>{label}</div>
                  <div style={S.roleBtnDesc}>{desc}</div>
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading} style={S.btn}>{loading?"Creating account...":"Continue to payment"}</button>
        </form>
        <p style={S.foot}>Already have an account? <Link href="/login" style={S.link}>Sign in</Link></p>
      </div>
    </div>
  )
}

const S: Record<string,any> = {
  page:{ minHeight:"100vh",background:"#0F0A1E",display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem" },
  card:{ background:"#fff",borderRadius:20,padding:"2.5rem",width:"100%",maxWidth:420 },
  brand:{ display:"flex",alignItems:"center",gap:8,textDecoration:"none",marginBottom:"2rem" },
  brandMark:{ width:36,height:36,background:"#7C3AED",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff" },
  brandName:{ fontSize:15,fontWeight:700,color:"#0A0A0F" },
  title:{ fontSize:22,fontWeight:700,color:"#0A0A0F",letterSpacing:"-.3px",marginBottom:4 },
  sub:{ fontSize:14,color:"#9ca3af",marginBottom:"1.5rem" },
  err:{ background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#B91C1C",marginBottom:"1rem" },
  fg:{ display:"flex",flexDirection:"column" as const,gap:5,marginBottom:14 },
  label:{ fontSize:12,fontWeight:500,color:"#7B7B8F" },
  input:{ border:"0.5px solid rgba(0,0,0,.15)",borderRadius:10,padding:"10px 13px",fontSize:14,outline:"none",fontFamily:"inherit",width:"100%" },
  passWrap:{ position:"relative" as const },
  eyeBtn:{ position:"absolute" as const,right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,padding:4 },
  rules:{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px 12px",marginTop:9 },
  rule:{ display:"flex",alignItems:"center",gap:6,fontSize:11.5,transition:"color .15s" },
  ruleDot:{ width:11,height:11,borderRadius:"50%",border:"1.5px solid #D1D5DB",flexShrink:0,transition:"all .15s" },
  roleRow:{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 },
  roleBtn:{ background:"#F9F9FC",border:"1px solid rgba(0,0,0,.1)",borderRadius:10,padding:"12px",textAlign:"left" as const,cursor:"pointer",transition:"all .15s" },
  roleBtnOn:{ border:"1.5px solid #7C3AED",background:"#F5F3FF" },
  roleBtnLabel:{ fontSize:13,fontWeight:600,color:"#0A0A0F",marginBottom:2 },
  roleBtnDesc:{ fontSize:11,color:"#9ca3af" },
  btn:{ width:"100%",background:"#7C3AED",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:15,fontWeight:600,cursor:"pointer",marginTop:4 },
  foot:{ textAlign:"center" as const,fontSize:14,color:"#7B7B8F",marginTop:"1.25rem" },
  link:{ color:"#7C3AED",fontWeight:500,textDecoration:"none" },
}