"use client"
import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { IconCheckCircle, IconX, IconHelp } from "@/components/ui/Icons"

type Step = "loading"|"liveness"|"verifying"|"uncertain"|"success"|"failed"

export default function FaceLogin() {
  return (
    <Suspense fallback={<div style={S.page}><div style={S.card}><p style={S.sub}>Loading...</p></div></div>}>
      <FaceLoginInner />
    </Suspense>
  )
}

function FaceLoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const userId = params.get("uid") || ""
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream|null>(null)
  const faceApiRef = useRef<any>(null)
  const detectionLoop = useRef<any>(null)
  const [step, setStep] = useState<Step>("loading")
  const [status, setStatus] = useState("Loading...")
  const [livenessScore, setLivenessScore] = useState(0)
  const [blinkCount, setBlinkCount] = useState(0)
  const [challenge] = useState(["Blink twice","Turn head slightly left","Nod once","Look up briefly"][Math.floor(Math.random()*4)])
  const [error, setError] = useState("")
  const [showInjury, setShowInjury] = useState(false)
  const [injuryNote, setInjuryNote] = useState("")
  const earHistory = useRef<number[]>([])
  const movRef = useRef<number[][]>([])
  const blinkRef = useRef(0)

  useEffect(() => {
    if (!userId) { router.push("/login"); return }
    init()
    return () => { stopCamera(); clearInterval(detectionLoop.current) }
  }, [])

  async function init() {
    const faceapi = (await import("face-api.js")).default
    faceApiRef.current = faceapi
    await faceapi.nets.tinyFaceDetector.loadFromUri("/models")
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models")
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models")
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ width:640,height:480,facingMode:"user" },audio:false })
    streamRef.current = stream
    if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
    setStep("liveness")
    setStatus(`Complete challenge: ${challenge}`)
    startLoop()
  }

  function stopCamera() { streamRef.current?.getTracks().forEach(t=>t.stop()) }

  function computeEAR(lm: any) {
    try {
      const e=(eye:any[])=>{ const A=Math.hypot(eye[1].x-eye[5].x,eye[1].y-eye[5].y),B=Math.hypot(eye[2].x-eye[4].x,eye[2].y-eye[4].y),C=Math.hypot(eye[0].x-eye[3].x,eye[0].y-eye[3].y); return(A+B)/(2*C) }
      return (e(lm.getLeftEye())+e(lm.getRightEye()))/2
    } catch { return 0.3 }
  }

  function startLoop() {
    let frames=0, blinks=0, wasBelow=false
    detectionLoop.current = setInterval(async()=>{
      if(!videoRef.current||!faceApiRef.current) return
      frames++
      try {
        const det = await faceApiRef.current.detectSingleFace(videoRef.current,new faceApiRef.current.TinyFaceDetectorOptions({scoreThreshold:0.4})).withFaceLandmarks()
        if(!det){setStatus("No face detected — position yourself");return}
        const ear = computeEAR(det.landmarks)
        if(ear<0.22&&!wasBelow) wasBelow=true
        else if(ear>0.28&&wasBelow){wasBelow=false;blinks++;blinkRef.current=blinks;setBlinkCount(blinks)}
        const nose=det.landmarks.getNose()[0]
        movRef.current=[...movRef.current.slice(-20),[nose.x,nose.y]]
        let score=0
        if(blinks>=1)score+=0.4
        if(movRef.current.length>=10){const xv=movRef.current.map(p=>p[0]),mean=xv.reduce((a,b)=>a+b)/xv.length,variance=xv.reduce((s,v)=>s+Math.pow(v-mean,2),0)/xv.length;if(variance>0.5)score+=0.3}
        if(det.detection.score>0.8)score+=0.2
        if(frames>30)score+=0.1
        setLivenessScore(Math.min(1,score))
        if(blinks>=1&&score>=0.7){clearInterval(detectionLoop.current);await verifyFace(score)}
        else setStatus(`Challenge: ${challenge} — blinks: ${blinks}`)
      }catch{}
    },150)
  }

  async function verifyFace(liveness: number) {
    const faceapi = faceApiRef.current
    setStep("verifying"); setStatus("Verifying your identity...")
    try {
      const det = await faceapi.detectSingleFace(videoRef.current,new faceapi.TinyFaceDetectorOptions({scoreThreshold:0.5})).withFaceLandmarks().withFaceDescriptor()
      if(!det){setError("Could not extract face — try again");setStep("liveness");startLoop();return}
      const vector = Array.from(det.descriptor)
      stopCamera()
      const res = await fetch("/api/verify/face-verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({vector,userId,livenessScore:liveness,challengePassed:true})})
      const data = await res.json()
      if(data.success){setStep("success");setTimeout(()=>router.push("/dashboard"),1200)}
      else if(data.uncertain){setStep("uncertain")}
      else{setStep("failed");setError(data.message||"Face did not match")}
    }catch(err:any){setError(err.message);setStep("failed")}
  }

  async function handleInjuryFallback() {
    const res = await fetch("/api/auth/otp-request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId,note:injuryNote})})
    const d = await res.json()
    if(d.success) router.push(`/verify/2fa?uid=${userId}&mode=injury`)
    else setError(d.error||"Failed to send OTP")
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>Face verification</h1>
        <p style={S.sub}>Complete the challenge below to verify your identity and log in.</p>
        {error&&<div style={S.err}>{error}</div>}

        {(step==="loading"||step==="liveness"||step==="verifying")&&(
          <div>
            <div style={S.videoWrap}>
              <video ref={videoRef} style={S.video} muted playsInline />
              <div style={S.guide}/>
            </div>
            <div style={S.statusBox}>
              <div style={S.statusText}>{status}</div>
              <div style={S.barWrap}>
                <div style={S.barTrack}><div style={{...S.barFill,width:`${livenessScore*100}%`,background:livenessScore>0.7?"#059669":livenessScore>0.4?"#B45309":"#7C3AED"}}/></div>
                <span style={{fontSize:12,color:"#9ca3af"}}>{Math.round(livenessScore*100)}%</span>
              </div>
              <div style={{fontSize:12,color:"#9ca3af"}}>Blinks: {blinkCount}</div>
            </div>
          </div>
        )}

        {step==="success"&&<div style={S.success}><div style={{color:"#059669",display:"flex",justifyContent:"center"}}><IconCheckCircle size={52} /></div><h2 style={S.doneTitle}>Identity verified</h2><p style={{color:"#7B7B8F",fontSize:14}}>Redirecting to dashboard...</p></div>}

        {step==="failed"&&(
          <div style={S.failBox}>
            <div style={{color:"#DC2626",display:"flex",justifyContent:"center"}}><IconX size={44} /></div>
            <h2 style={S.doneTitle}>Verification failed</h2>
            <p style={{fontSize:14,color:"#7B7B8F",marginBottom:"1rem"}}>{error}</p>
            <button onClick={()=>{setStep("loading");setError("");setBlinkCount(0);setLivenessScore(0);init()}} style={S.primaryBtn}>Try again</button>
            <button onClick={()=>router.push("/login?reason=otp")} style={S.secondaryBtn}>Use email OTP instead</button>
          </div>
        )}

        {step==="uncertain"&&(
          <div style={S.uncertainBox}>
            <div style={{color:"#B45309",display:"flex",justifyContent:"center"}}><IconHelp size={44} /></div>
            <h2 style={S.doneTitle}>Partial match detected</h2>
            <p style={{fontSize:14,color:"#7B7B8F",marginBottom:"1rem"}}>Your face partially matched but did not meet the confidence threshold.</p>
            {!showInjury?(
              <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                <button onClick={()=>setShowInjury(true)} style={S.primaryBtn}>I have had facial changes (injury, surgery, aging)</button>
                <button onClick={()=>{setStep("loading");init()}} style={S.secondaryBtn}>Try verification again</button>
                <button onClick={()=>router.push("/login?reason=otp")} style={S.secondaryBtn}>Use email OTP</button>
              </div>
            ):(
              <div>
                <p style={{fontSize:13,color:"#7B7B8F",marginBottom:8}}>Briefly describe what changed (optional — this helps our team review your account):</p>
                <textarea value={injuryNote} onChange={e=>setInjuryNote(e.target.value)} style={S.textarea} rows={3} placeholder="e.g. minor facial injury last month, dental surgery, significant time since last login..." />
                <button onClick={handleInjuryFallback} style={S.primaryBtn}>Send OTP to my email</button>
                <button onClick={()=>setShowInjury(false)} style={S.cancelBtn}>Back</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const S: Record<string,any> = {
  page:{minHeight:"100vh",background:"#0F0A1E",display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem"},
  card:{background:"#fff",borderRadius:16,padding:"2rem",width:"100%",maxWidth:480},
  title:{fontSize:20,fontWeight:600,color:"#0A0A0F",marginBottom:6},
  sub:{fontSize:13,color:"#7B7B8F",marginBottom:"1.25rem",lineHeight:1.6},
  err:{background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#B91C1C",marginBottom:12},
  videoWrap:{position:"relative" as const,borderRadius:14,overflow:"hidden",background:"#000",marginBottom:12,aspectRatio:"4/3"},
  video:{width:"100%",height:"100%",objectFit:"cover" as const,transform:"scaleX(-1)"},
  guide:{position:"absolute" as const,top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:220,border:"2px solid rgba(124,58,237,.7)",borderRadius:"50%",boxShadow:"0 0 0 4000px rgba(0,0,0,.4)"},
  statusBox:{background:"#F9F9FC",borderRadius:10,padding:"1rem",display:"flex",flexDirection:"column" as const,gap:8},
  statusText:{fontSize:13,fontWeight:500,color:"#3D3D4E"},
  barWrap:{display:"flex",alignItems:"center",gap:8},
  barTrack:{flex:1,background:"#E5E7EB",borderRadius:999,height:7,overflow:"hidden"},
  barFill:{height:7,borderRadius:999,transition:"width .3s,background .3s"},
  success:{textAlign:"center" as const,padding:"2rem 0"},
  doneTitle:{fontSize:18,fontWeight:600,color:"#0A0A0F",margin:"12px 0 8px"},
  failBox:{textAlign:"center" as const,padding:"1rem 0",display:"flex",flexDirection:"column" as const,gap:10,alignItems:"center"},
  uncertainBox:{textAlign:"center" as const,padding:"1rem 0"},
  primaryBtn:{width:"100%",background:"#7C3AED",color:"#fff",border:"none",borderRadius:9,padding:"11px",fontSize:14,fontWeight:500,cursor:"pointer",marginBottom:8},
  secondaryBtn:{width:"100%",background:"none",border:"0.5px solid rgba(0,0,0,.13)",color:"#3D3D4E",borderRadius:9,padding:"10px",fontSize:13,cursor:"pointer",marginBottom:6},
  cancelBtn:{width:"100%",background:"none",border:"none",color:"#9ca3af",fontSize:13,cursor:"pointer",marginTop:4},
  textarea:{width:"100%",border:"0.5px solid rgba(0,0,0,.12)",borderRadius:8,padding:"8px",fontSize:13,fontFamily:"inherit",outline:"none",marginBottom:10,resize:"vertical" as const},
}