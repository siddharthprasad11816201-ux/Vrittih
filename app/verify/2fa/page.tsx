"use client"
import { Suspense } from "react"
import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { IconLock, IconInfo } from "@/components/ui/Icons"

function TwoFAContent() {
  const router = useRouter()
  const params = useSearchParams()
  const userId = params.get("uid") || ""
  const mode = params.get("mode") || "login"
  const method = params.get("method") || "email"   // "totp" = in-house authenticator app
  const [otp, setOtp] = useState(["","","","","",""])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState("")
  const [countdown, setCountdown] = useState(0)
  const inputs = useRef<(HTMLInputElement|null)[]>([])
  const timerRef = useRef<any>(null)

  useEffect(() => {
    if (!userId) { router.push("/login"); return }
    if (method !== "totp") sendOTP()   // authenticator codes are generated on-device — nothing to send
    return () => clearInterval(timerRef.current)
  }, [])

  async function sendOTP() {
    setSending(true); setError("")
    const res = await fetch("/api/auth/otp-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, note: mode === "injury" ? "Face recognition fallback — please verify with OTP" : undefined })
    })
    const data = await res.json()
    setSending(false)
    if (data.success) {
      setSent(true)
      setMaskedEmail(data.email)
      setCountdown(60)
      timerRef.current = setInterval(() => {
        setCountdown(c => { if (c <= 1) { clearInterval(timerRef.current); return 0 } return c - 1 })
      }, 1000)
    } else setError(data.error || "Failed to send OTP")
  }

  function handleInput(i: number, val: string) {
    if (!/^\d*$/.test(val)) return
    const next = [...otp]
    next[i] = val.slice(-1)
    setOtp(next)
    setError("")
    if (val && i < 5) inputs.current[i+1]?.focus()
    if (next.every(d => d) && next.join("").length === 6) verify(next.join(""))
  }

  function handleKey(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[i] && i > 0) inputs.current[i-1]?.focus()
  }

  async function verify(code?: string) {
    const finalCode = code || otp.join("")
    if (finalCode.length !== 6) { setError("Please enter the 6-digit code"); return }
    setLoading(true); setError("")
    const res = await fetch(method === "totp" ? "/api/auth/totp/verify" : "/api/auth/otp-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(method === "totp" ? { userId, code: finalCode } : { userId, otp: finalCode, mode })
    })
    const data = await res.json()
    setLoading(false)
    if (data.success) {
      if (data.requiresReenroll) router.push("/verify/face-setup?update=true")
      else router.push("/dashboard")
    } else {
      setError(data.error || "Incorrect code")
      setOtp(["","","","","",""])
      inputs.current[0]?.focus()
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{...S.icon,color:"#534AB7",display:"flex",justifyContent:"center"}}><IconLock size={42} /></div>
        <h1 style={S.title}>
          {mode === "injury" ? "Identity verification" : "Two-factor authentication"}
        </h1>
        <p style={S.sub}>
          {method === "totp" ? "Enter the 6-digit code from your authenticator app" :
           sending ? "Sending verification code..." :
           sent ? `We sent a 6-digit code to ${maskedEmail}` :
           "Preparing your verification code..."}
        </p>
        {error && <div style={S.err}>{error}</div>}
        {mode === "injury" && (
          <div style={S.injuryNote}>
            <span style={{color:"#92400E",flexShrink:0}}><IconInfo size={16} /></span>
            <p style={{fontSize:13,color:"#92400E",lineHeight:1.55,margin:0}}>Face recognition returned a low confidence match. Verify with your email code. After login you will be asked to re-enroll your face.</p>
          </div>
        )}
        <div style={S.otpRow}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleInput(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              style={{...S.otpInput,...(digit?S.otpInputFilled:{})}}
              autoFocus={i === 0}
            />
          ))}
        </div>
        <button onClick={() => verify()} disabled={loading || otp.join("").length !== 6} style={S.verifyBtn}>
          {loading ? "Verifying..." : "Verify code"}
        </button>
        {method !== "totp" && (
          <div style={S.resend}>
            {countdown > 0
              ? <span style={{fontSize:13,color:"#9ca3af"}}>Resend in {countdown}s</span>
              : <button onClick={sendOTP} disabled={sending} style={S.resendBtn}>{sending ? "Sending..." : "Resend code"}</button>
            }
          </div>
        )}
        <button onClick={() => router.push("/login")} style={S.backBtn}>← Back to login</button>
      </div>
    </div>
  )
}

export default function TwoFAPage() {
  return (
    <Suspense fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#0F0A1E",color:"#fff",fontSize:14}}>Loading...</div>}>
      <TwoFAContent />
    </Suspense>
  )
}

const S: Record<string,any> = {
  page:{ minHeight:"100vh",background:"#0F0A1E",display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem" },
  card:{ background:"#fff",borderRadius:20,padding:"2.5rem",width:"100%",maxWidth:420,textAlign:"center" as const },
  icon:{ fontSize:48,marginBottom:16 },
  title:{ fontSize:20,fontWeight:700,color:"#0A0A0F",letterSpacing:"-.3px",marginBottom:8 },
  sub:{ fontSize:14,color:"#7B7B8F",lineHeight:1.6,marginBottom:"1.5rem" },
  err:{ background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#B91C1C",marginBottom:"1rem" },
  injuryNote:{ display:"flex",gap:10,background:"#FFFBEB",border:"0.5px solid #FCD34D",borderRadius:10,padding:"12px",marginBottom:"1.25rem",textAlign:"left" as const },
  otpRow:{ display:"flex",gap:10,justifyContent:"center",marginBottom:"1.5rem" },
  otpInput:{ width:48,height:56,borderRadius:12,border:"1.5px solid rgba(0,0,0,.15)",textAlign:"center" as const,fontSize:24,fontWeight:700,color:"#0A0A0F",outline:"none",transition:"border-color .15s,box-shadow .15s" },
  otpInputFilled:{ borderColor:"#534AB7",boxShadow:"0 0 0 3px rgba(83,74,183,.1)" },
  verifyBtn:{ width:"100%",background:"#534AB7",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:15,fontWeight:600,cursor:"pointer",marginBottom:"1rem" },
  resend:{ marginBottom:"1rem" },
  resendBtn:{ background:"none",border:"none",color:"#534AB7",fontSize:13,fontWeight:500,cursor:"pointer" },
  backBtn:{ background:"none",border:"none",color:"#9ca3af",fontSize:13,cursor:"pointer" },
}