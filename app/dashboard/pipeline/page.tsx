"use client"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconCheckCircle, IconArrowRight } from "@/components/ui/Icons"

const BOARD: { key: string; label: string; color: string }[] = [
  { key: "APPLIED", label: "Applied", color: "#185FA5" },
  { key: "SHORTLISTED", label: "Shortlisted", color: "#0F6E56" },
  { key: "INTERVIEW", label: "Interview", color: "#B45309" },
  { key: "OFFERED", label: "Offer", color: "#0891B2" },
  { key: "HIRED", label: "Hired", color: "#047857" },
  { key: "REJECTED", label: "Not selected", color: "#A32D2D" },
]
const initials = (n?: string) => (n || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()
const ago = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return d <= 0 ? "today" : d === 1 ? "1d" : `${d}d` }

export default function ApplicantPipeline() {
  const [jobs, setJobs] = useState<any[]>([])
  const [jobId, setJobId] = useState("")
  const [apps, setApps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/jobs?mine=true").then(r => r.json()).then(d => {
      const js = d.jobs || []; setJobs(js); setJobId(js[0]?.id || "all")
    })
  }, [])

  const load = useCallback(async () => {
    const d = await fetch("/api/applications?employer=true").then(r => r.json())
    setApps(d.applications || []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = apps.filter(a => jobId === "all" || a.job?.id === jobId)
  const byStage = (s: string) => filtered.filter(a => (a.status === "REVIEWED" ? "APPLIED" : a.status === "ASSESSMENT" ? "INTERVIEW" : a.status === "ACCEPTED" ? "OFFERED" : a.status) === s)

  async function move(id: string, status: string) {
    const cur = apps.find(a => a.id === id)
    if (!cur || cur.status === status) return
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a)) // optimistic
    await fetch("/api/applications/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: id, status }) })
    load()
  }

  return (
    <AppShell title="Candidate pipeline">
      <style>{CSS}</style>
      <div className="pp">
        <header className="ppHead">
          <div>
            <h1 className="ppTitle">Candidate pipeline</h1>
            <p className="ppSub">Drag a candidate between stages — they see the update live on their tracker.</p>
          </div>
          {jobs.length > 0 && (
            <select className="ppJob" value={jobId} onChange={e => setJobId(e.target.value)}>
              <option value="all">All roles ({apps.length})</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          )}
        </header>

        {loading ? (
          <div className="ppBoard">{BOARD.map(c => <div key={c.key} className="v-skeleton" style={{ height: 260, borderRadius: 14 }} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="ppEmpty">
            <p className="ppEmptyTitle">No applicants yet</p>
            <p className="ppEmptyText">Once candidates apply, drag them through Applied → Offer → Hired here. Import your Indeed applicants to fill this instantly.</p>
            <Link href="/admin/import" className="ppCta">Import candidates <IconArrowRight size={14} /></Link>
          </div>
        ) : (
          <div className="ppBoard">
            {BOARD.map(col => {
              const items = byStage(col.key)
              return (
                <div key={col.key}
                  onDragOver={e => { e.preventDefault(); setOver(col.key) }}
                  onDragLeave={() => setOver(o => o === col.key ? null : o)}
                  onDrop={() => { if (drag) move(drag, col.key); setDrag(null); setOver(null) }}
                  className={"ppCol" + (over === col.key ? " over" : "")}>
                  <div className="ppColHead">
                    <span className="ppDot" style={{ background: col.color }} />
                    <span className="ppColName">{col.label}</span>
                    <span className="ppCount">{items.length}</span>
                  </div>
                  <div className="ppCards">
                    {items.map(a => (
                      <div key={a.id} draggable onDragStart={() => setDrag(a.id)} onDragEnd={() => { setDrag(null); setOver(null) }}
                        className="ppCard" style={{ opacity: drag === a.id ? .5 : 1 }}>
                        <div className="ppCardTop">
                          {a.user?.avatar ? <img src={a.user.avatar} className="ppAv" alt="" /> : <span className="ppAvT">{initials(a.user?.name)}</span>}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <Link href={`/u/${a.user?.id}`} className="ppName">{a.user?.name}</Link>
                            {a.user?.headline && <div className="ppRole">{a.user.headline}</div>}
                          </div>
                          {a.user?.idVerified && <span className="v-gold ppVer" title="Verified"><IconCheckCircle size={11} /></span>}
                        </div>
                        <div className="ppCardFoot">
                          <span className="ppTime">applied {ago(a.appliedAt)} ago</span>
                          <select className="ppMove" value={col.key} onChange={e => move(a.id, e.target.value)} onClick={e => e.stopPropagation()} title="Move stage">
                            {BOARD.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && <div className="ppDrop">Drop here</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}

const CSS = `
.pp { padding: clamp(1.25rem,3vw,2rem); }
.ppHead { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
.ppTitle { font-family: var(--font-display); font-size: clamp(1.5rem,3vw,2rem); font-weight: 600; color: var(--v-ink); letter-spacing: -.02em; }
.ppSub { font-size: 14px; color: var(--v-ink-2); margin-top: 4px; }
.ppJob { border: 1px solid var(--v-line-2); border-radius: 10px; padding: 9px 13px; font-size: 13.5px; background: var(--v-surface); color: var(--v-ink); outline: none; max-width: 260px; }
.ppBoard { display: grid; grid-template-columns: repeat(6, minmax(200px, 1fr)); gap: 12px; align-items: start; overflow-x: auto; padding-bottom: 12px; }
.ppCol { background: var(--v-surface-2); border-radius: 14px; padding: 11px; min-height: 220px; border: 2px solid transparent; transition: border-color .12s, background .12s; }
.ppCol.over { border-color: var(--brand-600); background: var(--brand-100); }
.ppColHead { display: flex; align-items: center; gap: 8px; padding: 2px 4px 10px; }
.ppDot { width: 8px; height: 8px; border-radius: 50%; }
.ppColName { font-size: 13px; font-weight: 700; color: var(--v-ink); }
.ppCount { margin-left: auto; font-size: 11.5px; font-weight: 600; color: var(--v-ink-2); background: var(--v-surface); border-radius: 999px; padding: 1px 9px; }
.ppCards { display: flex; flex-direction: column; gap: 8px; }
.ppCard { background: var(--v-surface); border: 1px solid var(--v-line); border-radius: 11px; padding: 11px; cursor: grab; box-shadow: var(--v-shadow-sm); transition: box-shadow .14s; }
.ppCard:hover { box-shadow: var(--v-shadow); }
.ppCard:active { cursor: grabbing; }
.ppCardTop { display: flex; align-items: center; gap: 10px; }
.ppAv { width: 34px; height: 34px; border-radius: 9px; object-fit: cover; flex-shrink: 0; }
.ppAvT { width: 34px; height: 34px; border-radius: 9px; background: var(--brand-100); color: var(--brand-700); display: grid; place-items: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.ppName { font-size: 13.5px; font-weight: 600; color: var(--v-ink); text-decoration: none; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ppName:hover { color: var(--brand-700); }
.ppRole { font-size: 11.5px; color: var(--v-ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ppVer { width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; flex-shrink: 0; }
.ppCardFoot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
.ppTime { font-family: var(--font-mono); font-size: 10.5px; color: var(--v-ink-3); }
.ppMove { font-size: 11px; border: 1px solid var(--v-line-2); border-radius: 7px; padding: 3px 6px; background: var(--v-surface); color: var(--v-ink-2); outline: none; max-width: 110px; }
.ppDrop { border: 1.5px dashed var(--v-line-2); border-radius: 10px; padding: 16px 0; text-align: center; font-size: 12px; color: var(--v-ink-3); }
.ppEmpty { text-align: center; padding: 3rem 1rem; background: var(--v-surface); border: 1px solid var(--v-line); border-radius: 18px; }
.ppEmptyTitle { font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--v-ink); }
.ppEmptyText { font-size: 14px; color: var(--v-ink-2); max-width: 46ch; margin: 8px auto 18px; line-height: 1.6; }
.ppCta { display: inline-flex; align-items: center; gap: 7px; background: var(--brand-600); color: #fff; padding: 10px 18px; border-radius: 999px; font-size: 14px; font-weight: 600; text-decoration: none; }
`
