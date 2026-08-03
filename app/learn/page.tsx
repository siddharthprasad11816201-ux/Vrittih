"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import CompanyLogo from "@/components/vrittih/CompanyLogo"
import { IconSearch, IconArrowRight, IconBriefcase, IconBanknote } from "@/components/ui/Icons"

/* Learn & Earn — one hub, a toggle between two intents:
 *   Learn = internships (earn a stipend while you learn) — saffron/amber, book.
 *   Earn  = full-time / contract / freelance / part-time — green (money), cash.
 * Colour encodes meaning (cognitive mapping: green = money/earn; warm saffron =
 * knowledge/learn — and saffron+green reads intentionally for an Indian audience).
 * One accent per mode; everything else stays neutral. */

// Advanced open-book glyph for the Learn side (code-authored SVG, themes via stroke).
const BookIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 6.6C10.4 5.4 8.3 4.9 6 4.9c-1 0-2 .1-2.9.3v12.9c.9-.2 1.9-.3 2.9-.3 2.3 0 4.4.5 6 1.7" />
    <path d="M12 6.6c1.6-1.2 3.7-1.7 6-1.7 1 0 2 .1 2.9.3v12.9c-.9-.2-1.9-.3-2.9-.3-2.3 0-4.4.5-6 1.7z" />
    <path d="M12 6.6v12.9" />
  </svg>
)

const MODES = {
  learn: { key: "learn", label: "Learn", accent: "#B45309", soft: "#FEF3E2", type: "INTERNSHIP",
    title: "Internships that pay while you learn.", sub: "Real roles at real companies — earn a stipend, build experience, and track every stage live.", pay: "Stipend on offer" },
  earn: { key: "earn", label: "Earn", accent: "#1F9D5B", soft: "#E7F8EE", type: "FULLTIME,PARTTIME,CONTRACT,FREELANCE",
    title: "Full-time, contract and freelance work.", sub: "Roles ranked to your fit across every employment type — apply once, track through every stage.", pay: "Pay disclosed by employer" },
} as const

export default function LearnEarnPage() {
  const [mode, setMode] = useState<"learn" | "earn">("learn")
  const [jobs, setJobs] = useState<any[] | null>(null)
  const [q, setQ] = useState("")
  const [remote, setRemote] = useState(false)
  const m = MODES[mode]

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("mode")
    if (s === "earn" || s === "learn") setMode(s)
  }, [])

  const load = () => {
    const p = new URLSearchParams({ type: m.type })
    if (q.trim()) p.set("q", q.trim())
    if (remote) p.set("remote", "true")
    setJobs(null)
    fetch(`/api/jobs?${p}`).then(r => r.json()).then(d => setJobs(d.jobs || [])).catch(() => setJobs([]))
  }
  useEffect(() => { load() }, [mode, remote])

  const switchMode = (next: "learn" | "earn") => { setMode(next); setJobs(null); window.history.replaceState(null, "", `/learn?mode=${next}`) }

  return (
    <AppShell>
      <div style={S.wrap}>
        {/* Toggle */}
        <div style={S.toggle} role="tablist" aria-label="Learn or Earn">
          {(["learn", "earn"] as const).map(k => {
            const on = mode === k, mm = MODES[k]
            return (
              <button key={k} role="tab" aria-selected={on} onClick={() => switchMode(k)}
                style={{ ...S.toggleBtn, ...(on ? { background: mm.soft, color: mm.accent, borderColor: mm.accent } : {}) }}>
                <span style={{ display: "inline-flex", color: on ? mm.accent : "var(--v-ink-3)" }}>
                  {k === "learn" ? <BookIcon size={18} /> : <IconBanknote size={18} />}
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.2 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{mm.label}</span>
                  <span style={{ fontSize: 11.5, color: on ? mm.accent : "var(--v-ink-3)", opacity: on ? .85 : 1 }}>{k === "learn" ? "Internships" : "Jobs & gigs"}</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Hero (mode-tinted) */}
        <section style={{ ...S.hero, background: m.soft, borderColor: m.accent + "33" }}>
          <span style={{ ...S.kicker, color: m.accent, background: "var(--v-surface)" }}>{mode === "learn" ? "Learn & Earn" : "Earn"}</span>
          <h1 style={S.h1}>{m.title}</h1>
          <p style={S.sub}>{m.sub}</p>
          <form onSubmit={e => { e.preventDefault(); load() }} style={S.searchRow}>
            <span style={S.searchWrap}>
              <span style={{ display: "inline-flex", color: "var(--v-ink-3)" }}><IconSearch size={17} /></span>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={mode === "learn" ? "Search internships by role, company or skill" : "Search jobs by role, company or skill"} style={S.searchInput} />
            </span>
            <button type="submit" style={{ ...S.searchBtn, background: m.accent }}>Search</button>
            <label style={S.remote}><input type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)} /> Remote</label>
          </form>
        </section>

        {jobs === null ? (
          <div style={S.dim}>Loading {mode === "learn" ? "internships" : "roles"}…</div>
        ) : jobs.length === 0 ? (
          <div style={S.empty}>
            <div style={{ ...S.emptyIcon, background: m.soft, color: m.accent }}>{mode === "learn" ? <BookIcon size={22} /> : <IconBriefcase size={22} />}</div>
            <div style={S.emptyTitle}>No {mode === "learn" ? "internships" : "roles"} match yet</div>
            <p style={S.emptySub}>Try a broader search{mode === "learn" ? ", or switch to Earn for full-time and contract roles." : ", or switch to Learn for internships."}</p>
            <button onClick={() => switchMode(mode === "learn" ? "earn" : "learn")} style={{ ...S.cta, background: MODES[mode === "learn" ? "earn" : "learn"].accent }}>Switch to {mode === "learn" ? "Earn" : "Learn"} <IconArrowRight size={15} /></button>
          </div>
        ) : (
          <>
            <div style={S.count}>{jobs.length} {mode === "learn" ? "internship" : "role"}{jobs.length === 1 ? "" : "s"}</div>
            <div style={S.grid}>
              {jobs.map(j => (
                <Link key={j.id} href={`/jobs/${j.id}`} className="ln-card" style={S.card}>
                  <div style={S.cardTop}>
                    <CompanyLogo name={j.company} size={40} radius={10} />
                    <div style={{ minWidth: 0 }}>
                      <div style={S.cardTitle}>{j.title}</div>
                      <div style={S.cardCompany}>{j.company}</div>
                    </div>
                  </div>
                  <div style={S.tags}>
                    <span style={S.tag}>{j.location}</span>
                    {j.remote && <span style={S.tag}>Remote</span>}
                    {mode === "earn" && j.type && <span style={S.tag}>{j.type.toLowerCase()}</span>}
                  </div>
                  <div style={S.cardFoot}>
                    <span style={S.stipend}>{j.salary || m.pay}</span>
                    <span style={{ ...S.apply, color: m.accent }}>Apply <IconArrowRight size={13} /></span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `.ln-card:hover{ border-color:var(--border-strong) !important; }` }} />
    </AppShell>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 },
  toggle: { display: "inline-flex", gap: 6, padding: 5, background: "var(--v-surface-2)", border: "1px solid var(--border)", borderRadius: 14, width: "fit-content" },
  toggleBtn: { display: "inline-flex", alignItems: "center", gap: 10, padding: "9px 16px", borderRadius: 10, border: "1px solid transparent", background: "transparent", color: "var(--v-ink-2)", cursor: "pointer", font: "400 14px var(--font-sans)" },
  hero: { border: "1px solid", borderRadius: "var(--r-lg)", padding: "24px 26px" },
  kicker: { display: "inline-block", font: "600 11px var(--font-sans)", letterSpacing: ".08em", textTransform: "uppercase", borderRadius: 999, padding: "3px 10px", marginBottom: 12 },
  h1: { font: "500 26px var(--font-display)", color: "var(--v-ink)", letterSpacing: "-.02em", margin: 0 },
  sub: { font: "400 14.5px/1.6 var(--font-sans)", color: "var(--v-ink-2)", marginTop: 8, maxWidth: "62ch" },
  searchRow: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 16 },
  searchWrap: { display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 220, height: 42, padding: "0 13px", background: "var(--v-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" },
  searchInput: { flex: 1, border: "none", background: "none", outline: "none", font: "400 14px var(--font-sans)", color: "var(--v-ink)" },
  searchBtn: { color: "#fff", border: "none", borderRadius: "var(--r-md)", padding: "0 20px", height: 42, font: "500 14px var(--font-sans)", cursor: "pointer" },
  remote: { display: "inline-flex", alignItems: "center", gap: 6, font: "400 13.5px var(--font-sans)", color: "var(--v-ink-2)", cursor: "pointer" },
  dim: { padding: 40, textAlign: "center", font: "400 14px var(--font-sans)", color: "var(--v-ink-3)" },
  count: { font: "400 13px var(--font-sans)", color: "var(--v-ink-3)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 },
  card: { display: "flex", flexDirection: "column", gap: 12, background: "var(--v-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 16, textDecoration: "none" },
  cardTop: { display: "flex", gap: 12, alignItems: "center" },
  cardTitle: { font: "500 15px var(--font-sans)", color: "var(--v-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardCompany: { font: "400 13px var(--font-sans)", color: "var(--v-ink-3)", marginTop: 1 },
  tags: { display: "flex", flexWrap: "wrap", gap: 6 },
  tag: { font: "400 11.5px var(--font-sans)", color: "var(--v-ink-2)", background: "var(--v-surface-2)", borderRadius: 999, padding: "3px 10px", textTransform: "capitalize" },
  cardFoot: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 11, marginTop: "auto" },
  stipend: { font: "500 13px var(--font-sans)", color: "var(--v-ink)" },
  apply: { display: "inline-flex", alignItems: "center", gap: 4, font: "500 13px var(--font-sans)" },
  empty: { textAlign: "center", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 14, display: "grid", placeItems: "center" },
  emptyTitle: { font: "500 16px var(--font-display)", color: "var(--v-ink)" },
  emptySub: { font: "400 13.5px var(--font-sans)", color: "var(--v-ink-3)", maxWidth: "40ch" },
  cta: { display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, color: "#fff", border: "none", borderRadius: "var(--r-md)", padding: "10px 18px", font: "500 13.5px var(--font-sans)", textDecoration: "none", cursor: "pointer" },
}
