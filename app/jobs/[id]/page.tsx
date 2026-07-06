"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import styles from "@/styles/jobdetail.module.css"
import { IconBanknote } from "@/components/ui/Icons"

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
            <div className={styles.logo}>{job.company.slice(0,2).toUpperCase()}</div>
            <div>
              <h1 className={styles.title}>{job.title}</h1>
              <div className={styles.meta}>{job.company} · {job.location} · {job.type}</div>
            </div>
          </div>

          {job.salary && <div className={styles.salaryBadge} style={{display:"inline-flex",alignItems:"center",gap:7}}><IconBanknote size={15} /> {job.salary}</div>}

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
            <button onClick={() => setShowForm(true)} className={styles.applyBtn}>
              Apply now
            </button>
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