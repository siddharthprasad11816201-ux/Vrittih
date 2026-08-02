"use client"
import { useEffect, useState } from "react"

/* ICIRE §14 — in-house résumé / ATS critique on the job page: a score, quick
 * stats, missing ATS keywords for this role, and specific weak-bullet fixes.
 * Hidden when logged out (the MatchPanel above handles the sign-in prompt). */

type Finding = { severity: "high" | "medium" | "low"; type: string; message: string; fix: string; bullet?: string }
type Review = {
  score: number
  stats: { bullets: number; quantified: number; strongVerbs: number; keywordCoverage: number }
  missingKeywords: string[]
  matchedKeywords: string[]
  findings: Finding[]
}
type Rewrite = { original: string; improved: string; reason: string }
type Enhance = {
  rewrites: Rewrite[]
  summary: string
  summaryNote?: string
  tailoring: { emphasizeSkills: string[]; leadBullets: string[]; note: string }
}

const scoreTone = (s: number) => (s >= 75 ? { c: "#16A34A", bg: "#E7F8EE" } : s >= 50 ? { c: "#B45309", bg: "#FEF3E2" } : { c: "#DC2626", bg: "#FDECEC" })
const sev: Record<Finding["severity"], { c: string; bg: string; label: string }> = {
  high: { c: "#DC2626", bg: "#FDECEC", label: "Fix" },
  medium: { c: "#B45309", bg: "#FEF3E2", label: "Improve" },
  low: { c: "#64748B", bg: "#F1F5F9", label: "Polish" },
}

export default function ResumeReviewPanel({ jobId }: { jobId: string }) {
  const [d, setD] = useState<Review | null>(null)
  const [enh, setEnh] = useState<Enhance | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading")
  const [all, setAll] = useState(false)
  const [tab, setTab] = useState<"review" | "improve">("review")

  useEffect(() => {
    let live = true
    fetch(`/api/career/resume-review/${jobId}`).then((r) => {
      if (!r.ok) { if (live) setState("hidden"); return null }
      return r.json()
    }).then((j) => { if (live && j?.review) { setD(j.review); setEnh(j.enhance || null); setState("ready") } }).catch(() => live && setState("hidden"))
    return () => { live = false }
  }, [jobId])

  if (state === "hidden") return null
  if (state === "loading" && !d) return <div style={S.card}><div style={S.muted}>Reviewing your résumé for this role…</div></div>
  if (!d) return null

  const t = scoreTone(d.score)
  const empty = d.stats.bullets === 0
  const shown = all ? d.findings : d.findings.slice(0, 4)

  return (
    <div style={S.card}>
      <div style={S.head}>
        <div>
          <div style={S.title}>Résumé check</div>
          <div style={S.sub}>How your profile reads to this role's recruiter and ATS</div>
        </div>
        <div style={{ ...S.score, color: t.c, background: t.bg }}><b style={{ fontSize: 18 }}>{d.score}</b><span style={{ opacity: .75 }}>/100</span></div>
      </div>

      {!empty && enh && (enh.rewrites.length > 0 || enh.summary || enh.tailoring.emphasizeSkills.length > 0) && (
        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(tab === "review" ? S.tabOn : {}) }} onClick={() => setTab("review")}>Review</button>
          <button style={{ ...S.tab, ...(tab === "improve" ? S.tabOn : {}) }} onClick={() => setTab("improve")}>Auto-improve</button>
        </div>
      )}

      {empty ? (
        <p style={S.warn}>Add your experience and projects to your profile so we can review your résumé against this role.</p>
      ) : tab === "improve" && enh ? (
        <div style={S.improve}>
          {enh.tailoring.emphasizeSkills.length > 0 && (
            <div style={S.block}>
              <div style={S.blockLabel}>Tailor for this role</div>
              <div style={S.tailorNote}>{enh.tailoring.note}</div>
              <div style={S.kwWrap}>{enh.tailoring.emphasizeSkills.map((k) => <span key={k} style={S.kwHave}>{k}</span>)}</div>
              {enh.tailoring.leadBullets.length > 0 && (
                <ul style={S.leadList}>
                  {enh.tailoring.leadBullets.map((b, i) => <li key={i} style={S.leadItem}>{b.length > 130 ? b.slice(0, 130) + "…" : b}</li>)}
                </ul>
              )}
            </div>
          )}

          {(enh.summary || enh.summaryNote) && (
            <div style={S.block}>
              <div style={S.blockLabel}>Suggested summary</div>
              {enh.summary ? <div style={S.summaryBox}>{enh.summary}</div> : <div style={S.tailorNote}>{enh.summaryNote}</div>}
            </div>
          )}

          {enh.rewrites.length > 0 && (
            <div style={S.block}>
              <div style={S.blockLabel}>Stronger bullets</div>
              <div style={S.rewrites}>
                {enh.rewrites.map((r, i) => (
                  <div key={i} style={S.rewrite}>
                    <div style={S.rwOld}><span style={S.rwTag}>Before</span>{r.original}</div>
                    <div style={S.rwNew}><span style={{ ...S.rwTag, color: "#166534", background: "#E7F8EE" }}>After</span>{r.improved}</div>
                    <div style={S.rwReason}>{r.reason}</div>
                  </div>
                ))}
              </div>
              <div style={S.disclaimer}>Suggestions only — edit to keep every claim true. Bracketed placeholders are for you to fill with real numbers.</div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={S.stats}>
            <div style={S.stat}><span style={S.statNum}>{d.stats.bullets}</span><span style={S.statLabel}>bullets</span></div>
            <div style={S.stat}><span style={S.statNum}>{d.stats.quantified}</span><span style={S.statLabel}>quantified</span></div>
            <div style={S.stat}><span style={S.statNum}>{d.stats.strongVerbs}</span><span style={S.statLabel}>action verbs</span></div>
            <div style={S.stat}><span style={S.statNum}>{d.stats.keywordCoverage}%</span><span style={S.statLabel}>keyword match</span></div>
          </div>

          {d.missingKeywords.length > 0 && (
            <div style={S.kwBlock}>
              <div style={S.kwLabel}>Keywords this role screens for — add where true:</div>
              <div style={S.kwWrap}>{d.missingKeywords.map((k) => <span key={k} style={S.kwMiss}>{k}</span>)}</div>
            </div>
          )}

          <div style={S.findings}>
            {shown.map((f, i) => {
              const s = sev[f.severity]
              return (
                <div key={i} style={S.finding}>
                  <span style={{ ...S.badge, color: s.c, background: s.bg }}>{s.label}</span>
                  <div style={S.fbody}>
                    <div style={S.fmsg}>{f.message}</div>
                    {f.bullet && <div style={S.fbullet}>“{f.bullet.length > 120 ? f.bullet.slice(0, 120) + "…" : f.bullet}”</div>}
                    <div style={S.ffix}>{f.fix}</div>
                  </div>
                </div>
              )
            })}
          </div>
          {d.findings.length > 4 && (
            <button style={S.more} onClick={() => setAll(!all)}>{all ? "Show less" : `Show ${d.findings.length - 4} more`}</button>
          )}
        </>
      )}
    </div>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", margin: "0 0 20px" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 14 },
  title: { font: "600 17px var(--font-sans)", color: "#1F2937", letterSpacing: "-.01em" },
  sub: { font: "400 12.5px var(--font-sans)", color: "#94A3B8", marginTop: 3 },
  muted: { font: "400 13.5px var(--font-sans)", color: "#64748B" },
  warn: { font: "400 13px/1.5 var(--font-sans)", color: "#92400E", background: "#FEF3E2", border: "1px solid #FADFB5", borderRadius: 11, padding: "12px 14px", margin: 0 },
  score: { font: "500 12.5px var(--font-sans)", borderRadius: 999, padding: "6px 14px", display: "inline-flex", alignItems: "baseline", gap: 3 },
  stats: { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  stat: { flex: "1 1 0", minWidth: 78, background: "#F7F9FC", border: "1px solid #EEF2F6", borderRadius: 11, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 },
  statNum: { font: "700 18px var(--font-sans)", color: "#1F2937" },
  statLabel: { font: "400 11.5px var(--font-sans)", color: "#94A3B8" },
  kwBlock: { marginBottom: 14 },
  kwLabel: { font: "500 12px var(--font-sans)", color: "#64748B", marginBottom: 7 },
  kwWrap: { display: "flex", flexWrap: "wrap", gap: 7 },
  kwMiss: { font: "500 12.5px var(--font-sans)", color: "#92400E", background: "#FEF3E2", border: "1px solid #FADFB5", borderRadius: 999, padding: "4px 11px" },
  findings: { display: "flex", flexDirection: "column", gap: 10 },
  finding: { display: "flex", gap: 11, alignItems: "flex-start" },
  badge: { font: "700 10px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".04em", borderRadius: 6, padding: "3px 7px", flexShrink: 0, marginTop: 1 },
  fbody: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 },
  fmsg: { font: "500 13px/1.45 var(--font-sans)", color: "#1F2937" },
  fbullet: { font: "400 12px/1.5 var(--font-sans)", color: "#94A3B8", fontStyle: "italic" },
  ffix: { font: "400 12.5px/1.5 var(--font-sans)", color: "#475569" },
  more: { marginTop: 12, font: "600 12.5px var(--font-sans)", color: "#334EAC", background: "#F3F6FF", border: "1px solid #E1E9FE", borderRadius: 9, padding: "7px 13px", cursor: "pointer" },
  tabs: { display: "inline-flex", gap: 4, background: "#F1F5F9", borderRadius: 999, padding: 3, marginBottom: 16 },
  tab: { font: "600 12.5px var(--font-sans)", color: "#64748B", background: "none", border: "none", borderRadius: 999, padding: "6px 14px", cursor: "pointer" },
  tabOn: { background: "#fff", color: "#334EAC", boxShadow: "0 1px 2px rgba(16,24,40,.08)" },
  improve: { display: "flex", flexDirection: "column", gap: 18 },
  block: { display: "flex", flexDirection: "column", gap: 8 },
  blockLabel: { font: "700 11px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".05em", color: "#94A3B8" },
  tailorNote: { font: "400 12.5px/1.5 var(--font-sans)", color: "#475569" },
  kwHave: { font: "500 12.5px var(--font-sans)", color: "#166534", background: "#E7F8EE", border: "1px solid #CDEFDB", borderRadius: 999, padding: "4px 11px" },
  leadList: { margin: "6px 0 0", padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 5 },
  leadItem: { font: "400 12.5px/1.5 var(--font-sans)", color: "#334155" },
  summaryBox: { font: "400 13px/1.55 var(--font-sans)", color: "#1F2937", background: "#F7F9FC", border: "1px solid #E9EDF2", borderRadius: 11, padding: "12px 14px" },
  rewrites: { display: "flex", flexDirection: "column", gap: 12 },
  rewrite: { display: "flex", flexDirection: "column", gap: 5, background: "#F7F9FC", border: "1px solid #E9EDF2", borderRadius: 11, padding: "12px 14px" },
  rwOld: { font: "400 12.5px/1.5 var(--font-sans)", color: "#94A3B8", textDecoration: "line-through", display: "flex", gap: 8, alignItems: "baseline" },
  rwNew: { font: "500 13px/1.5 var(--font-sans)", color: "#1F2937", display: "flex", gap: 8, alignItems: "baseline" },
  rwTag: { font: "700 9px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".04em", color: "#94A3B8", background: "#EEF2F6", borderRadius: 5, padding: "2px 6px", flexShrink: 0 },
  rwReason: { font: "400 11.5px var(--font-sans)", color: "#94A3B8" },
  disclaimer: { font: "400 11.5px/1.5 var(--font-sans)", color: "#94A3B8", marginTop: 2 },
}
