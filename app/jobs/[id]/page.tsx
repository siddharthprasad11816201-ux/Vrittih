"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import CompanyLogo from "@/components/vrittih/CompanyLogo"
import styles from "@/styles/jobdetail.module.css"
import { IconBanknote } from "@/components/ui/Icons"
import { slugify } from "@/lib/company"
import { hostLabel } from "@/lib/url"

export default function JobDetail({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [coverLetter, setCoverLetter] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then(r => r.json())
      .then(d => { setJob(d.job); setLoading(false) })
  }, [id])

  async function apply() {
    setApplying(true)
    setError("")
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: id, coverLetter }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setApplying(false); return }
    setApplied(true)
    setShowForm(false)
    setApplying(false)
  }

  if (loading) return <AppShell><div className={styles.loading}>Loading...</div></AppShell>
  if (!job) return <AppShell><div className={styles.loading}>Job not found.</div></AppShell>

  return (
    <AppShell>
      <div className={styles.wrap}>
        <div className={styles.main}>
          <div className={styles.header}>
            <Link href={`/companies/${slugify(job.company)}`}><CompanyLogo name={job.company} size={48} radius={11} /></Link>
            <div>
              <h1 className={styles.title}>{job.title}</h1>
              <div className={styles.meta}>
                <Link href={`/companies/${slugify(job.company)}`} style={{ color: "inherit", fontWeight: 600, textDecoration: "none" }}>{job.company}</Link> · {job.location} · {job.type}
              </div>
            </div>
          </div>

          {job.salary && <div className={styles.salaryBadge} style={{display:"inline-flex",alignItems:"center",gap:7}}><IconBanknote size={15} /> {job.salary}</div>}

          {job.closesAt && (() => {
            const days = Math.ceil((new Date(job.closesAt).getTime() - Date.now()) / 86400000)
            const closed = days < 0
            const urgent = !closed && days <= 7
            const on = new Date(job.closesAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
            return (
              <div style={{ ...A.deadline, ...(closed ? A.deadlineClosed : urgent ? A.deadlineUrgent : {}) }}>
                <b>{closed ? "Applications closed" : days === 0 ? "Closes today" : days === 1 ? "Closes tomorrow" : `Closes in ${days} days`}</b>
                <span style={{ opacity: .8 }}>· last date {on}</span>
              </div>
            )
          })()}

          <div className={styles.tags}>
            {job.remote && <span className={styles.tag}>Remote</span>}
            <span className={styles.tag}>{job.industry}</span>
            <span className={styles.tag}>{job._count.applications} applicants</span>
          </div>

          <div className={styles.section}>
            <h2>About this role</h2>
            <p className={styles.desc}>{job.description}</p>
          </div>

          {job.skills?.length > 0 && (
            <div className={styles.section}>
              <h2>Skills required</h2>
              <div className={styles.skillWrap}>
                {job.skills.map((s: any) => (
                  <span key={s.skill.id} className={styles.skill}>{s.skill.name}</span>
                ))}
              </div>
            </div>
          )}

          {error && <div className={styles.errorBox}>{error}</div>}

          {applied ? (
            <div className={styles.successBox}>
              Application submitted successfully.
              <Link href="/dashboard/applications" className={styles.trackLink}>Track status</Link>
            </div>
          ) : showForm ? (
            <div className={styles.applyForm}>
              <h2>Cover letter <span>(optional)</span></h2>
              <textarea
                placeholder="Tell the employer why you are a great fit..."
                value={coverLetter}
                onChange={e => setCoverLetter(e.target.value)}
                className={styles.textarea}
                rows={5}
              />
              <div className={styles.formActions}>
                <button onClick={() => setShowForm(false)} className={styles.cancelBtn}>Cancel</button>
                <button onClick={apply} disabled={applying} className={styles.applyBtn}>
                  {applying ? "Submitting..." : "Submit application"}
                </button>
              </div>
            </div>
          ) : (
            <div style={A.box}>
              <h2 style={A.head}>Apply for this role</h2>
              <p style={A.sub}>
                {job.govUrl || job.applyUrl
                  ? "Choose how you’d like to apply — all routes reach the same employer."
                  : "Apply here and follow every stage live."}
              </p>

              <button onClick={() => setShowForm(true)} style={A.primary}>
                <span style={A.optMain}>Apply on Vrittih</span>
                <span style={A.optSubOn}>Tracked live through all 7 stages</span>
              </button>

              {job.govUrl && (
                <a href={job.govUrl} target="_blank" rel="noopener noreferrer" style={A.opt}>
                  <span style={A.optBody}>
                    <span style={A.optMain}>Apply on the official government portal</span>
                    <span style={A.optSub}>{hostLabel(job.govUrl)} · opens the official site</span>
                  </span>
                  <span style={A.ext}>↗</span>
                </a>
              )}

              {job.applyUrl && (
                <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" style={A.opt}>
                  <span style={A.optBody}>
                    <span style={A.optMain}>Apply on the {job.company} website</span>
                    <span style={A.optSub}>{hostLabel(job.applyUrl)} · opens the employer’s own site</span>
                  </span>
                  <span style={A.ext}>↗</span>
                </a>
              )}

              {(job.govUrl || job.applyUrl) && (
                <p style={A.note}>
                  Applying on an external site happens outside Vrittih, so we can’t show live status for it.
                </p>
              )}
            </div>
          )}
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.sideCard}>
            <h3>Job overview</h3>
            <div className={styles.overviewItem}><span>Posted by</span><span>{job.postedBy?.name}</span></div>
            <div className={styles.overviewItem}><span>Industry</span><span>{job.industry}</span></div>
            <div className={styles.overviewItem}><span>Type</span><span>{job.type}</span></div>
            <div className={styles.overviewItem}><span>Location</span><span>{job.location}</span></div>
            {job.remote && <div className={styles.overviewItem}><span>Remote</span><span>Yes</span></div>}
            <div className={styles.overviewItem}><span>Applicants</span><span>{job._count.applications}</span></div>
          </div>
        </aside>
      </div>
    </AppShell>
  )
}

// Apply options — Vrittih's tracked flow plus the official external routes.
const A: Record<string, any> = {
  box: { border: "1px solid var(--v-line, #E6E3DA)", borderRadius: 14, padding: 20, background: "var(--v-surface, #fff)", marginTop: 8 },
  head: { fontSize: 17, fontWeight: 650, color: "var(--brand-900, #04342C)", margin: 0 },
  sub: { fontSize: 13.5, color: "var(--v-ink-3, #7C877F)", margin: "6px 0 16px", lineHeight: 1.5 },
  primary: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, width: "100%",
    background: "var(--brand-600, #0F6E56)", color: "#fff", border: "none", borderRadius: 11,
    padding: "13px 16px", cursor: "pointer", textAlign: "left", marginBottom: 10,
  },
  opt: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%",
    border: "1px solid var(--v-line-2, #D9D3C4)", borderRadius: 11, padding: "13px 16px",
    textDecoration: "none", marginBottom: 10, background: "var(--v-bg, #FAF8F2)", boxSizing: "border-box",
    color: "var(--v-ink, #14201B)",
  },
  optBody: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  optMain: { fontSize: 14.5, fontWeight: 600, color: "inherit" },
  optSub: { fontSize: 12, color: "var(--v-ink-3, #7C877F)" },
  optSubOn: { fontSize: 12, color: "rgba(255,255,255,.8)" },
  ext: { fontSize: 16, color: "var(--v-ink-3, #7C877F)", flexShrink: 0 },
  note: { fontSize: 12, color: "var(--v-ink-3, #7C877F)", lineHeight: 1.5, margin: "2px 0 0" },
  // Deadline banner — for public-sector notices this is the single most important fact.
  deadline: {
    display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, margin: "12px 0 0",
    padding: "9px 14px", borderRadius: 999, fontSize: 13.5, width: "fit-content",
    background: "var(--brand-100, #E1F5EE)", color: "var(--brand-900, #04342C)",
  },
  deadlineUrgent: { background: "#FDF0DC", color: "#7A4B12" },
  deadlineClosed: { background: "#F3F0EA", color: "#6B6B6B" },
}