"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
const QUESTION_TYPES = [
  { value:"MCQ", label:"Multiple choice", desc:"4 options, one correct answer" },
  { value:"SHORT", label:"Short answer", desc:"Free text response" },
  { value:"CODING", label:"Coding", desc:"Write code to solve a problem" },
  { value:"SCALE", label:"Scale / opinion", desc:"Agree-disagree scale (psychometric)" },
]

const TEST_TYPES = ["APTITUDE","TECHNICAL","PSYCHOMETRIC","CODING"]

interface Question {
  type: string
  text: string
  options: string[]
  correctAnswer: string
  points: number
}

export default function CreateTest() {
  const router = useRouter()
  const [form, setForm] = useState({ title:"", description:"", type:"TECHNICAL", duration:30, passingScore:70 })
  const [questions, setQuestions] = useState<Question[]>([
    { type:"MCQ", text:"", options:["","","",""], correctAnswer:"", points:10 }
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function addQuestion() {
    setQuestions(prev => [...prev, { type:"MCQ", text:"", options:["","","",""], correctAnswer:"", points:10 }])
  }

  function removeQuestion(i: number) {
    setQuestions(prev => prev.filter((_,idx) => idx !== i))
  }

  function updateQuestion(i: number, field: string, value: any) {
    setQuestions(prev => prev.map((q,idx) => idx === i ? {...q, [field]: value} : q))
  }

  function updateOption(qi: number, oi: number, value: string) {
    setQuestions(prev => prev.map((q,idx) => {
      if (idx !== qi) return q
      const opts = [...q.options]
      opts[oi] = value
      return {...q, options: opts}
    }))
  }

  function changeType(qi: number, type: string) {
    setQuestions(prev => prev.map((q,idx) => {
      if (idx !== qi) return q
      const base = {...q, type}
      if (type === "SCALE") base.options = ["Strongly Disagree","Disagree","Neutral","Agree","Strongly Agree"]
      if (type === "MCQ") base.options = ["","","",""]
      if (type === "SHORT" || type === "CODING") base.options = []
      return base
    }))
  }

  async function submit(e: any) {
    e.preventDefault()
    const invalid = questions.find(q => !q.text.trim())
    if (invalid) { setError("All questions must have text"); return }
    setSaving(true); setError("")
    const payload = {
      ...form,
      questions: questions.map(q => ({
        type: q.type,
        text: q.text,
        options: q.options.length ? q.options : undefined,
        correctAnswer: q.correctAnswer || null,
        points: q.points,
      }))
    }
    const res = await fetch("/api/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) router.push(`/tests/${data.test.id}`)
    else setError(data.error || "Failed to create test")
  }

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <h1 style={S.title}>Create assessment</h1>
            <p style={S.sub}>Build a custom test to evaluate candidates for your roles</p>
          </div>

          {error && <div style={S.err}>{error}</div>}

          <form onSubmit={submit}>
            {/* Test details */}
            <div style={S.section}>
              <h2 style={S.sectionTitle}>Test details</h2>
              <div style={S.row}>
                <div style={S.fg}>
                  <label style={S.label}>Test title</label>
                  <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} style={S.input} placeholder="e.g. Frontend Engineer Technical Test" required />
                </div>
                <div style={{...S.fg, maxWidth:180}}>
                  <label style={S.label}>Type</label>
                  <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))} style={S.input}>
                    {TEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={S.fg}>
                <label style={S.label}>Description (optional)</label>
                <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} style={S.textarea} rows={2} placeholder="What will this test assess?" />
              </div>
              <div style={S.row}>
                <div style={S.fg}>
                  <label style={S.label}>Duration (minutes)</label>
                  <select value={form.duration} onChange={e=>setForm(p=>({...p,duration:Number(e.target.value)}))} style={S.input}>
                    {[15,20,30,45,60,90,120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
                <div style={S.fg}>
                  <label style={S.label}>Passing score (%)</label>
                  <input type="number" min={0} max={100} value={form.passingScore} onChange={e=>setForm(p=>({...p,passingScore:Number(e.target.value)}))} style={S.input} />
                </div>
              </div>
            </div>

            {/* Questions */}
            <div style={S.section}>
              <div style={S.sectionHead}>
                <h2 style={S.sectionTitle}>Questions ({questions.length})</h2>
                <button type="button" onClick={addQuestion} style={S.addQBtn}>+ Add question</button>
              </div>

              {questions.map((q, qi) => (
                <div key={qi} style={S.qCard}>
                  <div style={S.qCardHead}>
                    <span style={S.qNum}>Q{qi + 1}</span>
                    <div style={S.qTypeTabs}>
                      {QUESTION_TYPES.map(t => (
                        <button key={t.value} type="button" onClick={() => changeType(qi, t.value)}
                          style={{...S.qTypeTab,...(q.type===t.value?S.qTypeTabOn:{})}}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div style={S.qPoints}>
                      <label style={{fontSize:12,color:"#9ca3af"}}>Points</label>
                      <input type="number" min={0} max={100} value={q.points}
                        onChange={e => updateQuestion(qi,"points",Number(e.target.value))}
                        style={{...S.input, width:60, padding:"4px 8px", textAlign:"center" as const}} />
                    </div>
                    {questions.length > 1 && (
                      <button type="button" onClick={() => removeQuestion(qi)} style={S.removeBtn}>×</button>
                    )}
                  </div>

                  <div style={S.fg}>
                    <label style={S.label}>Question text</label>
                    <textarea value={q.text} onChange={e => updateQuestion(qi,"text",e.target.value)}
                      style={S.textarea} rows={2} placeholder="Enter your question..." required />
                  </div>

                  {(q.type === "MCQ") && (
                    <div>
                      <label style={S.label}>Options (mark correct answer)</label>
                      <div style={S.optionsGrid}>
                        {q.options.map((opt, oi) => (
                          <div key={oi} style={S.optRow}>
                            <input type="radio" name={`correct-${qi}`} checked={q.correctAnswer === opt && opt !== ""}
                              onChange={() => updateQuestion(qi,"correctAnswer",opt)}
                              style={{accentColor:"#7C3AED",flexShrink:0}} />
                            <input value={opt} onChange={e => updateOption(qi,oi,e.target.value)}
                              style={{...S.input,flex:1}} placeholder={`Option ${String.fromCharCode(65+oi)}`} />
                          </div>
                        ))}
                      </div>
                      <div style={{fontSize:12,color:"#9ca3af",marginTop:4}}>Select the radio button next to the correct answer</div>
                    </div>
                  )}

                  {q.type === "SCALE" && (
                    <div style={{fontSize:13,color:"#7B7B8F",background:"#F9F9FC",borderRadius:8,padding:"10px 12px"}}>
                      Scale: Strongly Disagree → Disagree → Neutral → Agree → Strongly Agree (no correct answer)
                    </div>
                  )}

                  {(q.type === "SHORT" || q.type === "CODING") && (
                    <div>
                      <label style={S.label}>Expected answer (optional — for auto-grading)</label>
                      <input value={q.correctAnswer} onChange={e => updateQuestion(qi,"correctAnswer",e.target.value)}
                        style={S.input} placeholder="Leave blank for manual review" />
                    </div>
                  )}
                </div>
              ))}

              <button type="button" onClick={addQuestion} style={S.addQBtnLarge}>+ Add another question</button>
            </div>

            <div style={S.actions}>
              <button type="submit" disabled={saving || !form.title || questions.length === 0} style={S.saveBtn}>
                {saving ? "Creating..." : `Create test with ${questions.length} question${questions.length !== 1 ? "s" : ""}`}
              </button>
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
  sectionHead:{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem" },
  sectionTitle:{ fontSize:16,fontWeight:600,color:"#0A0A0F",marginBottom:"1.25rem" },
  row:{ display:"flex",gap:12 },
  fg:{ display:"flex",flexDirection:"column" as const,gap:5,marginBottom:12,flex:1 },
  label:{ fontSize:12,fontWeight:500,color:"#7B7B8F" },
  input:{ border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"8px 11px",fontSize:13,color:"#0A0A0F",outline:"none",fontFamily:"inherit",width:"100%" },
  textarea:{ border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"8px 11px",fontSize:13,color:"#0A0A0F",outline:"none",fontFamily:"inherit",resize:"vertical" as const,width:"100%" },
  addQBtn:{ background:"#7C3AED",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:13,fontWeight:500,cursor:"pointer" },
  addQBtnLarge:{ width:"100%",background:"#F5F3FF",color:"#7C3AED",border:"1px dashed rgba(124,58,237,.3)",borderRadius:10,padding:"12px",fontSize:13,fontWeight:500,cursor:"pointer",marginTop:8 },
  qCard:{ background:"#F9F9FC",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:12,padding:"1.25rem",marginBottom:10 },
  qCardHead:{ display:"flex",alignItems:"center",gap:10,marginBottom:"1rem",flexWrap:"wrap" as const },
  qNum:{ fontSize:13,fontWeight:700,color:"#7C3AED",background:"#F5F3FF",padding:"4px 10px",borderRadius:999,flexShrink:0 },
  qTypeTabs:{ display:"flex",gap:4,flex:1,flexWrap:"wrap" as const },
  qTypeTab:{ background:"none",border:"0.5px solid rgba(0,0,0,.1)",borderRadius:7,padding:"4px 10px",fontSize:11,cursor:"pointer",color:"#7B7B8F" },
  qTypeTabOn:{ background:"#7C3AED",color:"#fff",border:"0.5px solid #7C3AED" },
  qPoints:{ display:"flex",alignItems:"center",gap:6 },
  removeBtn:{ background:"none",border:"none",fontSize:20,color:"#9ca3af",cursor:"pointer",lineHeight:1,padding:"0 4px" },
  optionsGrid:{ display:"flex",flexDirection:"column" as const,gap:8,marginBottom:4 },
  optRow:{ display:"flex",alignItems:"center",gap:8 },
  actions:{ display:"flex",gap:10,marginTop:4 },
  saveBtn:{ flex:1,background:"#7C3AED",color:"#fff",border:"none",borderRadius:9,padding:"12px",fontSize:14,fontWeight:600,cursor:"pointer" },
  cancelBtn:{ background:"none",border:"0.5px solid rgba(0,0,0,.1)",color:"#6b7280",borderRadius:9,padding:"12px 20px",fontSize:14,cursor:"pointer" },
}