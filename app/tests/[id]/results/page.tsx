"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconFileText, IconUsers } from "@/components/ui/Icons"

export default function TestResultsPage({ params }: { params: { id: string } }) {
  const [test, setTest] = useState<any>(null)
  const [attempts, setAttempts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    fetch(`/api/tests/${params.id}/attempts`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || "Unable to load results")
        return data
      })
      .then(data => { setTest(data.test); setAttempts(data.attempts || []) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.id])

  const completed = attempts.filter(a => a.status === "COMPLETED")
  const passRate = completed.length ? Math.round((completed.filter(a => a.passed).length / completed.length) * 100) : 0

  return (
    <AppShell>
      <div style={S.page}>
        <div style={S.wrap}>
          <div style={S.header}>
            <div>
              <Link href="/tests" style={S.back}>← Assessments</Link>
              <h1 style={S.title}>{test ? `Results — ${test.title}` : "Test results"}</h1>
              <p style={S.sub}>Candidate results for this assessment, shared with you as the test owner</p>
            </div>
          </div>

          {loading ? (
            <div style={S.empty}><p style={{color:"#9ca3af"}}>Loading...</p></div>
          ) : error ? (
            <div style={S.empty}>
              <span style={{color:"#D1D5DB"}}><IconFileText size={38} /></span>
              <p style={{fontSize:15,fontWeight:500,color:"#3D3D4E",marginTop:12}}>{error}</p>
            </div>
          ) : (
            <>
              <div style={S.stats}>
                <div style={S.stat}><span style={S.statNum}>{attempts.length}</span><span style={S.statLbl}>Total attempts</span></div>
                <div style={S.stat}><span style={S.statNum}>{completed.length}</span><span style={S.statLbl}>Completed</span></div>
                <div style={S.stat}><span style={S.statNum}>{passRate}%</span><span style={S.statLbl}>Pass rate</span></div>
              </div>

              {attempts.length === 0 ? (
                <div style={S.empty}>
                  <span style={{color:"#D1D5DB"}}><IconUsers size={38} /></span>
                  <p style={{fontSize:15,fontWeight:500,color:"#3D3D4E",marginTop:12}}>No candidates have attempted this test yet</p>
                </div>
              ) : (
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Candidate</th>
                        <th style={S.th}>Score</th>
                        <th style={S.th}>Result</th>
                        <th style={S.th}>Status</th>
                        <th style={S.th}>Completed</th>
                        <th style={S.th}>Tab switches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attempts.map(a => (
                        <tr key={a.id}>
                          <td style={S.td}>
                            <div style={{fontWeight:600,color:"#0A0A0F"}}>{a.user?.name || "—"}</div>
                            <div style={{fontSize:12,color:"#9ca3af"}}>{a.user?.email}</div>
                          </td>
                          <td style={S.td}>{a.status === "COMPLETED" && a.score != null ? `${a.score}%` : "—"}</td>
                          <td style={S.td}>
                            {a.status !== "COMPLETED" ? <span style={S.pillNeutral}>Pending</span>
                              : a.passed ? <span style={S.pillPass}>Passed</span>
                              : <span style={S.pillFail}>Not passed</span>}
                          </td>
                          <td style={S.td}><span style={S.statusText}>{a.status?.replace("_"," ").toLowerCase()}</span></td>
                          <td style={S.td}>{a.completedAt ? new Date(a.completedAt).toLocaleDateString() : "—"}</td>
                          <td style={S.td}>{a.tabSwitches ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{ background:"#F7F9FC",minHeight:"calc(100vh - 60px)",padding:"2rem" },
  wrap:{ maxWidth:1100,margin:"0 auto" },
  header:{ display:"flex", flexWrap:"wrap" as const, gap:12,justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1.5rem" },
  back:{ fontSize:13,color:"#6495ED",textDecoration:"none",fontWeight:500 },
  title:{ fontSize:22,fontWeight:600,color:"#0A0A0F",letterSpacing:"-.3px",marginTop:6 },
  sub:{ fontSize:13,color:"#7B7B8F",marginTop:4,maxWidth:520 },
  stats:{ display:"flex",gap:12,flexWrap:"wrap" as const,marginBottom:"1.25rem" },
  stat:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1rem 1.5rem",display:"flex",flexDirection:"column" as const,gap:4,minWidth:130 },
  statNum:{ fontSize:24,fontWeight:600,color:"#0A0A0F" },
  statLbl:{ fontSize:12,color:"#7B7B8F" },
  tableWrap:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,overflowX:"auto" as const },
  table:{ width:"100%",borderCollapse:"collapse" as const,fontSize:13 },
  th:{ textAlign:"left" as const,padding:"12px 16px",fontSize:12,fontWeight:600,color:"#7B7B8F",borderBottom:"0.5px solid rgba(0,0,0,.08)",whiteSpace:"nowrap" as const },
  td:{ padding:"12px 16px",color:"#3D3D4E",borderBottom:"0.5px solid rgba(0,0,0,.05)",verticalAlign:"top" as const },
  statusText:{ textTransform:"capitalize" as const },
  pillPass:{ fontSize:12,fontWeight:500,padding:"3px 12px",borderRadius:999,background:"#ECFDF5",color:"#047857" },
  pillFail:{ fontSize:12,fontWeight:500,padding:"3px 12px",borderRadius:999,background:"#FEF2F2",color:"#B91C1C" },
  pillNeutral:{ fontSize:12,fontWeight:500,padding:"3px 12px",borderRadius:999,background:"#F3F4F6",color:"#6B7280" },
  empty:{ display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",padding:"4rem",background:"#fff",borderRadius:14,border:"0.5px solid rgba(0,0,0,.07)",textAlign:"center" as const },
}
