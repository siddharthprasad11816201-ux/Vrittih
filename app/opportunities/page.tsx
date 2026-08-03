"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconCheckCircle, IconArrowRight, IconLock, IconUsers } from "@/components/ui/Icons"

interface OppJob {
  id: string; title: string; company: string; remote?: boolean
  roleLabel: string; seniorityLabel: string
  overall: number; technical: number; confidence: number; band: string
  matched: string[]; missing: { skill: string; difficulty: string; prepDays: number }[]
  why: string[]; alreadyApplied: boolean; applyMode: "profile" | "manual"
}
interface OppGroup {
  key: string; cluster: string; clusterLabel: string; seniority: string; seniorityLabel: string
  roleLabels: string[]; employers: string[]; size: number; sharedSkills: string[]; cohesion: number
  readiness: { best: number; avg: number; ready: number }; eligibleCount: number; why: string
  jobs: OppJob[]
}

const bandColor = (b: string) => b === "Ready" ? "var(--v-green)" : b === "Competitive" ? "var(--v-accent)" : b === "Stretch" ? "var(--v-amber)" : "var(--v-ink-3)"

export default function OpportunitiesPage() {
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(true)
  const [groups, setGroups] = useState<OppGroup[]>([])
  const [stats, setStats] = useState<any>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [coverLetter, setCoverLetter] = useState("")
  const [applying, setApplying] = useState(false)
  const [results, setResults] = useState<any[] | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch("/api/opportunities/groups")
      if (r.status === 401) { setAuthed(false); setLoading(false); return }
      const d = await r.json()
      setGroups(d.groups || []); setStats(d.stats || null)
      if (d.groups?.[0]) setOpen(d.groups[0].key)
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const selectedIds = useMemo(() => Object.keys(selected).filter(id => selected[id]), [selected])
  const toggle = (id: string) => setSelected(s => ({ ...s, [id]: !s[id] }))
  function selectAllEligible(g: OppGroup) {
    setSelected(s => {
      const next = { ...s }
      for (const j of g.jobs) if (!j.alreadyApplied && j.applyMode === "profile") next[j.id] = true
      return next
    })
  }

  async function applyBatch() {
    if (!selectedIds.length) return
    setApplying(true); setResults(null)
    try {
      const d = await fetch("/api/applications/batch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: selectedIds, coverLetter }),
      }).then(r => r.json())
      setResults(d.results || [])
      setSelected({})
      await load()   // refresh readiness + applied flags
    } catch {} finally { setApplying(false) }
  }

  if (!authed) return (
    <AppShell title="Opportunities">
      <div style={S.page}><div style={S.empty}>
        <h1 style={S.h1}>Sign in to see your opportunities</h1>
        <p style={S.sub}>ICAE discovers the roles that fit your profile across every employer.</p>
        <Link href="/login" style={S.cta}>Sign in <IconArrowRight size={15} /></Link>
      </div></div>
    </AppShell>
  )

  return (
    <AppShell title="Opportunities">
      <div style={S.page}>
        <header style={S.head}>
          <div>
            <h1 style={S.h1}>Opportunity groups</h1>
            <p style={S.sub}>Related roles across employers, matched to your profile. Review a group, then apply to one, some, or all eligible roles at once.</p>
          </div>
          {stats && (
            <div style={S.statRow}>
              <Stat n={stats.groups} l="groups" />
              <Stat n={stats.opportunities} l="roles" />
              <Stat n={stats.employers} l="employers" />
            </div>
          )}
        </header>

        {loading ? <div style={S.empty}><p style={S.sub}>Discovering opportunities…</p></div>
        : groups.length === 0 ? (
          <div style={S.empty}>
            <h2 style={S.h2}>No matching groups yet</h2>
            <p style={S.sub}>Add skills, projects and experience to your profile so ICAE can find and cluster the roles that fit you.</p>
            <Link href="/career" style={S.cta}>Build your Career profile <IconArrowRight size={15} /></Link>
          </div>
        ) : (
          <div style={S.groups}>
            {groups.map(g => {
              const isOpen = open === g.key
              return (
                <div key={g.key} style={S.gcard}>
                  <button style={S.ghead} onClick={() => setOpen(isOpen ? null : g.key)}>
                    <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                      <div style={S.gtitle}>{g.clusterLabel} · <span style={{ color: "var(--v-ink-2)" }}>{g.seniorityLabel}</span></div>
                      <div style={S.gmeta}>
                        <span style={S.gmetaItem}><IconUsers size={13} /> {g.employers.length || g.size} {g.employers.length === 1 ? "employer" : "employers"}</span>
                        <span style={S.dot} />
                        <span>{g.size} {g.size === 1 ? "role" : "roles"}</span>
                        {g.eligibleCount > 0 && <><span style={S.dot} /><span style={{ color: "var(--v-green)" }}>{g.eligibleCount} one-click eligible</span></>}
                      </div>
                    </div>
                    <div style={S.gright}>
                      <span style={{ ...S.badge, color: "#fff", background: bandColor(g.readiness.best >= 75 ? "Ready" : g.readiness.best >= 60 ? "Competitive" : g.readiness.best >= 45 ? "Stretch" : "Aspirational") }}>{g.readiness.best}% best fit</span>
                      <span style={{ ...S.chev, transform: isOpen ? "rotate(90deg)" : "none" }}><IconArrowRight size={16} /></span>
                    </div>
                  </button>

                  {isOpen && (
                    <div style={S.gbody}>
                      <p style={S.why}>{g.why}</p>
                      {g.roleLabels.length > 1 && (
                        <div style={S.chips}>{g.roleLabels.map(r => <span key={r} style={S.chip}>{r}</span>)}</div>
                      )}
                      {g.sharedSkills.length > 0 && (
                        <div style={S.sharedRow}><span style={S.sharedLbl}>Shared skills</span>{g.sharedSkills.map(s => <span key={s} style={S.skchip}>{s}</span>)}</div>
                      )}

                      <div style={S.rowActions}>
                        <button style={S.linkBtn} onClick={() => selectAllEligible(g)}>Select all eligible</button>
                      </div>

                      <div style={S.jobs}>
                        {g.jobs.map(j => (
                          <div key={j.id} style={S.job}>
                            <div style={S.jobSel}>
                              {j.alreadyApplied ? (
                                <span title="Applied" style={{ color: "var(--v-green)" }}><IconCheckCircle size={18} /></span>
                              ) : j.applyMode === "profile" ? (
                                <input type="checkbox" checked={!!selected[j.id]} onChange={() => toggle(j.id)} style={S.cb} aria-label={`Select ${j.title}`} />
                              ) : (
                                <span title="Needs the full application" style={{ color: "var(--v-ink-3)" }}><IconLock size={15} /></span>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={S.jobTop}>
                                <Link href={`/jobs/${j.id}`} style={S.jobTitle}>{j.title}</Link>
                                <span style={{ ...S.band, color: bandColor(j.band) }}>{j.overall}% · {j.band}</span>
                              </div>
                              <div style={S.jobSub}>{j.company}{j.remote ? " · Remote" : ""} · {j.roleLabel}</div>
                              {j.matched.length > 0 && <div style={S.miniRow}><span style={S.miniLbl}>You have</span>{j.matched.slice(0, 4).map(s => <span key={s} style={S.have}>{s}</span>)}</div>}
                              {j.missing.length > 0 && <div style={S.miniRow}><span style={S.miniLbl}>Gaps</span>{j.missing.slice(0, 3).map(m => <span key={m.skill} style={S.gap}>{m.skill}<em>{m.prepDays}d</em></span>)}</div>}
                              {j.alreadyApplied
                                ? <div style={S.appliedTag}>Applied</div>
                                : j.applyMode === "manual"
                                  ? <Link href={`/jobs/${j.id}/apply`} style={S.manualLink}>This employer needs documents / questions — apply individually <IconArrowRight size={12} /></Link>
                                  : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* batch apply bar */}
      {selectedIds.length > 0 && (
        <div style={S.bar}>
          <div style={S.barInner}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.barTitle}>{selectedIds.length} role{selectedIds.length > 1 ? "s" : ""} selected</div>
              <input value={coverLetter} onChange={e => setCoverLetter(e.target.value)} placeholder="Optional: one cover note sent to all selected employers" style={S.barInput} />
            </div>
            <button onClick={applyBatch} disabled={applying} style={{ ...S.applyBtn, ...(applying ? { opacity: .6 } : {}) }}>
              {applying ? "Applying…" : <>Apply to {selectedIds.length} <IconArrowRight size={15} /></>}
            </button>
          </div>
        </div>
      )}

      {/* results modal */}
      {results && (
        <div style={S.modalWrap} onClick={() => setResults(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h2 style={S.h2}>Batch results</h2>
            <div style={S.resList}>
              {results.map((r, i) => (
                <div key={i} style={S.resRow}>
                  <span style={{ ...S.resDot, background: r.status === "applied" ? "var(--v-green)" : r.status === "already_applied" ? "var(--v-ink-3)" : r.status === "needs_manual" ? "var(--v-amber)" : "var(--v-red)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.resTitle}>{r.title || r.jobId} <span style={{ color: "var(--v-ink-3)", fontWeight: 400 }}>· {r.company}</span></div>
                    <div style={S.resStatus}>{
                      r.status === "applied" ? "Applied ✓" :
                      r.status === "already_applied" ? "Already applied" :
                      r.status === "needs_manual" ? (r.reason || "Needs the full application") :
                      r.status === "capped" ? (r.reason || "Trial limit reached") : (r.reason || "Could not submit")
                    }</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setResults(null)} style={S.cta}>Done</button>
          </div>
        </div>
      )}
    </AppShell>
  )
}

function Stat({ n, l }: { n: number; l: string }) {
  return <div style={S.stat}><div style={S.statN}>{n}</div><div style={S.statL}>{l}</div></div>
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 920, margin: "0 auto", paddingBottom: 120 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 20 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(22px,3vw,28px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0 },
  h2: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--v-ink)", margin: "0 0 12px" },
  sub: { fontSize: 14, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 560 },
  statRow: { display: "flex", gap: 10 },
  stat: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "10px 16px", textAlign: "center", minWidth: 76 },
  statN: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--v-accent)" },
  statL: { fontSize: 11.5, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".04em", marginTop: 2 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "48px 28px", textAlign: "center" },
  cta: { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 20px", fontSize: 14, fontWeight: 600, textDecoration: "none", cursor: "pointer", marginTop: 16 },
  groups: { display: "flex", flexDirection: "column", gap: 12 },
  gcard: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--v-shadow-sm)" },
  ghead: { display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "16px 18px", background: "none", border: "none", cursor: "pointer", font: "inherit" },
  gtitle: { fontFamily: "var(--font-display)", fontSize: 16.5, fontWeight: 600, color: "var(--v-ink)", letterSpacing: "-.01em" },
  gmeta: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--v-ink-2)", marginTop: 4, flexWrap: "wrap" },
  gmetaItem: { display: "inline-flex", alignItems: "center", gap: 5 },
  dot: { width: 3, height: 3, borderRadius: "50%", background: "var(--v-ink-3)" },
  gright: { display: "flex", alignItems: "center", gap: 12, flexShrink: 0 },
  chev: { color: "var(--v-ink-3)", display: "grid", placeItems: "center", transition: "transform .2s var(--v-ease)" },
  badge: { fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 999, whiteSpace: "nowrap" },
  gbody: { padding: "4px 18px 18px", borderTop: "1px solid var(--v-line-2)" },
  why: { fontSize: 13, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "12px 0 12px" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: { fontSize: 12, fontWeight: 500, color: "var(--v-accent-2)", background: "var(--v-accent-soft)", padding: "4px 10px", borderRadius: 999 },
  sharedRow: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 12 },
  sharedLbl: { fontSize: 11.5, fontWeight: 600, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".04em", marginRight: 4 },
  skchip: { fontSize: 12, color: "var(--v-ink-2)", background: "var(--v-surface-2)", padding: "3px 9px", borderRadius: 6 },
  rowActions: { display: "flex", justifyContent: "flex-end", marginBottom: 8 },
  linkBtn: { background: "none", border: "none", color: "var(--v-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline", padding: 0, font: "inherit" },
  jobs: { display: "flex", flexDirection: "column", gap: 8 },
  job: { display: "flex", gap: 12, padding: "12px 14px", background: "var(--v-surface-2)", borderRadius: 12, border: "1px solid var(--v-line-2)" },
  jobSel: { paddingTop: 2, flexShrink: 0, display: "grid", placeItems: "center", width: 20 },
  cb: { width: 17, height: 17, accentColor: "var(--v-accent)", cursor: "pointer" },
  jobTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" },
  jobTitle: { fontSize: 14.5, fontWeight: 600, color: "var(--v-ink)", textDecoration: "none" },
  band: { fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },
  jobSub: { fontSize: 12.5, color: "var(--v-ink-2)", marginTop: 2 },
  miniRow: { display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginTop: 7 },
  miniLbl: { fontSize: 11, fontWeight: 600, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".03em", marginRight: 2 },
  have: { fontSize: 11.5, color: "var(--v-green)", background: "var(--v-green-soft)", padding: "2px 8px", borderRadius: 6, fontWeight: 500 },
  gap: { fontSize: 11.5, color: "var(--v-amber)", background: "rgba(180,83,9,.08)", padding: "2px 8px", borderRadius: 6, fontWeight: 500, display: "inline-flex", gap: 5, alignItems: "center" },
  appliedTag: { fontSize: 11.5, color: "var(--v-green)", fontWeight: 600, marginTop: 8 },
  manualLink: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--v-amber)", textDecoration: "none", fontWeight: 500, marginTop: 8 },
  bar: { position: "fixed", left: 0, right: 0, bottom: 0, padding: "12px 16px", zIndex: 40, pointerEvents: "none" },
  barInner: { maxWidth: 720, margin: "0 auto", background: "var(--v-ink)", color: "#fff", borderRadius: 16, padding: "12px 14px 12px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "var(--v-shadow-lg)", pointerEvents: "auto" },
  barTitle: { fontSize: 13, fontWeight: 600, marginBottom: 6 },
  barInput: { width: "100%", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 9, padding: "8px 11px", fontSize: 13, color: "#fff", outline: "none", fontFamily: "inherit" },
  applyBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 11, padding: "12px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  modalWrap: { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "grid", placeItems: "center", zIndex: 60, padding: 20 },
  modal: { background: "var(--v-surface)", borderRadius: 18, padding: 24, width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", boxShadow: "var(--v-shadow-lg)" },
  resList: { display: "flex", flexDirection: "column", gap: 8, margin: "4px 0 18px" },
  resRow: { display: "flex", gap: 11, alignItems: "flex-start", padding: "9px 0", borderBottom: "1px solid var(--v-line-2)" },
  resDot: { width: 9, height: 9, borderRadius: "50%", marginTop: 5, flexShrink: 0 },
  resTitle: { fontSize: 13.5, fontWeight: 600, color: "var(--v-ink)" },
  resStatus: { fontSize: 12.5, color: "var(--v-ink-2)", marginTop: 2, lineHeight: 1.5 },
}
