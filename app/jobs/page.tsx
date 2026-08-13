"use client"
import { useState, useEffect, Suspense, type FormEvent, type CSSProperties } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import styles from "@/styles/jobs.module.css"
import AppShell from "@/components/vrittih/AppShell"
import EmptyState from "@/components/vrittih/EmptyState"
import { IconBanknote, IconGlobe, IconFolder, IconUsers, IconTarget, IconBookmark } from "@/components/ui/Icons"

const INDUSTRIES = ["All","Technology","Finance","Healthcare","Education","Manufacturing","Retail","Legal","Government","Logistics","Energy","Agriculture","Media","Other"]
const TYPES = ["All","FULLTIME","PARTTIME","INTERNSHIP","CONTRACT","FREELANCE"]
const adminBtn: CSSProperties = {
  fontSize: 13, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--v-line-2)",
  background: "var(--v-surface)", color: "var(--v-ink-1)", cursor: "pointer", textDecoration: "none",
}
const fieldWrap: CSSProperties = { display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }
const fieldLabel: CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--v-ink-2)" }
const fieldInput: CSSProperties = {
  fontSize: 14, padding: "9px 11px", borderRadius: 9,
  border: "1px solid var(--v-line-2)", background: "var(--v-bg)", color: "var(--v-ink-1)", width: "100%",
}

const TYPE_LABELS: Record<string,string> = { FULLTIME:"Full-time", PARTTIME:"Part-time", INTERNSHIP:"Internship", CONTRACT:"Contract", FREELANCE:"Freelance" }

export default function JobsPage() {
  return (
    <Suspense fallback={<AppShell title="Find jobs"><div className={styles.loadingState} style={{margin:"2rem auto",maxWidth:600}}>Loading jobs…</div></AppShell>}>
      <JobsInner />
    </Suspense>
  )
}

function JobsInner() {
  const sp = useSearchParams()
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState(sp.get("q") || "")
  const [industry, setIndustry] = useState(() => {
    const i = sp.get("industry") || "All"
    return INDUSTRIES.includes(i) ? i : "All"
  })
  const [type, setType] = useState(() => {
    const t = sp.get("type") || "All"
    return TYPES.includes(t) ? t : "All"
  })
  const [remote, setRemote] = useState(sp.get("remote") === "true")
  const [saved, setSaved] = useState<Set<string>>(new Set())
  // Admin capabilities are SERVER-decided (returned by /api/jobs), never inferred from a
  // local idea of the role — so the UI can never offer an action the API would refuse.
  const [admin, setAdmin] = useState<{ isAdmin: boolean; canDelete: boolean }>({ isAdmin: false, canDelete: false })
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => { fetchJobs() }, [industry, type, remote, showArchived])
  useEffect(() => {
    fetch("/api/jobs/save").then(r => r.ok ? r.json() : { jobs: [] }).then(d => setSaved(new Set((d.jobs || []).map((j: any) => j.id)))).catch(() => {})
  }, [])

  async function toggleSave(jobId: string) {
    setSaved(s => { const n = new Set(s); n.has(jobId) ? n.delete(jobId) : n.add(jobId); return n }) // optimistic
    await fetch("/api/jobs/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) })
  }

  async function fetchJobs(query = q) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set("q", query)
      if (industry !== "All") params.set("industry", industry)
      if (type !== "All") params.set("type", type)
      if (remote) params.set("remote", "true")
      if (showArchived) params.set("includeArchived", "true")
      const res = await fetch("/api/jobs?" + params.toString())
      const data = await res.json()
      setJobs(data.jobs || [])
      setTotal(data.total || 0)
      setAdmin(data.viewer || { isAdmin: false, canDelete: false })
    } catch { setJobs([]); setTotal(0) }   // don't hang on 'Loading jobs…' if the request fails
    finally { setLoading(false) }
  }

  // Archive is reversible and is the DEFAULT destructive-ish action offered.
  async function toggleArchive(job: any) {
    setBusy(job.id); setNotice(null)
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, active: job.active === false }),
      })
      const d = await res.json()
      if (!res.ok) { setNotice(d.error || "Could not update the posting."); return }
      setNotice(job.active === false ? "Posting restored." : "Posting archived.")
      fetchJobs()
    } catch { setNotice("Could not reach the server.") }
    finally { setBusy(null) }
  }

  // Permanent deletion also destroys every application to the posting, so the count is
  // shown in the confirmation rather than hidden behind a generic "are you sure?".
  async function deleteJob(job: any) {
    const apps = job._count?.applications ?? 0
    const warn = apps > 0
      ? `Permanently delete "${job.title}"?

This also deletes ${apps} application${apps === 1 ? "" : "s"} submitted to it. This cannot be undone.

Archive instead if you only want to hide it.`
      : `Permanently delete "${job.title}"? This cannot be undone.`
    if (!confirm(warn)) return
    setBusy(job.id); setNotice(null)
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      })
      const d = await res.json()
      if (!res.ok) { setNotice(d.error || "Could not delete the posting."); return }
      setNotice(`Deleted "${job.title}"${d.deletedApplications ? ` and ${d.deletedApplications} application(s)` : ""}.`)
      fetchJobs()
    } catch { setNotice("Could not reach the server.") }
    finally { setBusy(null) }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setBusy(editing.id); setNotice(null)
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: editing.id, title: editing.title, company: editing.company,
          location: editing.location, type: editing.type, industry: editing.industry,
          salary: editing.salary, remote: !!editing.remote, description: editing.description,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setNotice(d.error || "Could not save."); return }
      setNotice("Changes saved.")
      setEditing(null)
      fetchJobs()
    } catch { setNotice("Could not reach the server.") }
    finally { setBusy(null) }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    fetchJobs(q)
  }

  // When signed in, detect a weak/empty profile so we can explain the low scores
  // instead of showing a wall of meaningless "Low match" badges.
  const matched = jobs.filter((j: any) => j.match)
  const anySkillMatch = matched.some((j: any) => j.match?.matchedSkills?.length > 0)
  const bestScore = matched.length ? Math.max(...matched.map((j: any) => j.match.score)) : 0
  const weakProfile = matched.length > 0 && !anySkillMatch && bestScore < 55

  return (
    <AppShell title="Find jobs">
      <div className={styles.searchStrip}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input type="text" placeholder="Job title, company, or keyword..." value={q} onChange={e => setQ(e.target.value)} className={styles.searchInput} />
          <button type="submit" className={styles.searchBtn}>Search</button>
        </form>
      </div>
      <div className={styles.layout}>
        <aside className={styles.filters}>
          <div className={styles.filterSection}>
            <div className={styles.filterTitle}>Industry</div>
            {INDUSTRIES.map(i => (
              <label key={i} className={styles.filterLabel}>
                <input type="radio" name="industry" checked={industry === i} onChange={() => setIndustry(i)} />
                {i}
              </label>
            ))}
          </div>
          <div className={styles.filterSection}>
            <div className={styles.filterTitle}>Job type</div>
            {TYPES.map(t => (
              <label key={t} className={styles.filterLabel}>
                <input type="radio" name="type" checked={type === t} onChange={() => setType(t)} />
                {t === "All" ? "All types" : TYPE_LABELS[t]}
              </label>
            ))}
          </div>
          <div className={styles.filterSection}>
            <div className={styles.filterTitle}>Work mode</div>
            <label className={styles.filterLabel}>
              <input type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)} />
              Remote only
            </label>
          </div>
        </aside>

        <main>
          {!loading && weakProfile && !admin.isAdmin && (
            <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", background:"linear-gradient(135deg,#EAF1FE,#F1F7F4)", border:"1px solid #CFE9DF", borderRadius:14, padding:"14px 18px", marginBottom:16 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:"#6495ED", color:"#fff", display:"grid", placeItems:"center", flexShrink:0 }}>
                <IconTarget size={19} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:650, color:"#1F2937" }}>Your match scores are low because your profile is empty</div>
                <div style={{ fontSize:13, color:"#64748B", marginTop:2 }}>Add your skills, experience and location — matching recalculates instantly and surfaces roles that actually fit you.</div>
              </div>
              <Link href="/profile/edit" style={{ background:"#6495ED", color:"#fff", fontSize:13, fontWeight:600, padding:"9px 16px", borderRadius:9, textDecoration:"none", whiteSpace:"nowrap" }}>Complete profile</Link>
            </div>
          )}
          {admin.isAdmin && (
            <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:12, padding:"10px 14px", marginBottom:12 }}>
              <span style={{ fontSize:12, fontWeight:700, letterSpacing:.4, color:"#9A3412", textTransform:"uppercase" }}>Admin</span>
              <span style={{ fontSize:13, color:"#7C2D12" }}>You can edit, archive{admin.canDelete ? " and delete" : ""} any posting.</span>
              <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:"#7C2D12", marginLeft:"auto", cursor:"pointer" }}>
                <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
                Show archived
              </label>
            </div>
          )}
          {notice && (
            <div role="status" style={{ background:"#ECFDF5", border:"1px solid #A7F3D0", color:"#065F46", borderRadius:10, padding:"9px 13px", fontSize:13, marginBottom:12 }}>
              {notice}
            </div>
          )}
          <div className={styles.listHeader}>
            <span className={styles.jobsCount}>{loading ? "Loading..." : `${total.toLocaleString()} jobs found`}</span>
          </div>
          {loading ? (
            <div className={styles.loadingState}>Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <EmptyState
              title="No jobs match your filters"
              reason="Nothing here right now. Widen your filters or clear the search to see more roles."
              ctaLabel={q || industry !== "All" || type !== "All" || remote ? "Clear filters" : "Browse all jobs"}
              onCta={() => { setQ(""); setIndustry("All"); setType("All"); setRemote(false) }}
              aiTip="Fewer, broader filters surface more AI-matched roles — then sort by match to focus."
            />
          ) : (
            <div className={styles.list}>
              {jobs.map((job: any) => (
                <Link href={`/jobs/${job.id}`} key={job.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardLeft}>
                      <div className={styles.logo}>{job.company.slice(0,2).toUpperCase()}</div>
                      <div>
                        <div className={styles.jobTitle}>{job.title}</div>
                        <div className={styles.jobMeta}>{job.company} · {job.location}</div>
                      </div>
                    </div>
                    <div className={styles.cardTopRight}>
                      {job.match && (
                        <span className={styles.matchBadge} data-tier={matchTier(job.match.score)}>
                          <span className={styles.matchScore}>{job.match.score}%</span>
                          <span className={styles.matchLabel}>{job.match.label} match</span>
                        </span>
                      )}
                      <span className={styles.typePill}>{TYPE_LABELS[job.type] || job.type}</span>
                      {job.active === false && (
                        <span style={{ fontSize:11, fontWeight:700, letterSpacing:.3, textTransform:"uppercase", color:"#9A3412", background:"#FFEDD5", border:"1px solid #FED7AA", borderRadius:6, padding:"3px 7px" }}>Archived</span>
                      )}
                      {!admin.isAdmin && (
                      <button type="button" aria-label={saved.has(job.id) ? "Remove from saved" : "Save job"}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); toggleSave(job.id) }}
                        style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 8, border: "1px solid var(--v-line-2)", background: saved.has(job.id) ? "var(--brand-100)" : "var(--v-surface)", color: saved.has(job.id) ? "var(--brand-600)" : "var(--v-ink-3)", cursor: "pointer", flexShrink: 0 }}>
                        <IconBookmark size={15} />
                      </button>
                      )}
                    </div>
                  </div>
                  <div className={styles.cardBottom}>
                    {job.salary && <span className={styles.metaItem}><IconBanknote size={14} /> {job.salary}</span>}
                    {job.remote && <span className={styles.metaItem}><IconGlobe size={14} /> Remote</span>}
                    <span className={styles.metaItem}><IconFolder size={14} /> {job.industry}</span>
                    <span className={styles.metaItem}><IconUsers size={14} /> {job._count.applications} applied</span>
                    <span className={styles.metaTime}>{timeAgo(job.createdAt)}</span>
                  </div>
                  {job.match?.matchedSkills?.length > 0 && (
                    <div className={styles.matchSkills}>
                      <span className={styles.matchSkillsLabel}>Why you match:</span>
                      {job.match.matchedSkills.slice(0,6).map((s: string) => (
                        <span key={s} className={styles.skillChip}>{s}</span>
                      ))}
                    </div>
                  )}
                  {admin.isAdmin && (
                    <div
                      onClick={e => { e.preventDefault(); e.stopPropagation() }}
                      style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginTop:12, paddingTop:12, borderTop:"1px dashed var(--v-line-2)" }}
                    >
                      <Link
                        href={`/jobs/${job.id}`}
                        onClick={e => e.stopPropagation()}
                        style={adminBtn}
                      >View</Link>
                      <button type="button" disabled={busy === job.id}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); setEditing({ ...job }) }}
                        style={adminBtn}>Edit</button>
                      <button type="button" disabled={busy === job.id}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); toggleArchive(job) }}
                        style={adminBtn}>{job.active === false ? "Restore" : "Archive"}</button>
                      {admin.canDelete && (
                        <button type="button" disabled={busy === job.id}
                          onClick={e => { e.preventDefault(); e.stopPropagation(); deleteJob(job) }}
                          style={{ ...adminBtn, color:"#B91C1C", borderColor:"#FECACA", background:"#FEF2F2" }}>Delete</button>
                      )}
                      <span style={{ marginLeft:"auto", fontSize:12, color:"var(--v-ink-3)" }}>
                        {job.postedBy?.name ? `Posted by ${job.postedBy.name}` : "Unknown poster"}
                      </span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>

      {editing && (
        <div
          role="dialog" aria-modal="true" aria-label="Edit posting"
          onClick={() => setEditing(null)}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,.45)", display:"grid", placeItems:"center", padding:20, zIndex:50 }}
        >
          <form
            onClick={e => e.stopPropagation()} onSubmit={saveEdit}
            style={{ background:"var(--v-surface)", borderRadius:16, padding:22, width:"min(640px,100%)", maxHeight:"88vh", overflowY:"auto", border:"1px solid var(--v-line-2)" }}
          >
            <h2 style={{ margin:"0 0 4px", fontSize:18, fontWeight:700 }}>Edit posting</h2>
            <p style={{ margin:"0 0 16px", fontSize:13, color:"var(--v-ink-3)" }}>
              Editing as an administrator. The change is recorded in the audit log with the previous values.
            </p>
            {[
              { k:"title", label:"Title" },
              { k:"company", label:"Company" },
              { k:"location", label:"Location" },
              { k:"industry", label:"Industry" },
              { k:"salary", label:"Salary (CHF)" },
            ].map(({ k, label }) => (
              <label key={k} style={fieldWrap}>
                <span style={fieldLabel}>{label}</span>
                <input value={editing[k] ?? ""} onChange={e => setEditing({ ...editing, [k]: e.target.value })} style={fieldInput} />
              </label>
            ))}
            <label style={fieldWrap}>
              <span style={fieldLabel}>Type</span>
              <select value={editing.type ?? ""} onChange={e => setEditing({ ...editing, type: e.target.value })} style={fieldInput}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label style={{ ...fieldWrap, flexDirection:"row", alignItems:"center", gap:8 }}>
              <input type="checkbox" checked={!!editing.remote} onChange={e => setEditing({ ...editing, remote: e.target.checked })} />
              <span style={fieldLabel}>Remote</span>
            </label>
            <label style={fieldWrap}>
              <span style={fieldLabel}>Description</span>
              <textarea rows={6} value={editing.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value })} style={{ ...fieldInput, resize:"vertical" }} />
            </label>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
              <button type="button" onClick={() => setEditing(null)} style={adminBtn}>Cancel</button>
              <button type="submit" disabled={busy === editing.id}
                style={{ ...adminBtn, background:"var(--brand-600,#6495ED)", color:"#fff", borderColor:"transparent", fontWeight:600 }}>
                {busy === editing.id ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  )
}

function matchTier(score: number) {
  if (score >= 85) return "excellent"
  if (score >= 70) return "strong"
  if (score >= 55) return "good"
  if (score >= 40) return "fair"
  return "low"
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return mins + "m ago"
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + "h ago"
  return Math.floor(hrs / 24) + "d ago"
}
