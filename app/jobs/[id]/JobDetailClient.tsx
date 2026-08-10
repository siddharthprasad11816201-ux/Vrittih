"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import CompanyLogo from "@/components/vrittih/CompanyLogo"
import MatchPanel from "@/components/career/MatchPanel"
import RoadmapPanel from "@/components/career/RoadmapPanel"
import ResumeReviewPanel from "@/components/career/ResumeReviewPanel"
import InterviewPanel from "@/components/career/InterviewPanel"
import styles from "@/styles/jobdetail.module.css"
import { IconBanknote } from "@/components/ui/Icons"
import { slugify } from "@/lib/company"
import { hostLabel } from "@/lib/url"

export default function JobDetailClient({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [coverLetter, setCoverLetter] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState("")
  // "gone" = the role genuinely no longer exists (404). "transient" = the request
  // failed (500 / network) and a retry may succeed. fetch() does NOT reject on
  // 4xx/5xx, so without inspecting r.status BOTH used to collapse into a bare
  // "Job not found." — mislabeling a transient outage as a permanent removal and
  // dead-ending recommended-job clicks. Keep them distinct so each gets the right UX.
  const [loadErr, setLoadErr] = useState<"none" | "gone" | "transient">("none")

  useEffect(() => {
    let alive = true
    setLoading(true); setLoadErr("none")
    fetch(`/api/jobs/${id}`)
      .then(async (r) => {
        if (!alive) return
        if (r.status === 404) { setLoadErr("gone"); return }
        if (!r.ok) { setLoadErr("transient"); return }
        const d = await r.json().catch(() => null)
        if (d?.job) setJob(d.job)
        else setLoadErr("transient")
      })
      .catch(() => { if (alive) setLoadErr("transient") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id])

  // Returned from sign-in mid-apply: resume in the FULL validated apply flow, not
  // the legacy inline cover-letter form (which POSTed incomplete applications,
  // skipping required questions/documents/assessments). The draft is left in
  // sessionStorage for the flow to pick up.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`vrittih:draft:${id}`)) router.push(`/jobs/${id}/apply`)
    } catch {}
  }, [id, router])

  async function apply() {
    setApplying(true)
    setError("")
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: id, coverLetter }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      // A rejected session is not the candidate's fault and "Not authenticated"
      // tells them nothing. Send them to sign in and bring them straight back to
      // this job, with the cover letter they already wrote preserved.
      if (res.status === 401) {
        try { sessionStorage.setItem(`vrittih:draft:${id}`, coverLetter) } catch {}
        router.push(`/login?next=${encodeURIComponent(`/jobs/${id}`)}`)
        return
      }
      setError(data.error || "Could not submit your application. Please try again.")
      setApplying(false)
      return
    }
    setApplied(true)
    setShowForm(false)
    setApplying(false)
  }

  if (loading) return <AppShell><div className={styles.loading}>Loading…</div></AppShell>
  if (loadErr === "gone") return (
    <AppShell>
      <div style={A.empty}>
        <h1 style={A.emptyTitle}>This role is no longer available</h1>
        <p style={A.emptyText}>It may have been filled or closed since it was recommended to you. Here&apos;s where to go next:</p>
        <div style={A.emptyBtns}>
          <Link href="/career" style={A.emptyPrimary}>See your best-fit roles →</Link>
          <Link href="/jobs" style={A.emptySecondary}>Browse all jobs</Link>
        </div>
      </div>
    </AppShell>
  )
  if (loadErr === "transient" || !job) return (
    <AppShell>
      <div style={A.empty}>
        <h1 style={A.emptyTitle}>Couldn&apos;t load this role</h1>
        <p style={A.emptyText}>Something went wrong on our side — this is usually temporary.</p>
        <div style={A.emptyBtns}>
          <button onClick={() => { setJob(null); setLoadErr("none"); setLoading(true); fetch(`/api/jobs/${id}`).then(async (r) => { if (r.status === 404) { setLoadErr("gone"); return } if (!r.ok) { setLoadErr("transient"); return } const d = await r.json().catch(() => null); if (d?.job) setJob(d.job); else setLoadErr("transient") }).catch(() => setLoadErr("transient")).finally(() => setLoading(false)) }} style={A.emptyPrimary}>Try again</button>
          <Link href="/jobs" style={A.emptySecondary}>Browse all jobs</Link>
        </div>
      </div>
    </AppShell>
  )

  // #5: a closed (past closesAt) or deactivated role must not offer an apply path — the
  // banner alone was cosmetic while the button + flow still worked.
  const closed = job.active === false || (job.closesAt && new Date(job.closesAt).getTime() < Date.now())

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
            {job.experienceLevel && <span className={styles.tag}>{job.experienceLevel}</span>}
            {job.openings > 1 && <span className={styles.tag}>{job.openings} openings</span>}
            <span className={styles.tag}>{job._count.applications} applicants</span>
          </div>

          <div className={styles.section}>
            <h2>About this role</h2>
            <p className={styles.desc}>{job.description}</p>
          </div>

          {job.requirements && (
            <div className={styles.section}>
              <h2>Requirements</h2>
              <p className={styles.desc} style={{ whiteSpace: "pre-line" }}>{job.requirements}</p>
            </div>
          )}

          {job.benefits && (
            <div className={styles.section}>
              <h2>Benefits &amp; perks</h2>
              <p className={styles.desc} style={{ whiteSpace: "pre-line" }}>{job.benefits}</p>
            </div>
          )}

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

          <MatchPanel jobId={id} />
          <RoadmapPanel jobId={id} />
          <ResumeReviewPanel jobId={id} />
          <InterviewPanel jobId={id} />

          {error && <div className={styles.errorBox}>{error}</div>}

          {applied ? (
            <div className={styles.successBox}>
              Application submitted successfully.
              <Link href="/dashboard/applications" className={styles.trackLink}>Track status</Link>
            </div>
          ) : closed ? (
            <div style={A.box}>
              <h2 style={A.head}>This role has closed</h2>
              <p style={A.sub}>Applications are no longer being accepted for this position. Here&apos;s where to look next:</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                <Link href="/career" style={{ ...A.emptyPrimary, textDecoration: "none" }}>See your best-fit roles</Link>
                <Link href="/jobs" style={{ ...A.emptySecondary, textDecoration: "none" }}>Browse all jobs</Link>
              </div>
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
                {job.aggregated
                  ? `${job.company} isn’t on Vrittih — we found this role for you. Apply on their official posting.`
                  : job.govUrl || job.applyUrl
                    ? "Choose how you’d like to apply — all routes reach the same employer."
                    : "Apply here and follow every stage live."}
              </p>

              {/* Native apply only where the employer actually has an account here.
                  For aggregated listings it would be a black hole — nobody would
                  ever receive the application. */}
              {/* The full application: profile prefilled but editable, plus any
                  questions, documents or assessment this employer requires. */}
              {!job.aggregated && (
                <Link href={`/jobs/${id}/apply`} style={{ ...A.primary, textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <span style={A.optMain}>Apply on Vrittih</span>
                  <span style={A.optSubOn}>Your profile fills it in · tracked live through all 7 stages</span>
                </Link>
              )}

              {job.aggregated && !job.govUrl && !job.applyUrl && (
                <p style={A.warn}>
                  We don’t have a link to the original posting for this role yet, so we can’t
                  send you to a real application. Rather than waste your time, please search for
                  it on {job.company}’s own site.
                </p>
              )}

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

              {/* Attribution — required by the sources we aggregate, and honest
                  about the fact that we are not the employer. */}
              {job.aggregated && job.source && (
                <p style={A.note}>
                  Listing sourced from{" "}
                  <a href={job.source.homepage} target="_blank" rel="noopener noreferrer" style={A.srcLink}>{job.source.name}</a>
                  . Vrittih is not affiliated with {job.company} and does not process this application.
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
  empty: { maxWidth: 520, margin: "56px auto", textAlign: "center", padding: "0 20px" },
  emptyTitle: { font: "700 22px var(--font-sans)", color: "var(--brand-900, #0B1126)", margin: 0, letterSpacing: "-.02em" },
  emptyText: { font: "400 14px/1.6 var(--font-sans)", color: "var(--v-ink-3, #64748B)", margin: "12px 0 22px" },
  emptyBtns: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" },
  emptyPrimary: { font: "600 13.5px var(--font-sans)", color: "#fff", background: "var(--brand-600, #6495ED)", border: "none", borderRadius: 11, padding: "11px 18px", textDecoration: "none", cursor: "pointer" },
  emptySecondary: { font: "600 13.5px var(--font-sans)", color: "var(--brand-700, #334EAC)", background: "var(--v-surface, #fff)", border: "1px solid var(--v-line-2, #cdd6f5)", borderRadius: 11, padding: "11px 18px", textDecoration: "none", cursor: "pointer" },
  box: { border: "1px solid var(--v-line, #E6E3DA)", borderRadius: 14, padding: 20, background: "var(--v-surface, #fff)", marginTop: 8 },
  head: { fontSize: 17, fontWeight: 650, color: "var(--brand-900, #0B1126)", margin: 0 },
  sub: { fontSize: 13.5, color: "var(--v-ink-3, #94A3B8)", margin: "6px 0 16px", lineHeight: 1.5 },
  primary: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, width: "100%",
    background: "var(--brand-600, #6495ED)", color: "#fff", border: "none", borderRadius: 11,
    padding: "13px 16px", cursor: "pointer", textAlign: "left", marginBottom: 10,
  },
  opt: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%",
    border: "1px solid var(--v-line-2, #E9EDF2)", borderRadius: 11, padding: "13px 16px",
    textDecoration: "none", marginBottom: 10, background: "var(--v-bg, #F7F9FC)", boxSizing: "border-box",
    color: "var(--v-ink, #1F2937)",
  },
  optBody: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  optMain: { fontSize: 14.5, fontWeight: 600, color: "inherit" },
  optSub: { fontSize: 12, color: "var(--v-ink-3, #94A3B8)" },
  optSubOn: { fontSize: 12, color: "rgba(255,255,255,.8)" },
  ext: { fontSize: 16, color: "var(--v-ink-3, #94A3B8)", flexShrink: 0 },
  note: { fontSize: 12, color: "var(--v-ink-3, #94A3B8)", lineHeight: 1.5, margin: "2px 0 0" },
  // Deadline banner — for public-sector notices this is the single most important fact.
  deadline: {
    display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, margin: "12px 0 0",
    padding: "9px 14px", borderRadius: 999, fontSize: 13.5, width: "fit-content",
    background: "var(--brand-100, #EAF1FE)", color: "var(--brand-900, #0B1126)",
  },
  deadlineUrgent: { background: "#FDF0DC", color: "#7A4B12" },
  deadlineClosed: { background: "#F3F0EA", color: "#6B6B6B" },
  srcLink: { color: "var(--brand-600, #6495ED)", fontWeight: 600 },
  warn: {
    fontSize: 12.5, lineHeight: 1.55, color: "#7A4B12", background: "#FDF3E3",
    border: "1px solid #F0DFC0", borderRadius: 9, padding: "10px 12px", margin: "0 0 10px",
  },
}