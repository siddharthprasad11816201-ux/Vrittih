"use client"
import { useState, useEffect, Suspense, type FormEvent } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import styles from "@/styles/jobs.module.css"
import AppShell from "@/components/vrittih/AppShell"
import { IconBanknote, IconGlobe, IconFolder, IconUsers, IconTarget } from "@/components/ui/Icons"

const INDUSTRIES = ["All","Technology","Finance","Healthcare","Education","Manufacturing","Retail","Legal","Government","Logistics","Energy","Agriculture","Media","Other"]
const TYPES = ["All","FULLTIME","PARTTIME","INTERNSHIP","CONTRACT","FREELANCE"]
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

  useEffect(() => { fetchJobs() }, [industry, type, remote])

  async function fetchJobs(query = q) {
    setLoading(true)
    const params = new URLSearchParams()
    if (query) params.set("q", query)
    if (industry !== "All") params.set("industry", industry)
    if (type !== "All") params.set("type", type)
    if (remote) params.set("remote", "true")
    const res = await fetch("/api/jobs?" + params.toString())
    const data = await res.json()
    setJobs(data.jobs || [])
    setTotal(data.total || 0)
    setLoading(false)
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
          {!loading && weakProfile && (
            <div style={{ display:"flex", alignItems:"center", gap:14, background:"linear-gradient(135deg,#E1F5EE,#EEF2FF)", border:"1px solid #E2DBFB", borderRadius:14, padding:"14px 18px", marginBottom:16 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:"#0F6E56", color:"#fff", display:"grid", placeItems:"center", flexShrink:0 }}>
                <IconTarget size={19} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:650, color:"#1A1633" }}>Your match scores are low because your profile is empty</div>
                <div style={{ fontSize:13, color:"#5A5470", marginTop:2 }}>Add your skills, experience and location — matching recalculates instantly and surfaces roles that actually fit you.</div>
              </div>
              <Link href="/profile/edit" style={{ background:"#0F6E56", color:"#fff", fontSize:13, fontWeight:600, padding:"9px 16px", borderRadius:9, textDecoration:"none", whiteSpace:"nowrap" }}>Complete profile</Link>
            </div>
          )}
          <div className={styles.listHeader}>
            <span className={styles.jobsCount}>{loading ? "Loading..." : `${total.toLocaleString()} jobs found`}</span>
          </div>
          {loading ? (
            <div className={styles.loadingState}>Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No jobs found.</p>
              <p style={{fontSize:"13px",color:"#9ca3af",marginTop:"4px"}}>Try adjusting your filters.</p>
            </div>
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
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
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
