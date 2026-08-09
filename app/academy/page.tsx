"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconMonitor, IconCheckCircle, IconArrowRight, IconAward } from "@/components/ui/Icons"

export default function AcademyPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [tab, setTab] = useState<"browse" | "learning" | "author" | "path">("browse")
  const [data, setData] = useState<any>(null)
  const [open, setOpen] = useState<any>(null)      // course detail
  const [openLesson, setOpenLesson] = useState<string | null>(null) // expanded lesson body
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState("")
  // author
  const [nc, setNc] = useState({ title: "", summary: "", level: "MID", category: "", skills: "", competencies: "" })
  const [nl, setNl] = useState({ title: "", type: "reading", durationMin: 10, contentMd: "", resourceUrl: "" })
  // path
  const [pathSkills, setPathSkills] = useState(""); const [path, setPath] = useState<any>(null)

  async function load() {
    try { const r = await fetch("/api/courses"); if (r.status === 401) { setState("denied"); return } setData(await r.json()); setState("ok") } catch { setState("denied") }
  }
  useEffect(() => { load() }, [])
  // Deep-link: /academy?course=<slug> auto-opens that course (e.g. from the career coach).
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("course")
    if (slug) openCourse(slug)
  }, [])
  async function openCourse(idOrSlug: string) {
    setOpen(null); setOpenLesson(null); setErr("")
    try {
      const r = await fetch(`/api/courses/${idOrSlug}`); const d = await r.json().catch(() => null)
      if (r.ok && d?.course) setOpen(d); else setErr(d?.error || "Couldn't open that course.")
    } catch { setErr("Couldn't open that course.") }
  }
  async function courseAction(courseId: string, body: any, reopen = true) {
    setBusy("act"); setErr("")
    try {
      const r = await fetch(`/api/courses/${courseId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => null)
      if (!r.ok || d?.error) setErr(d?.error || "That action didn't go through.")
      if (reopen && open?.course) await openCourse(open.course.id); await load()
    } catch { setErr("Network error.") } finally { setBusy(null) }
  }
  async function createCourse() {
    if (!nc.title.trim()) { setErr("Course title required."); return }
    setBusy("create"); setErr("")
    try {
      const d = await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...nc, skills: nc.skills.split(",").map(s => s.trim()).filter(Boolean), competencies: nc.competencies.split(",").map(s => s.trim()).filter(Boolean) }) }).then(r => r.json())
      if (d.error) setErr(d.error); else { setNc({ title: "", summary: "", level: "MID", category: "", skills: "", competencies: "" }); await load(); await openCourse(d.id) }
    } finally { setBusy(null) }
  }
  async function genPath() {
    const skills = pathSkills.split(",").map(s => s.trim()).filter(Boolean)
    if (!skills.length) return
    setBusy("path"); try { setPath(await fetch("/api/learning/path", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skills }) }).then(r => r.json())) } finally { setBusy(null) }
  }

  if (state === "loading") return <AppShell title="Academy"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Academy"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in to learn</h1></div></div></AppShell>

  const tabs: [string, string][] = [["browse", "Browse"], ["learning", `My learning (${data?.enrollments?.length || 0})`], ["path", "Learning path"]]
  if (data?.canAuthor) tabs.push(["author", "Author"])

  return (
    <AppShell title="Academy">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconMonitor size={20} /> Academy</h1>
          <p style={S.sub}>Competency‑mapped learning. Completing a course produces real competency evidence and a verifiable certificate — the same skill graph you're hired on.</p>
        </header>
        {err && <div style={S.err}>{err}</div>}
        <div style={S.tabs}>{tabs.map(([k, l]) => <button key={k} style={{ ...S.tab, ...(tab === k ? S.tabOn : {}) }} onClick={() => setTab(k as any)}>{l}</button>)}</div>

        {tab === "browse" && (
          (data?.courses || []).length === 0 ? <div style={S.empty}><p style={S.sub}>No published courses yet.</p></div> : (
            <div style={S.grid}>
              {data.courses.map((c: any) => (
                <button key={c.id} style={S.card} onClick={() => openCourse(c.id)}>
                  <div style={S.cardTitle}>{c.title}</div>
                  <div style={S.cardSub}>{c.level} · {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"}{c.author ? ` · ${c.author.name}` : ""}</div>
                  {c.skills?.length > 0 && <div style={S.chips}>{c.skills.slice(0, 4).map((s: string) => <span key={s} style={S.chip}>{s}</span>)}</div>}
                  <span style={S.enrollTag}>{c.enrolled ? "Continue" : "View"} <IconArrowRight size={13} /></span>
                </button>
              ))}
            </div>
          )
        )}

        {tab === "learning" && (
          (data?.enrollments || []).length === 0 ? <div style={S.empty}><p style={S.sub}>You haven't enrolled in anything yet.</p></div> : (
            <div style={S.list}>
              {data.enrollments.map((e: any) => (
                <button key={e.id} style={S.enrollRow} onClick={() => openCourse(e.courseId)}>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div style={S.cardTitle}>{e.course.title}</div>
                    <div style={S.bar}><div style={{ ...S.barFill, width: `${e.progressPct}%`, background: e.status === "COMPLETED" ? "var(--v-green)" : "var(--v-accent)" }} /></div>
                  </div>
                  {e.status === "COMPLETED" ? <span style={S.doneTag}><IconAward size={14} /> Certified</span> : <span style={S.pctTag}>{e.progressPct}%</span>}
                </button>
              ))}
            </div>
          )
        )}

        {tab === "path" && (
          <div>
            <div style={S.searchRow}>
              <input style={{ ...S.input, flex: 1 }} placeholder="Target skills, comma-separated (e.g. React, System Design)" value={pathSkills} onChange={e => setPathSkills(e.target.value)} onKeyDown={e => { if (e.key === "Enter") genPath() }} />
              <button style={S.cta} onClick={genPath} disabled={busy === "path"}>{busy === "path" ? "…" : "Build path"}</button>
            </div>
            {path && (path.steps?.length === 0 ? <div style={S.empty}><p style={S.sub}>No courses cover those skills yet.</p></div> : (
              <div style={S.list}>
                {path.steps.map((s: any) => (
                  <button key={s.courseId} style={S.enrollRow} onClick={() => openCourse(s.courseId)}>
                    <span style={S.stepN}>{s.order}</span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}><div style={S.cardTitle}>{s.title}</div><div style={S.cardSub}>Builds: {s.newlyCovers.join(", ")}</div></div>
                    <IconArrowRight size={15} />
                  </button>
                ))}
                {path.uncovered?.length > 0 && <p style={S.note}>Not yet covered by any course: {path.uncovered.join(", ")}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === "author" && data?.canAuthor && (
          <div>
            <div style={S.cardPlain}>
              <div style={S.cardH}>New course</div>
              <div style={S.grid2}>
                <input style={S.input} placeholder="Title" value={nc.title} onChange={e => setNc({ ...nc, title: e.target.value })} />
                <input style={S.input} placeholder="Category (e.g. backend)" value={nc.category} onChange={e => setNc({ ...nc, category: e.target.value })} />
                <input style={S.input} placeholder="Skills taught (comma-separated)" value={nc.skills} onChange={e => setNc({ ...nc, skills: e.target.value })} />
                <input style={S.input} placeholder="Competency keys (comma-separated)" value={nc.competencies} onChange={e => setNc({ ...nc, competencies: e.target.value })} />
              </div>
              <input style={{ ...S.input, marginTop: 10 }} placeholder="Summary" value={nc.summary} onChange={e => setNc({ ...nc, summary: e.target.value })} />
              <button style={{ ...S.cta, marginTop: 10 }} onClick={createCourse} disabled={busy === "create"}>{busy === "create" ? "…" : "Create draft"}</button>
            </div>
            <div style={S.list}>
              {(data?.mine || []).map((c: any) => (
                <button key={c.id} style={S.enrollRow} onClick={() => openCourse(c.id)}>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}><div style={S.cardTitle}>{c.title}</div><div style={S.cardSub}>{c.status} · {c.lessonCount} lessons</div></div>
                  <IconArrowRight size={15} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* course detail modal */}
      {open?.course && (
        <div style={S.modalWrap} onClick={() => setOpen(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.mHead}>
              <div><div style={S.mTitle}>{open.course.title}</div><div style={S.cardSub}>{open.course.level} · {open.course.status}{open.course.author ? ` · ${open.course.author.name}` : ""}</div></div>
              {open.enrollment?.status === "COMPLETED"
                ? <span style={S.doneTag}><IconAward size={14} /> Certified</span>
                : open.enrollment
                  ? <span style={S.pctTag}>{open.enrollment.progressPct}%</span>
                  : <button style={S.cta} onClick={() => courseAction(open.course.id, { action: "enroll" })} disabled={busy === "act"}>Enroll</button>}
            </div>
            {err && <div style={S.err}>{err}</div>}
            {open.course.summary && <p style={S.sub}>{open.course.summary}</p>}
            {open.enrollment?.certificateCode && <a href={`/verify/cert/${open.enrollment.certificateCode}`} style={S.certLink}><IconAward size={13} /> View certificate</a>}
            <div style={S.lessons}>
              {(open.lessons || []).map((l: any) => {
                const canRead = !!(open.enrollment || open.course.isAuthor)
                const isOpen = openLesson === l.id
                return (
                  <div key={l.id} style={S.lessonWrap}>
                    <div style={S.lesson}>
                      <span style={{ color: l.done ? "var(--v-green)" : "var(--v-ink-3)", display: "grid", placeItems: "center" }}><IconCheckCircle size={17} /></span>
                      <button style={S.lessonToggle} onClick={() => canRead && setOpenLesson(isOpen ? null : l.id)} disabled={!canRead}>
                        <div style={S.lTitle}>{l.title}</div>
                        <div style={S.lSub}>{l.type} · {l.durationMin} min{l.section ? ` · ${l.section}` : ""}{canRead ? (isOpen ? " · Hide" : " · Open") : ""}</div>
                      </button>
                      {open.enrollment && !l.done && <button style={S.miniBtn} disabled={busy === "act"} onClick={() => courseAction(open.course.id, { action: "complete-lesson", lessonId: l.id })}>Mark done</button>}
                    </div>
                    {isOpen && canRead && (
                      <div style={S.lessonBody}>
                        {l.contentMd && <div style={S.lessonContent}>{l.contentMd}</div>}
                        {l.resourceUrl && <a href={l.resourceUrl} target="_blank" rel="noopener noreferrer" style={S.resourceLink}><IconArrowRight size={13} /> {l.type === "video" ? "Watch" : "Open"} resource</a>}
                        {!l.contentMd && !l.resourceUrl && <p style={S.lSub}>No content added yet.</p>}
                        <div style={S.lMeta}>{l.durationMin} min</div>
                      </div>
                    )}
                  </div>
                )
              })}
              {(open.lessons || []).length === 0 && <p style={S.sub}>No lessons yet.</p>}
            </div>
            {open.course.isAuthor && (
              <div style={S.authorBox}>
                <div style={S.cardH}>Add lesson</div>
                <div style={S.grid2}>
                  <input style={S.input} placeholder="Lesson title" value={nl.title} onChange={e => setNl({ ...nl, title: e.target.value })} />
                  <select style={S.input} value={nl.type} onChange={e => setNl({ ...nl, type: e.target.value })}>{(open.lessonTypes || ["reading"]).map((t: string) => <option key={t} value={t}>{t}</option>)}</select>
                </div>
                <textarea style={{ ...S.input, marginTop: 10, minHeight: 96, resize: "vertical", lineHeight: 1.6 }} placeholder="Lesson content (markdown or plain text)" value={nl.contentMd} onChange={e => setNl({ ...nl, contentMd: e.target.value })} />
                <div style={{ ...S.grid2, marginTop: 10 }}>
                  {nl.type === "video" && <input style={S.input} placeholder="Resource / video URL" value={nl.resourceUrl} onChange={e => setNl({ ...nl, resourceUrl: e.target.value })} />}
                  <input style={S.input} type="number" min={1} max={600} placeholder="Duration (min)" value={nl.durationMin} onChange={e => setNl({ ...nl, durationMin: Number(e.target.value) })} />
                </div>
                <div style={S.authorActions}>
                  <button style={S.ghost} onClick={() => { if (nl.title.trim()) { courseAction(open.course.id, { action: "add-lesson", ...nl }); setNl({ title: "", type: "reading", durationMin: 10, contentMd: "", resourceUrl: "" }) } }} disabled={busy === "act"}>Add lesson</button>
                  {open.course.status !== "PUBLISHED" && <button style={S.cta} onClick={() => courseAction(open.course.id, { action: "publish" })} disabled={busy === "act"}>Publish course</button>}
                </div>
              </div>
            )}
            <button style={{ ...S.ghost, marginTop: 12 }} onClick={() => setOpen(null)}>Close</button>
          </div>
        </div>
      )}
    </AppShell>
  )
}

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 900, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 16 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 640 },
  err: { background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#B91C1C", margin: "12px 0" },
  tabs: { display: "flex", gap: 4, background: "var(--v-surface-2)", padding: 4, borderRadius: 12, margin: "16px 0", width: "fit-content", flexWrap: "wrap" },
  tab: { padding: "8px 15px", border: "none", background: "none", borderRadius: 9, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--v-ink-2)", cursor: "pointer" },
  tabOn: { background: "var(--v-surface)", color: "var(--v-ink)", boxShadow: "var(--v-shadow-sm)" },
  cta: { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  ghost: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-surface)", color: "var(--v-ink)", border: "1px solid var(--v-line)", borderRadius: 10, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "40px 24px", textAlign: "center" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  card: { textAlign: "left", background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 15, cursor: "pointer", font: "inherit", boxShadow: "var(--v-shadow-sm)", display: "flex", flexDirection: "column" },
  cardPlain: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 16, marginBottom: 14 },
  cardH: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--v-ink)", marginBottom: 12 },
  cardTitle: { fontSize: 14.5, fontWeight: 600, color: "var(--v-ink)" },
  cardSub: { fontSize: 12.5, color: "var(--v-ink-2)", marginTop: 2 },
  chips: { display: "flex", flexWrap: "wrap", gap: 5, margin: "8px 0" },
  chip: { fontSize: 11.5, color: "var(--v-accent-2)", background: "var(--v-accent-soft)", padding: "2px 8px", borderRadius: 6 },
  enrollTag: { marginTop: "auto", paddingTop: 8, fontSize: 12.5, fontWeight: 600, color: "var(--v-accent)", display: "inline-flex", alignItems: "center", gap: 5 },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  enrollRow: { display: "flex", alignItems: "center", gap: 12, width: "100%", background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "12px 15px", cursor: "pointer", font: "inherit", boxShadow: "var(--v-shadow-sm)" },
  bar: { height: 6, background: "var(--v-surface-2)", borderRadius: 999, overflow: "hidden", marginTop: 8 },
  barFill: { height: "100%", borderRadius: 999 },
  pctTag: { fontSize: 13, fontWeight: 700, color: "var(--v-accent)" },
  doneTag: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "var(--v-green)" },
  stepN: { minWidth: 26, height: 26, borderRadius: "50%", background: "var(--v-accent-soft)", color: "var(--v-accent-2)", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 },
  searchRow: { display: "flex", gap: 8, marginBottom: 14 },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, color: "var(--v-ink)", outline: "none", fontFamily: "inherit", width: "100%", background: "var(--v-surface)" },
  note: { fontSize: 12.5, color: "var(--v-amber)", marginTop: 8 },
  modalWrap: { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "grid", placeItems: "center", zIndex: 60, padding: 20 },
  modal: { background: "var(--v-surface)", borderRadius: 18, padding: 22, width: "100%", maxWidth: 560, maxHeight: "84vh", overflowY: "auto", boxShadow: "var(--v-shadow-lg)" },
  mHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  mTitle: { fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--v-ink)" },
  certLink: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--v-green)", textDecoration: "none", fontWeight: 600, margin: "8px 0" },
  lessons: { display: "flex", flexDirection: "column", gap: 6, margin: "12px 0" },
  lessonWrap: { background: "var(--v-surface-2)", borderRadius: 10, overflow: "hidden" },
  lesson: { display: "flex", alignItems: "center", gap: 10, padding: "9px 11px" },
  lessonToggle: { flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", color: "inherit" },
  lessonBody: { padding: "0 11px 12px 38px", display: "flex", flexDirection: "column", gap: 8 },
  lessonContent: { fontSize: 13, color: "var(--v-ink-2)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" },
  resourceLink: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--v-accent)", textDecoration: "none", width: "fit-content" },
  lMeta: { fontSize: 11.5, color: "var(--v-ink-3)" },
  lTitle: { fontSize: 13.5, fontWeight: 500, color: "var(--v-ink)" },
  lSub: { fontSize: 11.5, color: "var(--v-ink-3)", marginTop: 1 },
  miniBtn: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  authorBox: { marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--v-line-2)" },
  authorActions: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
}
