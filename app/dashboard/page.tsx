"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import EmptyState from "@/components/vrittih/EmptyState"
import PipelineRail from "@/components/vrittih/PipelineRail"
import PipelineDonut from "@/components/vrittih/PipelineDonut"
import AstroJobCard from "@/components/vrittih/AstroJobCard"
import { dailyGuidance } from "@/lib/astrology"
import { basicActive, trialActive, trialDaysLeft } from "@/lib/trial"
import {
  IconBriefcase, IconFileText, IconUsers, IconVideo, IconAward, IconCheckCircle,
  IconArrowRight, IconCheck, IconUser, IconShield, IconTarget, IconClipboard,
  IconNetwork, IconSettings,
} from "@/components/ui/Icons"

/* Overview — rebuilt to the redesign brief. One typeface system (display headings
 * in Bricolage via --font-display), uniform metric cards (no per-card colour), the
 * pipeline stage rail as the signature, zero-state that leads with the next action,
 * and full-width content. Recruiters keep the compact pipeline donut. */

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [applications, setApplications] = useState<any[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [profile, setProfile] = useState<{ birthDate: string | null; birthTime: string | null; experience: any[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (!d.user) { router.push("/login"); return }
      setUser(d.user); loadData(d.user)
    })
  }, [])

  async function loadData(u: any) {
    const isEmp = ["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(u.role)
    // Profile (birth details) for everyone — powers the daily astrological guidance
    // (advanced tiers + admins) and the best-fit card (seekers).
    const prof = await fetch("/api/profile").then(r => r.json()).catch(() => ({}))
    setProfile({ birthDate: prof?.user?.profile?.birthDate || null, birthTime: prof?.user?.profile?.birthTime || null, experience: prof?.user?.experience || [] })
    if (isEmp) {
      const [jobsData, appsData] = await Promise.all([
        fetch("/api/jobs?mine=true").then(r => r.json()),
        fetch("/api/applications?employer=true").then(r => r.json()),
      ])
      setJobs(jobsData.jobs || []); setApplications(appsData.applications || [])
    } else {
      const appsData = await fetch("/api/applications").then(r => r.json())
      setApplications(appsData.applications || [])
    }
    setLoading(false)
  }

  if (loading) return <AppShell><div style={S.loading}>Loading your overview…</div></AppShell>

  const isEmployer = ["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(user?.role)
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(user?.role)
  const paid = basicActive(user)   // Basic access = paid, on a plan, or active trial
  const onTrial = trialActive(user)
  // Daily astrological guidance — advanced tiers (Pro / Growth / Scale) + admins.
  const advancedTier = isAdmin || ["pro", "emp_growth", "emp_scale"].includes(user?.plan || "")
  const guidance = advancedTier ? dailyGuidance(profile?.birthDate) : null
  const first = (user?.name?.split(" ")[0] || "there").replace(/^Super$/, "Admin")
  const hour = new Date().getHours()
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"
  const count = (fn: (a: any) => boolean) => applications.filter(fn).length

  // Onboarding — the same for both, leads the page while incomplete.
  const steps = [
    { done: !!(user?.headline && user?.location), title: "Complete your profile", desc: "Add a headline and location", href: "/profile/edit", icon: <IconUser size={16} /> },
    { done: !!user?.idVerified, title: "Verify your identity", desc: isEmployer ? "Unlock full employer access" : "Stand out to employers", href: "/verify/doc-verify", icon: <IconShield size={16} /> },
    isEmployer
      ? { done: jobs.length > 0, title: "Post your first job", desc: "Start receiving applicants", href: "/dashboard/post-job", icon: <IconBriefcase size={16} /> }
      : { done: applications.length > 0, title: "Apply to your first job", desc: "Browse roles matched to you", href: "/jobs", icon: <IconBriefcase size={16} /> },
    { done: !!user?.twoFactorEnabled, title: "Turn on two-factor security", desc: "Protect your account", href: "/account?section=security", icon: <IconCheckCircle size={16} /> },
  ]
  const doneCount = steps.filter(s => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)
  const setupOpen = doneCount < steps.length
  const empty = applications.length === 0

  const seekerMetrics = [
    { label: "Applications", value: applications.length, href: "/applications", action: "Browse jobs" },
    { label: "Interviews", value: count(a => a.status === "INTERVIEW"), href: "/applications", action: null }, // video room hidden for now
    { label: "Offers", value: count(a => a.status === "OFFERED"), href: "/applications", action: null },
    { label: "Hired", value: count(a => a.status === "HIRED"), href: "/applications", action: null },
  ]
  const railStages = [
    { label: "Applied", count: count(a => a.status === "APPLIED") },
    { label: "Screening", count: count(a => ["REVIEWED", "SHORTLISTED", "ASSESSMENT"].includes(a.status)) },
    { label: "Interview", count: count(a => a.status === "INTERVIEW") },
    { label: "Offer", count: count(a => a.status === "OFFERED") },
    { label: "Hired", count: count(a => a.status === "HIRED") },
  ]

  const STATUS: Record<string, { bg: string; fg: string; label: string }> = {
    APPLIED: { bg: "var(--v-accent-soft)", fg: "var(--v-accent)", label: "Applied" },
    REVIEWED: { bg: "var(--v-accent-soft)", fg: "var(--v-accent)", label: "Reviewed" },
    SHORTLISTED: { bg: "var(--v-green-soft)", fg: "var(--v-green)", label: "Shortlisted" },
    ASSESSMENT: { bg: "var(--v-green-soft)", fg: "var(--v-green)", label: "Assessment" },
    INTERVIEW: { bg: "#FEF3E2", fg: "var(--warn)", label: "Interview" },
    OFFERED: { bg: "var(--v-green-soft)", fg: "var(--v-green)", label: "Offer" },
    HIRED: { bg: "var(--v-green-soft)", fg: "var(--v-green)", label: "Hired" },
    REJECTED: { bg: "#FDECEC", fg: "var(--danger)", label: "Closed" },
  }
  const timeAgo = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return d === 0 ? "Today" : d === 1 ? "Yesterday" : `${d}d ago` }

  const Setup = () => (
    <section style={S.card}>
      <div style={S.setupHead}>
        <Ring pct={pct} />
        <div>
          <h2 style={S.h2}>{empty ? "Get set up" : "Finish setting up"}</h2>
          <p style={S.sub}>{doneCount} of {steps.length} done — a complete profile gets {isEmployer ? "better applicants" : "seen by more employers"}.</p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map(s => (
          <Link key={s.title} href={s.href} className="d-step" style={S.step}>
            <span style={{ ...S.stepCheck, ...(s.done ? S.stepDone : {}) }}>{s.done ? <IconCheck size={14} /> : s.icon}</span>
            <span style={{ flex: 1 }}>
              <span style={{ ...S.stepTitle, ...(s.done ? { color: "var(--v-ink-3)", textDecoration: "line-through" } : {}) }}>{s.title}</span>
              <span style={S.stepDesc}>{s.desc}</span>
            </span>
            {!s.done && <IconArrowRight size={15} />}
          </Link>
        ))}
      </div>
    </section>
  )

  return (
    <AppShell>
      <style dangerouslySetInnerHTML={{ __html: `
        .d-step:hover{ border-color:var(--border-strong) !important; }
        .d-metric:hover{ border-color:var(--border-strong) !important; }
        .d-row:hover{ background:var(--v-surface-2); }
        @media (max-width: 900px){ .d-grid{ grid-template-columns:1fr !important; } .d-metrics{ grid-template-columns:repeat(2,1fr) !important; } }
      ` }} />
      <div style={S.wrap}>
        <header style={S.head}>
          <div>
            <h1 style={S.h1}>Overview</h1>
            <p style={S.greeting}>Good {partOfDay}, {first}</p>
            {guidance && <p style={S.advice}><span style={S.adviceStar} aria-hidden="true">✦</span> {guidance.line}</p>}
            {onTrial && !isEmployer && <p style={S.trial}>Free trial · {trialDaysLeft(user)} day{trialDaysLeft(user) === 1 ? "" : "s"} left · {applications.length}/10 applications used · <Link href="/pay" style={{ color: "var(--v-accent)", textDecoration: "none", fontWeight: 500 }}>Upgrade</Link></p>}
          </div>
          <Link href={isEmployer ? "/dashboard/post-job" : "/jobs"} style={S.primary}>
            {isEmployer ? "Post a job" : "Browse jobs"} <IconArrowRight size={15} />
          </Link>
        </header>

        {/* Zero-state leads with setup; otherwise setup sits after the numbers. */}
        {empty && setupOpen && <Setup />}

        {isEmployer ? (
          <PipelineDonut title="Hiring pipeline" segments={[
            { label: "Applications", value: applications.length, color: "#6495ED", icon: <IconFileText size={16} />, href: "/dashboard/pipeline" },
            { label: "Interviews", value: count(a => a.status === "INTERVIEW"), color: "#F59E0B", icon: <IconVideo size={16} />, href: "/dashboard/pipeline" },
            { label: "Offers", value: count(a => a.status === "OFFERED"), color: "#0EA5E9", icon: <IconAward size={16} />, href: "/dashboard/pipeline" },
            { label: "Hired", value: count(a => a.status === "HIRED"), color: "#22C55E", icon: <IconCheckCircle size={16} />, href: "/dashboard/pipeline" },
          ]} />
        ) : (
          <div style={S.metrics} className="d-metrics">
            {seekerMetrics.map(m => (
              <Link key={m.label} href={m.href} className="d-metric" style={S.metric}>
                <span style={S.metricLabel}>{m.label}</span>
                <span style={S.metricNum}>{m.value}</span>
                {m.value === 0 && m.action && <span style={S.metricAction}>{m.action} <IconArrowRight size={12} /></span>}
              </Link>
            ))}
          </div>
        )}

        <div style={S.grid} className="d-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            {/* Signature: the pipeline stage rail (seekers). */}
            {!isEmployer && (
              <section style={S.card}>
                <div style={S.cardHead}><h2 style={S.h2}>Your pipeline</h2>{!empty && <Link href="/applications" style={S.link}>All applications <IconArrowRight size={13} /></Link>}</div>
                {empty
                  ? <EmptyState title="Nothing in your pipeline yet" reason="Apply to a role and watch it move here in real time — from first click to offer." ctaLabel="Browse jobs" ctaHref="/jobs" />
                  : <PipelineRail stages={railStages} />}
              </section>
            )}

            {/* Astrological best-fit career — paid (Basic) unlock, applicant home board */}
            {!isEmployer && <AstroJobCard paid={paid} birthDate={profile?.birthDate} birthTime={profile?.birthTime} experience={profile?.experience || []} />}

            {!empty && setupOpen && <Setup />}

            {/* Recent activity */}
            <section style={S.card}>
              <div style={S.cardHead}>
                <h2 style={S.h2}>{isEmployer ? "Recent applicants" : "Recent applications"}</h2>
                <Link href={isEmployer ? "/dashboard/recruiter" : "/applications"} style={S.link}>View all <IconArrowRight size={13} /></Link>
              </div>
              {applications.length === 0 ? (
                <EmptyState
                  title={isEmployer ? "No applicants yet" : "No applications yet"}
                  reason={isEmployer ? "Post a job and candidates appear here, ranked by fit." : "Your applications will show here with live status."}
                  ctaLabel={isEmployer ? "Post a job" : "Browse jobs"}
                  ctaHref={isEmployer ? "/dashboard/post-job" : "/jobs"}
                />
              ) : (
                <div>
                  {applications.slice(0, 6).map(a => {
                    const st = STATUS[a.status] || STATUS.APPLIED
                    return (
                      <Link key={a.id} href={isEmployer ? `/jobs/${a.job?.id}` : "/applications"} className="d-row" style={S.appRow}>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={S.appTitle}>{isEmployer ? a.user?.name : a.job?.title}</span>
                          <span style={S.appSub}>{(isEmployer ? a.job?.title : a.job?.company) || ""} · {timeAgo(a.appliedAt || a.updatedAt)}</span>
                        </span>
                        <span style={{ ...S.badge, background: st.bg, color: st.fg }}>{st.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right rail — quick access */}
          <aside style={S.card}>
            <div style={S.cardHead}><h2 style={S.h2}>Quick access</h2></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {(isEmployer ? [
                { href: "/dashboard/post-job", icon: <IconFileText size={16} />, t: "Post a job" },
                { href: "/dashboard/recruiter", icon: <IconUsers size={16} />, t: "Best candidates" },
                // Built-in video-call (Interviews) hidden for all tiers for now.
                { href: "/tests/create", icon: <IconClipboard size={16} />, t: "Create assessment" },
                { href: "/account", icon: <IconSettings size={16} />, t: "Account & security" },
              ] : [
                { href: "/jobs/match", icon: <IconTarget size={16} />, t: "Matched for you" },
                { href: "/resume", icon: <IconFileText size={16} />, t: "Build your résumé" },
                { href: "/network", icon: <IconNetwork size={16} />, t: "Grow your network" },
                { href: "/account", icon: <IconSettings size={16} />, t: "Account & security" },
              ]).map(q => (
                <Link key={q.href} href={q.href} className="d-row" style={S.quick}>
                  <span style={S.quickIcon}>{q.icon}</span>
                  <span style={S.quickText}>{q.t}</span>
                  <IconArrowRight size={14} />
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}

function Ring({ pct }: { pct: number }) {
  const size = 56, sw = 6, r = (size - sw) / 2, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--v-surface-2)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--v-accent)" strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" style={{ font: "500 14px var(--font-sans)", fill: "var(--v-ink)" }}>{pct}%</text>
    </svg>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 1120, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", font: "400 14px var(--font-sans)", color: "var(--v-ink-3)" },

  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
  h1: { font: "500 22px var(--font-display)", color: "var(--v-ink)", letterSpacing: "-.01em", margin: 0 },
  greeting: { font: "400 15px var(--font-sans)", color: "var(--v-ink-2)", marginTop: 4 },
  advice: { font: "400 13px/1.55 var(--font-sans)", color: "var(--v-ink-2)", marginTop: 8, maxWidth: "64ch", display: "flex", gap: 7, alignItems: "baseline" },
  adviceStar: { color: "var(--v-accent)", flex: "none" },
  trial: { font: "500 12.5px var(--font-sans)", color: "var(--v-accent)", background: "var(--v-accent-soft)", borderRadius: "var(--r-md)", padding: "6px 11px", marginTop: 8, display: "inline-block" },
  primary: { display: "inline-flex", alignItems: "center", gap: 7, background: "var(--v-accent)", color: "#fff", padding: "10px 16px", borderRadius: "var(--r-md)", font: "500 14px var(--font-sans)", textDecoration: "none", flex: "none" },

  metrics: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 },
  metric: { display: "flex", flexDirection: "column", gap: 6, background: "var(--v-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "16px 18px", textDecoration: "none", minHeight: 92 },
  metricLabel: { font: "400 12px var(--font-sans)", color: "var(--v-ink-3)" },
  metricNum: { font: "500 24px var(--font-display)", color: "var(--v-ink)", letterSpacing: "-.01em", fontVariantNumeric: "tabular-nums", lineHeight: 1 },
  metricAction: { display: "inline-flex", alignItems: "center", gap: 3, font: "500 12px var(--font-sans)", color: "var(--v-accent)", marginTop: "auto" },

  grid: { display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" },
  card: { background: "var(--v-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  h2: { font: "500 16px var(--font-display)", color: "var(--v-ink)", letterSpacing: "-.01em", margin: 0 },
  sub: { font: "400 13px var(--font-sans)", color: "var(--v-ink-2)", marginTop: 3, maxWidth: "42ch" },
  link: { display: "inline-flex", alignItems: "center", gap: 4, font: "500 13px var(--font-sans)", color: "var(--v-accent)", textDecoration: "none" },

  setupHead: { display: "flex", alignItems: "center", gap: 14, marginBottom: 14 },
  step: { display: "flex", alignItems: "center", gap: 12, background: "var(--v-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "11px 13px", textDecoration: "none" },
  stepCheck: { width: 30, height: 30, borderRadius: "var(--r-md)", background: "var(--v-accent-soft)", color: "var(--v-accent)", display: "grid", placeItems: "center", flexShrink: 0 },
  stepDone: { background: "var(--v-green)", color: "#fff" },
  stepTitle: { display: "block", font: "500 14px var(--font-sans)", color: "var(--v-ink)" },
  stepDesc: { display: "block", font: "400 12.5px var(--font-sans)", color: "var(--v-ink-3)", marginTop: 1 },

  appRow: { display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderTop: "1px solid var(--border)", textDecoration: "none", borderRadius: 6 },
  appTitle: { display: "block", font: "500 14px var(--font-sans)", color: "var(--v-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  appSub: { display: "block", font: "400 12.5px var(--font-sans)", color: "var(--v-ink-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  badge: { font: "500 11.5px var(--font-sans)", padding: "3px 10px", borderRadius: "var(--r-pill)", flex: "none" },

  quick: { display: "flex", alignItems: "center", gap: 11, padding: "10px 10px", borderRadius: "var(--r-md)", textDecoration: "none", color: "var(--v-ink-2)" },
  quickIcon: { width: 30, height: 30, borderRadius: "var(--r-md)", background: "var(--v-surface-2)", color: "var(--v-accent)", display: "grid", placeItems: "center", flexShrink: 0 },
  quickText: { flex: 1, font: "500 13.5px var(--font-sans)", color: "var(--v-ink)" },
}
