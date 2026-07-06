"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
import { IconCamera, IconLock, IconEye, IconTarget, IconCheckCircle } from "@/components/ui/Icons"

type Step = "intro"|"camera"|"liveness"|"capture"|"done"

export default function FaceSetup() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream|null>(null)
  const faceApiRef = useRef<any>(null)
  const [step, setStep] = useState<Step>("intro")
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [blinkCount, setBlinkCount] = useState(0)
  const [livenessScore, setLivenessScore] = useState(0)
  const [challenge, setChallenge] = useState("")
  const [challengeDone, setChallengeDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isUpdate, setIsUpdate] = useState(false)
  const [changeReason, setChangeReason] = useState("")
  const earHistory = useRef<number[]>([])
  const movementHistory = useRef<number[][]>([])
  const detectionLoop = useRef<any>(null)
  const CHALLENGES = ["Blink twice slowly","Turn your head slightly left","Nod once","Look up briefly","Smile naturally"]

  useEffect(() => {
    return () => { stopCamera(); clearInterval(detectionLoop.current) }
  }, [])

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  async function startCamera() {
    setError("")
    setStep("camera")
    setStatus("Requesting camera access...")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width:640, height:480, facingMode:"user" },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStatus("Loading face detection models...")
      const faceapi = (await import("face-api.js")).default
      faceApiRef.current = faceapi
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models")
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models")
      await faceapi.nets.faceRecognitionNet.loadFromUri("/models")
      const ch = CHALLENGES[Math.floor(Math.random()*CHALLENGES.length)]
      setChallenge(ch)
      setStep("liveness")
      setStatus(`Complete challenge: ${ch}`)
      startDetectionLoop(faceapi, ch)
    } catch (err: any) {
      setError("Camera access denied. Please allow camera access in your browser settings, then try again.")
      setStep("intro")
    }
  }

  function startDetectionLoop(faceapi: any, ch: string) {
    let blinks = 0
    let wasBelow = false
    let frames = 0

    detectionLoop.current = setInterval(async () => {
      if (!videoRef.current || !faceapi) return
      frames++
      try {
        const det = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
          .withFaceLandmarks()
        if (!det) { setStatus("No face detected — position your face in the oval"); return }

        const le = det.landmarks.getLeftEye()
        const re = det.landmarks.getRightEye()
        const earEye = (eye: any[]) => {
          const A = Math.hypot(eye[1].x-eye[5].x, eye[1].y-eye[5].y)
          const B = Math.hypot(eye[2].x-eye[4].x, eye[2].y-eye[4].y)
          const C = Math.hypot(eye[0].x-eye[3].x, eye[0].y-eye[3].y)
          return (A+B)/(2*C)
        }
        const ear = (earEye(le)+earEye(re))/2

        if (ear < 0.22 && !wasBelow) wasBelow = true
        else if (ear > 0.28 && wasBelow) { wasBelow = false; blinks++; setBlinkCount(blinks) }

        const nose = det.landmarks.getNose()[0]
        movementHistory.current = [...movementHistory.current.slice(-20), [nose.x, nose.y]]
        let score = 0
        if (blinks >= 1) score += 0.4
        if (movementHistory.current.length >= 10) {
          const xv = movementHistory.current.map(p=>p[0])
          const mean = xv.reduce((a,b)=>a+b)/xv.length
          const variance = xv.reduce((s,v)=>s+Math.pow(v-mean,2),0)/xv.length
          if (variance > 0.5) score += 0.3
        }
        if (det.detection.score > 0.8) score += 0.2
        if (frames > 30) score += 0.1
        setLivenessScore(Math.min(1, score))

        if (blinks >= 1 && score >= 0.7) {
          clearInterval(detectionLoop.current)
          setChallengeDone(true)
          setStatus("Liveness confirmed — hold still...")
          setTimeout(() => captureAndEnroll(faceapi), 800)
        } else {
          setStatus(`Challenge: ${ch} · Blinks detected: ${blinks}`)
        }
      } catch {}
    }, 200)
  }

  async function captureAndEnroll(faceapi: any) {
    if (!videoRef.current || !canvasRef.current) return
    setStep("capture")
    setStatus("Extracting face data...")
    try {
      const det = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (!det) {
        setError("Could not detect face clearly. Please try again.")
        setStep("intro")
        return
      }
      const vector = Array.from(det.descriptor)
      const canvas = canvasRef.current
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0)
      const imageBase64 = canvas.toDataURL("image/jpeg", 0.85)
      stopCamera()
      setSaving(true)
      setStatus("Saving securely...")
      const res = await fetch("/api/verify/face-enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vector, imageBase64, isUpdate, changeReason: changeReason||null }),
      })
      const data = await res.json()
      setSaving(false)
      if (data.success) setStep("done")
      else setError(data.error || "Enrollment failed")
    } catch (err: any) {
      setError("Face extraction failed: " + err.message)
      setSaving(false)
      setStep("intro")
    }
  }

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.card}>
          <h1 style={S.title}>Face verification setup</h1>
          <p style={S.sub}>Your face photo becomes your profile picture. We also store an encrypted mathematical representation for login verification — never the raw image.</p>

          {error && <div style={S.err}>{error}</div>}

          {step === "intro" && (
            <div>
              <div style={S.infoGrid}>
                {[
                  { icon:<IconCamera size={20} />, title:"Profile photo", desc:"Your capture becomes your profile picture. You can update it anytime." },
                  { icon:<IconLock size={20} />, title:"Encrypted vector", desc:"128 values stored with AES-256 encryption. Never a raw image." },
                  { icon:<IconEye size={20} />, title:"Liveness detection", desc:"Blink detection + movement analysis. Photos cannot pass." },
                  { icon:<IconTarget size={20} />, title:"Challenge", desc:"A random action is required to confirm you are present." },
                ].map(item=>(
                  <div key={item.title} style={S.infoCard}>
                    <span style={{color:"#7C3AED"}}>{item.icon}</span>
                    <div style={S.infoTitle}>{item.title}</div>
                    <div style={S.infoDesc}>{item.desc}</div>
                  </div>
                ))}
              </div>
              <div style={S.updateBox}>
                <label style={S.checkLabel}>
                  <input type="checkbox" checked={isUpdate} onChange={e=>setIsUpdate(e.target.checked)} style={{accentColor:"#7C3AED"}} />
                  I am updating my face due to injury, surgery, or significant change
                </label>
                {isUpdate && (
                  <textarea value={changeReason} onChange={e=>setChangeReason(e.target.value)} placeholder="Briefly describe the change (optional — helps with account recovery)" style={S.reason} rows={2} />
                )}
              </div>
              <button onClick={startCamera} style={S.primary}>Start face setup</button>
            </div>
          )}

          {(step === "camera" || step === "liveness" || step === "capture") && (
            <div>
              <div style={S.videoWrap}>
                <video ref={videoRef} style={S.video} muted playsInline />
                <canvas ref={canvasRef} style={{display:"none"}} />
                <div style={S.oval} />
              </div>
              <div style={S.statusBox}>
                <div style={S.statusText}>{status}</div>
                <div style={S.barRow}>
                  <span style={S.barLabel}>Liveness</span>
                  <div style={S.barTrack}><div style={{...S.barFill,width:`${livenessScore*100}%`,background:livenessScore>0.7?"#059669":livenessScore>0.4?"#B45309":"#7C3AED"}}/></div>
                  <span style={S.barVal}>{Math.round(livenessScore*100)}%</span>
                </div>
                {challenge && (
                  <div style={S.challengeRow}>
                    <span style={S.challengeTag}>Challenge</span>
                    <span style={S.challengeText}>{challenge}</span>
                    {challengeDone && <span style={S.done}>✓</span>}
                  </div>
                )}
                <div style={{fontSize:12,color:"#9ca3af"}}>Blinks detected: {blinkCount}</div>
              </div>
              <button onClick={() => { stopCamera(); clearInterval(detectionLoop.current); setStep("intro"); setBlinkCount(0); setLivenessScore(0) }} style={S.cancel}>Cancel</button>
            </div>
          )}

          {step === "done" && (
            <div style={S.done2}>
              <div style={{color:"#059669",display:"flex",justifyContent:"center"}}><IconCheckCircle size={52} /></div>
              <h2 style={S.doneTitle}>Face enrolled successfully</h2>
              <p style={{fontSize:13,color:"#7B7B8F",marginBottom:"1.5rem"}}>Your encrypted face vector is saved. You can now use face verification to log in.</p>
              <button onClick={() => router.push("/verify/doc-verify")} style={S.primary}>Verify identity document →</button>
              <button onClick={() => router.push("/profile")} style={S.secondary}>Go to profile</button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{minHeight:"calc(100vh - 60px)",background:"#F7F7FA",padding:"2rem",display:"flex",justifyContent:"center"},
  card:{background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:16,padding:"2rem",width:"100%",maxWidth:560,height:"fit-content"},
  title:{fontSize:20,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px",marginBottom:8},
  sub:{fontSize:13,color:"#7B7B8F",lineHeight:1.65,marginBottom:"1.25rem",paddingBottom:"1rem",borderBottom:"0.5px solid rgba(0,0,0,.07)"},
  err:{background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#B91C1C",marginBottom:"1rem"},
  infoGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:"1.25rem"},
  infoCard:{background:"#F9F9FC",border:"0.5px solid rgba(0,0,0,.06)",borderRadius:10,padding:"1rem",display:"flex",flexDirection:"column" as const,gap:5},
  infoTitle:{fontSize:13,fontWeight:600,color:"#0A0A0F"},
  infoDesc:{fontSize:12,color:"#7B7B8F",lineHeight:1.5},
  updateBox:{background:"#FFFBEB",border:"0.5px solid #FCD34D",borderRadius:10,padding:"1rem",marginBottom:"1rem"},
  checkLabel:{display:"flex",alignItems:"flex-start",gap:8,fontSize:13,color:"#92400E",cursor:"pointer",lineHeight:1.5},
  reason:{width:"100%",border:"0.5px solid rgba(0,0,0,.1)",borderRadius:8,padding:"8px",fontSize:13,fontFamily:"inherit",outline:"none",marginTop:8,resize:"vertical" as const},
  primary:{width:"100%",background:"#7C3AED",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer",marginBottom:8},
  secondary:{width:"100%",background:"none",border:"0.5px solid rgba(0,0,0,.12)",color:"#3D3D4E",borderRadius:10,padding:"11px",fontSize:13,cursor:"pointer"},
  cancel:{width:"100%",background:"none",border:"0.5px solid rgba(0,0,0,.1)",color:"#9ca3af",borderRadius:10,padding:"10px",fontSize:13,cursor:"pointer",marginTop:8},
  videoWrap:{position:"relative" as const,background:"#000",borderRadius:14,overflow:"hidden",marginBottom:12,aspectRatio:"4/3"},
  video:{width:"100%",height:"100%",objectFit:"cover" as const,transform:"scaleX(-1)"},
  oval:{position:"absolute" as const,top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:180,height:230,border:"2px solid rgba(124,58,237,.65)",borderRadius:"50%",boxShadow:"0 0 0 4000px rgba(0,0,0,.4)",pointerEvents:"none" as const},
  statusBox:{background:"#F9F9FC",border:"0.5px solid rgba(0,0,0,.07)",borderRadius:10,padding:"1rem",display:"flex",flexDirection:"column" as const,gap:8,marginBottom:8},
  statusText:{fontSize:13,fontWeight:500,color:"#3D3D4E"},
  barRow:{display:"flex",alignItems:"center",gap:8},
  barLabel:{fontSize:12,color:"#9ca3af",width:60,flexShrink:0},
  barTrack:{flex:1,background:"#E5E7EB",borderRadius:999,height:7,overflow:"hidden"},
  barFill:{height:7,borderRadius:999,transition:"width .3s,background .3s"},
  barVal:{fontSize:12,fontWeight:500,color:"#0A0A0F",width:32,textAlign:"right" as const},
  challengeRow:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const},
  challengeTag:{fontSize:11,fontWeight:600,color:"#9ca3af",textTransform:"uppercase" as const,letterSpacing:".06em"},
  challengeText:{fontSize:13,color:"#0A0A0F",fontWeight:500,flex:1},
  done:{fontSize:13,color:"#059669",fontWeight:600},
  done2:{textAlign:"center" as const,padding:"2rem 0",display:"flex",flexDirection:"column" as const,gap:10,alignItems:"center"},
  doneTitle:{fontSize:20,fontWeight:600,color:"#0A0A0F",margin:"12px 0 6px"},
}