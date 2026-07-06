"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconBookmark, IconBanknote, IconGlobe, IconFolder, IconArrowRight } from "@/components/ui/Icons"

const timeAgo = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d <= 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`
}

export default function SavedJobs() {
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const d = await fetch("/api/jobs/save").then(r => r.ok ? r.json() : { jobs: [] })
    setJobs(d.jobs || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function unsave(jobId: string) {
    setJobs(js => js.filter(j => j.id !== jobId))
    await fetch("/api/jobs/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) })
  }

  return (
    <AppShell title="Saved jobs">
      <div style={S.wrap}>
        <header style={S.head}>
          <div>
            <h1 style={S.title}>Saved jobs</h1>
            <p style={S.sub}>Roles you bookmarked to apply to later.</p>
          </div>
          <Link href="/jobs" style={S.cta}>Browse all jobs <IconArrowRight size={15} /></Link>
        </header>

        {loading ? (
          <div style={S.list}>{[0, 1].map(i => <div key={i} className="v-skeleton" style={{ height: 96, borderRadius: 14 }} />)}</div>
        ) : jobs.length === 0 ? (
          <div style={S.empty}>
            <span style={S.emptyIc}><IconBookmark size={22} /></span>
            <p style={S.emptyTitle}>No saved jobs yet</p>
            <p style={S.emptyText}>Tap the bookmark on any job to keep it here for later.</p>
            <Link href="/jobs" style={S.cta}>Find jobs</Link>
          </div>
        ) : (
          <div style={S.list}>
            {jobs.map(job => (
              <div key={job.id} style={S.card}>
                <Link href={`/jobs/${job.id}`} style={S.cardMain}>
                  <div style={S.logo}>{job.company?.slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.jobTitle}>{job.title}</div>
                    <div style={S.jobMeta}>{job.company} · {job.location}</div>
                    <div style={S.metaRow}>
                      {job.salary && <span style={S.meta}><IconBanknote size={13} /> {job.salary}</span>}
                      {job.remote && <span style={S.meta}><IconGlobe size={13} /> Remote</span>}
                      <span style={S.meta}><IconFolder size={13} /> {job.industry}</span>
                      <span style={S.metaTime}>{timeAgo(job.createdAt)}</span>
                    </div>
                  </div>
                </Link>
                <button onClick={() => unsave(job.id)} style={S.unsave} aria-label="Remove from saved"><IconBookmark size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 820, margin: "0 auto", padding: "clamp(1.25rem,3vw,2rem)" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 20 },
  title: { fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem,3vw,2rem)", fontWeight: 600, color: "var(--v-ink)", letterSpacing: "-.02em" },
  sub: { fontSize: 14, color: "var(--v-ink-2)", marginTop: 4 },
  cta: { display: "inline-flex", alignItems: "center", gap: 7, background: "var(--brand-600)", color: "#fff", padding: "10px 18px", borderRadius: 999, fontSize: 14, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: { display: "flex", alignItems: "stretch", gap: 8, background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 8, boxShadow: "var(--v-shadow-sm)" },
  cardMain: { display: "flex", gap: 14, alignItems: "flex-start", flex: 1, minWidth: 0, textDecoration: "none", padding: 8 },
  logo: { width: 46, height: 46, borderRadius: 11, background: "var(--brand-100)", color: "var(--brand-700)", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 15, flexShrink: 0 },
  jobTitle: { fontSize: 15.5, fontWeight: 650, color: "var(--v-ink)" },
  jobMeta: { fontSize: 13, color: "var(--v-ink-2)", marginTop: 2 },
  metaRow: { display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, alignItems: "center" },
  meta: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--v-ink-3)" },
  metaTime: { fontSize: 12, color: "var(--v-ink-3)", fontFamily: "var(--font-mono)" },
  unsave: { alignSelf: "flex-start", display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 10, border: "none", background: "var(--brand-100)", color: "var(--brand-600)", cursor: "pointer", flexShrink: 0 },
  empty: { textAlign: "center", padding: "3rem 1rem", background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 18 },
  emptyIc: { display: "grid", placeItems: "center", width: 58, height: 58, borderRadius: 15, background: "var(--brand-100)", color: "var(--brand-600)", margin: "0 auto 14px" },
  emptyTitle: { fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: "var(--v-ink)" },
  emptyText: { fontSize: 14, color: "var(--v-ink-2)", margin: "6px auto 18px", maxWidth: "38ch" },
}
