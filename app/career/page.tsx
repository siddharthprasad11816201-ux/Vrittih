"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import DnaPanel from "@/components/career/DnaPanel"
import ProgressPanel from "@/components/career/ProgressPanel"
import PathSimulatorPanel from "@/components/career/PathSimulatorPanel"
import FrontierPanel from "@/components/career/FrontierPanel"
import DocumentUpload from "@/components/career/DocumentUpload"

/* ICIRE — the Career Intelligence dashboard: the whole in-house engine for the
 * logged-in applicant in one place — DNA, skill graph, best-fit roles, growth,
 * career paths, and document ingestion. Anonymous users get a sign-in prompt. */

type Skill = { skill: string; confidence: number; level: string; category: string; implied: boolean }
type Match = { id: string; title: string; company: string; remote: boolean; overall: number; projectedMatch: number; matched: string[]; missing: { skill: string; difficulty: string }[]; transferable: { skill: string; via: string }[]; label: string }
type Feedback = { skill: string; direction: "up" | "down"; liftPct: number }
type Dashboard = { skills: Skill[]; stats: { total: number; demonstrated: number; strengths: string[]; jobsConsidered: number }; matches: Match[]; feedback?: Feedback[] | null }

const tierColor = (n: number) => (n >= 75 ? "#16A34A" : n >= 55 ? "#6495ED" : n >= 35 ? "#B45309" : "#94A3B8")

export default function CareerPage() {
  const [d, setD] = useState<Dashboard | null>(null)
  const [state, setState] = useState<"loading" | "anon" | "ready" | "error">("loading")

  const load = () => fetch("/api/career/dashboard").then((r) => {
    if (r.status === 401) { setState("anon"); return null }
    if (!r.ok) { setState("error"); return null }
    return r.json()
  }).then((j) => { if (j) { setD(j); setState("ready") } }).catch(() => setState("error"))
  useEffect(() => { load() }, [])

  if (state === "loading") return <AppShell><div style={S.loading}>Loading your Career Intelligence…</div></AppShell>
  if (state === "error") return <AppShell><div style={S.loading}>Couldn't load your Career Intelligence right now. <button onClick={load} style={{ marginLeft: 8, color: "#6495ED", background: "none", border: "none", cursor: "pointer", font: "inherit", textDecoration: "underline" }}>Retry</button></div></AppShell>
  if (state === "anon") return (
    <AppShell>
      <div style={S.wrap}>
        <div style={S.card}>
          <h1 style={S.h1}>Career Intelligence</h1>
          <p style={S.muted}>Sign in to see your Career DNA, best-fit roles, a skills breakdown, growth over time and personalised career paths — all computed in-house from your profile.</p>
          <Link href="/login?next=/career" style={S.cta}>Sign in</Link>
        </div>
      </div>
    </AppShell>
  )
  if (!d) return null

  return (
    <AppShell>
      <div style={S.wrap}>
        <div style={S.header}>
          <h1 style={S.h1}>Career Intelligence</h1>
          <p style={S.lede}>Your professional profile, understood — and turned into a plan. All in-house, explainable, and based only on your real evidence.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <Link href="/career/coach" style={{ ...S.coachCta, marginTop: 0 }}>Ask the AI coach →</Link>
            <Link href="/career/readiness" style={{ ...S.coachCta, marginTop: 0, background: "var(--v-surface,#fff)", color: "#334EAC", border: "1px solid #cdd6f5", boxShadow: "none" }}>Role readiness &amp; plan →</Link>
          </div>
          <div style={S.statRow}>
            <Stat n={d.stats.total} label="skills mapped" />
            <Stat n={d.stats.demonstrated} label="demonstrated" />
            <Stat n={d.stats.jobsConsidered} label="roles considered" />
            <Stat n={d.matches.length} label="strong matches" />
          </div>
        </div>

        <DnaPanel />

        {d.skills.length > 0 && (
          <div style={S.panel}>
            <div style={S.panelTitle}>Skill graph</div>
            <div style={S.skills}>
              {d.skills.map((s) => (
                <div key={s.skill} style={S.skillRow}>
                  <span style={S.skillName}>{s.skill}{s.implied && <span style={S.impl}>inferred</span>}</span>
                  <div style={S.skillTrack}><div style={{ ...S.skillFill, width: `${Math.round(s.confidence * 100)}%`, background: tierColor(Math.round(s.confidence * 100)) }} /></div>
                  <span style={S.skillLvl}>{s.level}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {d.matches.length > 0 && (
          <div style={S.panel}>
            <div style={S.panelTitle}>Best-fit roles for you</div>
            <div style={S.matches}>
              {d.matches.map((m) => (
                <Link key={m.id} href={`/jobs/${m.id}`} style={S.match}>
                  <div style={S.matchTop}>
                    <div style={S.matchTitle}>{m.title}<span style={S.matchCo}> · {m.company}</span></div>
                    <span style={{ ...S.matchScore, color: tierColor(m.overall) }}>{m.overall}%</span>
                  </div>
                  <div style={S.matchChips}>
                    {m.matched.map((s) => <span key={s} style={S.chipOk}>{s}</span>)}
                    {m.missing.map((x) => <span key={x.skill} style={S.chipMiss}>{x.skill}</span>)}
                  </div>
                  {m.transferable?.length > 0 && (
                    <div style={S.matchTransfer}>Transferable: {m.transferable.map((t, i) => (
                      <span key={t.skill}>{i > 0 ? ", " : ""}<b>{t.via}</b> → {t.skill}</span>
                    ))}</div>
                  )}
                  {m.projectedMatch > m.overall && <div style={S.matchProj}>→ up to {m.projectedMatch}% after closing the gap</div>}
                </Link>
              ))}
            </div>
          </div>
        )}

        {d.feedback && d.feedback.length > 0 && (
          <div style={S.panel}>
            <div style={S.panelTitle}>What employers actually advance</div>
            <p style={S.panelSub}>Learned in-house from real, decided applications — anonymised, never tied to any person or employer.</p>
            <div style={S.matchChips}>
              {d.feedback.map((f) => (
                <span key={f.skill} style={f.direction === "up" ? S.chipOk : S.chipMiss}>
                  {f.skill} {f.direction === "up" ? "+" : "−"}{f.liftPct}%
                </span>
              ))}
            </div>
          </div>
        )}

        <ProgressPanel />
        <PathSimulatorPanel />
        <FrontierPanel />

        <div style={S.panel}>
          <div style={S.panelTitle}>Add documents</div>
          <p style={S.panelSub}>Upload your résumé or transcript — we read it in-house and sharpen every analysis above.</p>
          <DocumentUpload onChange={load} />
        </div>
      </div>
    </AppShell>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return <div style={S.stat}><span style={S.statNum}>{n}</span><span style={S.statLabel}>{label}</span></div>
}

const S: Record<string, any> = {
  wrap: { maxWidth: 860, margin: "0 auto", padding: "8px 4px 40px" },
  loading: { padding: 40, font: "400 14px var(--font-sans)", color: "#64748B" },
  header: { marginBottom: 22 },
  h1: { font: "700 26px var(--font-sans)", color: "#1F2937", letterSpacing: "-.02em", margin: 0 },
  lede: { font: "400 14px/1.6 var(--font-sans)", color: "#64748B", margin: "8px 0 0", maxWidth: 620 },
  coachCta: { display: "inline-block", marginTop: 14, font: "600 13.5px var(--font-sans)", color: "#fff", background: "linear-gradient(135deg,#6495ED,#334EAC)", border: "none", borderRadius: 11, padding: "10px 18px", textDecoration: "none", boxShadow: "0 14px 30px -16px rgba(51,78,172,.7)" },
  muted: { font: "400 14px/1.6 var(--font-sans)", color: "#64748B", margin: "10px 0 18px" },
  cta: { display: "inline-block", background: "#6495ED", color: "#fff", borderRadius: 11, padding: "10px 18px", font: "600 13.5px var(--font-sans)", textDecoration: "none" },
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "28px 26px", maxWidth: 560, margin: "20px auto" },
  statRow: { display: "flex", flexWrap: "wrap", gap: 22, marginTop: 18 },
  stat: { display: "flex", flexDirection: "column" },
  statNum: { font: "700 22px var(--font-sans)", color: "#334EAC", lineHeight: 1 },
  statLabel: { font: "400 12px var(--font-sans)", color: "#94A3B8", marginTop: 3 },
  panel: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "20px 22px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", margin: "0 0 20px" },
  panelTitle: { font: "600 17px var(--font-sans)", color: "#1F2937", letterSpacing: "-.01em", marginBottom: 14 },
  panelSub: { font: "400 12.5px var(--font-sans)", color: "#94A3B8", margin: "-8px 0 14px" },
  skills: { display: "flex", flexDirection: "column", gap: 9 },
  skillRow: { display: "flex", alignItems: "center", gap: 10 },
  skillName: { font: "500 13px var(--font-sans)", color: "#334155", width: 150, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 },
  impl: { font: "500 9.5px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".03em", color: "#94A3B8", background: "#F1F5F9", borderRadius: 5, padding: "1px 5px" },
  skillTrack: { flex: 1, height: 7, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" },
  skillFill: { height: "100%", borderRadius: 999 },
  skillLvl: { font: "500 11.5px var(--font-sans)", color: "#94A3B8", width: 74, textAlign: "right" },
  matches: { display: "flex", flexDirection: "column", gap: 10 },
  match: { display: "block", border: "1px solid #E9EDF2", borderRadius: 12, padding: "13px 15px", textDecoration: "none", background: "#F7F9FC" },
  matchTop: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
  matchTitle: { font: "600 14px var(--font-sans)", color: "#1F2937" },
  matchCo: { font: "400 12.5px var(--font-sans)", color: "#94A3B8" },
  matchScore: { font: "700 16px var(--font-sans)", fontVariantNumeric: "tabular-nums" },
  matchChips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chipOk: { font: "600 11.5px var(--font-sans)", background: "#EAF1FE", color: "#2F6BE0", borderRadius: 7, padding: "3px 8px" },
  chipMiss: { font: "600 11.5px var(--font-sans)", background: "#F1F5F9", color: "#94A3B8", borderRadius: 7, padding: "3px 8px" },
  matchProj: { font: "400 12px var(--font-sans)", color: "#16A34A", marginTop: 7 },
  matchTransfer: { font: "400 11.5px var(--font-sans)", color: "#7C6FD8", marginTop: 6 },
}
