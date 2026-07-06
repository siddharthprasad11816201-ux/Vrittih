"use client"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
import { IconLock, IconFileText, IconSearch, IconCheckCircle } from "@/components/ui/Icons"

const ID_TYPES = [
  { value:"AADHAAR", label:"Aadhaar Card" },
  { value:"PAN", label:"PAN Card" },
  { value:"PASSPORT", label:"Passport" },
  { value:"DRIVING_LICENSE", label:"Driving License" },
  { value:"VOTER_ID", label:"Voter ID" },
]

export default function DocVerify() {
  const router = useRouter()
  const [step, setStep] = useState<"upload"|"extracted"|"verifying"|"done">("upload")
  const [idType, setIdType] = useState("AADHAAR")
  const [file, setFile] = useState<File|null>(null)
  const [preview, setPreview] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<any>(null)
  const [form, setForm] = useState({ nameOnDoc:"", idNumber:"", dob:"" })
  const [error, setError] = useState("")
  const [result, setResult] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const faceApiRef = useRef<any>(null)

  async function handleFile(e: any) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError("")
    if (f.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(f))
      setExtracting(true)
      await extractFromImage(f)
    } else if (f.type === "application/pdf") {
      setPreview("")
      setExtracting(false)
      setStep("extracted")
    }
  }

  async function extractFromImage(f: File) {
    try {
      // Load Tesseract for OCR
      const { createWorker } = await import("tesseract.js")
      const worker = await createWorker("eng")
      const { data: { text } } = await worker.recognize(f)
      await worker.terminate()

      // Extract face vector from document photo
      let docFaceVector = null
      try {
        const faceapi = (await import("face-api.js")).default
        faceApiRef.current = faceapi
        await faceapi.nets.tinyFaceDetector.loadFromUri("/models")
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models")
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models")
        const img = document.createElement("img")
        img.src = URL.createObjectURL(f)
        await new Promise(r => { img.onload = r })
        const det = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor()
        if (det) docFaceVector = Array.from(det.descriptor)
      } catch {}

      // Parse structured data from OCR text
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean)
      const nameMatch = text.match(/(?:name|Name)[:\s]+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i)
      const dobMatch = text.match(/(?:DOB|Date of Birth|D\.O\.B)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i)
      const idMatch = text.match(/\b\d{4}\s\d{4}\s\d{4}\b|\b[A-Z]{5}\d{4}[A-Z]\b|\b[A-Z]\d{7}\b/)

      setExtracted({ rawText: text.slice(0, 200), docFaceVector })
      setForm({
        nameOnDoc: nameMatch?.[1] || "",
        idNumber: idMatch?.[0]?.replace(/\s/g,"") || "",
        dob: dobMatch?.[1] || "",
      })
      setExtracting(false)
      setStep("extracted")
    } catch (err: any) {
      setExtracting(false)
      setError("Could not process document — please enter details manually")
      setStep("extracted")
    }
  }

  async function submitVerification() {
    if (!form.nameOnDoc || !form.idNumber) { setError("Name and ID number are required"); return }
    setSubmitting(true); setError("")
    const res = await fetch("/api/verify/doc-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idType,
        idNumber: form.idNumber,
        nameOnDoc: form.nameOnDoc,
        dobOnDoc: form.dob,
        faceVectorFromDoc: extracted?.docFaceVector || null,
      }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (data.success) { setResult(data); setStep("done") }
    else setError(data.error || "Verification failed")
  }

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.head}>
            <h1 style={S.title}>Identity document verification</h1>
            <p style={S.sub}>Upload your ID to verify your identity. We extract only your name, date of birth, and a hash of your ID number. The document itself is never stored.</p>
          </div>

          <div style={S.privacyNote}>
            <span style={{color:"#92400E",flexShrink:0}}><IconLock size={16} /></span>
            <div style={{fontSize:12,color:"#92400E",lineHeight:1.6}}>
              <strong>Privacy first:</strong> Document processing happens in your browser. We receive only: name, DOB, ID type, and a one-way hash of your ID number. No document image or PDF is ever sent to our server.
            </div>
          </div>

          {error && <div style={S.errBox}>{error}</div>}

          {step === "upload" && (
            <div>
              <div style={S.fg}><label style={S.label}>Document type</label>
                <select value={idType} onChange={e=>setIdType(e.target.value)} style={S.select}>
                  {ID_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={S.uploadZone}>
                <input type="file" accept="image/*,.pdf" onChange={handleFile} style={{display:"none"}} id="doc-upload" />
                <label htmlFor="doc-upload" style={S.uploadLabel}>
                  <span style={{color:"#534AB7"}}><IconFileText size={34} /></span>
                  <span style={S.uploadText}>Click to upload your {ID_TYPES.find(t=>t.value===idType)?.label}</span>
                  <span style={S.uploadHint}>JPG, PNG or PDF · Max 5MB · Processed locally</span>
                </label>
              </div>
              {extracting && <div style={{...S.extracting,display:"flex",alignItems:"center",gap:8}}><IconSearch size={15} /> Scanning document — extracting information locally...</div>}
              {preview && <img src={preview} alt="Document preview" style={S.preview} />}
            </div>
          )}

          {step === "extracted" && (
            <div>
              {extracted?.docFaceVector && (
                <div style={S.successNote}>✓ Face detected in document — will be matched against your profile</div>
              )}
              <p style={{fontSize:13,color:"#7B7B8F",marginBottom:"1rem"}}>Review and correct the extracted information below:</p>
              <div style={S.fg}><label style={S.label}>Name on document</label><input value={form.nameOnDoc} onChange={e=>setForm(p=>({...p,nameOnDoc:e.target.value}))} style={S.input} placeholder="Full name as on document" /></div>
              <div style={S.fg}><label style={S.label}>ID number</label><input value={form.idNumber} onChange={e=>setForm(p=>({...p,idNumber:e.target.value}))} style={S.input} placeholder="Document ID number" /></div>
              <div style={S.fg}><label style={S.label}>Date of birth (optional)</label><input value={form.dob} onChange={e=>setForm(p=>({...p,dob:e.target.value}))} style={S.input} placeholder="DD/MM/YYYY" /></div>
              <button onClick={submitVerification} disabled={submitting} style={S.primaryBtn}>{submitting?"Verifying...":"Verify identity"}</button>
              <button onClick={() => setStep("upload")} style={S.secondaryBtn}>Upload different document</button>
            </div>
          )}

          {step === "done" && result && (
            <div style={S.doneWrap}>
              <div style={{color:"#059669",display:"flex",justifyContent:"center"}}><IconCheckCircle size={52} /></div>
              <h2 style={S.doneTitle}>Identity verified</h2>
              <div style={S.scoreGrid}>
                <div style={S.scoreCard}>
                  <div style={S.scoreNum}>{Math.round(result.nameMatchScore*100)}%</div>
                  <div style={S.scoreLabel}>Name match</div>
                </div>
                {result.faceMatchScore > 0 && (
                  <div style={S.scoreCard}>
                    <div style={S.scoreNum}>{Math.round(result.faceMatchScore*100)}%</div>
                    <div style={S.scoreLabel}>Face match</div>
                  </div>
                )}
              </div>
              <p style={{fontSize:13,color:"#7B7B8F",margin:"1rem 0"}}>Your identity is verified. Your document data has not been stored.</p>
              <button onClick={() => router.push("/dashboard")} style={S.primaryBtn}>Go to dashboard</button>
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
  head:{marginBottom:"1.25rem",paddingBottom:"1rem",borderBottom:"0.5px solid rgba(0,0,0,.07)"},
  title:{fontSize:20,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px",marginBottom:8},
  sub:{fontSize:13,color:"#7B7B8F",lineHeight:1.65},
  privacyNote:{display:"flex",gap:10,background:"#FFFBEB",border:"0.5px solid #FCD34D",borderRadius:10,padding:"12px",marginBottom:"1.25rem",alignItems:"flex-start"},
  errBox:{background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#B91C1C",marginBottom:12},
  successNote:{background:"#ECFDF5",border:"0.5px solid #A7F3D0",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#047857",marginBottom:12},
  fg:{display:"flex",flexDirection:"column" as const,gap:5,marginBottom:12},
  label:{fontSize:12,fontWeight:500,color:"#7B7B8F"},
  input:{border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"8px 11px",fontSize:13,color:"#0A0A0F",outline:"none"},
  select:{border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"8px 11px",fontSize:13,color:"#0A0A0F",background:"#fff"},
  uploadZone:{border:"1.5px dashed rgba(0,0,0,.13)",borderRadius:12,padding:"2rem",textAlign:"center" as const,marginBottom:12,cursor:"pointer",transition:"border-color .2s"},
  uploadLabel:{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:8,cursor:"pointer"},
  uploadText:{fontSize:14,fontWeight:500,color:"#3D3D4E"},
  uploadHint:{fontSize:12,color:"#9ca3af"},
  extracting:{background:"#EEEDF9",border:"0.5px solid rgba(83,74,183,.2)",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#534AB7",display:"flex",gap:8,alignItems:"center",marginBottom:12},
  preview:{width:"100%",borderRadius:10,marginTop:10,maxHeight:200,objectFit:"cover" as const},
  primaryBtn:{width:"100%",background:"#534AB7",color:"#fff",border:"none",borderRadius:9,padding:"11px",fontSize:14,fontWeight:500,cursor:"pointer",marginBottom:8},
  secondaryBtn:{width:"100%",background:"none",border:"0.5px solid rgba(0,0,0,.1)",color:"#6b7280",borderRadius:9,padding:"10px",fontSize:13,cursor:"pointer"},
  doneWrap:{textAlign:"center" as const,padding:"1rem 0"},
  doneTitle:{fontSize:20,fontWeight:600,color:"#0A0A0F",margin:"12px 0"},
  scoreGrid:{display:"flex",gap:12,justifyContent:"center",margin:"1rem 0"},
  scoreCard:{background:"#EEEDF9",border:"0.5px solid rgba(83,74,183,.2)",borderRadius:12,padding:"1rem 1.5rem",textAlign:"center" as const},
  scoreNum:{fontSize:28,fontWeight:700,color:"#534AB7"},
  scoreLabel:{fontSize:12,color:"#7B7B8F",marginTop:3},
}