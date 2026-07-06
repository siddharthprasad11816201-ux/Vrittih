"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
import { IconActivity, IconMonitor, IconTarget, IconClipboard, IconFileText, IconClock, IconHelp, IconCheck, IconAlert, IconAward, IconBarChart, IconCheckCircle } from "@/components/ui/Icons"

export default function TakeTest() {
  const params = useParams()
  const router = useRouter()
  const testId = params.id as string
  const [test, setTest] = useState<any>(null)
  const [attempt, setAttempt] = useState<any>(null)
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [current, setCurrent] = useState(0)
  const [phase, setPhase] = useState<"intro"|"taking"|"result">("intro")
  const [timeLeft, setTimeLeft] = useState(0)
  const [tabSwitches, setTabSwitches] = useState(0)
  const [result, setResult] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<any>(null)
  const tabRef = useRef(0)
  const submittingRef = useRef(false)

  useEffect(() => {
    fetch(`/api/tests/${testId}`).then(r => r.json()).then(d => {
      setTest(d.test)
      setTimeLeft((d.test?.duration || 30) * 60)
      setLoading(false)
    })
  }, [testId])

  useEffect(() => {
    if (phase !== "taking") return
    const onVisChange = () => {
      if (document.hidden) {
        tabRef.current++
        setTabSwitches(tabRef.current)
      }
    }
    document.addEventListener("visibilitychange", onVisChange)
    return () => document.removeEventListener("visibilitychange", onVisChange)
  }, [phase])

  useEffect(() => {
    if (phase !== "taking") return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          handleSubmit()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase])

  async function startTest() {
    const res = await fetch(`/api/tests/${testId}/attempt`, { method: "POST" })
    const data = await res.json()
    setAttempt(data.attempt)
    setPhase("taking")
  }

  async function handleSubmit() {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    clearInterval(timerRef.current)
    const currentAttempt = attempt
    if (!currentAttempt) { setSubmitting(false); submittingRef.current = false; return }
    const res = await fetch(`/api/tests/${testId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: currentAttempt.id, answers, tabSwitches: tabRef.current })
    })
    const data = await res.json()
    setResult(data)
    setPhase("result")
    setSubmitting(false)
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
  }

  const TYPE_META: Record<string,{label:string,icon:React.ReactNode}> = {
    APTITUDE:    { label:"Aptitude",    icon:<IconActivity size={44} /> },
    TECHNICAL:   { label:"Technical",  icon:<IconMonitor size={44} /> },
    PSYCHOMETRIC:{ label:"Personality",icon:<IconTarget size={44} /> },
    CODING:      { label:"Coding",     icon:<IconClipboard size={44} /> },
  }

  if (loading) return (
    <AppShell>
      <div style={S.loading}>Loading test...</div>
    </AppShell>
  )

  if (!test) return (
    <AppShell>
      <div style={S.loading}>Test not found</div>
    </AppShell>
  )

  const meta = TYPE_META[test.type] || { label: test.type, icon: <IconFileText size={44} /> }
  const q = test?.questions?.[current]
  const progress = test?.questions?.length ? ((current + 1) / test.questions.length) * 100 : 0
  const answered = Object.keys(answers).length

  if (phase === "intro") return (
    <AppShell>
      <div style={S.page}>
        <div style={S.introCard}>
          <div style={S.introIcon}>{meta.icon}</div>
          <h1 style={S.introTitle}>{test.title}</h1>
          {test.description && <p style={S.introDesc}>{test.description}</p>}
          <div style={S.introStats}>
            {[
              { icon:<IconClock size={19} />, label:"Duration", val:`${test.duration} minutes` },
              { icon:<IconHelp size={19} />, label:"Questions", val:`${test._count?.questions || test.questions?.length}` },
              { icon:<IconCheck size={19} />, label:"Pass score", val:test.passingScore > 0 ? `${test.passingScore}%` : "No pass/fail" },
              { icon:<IconTarget size={19} />, label:"Type", val:meta.label },
            ].map(item => (
              <div key={item.label} style={S.statItem}>
                <span style={{color:"#0F6E56"}}>{item.icon}</span>
                <div>
                  <div style={S.statLabel}>{item.label}</div>
                  <div style={S.statVal}>{item.val}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={S.rules}>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:8,color:"#0A0A0F"}}>Before you start</h3>
            {[
              "Do not switch tabs or windows during the test",
              "Answer all questions before submitting",
              "You cannot go back once you submit",
              "Your result will be shared with the employer",
            ].map(r => (
              <div key={r} style={{fontSize:13,color:"#3D3D4E",marginBottom:4}}>• {r}</div>
            ))}
          </div>
          <button onClick={startTest} style={S.startBtn}>Start test — {test.duration} minutes</button>
          <button onClick={() => router.back()} style={S.cancelBtn}>Cancel</button>
        </div>
      </div>
    </AppShell>
  )

  if (phase === "taking" && q) return (
    <div style={S.testShell}>
      <div style={S.testHead}>
        <div style={S.testTitle}>{test.title}</div>
        <div style={S.testMeta}>
          <span style={{...S.timer,...(timeLeft < 300 ? S.timerWarn : {})}}>{formatTime(timeLeft)}</span>
          <span style={S.qCount}>{current + 1} / {test.questions.length}</span>
          {tabSwitches > 0 && <span style={{...S.tabWarn,display:"inline-flex",alignItems:"center",gap:5}}><IconAlert size={13} /> {tabSwitches} tab switch{tabSwitches > 1 ? "es" : ""}</span>}
        </div>
        <button onClick={handleSubmit} disabled={submitting} style={S.submitBtn}>
          {submitting ? "Submitting..." : "Submit"}
        </button>
      </div>

      <div style={S.progressWrap}>
        <div style={{...S.progressFill, width:`${progress}%`}} />
      </div>

      <div style={S.testBody}>
        <div style={S.questionCard}>
          <div style={S.qNum}>Question {current + 1} of {test.questions.length} · {q.points} pts</div>
          <div style={S.qText}>{q.text}</div>

          {(q.type === "MCQ" || q.type === "SCALE") && q.options && (
            <div style={S.options}>
              {JSON.parse(q.options).map((opt: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setAnswers(p => ({...p, [q.id]: opt}))}
                  style={{...S.option,...(answers[q.id] === opt ? S.optionSelected : {})}}
                >
                  <span style={S.optionLetter}>{String.fromCharCode(65 + i)}</span>
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.type === "SHORT" && (
            <textarea
              value={answers[q.id] || ""}
              onChange={e => setAnswers(p => ({...p, [q.id]: e.target.value}))}
              placeholder="Type your answer here..."
              style={S.shortAnswer}
              rows={5}
            />
          )}

          {q.type === "CODING" && (
            <div>
              <div style={{fontSize:12,color:"#9ca3af",marginBottom:8}}>Write your solution below:</div>
              <textarea
                value={answers[q.id] || ""}
                onChange={e => setAnswers(p => ({...p, [q.id]: e.target.value}))}
                placeholder="// Write your solution here..."
                style={{...S.shortAnswer, fontFamily:"monospace", background:"#04342C", color:"#9FD4C3", fontSize:13}}
                rows={10}
              />
            </div>
          )}

          <div style={S.qNavRow}>
            <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0} style={S.navBtn}>← Prev</button>
            <span style={{fontSize:13,color:"#9ca3af"}}>{answered} / {test.questions.length} answered</span>
            {current < test.questions.length - 1
              ? <button onClick={() => setCurrent(c => c + 1)} style={S.navBtnPrimary}>Next →</button>
              : <button onClick={handleSubmit} disabled={submitting} style={S.navBtnPrimary}>{submitting ? "..." : "Submit →"}</button>
            }
          </div>
        </div>

        <div style={S.qSidebar}>
          <div style={S.qNavTitle}>Questions</div>
          <div style={S.qNavGrid}>
            {test.questions.map((_: any, i: number) => {
              const isAnswered = !!answers[test.questions[i].id]
              const isCurrent = i === current
              let btnStyle = {...S.qNavItem}
              if (isCurrent) btnStyle = {...btnStyle, ...S.qNavCurrent}
              else if (isAnswered) btnStyle = {...btnStyle, ...S.qNavAnswered}
              return (
                <button key={i} onClick={() => setCurrent(i)} style={btnStyle}>{i + 1}</button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  if (phase === "result" && result) return (
    <AppShell>
      <div style={S.page}>
        <div style={S.resultCard}>
          <div style={{marginBottom:16,color:result.passed===true?"#059669":result.passed===false?"#B45309":"#0F6E56"}}>
            {result.passed === true ? <IconAward size={56} /> : result.passed === false ? <IconBarChart size={56} /> : <IconCheckCircle size={56} />}
          </div>
          <h1 style={S.resultTitle}>
            {result.passed === true ? "Passed!" : result.passed === false ? "Keep practicing" : "Completed!"}
          </h1>
          <div style={S.scoreCircle}>
            <div style={{fontSize:40,fontWeight:700,color:result.passed===true?"#059669":result.passed===false?"#DC2626":"#0F6E56"}}>{result.score}%</div>
            <div style={{fontSize:13,color:"#9ca3af"}}>Score</div>
          </div>
          <div style={S.resultStats}>
            <div style={S.rStat}><div style={S.rStatNum}>{result.earnedPoints}</div><div style={S.rStatLabel}>Earned</div></div>
            <div style={S.rStat}><div style={S.rStatNum}>{result.totalPoints}</div><div style={S.rStatLabel}>Total</div></div>
            {tabRef.current > 0 && <div style={S.rStat}><div style={{...S.rStatNum,color:"#DC2626"}}>{tabRef.current}</div><div style={S.rStatLabel}>Tab switches</div></div>}
          </div>
          {test.passingScore > 0 && (
            <div style={{...S.passBanner,...(result.passed ? S.passOk : S.passFail)}}>
              {result.passed ? `✓ You passed! Required: ${test.passingScore}%` : `Passing score: ${test.passingScore}% — Your score: ${result.score}%`}
            </div>
          )}
          <p style={{fontSize:13,color:"#7B7B8F",marginBottom:"1.5rem"}}>Your result has been saved and shared with the employer.</p>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap" as const}}>
            <button onClick={() => router.push("/tests")} style={S.startBtn}>Browse more tests</button>
            <button onClick={() => router.push("/dashboard")} style={S.cancelBtn}>Go to dashboard</button>
          </div>
        </div>
      </div>
    </AppShell>
  )

  return null
}

const S: Record<string,any> = {
  loading:{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"calc(100vh - 60px)",fontSize:14,color:"#9ca3af" },
  page:{ background:"#FAF8F2",minHeight:"calc(100vh - 60px)",padding:"2rem",display:"flex",justifyContent:"center" },
  introCard:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:16,padding:"2.5rem",width:"100%",maxWidth:540,height:"fit-content",textAlign:"center" as const },
  introIcon:{ marginBottom:12,color:"#0F6E56",display:"flex",justifyContent:"center" },
  introTitle:{ fontSize:22,fontWeight:700,color:"#0A0A0F",letterSpacing:"-.3px",marginBottom:8 },
  introDesc:{ fontSize:14,color:"#7B7B8F",lineHeight:1.65,marginBottom:"1.5rem" },
  introStats:{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:"1.5rem",textAlign:"left" as const },
  statItem:{ display:"flex",gap:10,alignItems:"center",background:"#F9F9FC",borderRadius:10,padding:"12px" },
  statLabel:{ fontSize:11,color:"#9ca3af",textTransform:"uppercase" as const,letterSpacing:".05em" },
  statVal:{ fontSize:14,fontWeight:600,color:"#0A0A0F" },
  rules:{ background:"#F9F9FC",borderRadius:10,padding:"1rem",marginBottom:"1.5rem",textAlign:"left" as const },
  startBtn:{ width:"100%",background:"#0F6E56",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:15,fontWeight:600,cursor:"pointer",marginBottom:8 },
  cancelBtn:{ width:"100%",background:"none",border:"0.5px solid rgba(0,0,0,.1)",color:"#6b7280",borderRadius:10,padding:"11px",fontSize:13,cursor:"pointer" },
  testShell:{ display:"flex",flexDirection:"column" as const,height:"100vh",background:"#FAF8F2",overflow:"hidden" },
  testHead:{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 2rem",background:"#fff",borderBottom:"0.5px solid rgba(0,0,0,.07)",flexShrink:0 },
  testTitle:{ fontSize:15,fontWeight:600,color:"#0A0A0F",flex:1 },
  testMeta:{ display:"flex",gap:12,alignItems:"center" },
  timer:{ fontSize:16,fontWeight:700,color:"#0F6E56",fontVariantNumeric:"tabular-nums" as const },
  timerWarn:{ color:"#DC2626" },
  qCount:{ fontSize:13,color:"#9ca3af" },
  tabWarn:{ fontSize:12,color:"#DC2626",fontWeight:500 },
  submitBtn:{ background:"#0F6E56",color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:500,cursor:"pointer",marginLeft:12 },
  progressWrap:{ height:3,background:"#E5E7EB",flexShrink:0 },
  progressFill:{ height:3,background:"#0F6E56",transition:"width .3s" },
  testBody:{ flex:1,display:"grid",gridTemplateColumns:"1fr 220px",gap:0,overflow:"hidden" },
  questionCard:{ padding:"2rem",overflow:"auto" },
  qNum:{ fontSize:12,color:"#9ca3af",marginBottom:12,textTransform:"uppercase" as const,letterSpacing:".05em" },
  qText:{ fontSize:18,fontWeight:600,color:"#0A0A0F",lineHeight:1.5,marginBottom:"1.5rem" },
  options:{ display:"flex",flexDirection:"column" as const,gap:10,marginBottom:"1.5rem" },
  option:{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px",border:"1px solid rgba(0,0,0,.1)",borderRadius:10,background:"#fff",textAlign:"left" as const,cursor:"pointer",fontSize:14,color:"#3D3D4E",transition:"all .15s",width:"100%" },
  optionSelected:{ border:"1.5px solid #0F6E56",background:"#E1F5EE",color:"#0F6E56" },
  optionLetter:{ width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,flexShrink:0 },
  shortAnswer:{ width:"100%",border:"1px solid rgba(0,0,0,.12)",borderRadius:10,padding:"12px",fontSize:14,fontFamily:"inherit",outline:"none",resize:"vertical" as const,marginBottom:"1.5rem" },
  qNavRow:{ display:"flex",justifyContent:"space-between",alignItems:"center" },
  navBtn:{ background:"none",border:"0.5px solid rgba(0,0,0,.13)",color:"#3D3D4E",borderRadius:8,padding:"8px 16px",fontSize:13,cursor:"pointer" },
  navBtnPrimary:{ background:"#0F6E56",color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:500,cursor:"pointer" },
  qSidebar:{ background:"#fff",borderLeft:"0.5px solid rgba(0,0,0,.07)",padding:"1.25rem",overflow:"auto" },
  qNavTitle:{ fontSize:12,fontWeight:600,color:"#9ca3af",textTransform:"uppercase" as const,letterSpacing:".06em",marginBottom:10 },
  qNavGrid:{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6 },
  qNavItem:{ width:"100%",aspectRatio:"1",borderRadius:8,border:"0.5px solid rgba(0,0,0,.1)",background:"#fff",fontSize:12,cursor:"pointer" },
  qNavCurrent:{ border:"1.5px solid #0F6E56",background:"#E1F5EE",color:"#0F6E56",fontWeight:600 },
  qNavAnswered:{ background:"#ECFDF5",border:"0.5px solid #A7F3D0",color:"#047857" },
  resultCard:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:16,padding:"2.5rem",width:"100%",maxWidth:480,height:"fit-content",textAlign:"center" as const },
  resultTitle:{ fontSize:24,fontWeight:700,color:"#0A0A0F",letterSpacing:"-.5px",marginBottom:"1.5rem" },
  scoreCircle:{ background:"#F9F9FC",border:"0.5px solid rgba(0,0,0,.07)",borderRadius:"50%",width:120,height:120,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",margin:"0 auto 1.5rem" },
  resultStats:{ display:"flex",gap:12,justifyContent:"center",marginBottom:"1.25rem" },
  rStat:{ background:"#F9F9FC",borderRadius:12,padding:"1rem 1.5rem",textAlign:"center" as const },
  rStatNum:{ fontSize:28,fontWeight:700,color:"#0A0A0F" },
  rStatLabel:{ fontSize:12,color:"#9ca3af",marginTop:3 },
  passBanner:{ borderRadius:10,padding:"12px 16px",fontSize:14,fontWeight:500,marginBottom:"1rem" },
  passOk:{ background:"#ECFDF5",border:"0.5px solid #A7F3D0",color:"#047857" },
  passFail:{ background:"#FEF2F2",border:"0.5px solid #FECACA",color:"#B91C1C" },
}