"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { IconBriefcase, IconEye, IconEyeOff, IconScan } from "@/components/ui/Icons"
import { loginWithPasskey, webauthnSupported } from "@/lib/webauthn-client"

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email:"", password:"" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)

  async function passkeySignIn() {
    if (!form.email) { setError("Enter your email first, then use your passkey"); return }
    setPasskeyLoading(true); setError("")
    const r = await loginWithPasskey(form.email)
    setPasskeyLoading(false)
    if (r.success) router.push("/dashboard")
    else setError(r.error || "Passkey sign-in failed")
  }

  async function submit(e: any) {
    e.preventDefault()
    setLoading(true); setError("")
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || "Invalid credentials"); return }
    if (data.requiresFaceVerify && data.userId) {
      router.push(`/verify/face-login?uid=${data.userId}`)
      return
    }
    if (data.requires2FA && data.userId) {
      router.push(`/verify/2fa?uid=${data.userId}${data.method === "totp" ? "&method=totp" : ""}`)
      return
    }
    router.push("/dashboard")
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <Link href="/" style={S.brand}>
          <div style={S.brandMark}><IconBriefcase size={17} /></div>
          <span style={S.brandName}>Vrittih</span>
        </Link>
        <h1 style={S.title}>Sign in</h1>
        <p style={S.sub}>Welcome back</p>
        {error && <div style={S.err}>{error}</div>}
        <form onSubmit={submit}>
          <div style={S.fg}>
            <label style={S.label}>Email</label>
            <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} style={S.input} placeholder="you@email.com" required autoFocus />
          </div>
          <div style={S.fg}>
            <label style={S.label}>Password</label>
            <div style={S.passWrap}>
              <input type={showPass?"text":"password"} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} style={{...S.input,paddingRight:44}} placeholder="••••••••" required />
              <button type="button" onClick={()=>setShowPass(p=>!p)} style={S.eyeBtn} aria-label={showPass?"Hide password":"Show password"}>{showPass?<IconEyeOff size={16} />:<IconEye size={16} />}</button>
            </div>
          </div>
          <button type="submit" disabled={loading} style={S.btn}>{loading?"Signing in...":"Sign in"}</button>
        </form>
        <div style={S.divider}><span>or</span></div>
        {webauthnSupported() && (
          <button type="button" onClick={passkeySignIn} disabled={passkeyLoading}
            style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:9,background:"none",border:"1px solid rgba(0,0,0,.15)",borderRadius:10,padding:"11px",fontSize:14,fontWeight:600,color:"#0A0A0F",cursor:"pointer",marginBottom:14}}>
            <IconScan size={16} /> {passkeyLoading ? "Waiting for your device..." : "Sign in with fingerprint / passkey"}
          </button>
        )}
        <p style={S.foot}>
          No account? <Link href="/register" style={S.link}>Join for 1 CHF</Link>
        </p>
      </div>
    </div>
  )
}

const S: Record<string,any> = {
  page:{ minHeight:"100vh",background:"#0F0A1E",display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem" },
  card:{ background:"#fff",borderRadius:20,padding:"2.5rem",width:"100%",maxWidth:400 },
  brand:{ display:"flex",alignItems:"center",gap:8,textDecoration:"none",marginBottom:"2rem" },
  brandMark:{ width:36,height:36,background:"#7C3AED",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff" },
  brandName:{ fontSize:15,fontWeight:700,color:"#0A0A0F" },
  title:{ fontSize:22,fontWeight:700,color:"#0A0A0F",letterSpacing:"-.3px",marginBottom:4 },
  sub:{ fontSize:14,color:"#9ca3af",marginBottom:"1.5rem" },
  err:{ background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#B91C1C",marginBottom:"1rem" },
  fg:{ display:"flex",flexDirection:"column" as const,gap:5,marginBottom:14 },
  label:{ fontSize:12,fontWeight:500,color:"#7B7B8F" },
  input:{ border:"0.5px solid rgba(0,0,0,.15)",borderRadius:10,padding:"10px 13px",fontSize:14,outline:"none",fontFamily:"inherit",width:"100%",transition:"border-color .15s" },
  passWrap:{ position:"relative" as const },
  eyeBtn:{ position:"absolute" as const,right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,padding:4 },
  btn:{ width:"100%",background:"#7C3AED",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:15,fontWeight:600,cursor:"pointer",marginTop:4,transition:"background .15s" },
  divider:{ textAlign:"center" as const,margin:"1.25rem 0",fontSize:13,color:"#9ca3af" },
  foot:{ textAlign:"center" as const,fontSize:14,color:"#7B7B8F" },
  link:{ color:"#7C3AED",fontWeight:500,textDecoration:"none" },
}