"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconArrowRight, IconCheckCircle, IconLayers } from "@/components/ui/Icons"
import { LEVELS } from "@/lib/jobarch/jd"
import { managerActions, TEMPLATE_STATUS_LABEL, type TemplateAction } from "@/lib/jobarch/lifecycle"
import { FAMILIES } from "@/lib/career/roles"

const FAMILY_OPTS = Object.values(FAMILIES).map((f: any) => ({ key: f.key, label: f.label }))
const ACTION_LABEL: Record<string, string> = { submit: "Submit for approval", approve: "Approve", archive: "Archive", revise: "Revise" }
const statusColor = (s: string) => ({ DRAFT: "var(--v-ink-3)", PENDING_APPROVAL: "var(--v-amber)", APPROVED: "var(--v-green)", ARCHIVED: "var(--v-ink-3)" } as Record<string, string>)[s] || "var(--v-ink-3)"
const statusLabel = (s: string) => (TEMPLATE_STATUS_LABEL as Record<string, string>)[s] || s

export default function JobArchitecturePage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [data, setData] = useState<any>({ mine: [], library: [], isAdmin: false })
  const [tab, setTab] = useState<"mine" | "library">("mine")
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<any>({ title: "", family: "backend", level: "MID", grade: "", skills: "", companyName: "" })
  const [preview, setPreview] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState("")
  const [viewJD, setViewJD] = useState<any>(null)

  async function load() {
    try {
      const r = await fetch("/api/job-templates")
      if (r.status === 403 || r.status === 401) { setState("denied"); return }
      setData(await r.json()); setState("ok")
    } catch { setState("denied") }
  }
  useEffect(() => { load() }, [])

  const skillsArr = () => form.skills.split(",").map((s: string) => s.trim()).filter(Boolean)

  async function genPreview() {
    if (!form.title.trim()) { setErr("A role title is required."); return }
    setBusy("preview"); setErr("")
    try {
      const d = await fetch("/api/job-templates/generate-jd", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, skills: skillsArr() }) }).then(r => r.json())
      if (d.error) setErr(d.error); else setPreview(d.jd)
    } catch { setErr("Network error.") } finally { setBusy(null) }
  }
  async function create() {
    if (!form.title.trim()) { setErr("A role title is required."); return }
    setBusy("create"); setErr("")
    try {
      const d = await fetch("/api/job-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, requiredSkills: skillsArr() }) }).then(r => r.json())
      if (d.error) setErr(d.error); else { setShowNew(false); setPreview(null); setForm({ title: "", family: "backend", level: "MID", grade: "", skills: "", companyName: "" }); await load() }
    } catch { setErr("Network error.") } finally { setBusy(null) }
  }
  async function act(id: string, action: TemplateAction) {
    setBusy(id + action); setErr("")
    try {
      const d = await fetch(`/api/job-templates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }).then(r => r.json())
      if (d.error) setErr(d.error); else await load()
    } catch { setErr("Network error.") } finally { setBusy(null) }
  }

  if (state === "loading") return <AppShell title="Job architecture"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Job architecture"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Recruiter access required</h1></div></div></AppShell>

  const list = tab === "mine" ? data.mine : data.library

  return (
    <AppShell title="Job architecture">
      <div style={S.page}>
        <header style={S.head}>
          <div>
            <h1 style={S.h1}><IconLayers size={20} /> Job architecture</h1>
            <p style={S.sub}>Versioned, approved role templates with an in-house JD assistant — no external AI. Approved templates become a reusable library.</p>
          </div>
          <button style={S.cta} onClick={() => { setShowNew(v => !v); setPreview(null) }}>{showNew ? "Close" : "New template"}</button>
        </header>
        {err && <div style={S.err}>{err}</div>}

        {showNew && (
          <div style={S.card}>
            <div style={S.grid}>
              <Field label="Role title"><input style={S.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Backend Engineer" /></Field>
              <Field label="Family"><select style={S.input} value={form.family} onChange={e => setForm({ ...form, family: e.target.value })}>{FAMILY_OPTS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}</select></Field>
              <Field label="Level"><select style={S.input} value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>{LEVELS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}</select></Field>
              <Field label="Grade (optional)"><input style={S.input} value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} placeholder="e.g. L4" /></Field>
              <Field label="Required skills (comma-separated)"><input style={S.input} value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="Go, PostgreSQL, REST API" /></Field>
              <Field label="Company (optional)"><input style={S.input} value={form.companyName} onChange={e => setForm({ ...form, companyName: e.target.value })} /></Field>
            </div>
            <div style={S.formActions}>
              <button style={S.ghost} onClick={genPreview} disabled={busy === "preview"}>{busy === "preview" ? "…" : "Generate JD preview"}</button>
              <button style={S.cta} onClick={create} disabled={busy === "create"}><IconCheckCircle size={15} /> {busy === "create" ? "Saving…" : "Create draft"}</button>
            </div>
            {preview && (
              <div style={S.preview}>
                <div style={S.previewLbl}>JD preview · {preview.generatedBy}</div>
                <pre style={S.md}>{preview.markdown}</pre>
              </div>
            )}
          </div>
        )}

        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(tab === "mine" ? S.tabOn : {}) }} onClick={() => setTab("mine")}>My templates ({data.mine.length})</button>
          <button style={{ ...S.tab, ...(tab === "library" ? S.tabOn : {}) }} onClick={() => setTab("library")}>Approved library ({data.library.length})</button>
        </div>

        {list.length === 0 ? <div style={S.empty}><p style={S.sub}>{tab === "mine" ? "No templates yet — create one." : "No approved templates yet."}</p></div> : (
          <div style={S.list}>
            {list.map((t: any) => {
              const acts = tab === "mine" ? managerActions(t.status, { isAdmin: data.isAdmin }) : []
              return (
                <div key={t.id} style={S.tcard}>
                  <div style={S.tTop}>
                    <div style={{ minWidth: 0 }}>
                      <div style={S.tTitle}>{t.title} <span style={S.ver}>v{t.version}</span></div>
                      <div style={S.tSub}>{FAMILY_OPTS.find(f => f.key === t.family)?.label || t.family || "—"} · {LEVELS.find(l => l.key === t.level)?.label || t.level}{t.grade ? ` · ${t.grade}` : ""}{t.createdBy ? ` · ${t.createdBy.name}` : ""}</div>
                    </div>
                    <span style={{ ...S.badge, color: "#fff", background: statusColor(t.status) }}>{statusLabel(t.status)}</span>
                  </div>
                  {t.requiredSkills?.length > 0 && <div style={S.chips}>{t.requiredSkills.slice(0, 8).map((s: string) => <span key={s} style={S.chip}>{s}</span>)}</div>}
                  {t.requiredCompetencies?.length > 0 && <div style={S.compRow}><span style={S.compLbl}>Evaluate:</span>{t.requiredCompetencies.map((c: any) => <span key={c.key} style={S.comp}>{c.label}</span>)}</div>}
                  <div style={S.actions}>
                    <button style={S.link} onClick={() => setViewJD(t)}>View JD</button>
                    {acts.map((a: TemplateAction) => (
                      <button key={a} style={a === "approve" ? S.primary : S.ghostSm} disabled={busy === t.id + a} onClick={() => act(t.id, a)}>{busy === t.id + a ? "…" : ACTION_LABEL[a]}</button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {viewJD && (
        <div style={S.modalWrap} onClick={() => setViewJD(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <pre style={S.md}>{viewJD.descriptionMd || "No description."}</pre>
            <button style={S.cta} onClick={() => setViewJD(null)}>Close</button>
          </div>
        </div>
      )}
    </AppShell>
  )
}
function Field({ label, children }: any) { return <label style={S.field}><span style={S.fieldLbl}>{label}</span>{children}</label> }

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 860, margin: "0 auto", paddingBottom: 60 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 16 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 580 },
  cta: { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  err: { background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#B91C1C", marginBottom: 14 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18, marginBottom: 16 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLbl: { fontSize: 12, fontWeight: 500, color: "var(--v-ink-2)" },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "8px 11px", fontSize: 13, color: "var(--v-ink)", outline: "none", fontFamily: "inherit", width: "100%", background: "var(--v-surface)" },
  formActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  preview: { marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--v-line-2)" },
  previewLbl: { fontSize: 11.5, fontWeight: 600, color: "var(--v-ink-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".03em" },
  md: { whiteSpace: "pre-wrap", fontFamily: "var(--font-mono, monospace)", fontSize: 12.5, color: "var(--v-ink)", background: "var(--v-surface-2)", padding: 14, borderRadius: 10, overflowX: "auto", lineHeight: 1.6, margin: 0 },
  tabs: { display: "flex", gap: 4, background: "var(--v-surface-2)", padding: 4, borderRadius: 12, marginBottom: 14, width: "fit-content" },
  tab: { padding: "8px 16px", border: "none", background: "none", borderRadius: 9, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--v-ink-2)", cursor: "pointer" },
  tabOn: { background: "var(--v-surface)", color: "var(--v-ink)", boxShadow: "var(--v-shadow-sm)" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "40px 24px", textAlign: "center" },
  tcard: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px", boxShadow: "var(--v-shadow-sm)" },
  tTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  tTitle: { fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: 600, color: "var(--v-ink)" },
  ver: { fontSize: 11, color: "var(--v-ink-3)", fontWeight: 500 },
  tSub: { fontSize: 12.5, color: "var(--v-ink-2)", marginTop: 2 },
  badge: { fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { fontSize: 12, color: "var(--v-accent-2)", background: "var(--v-accent-soft)", padding: "3px 9px", borderRadius: 6 },
  compRow: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 8 },
  compLbl: { fontSize: 11.5, fontWeight: 600, color: "var(--v-ink-3)", marginRight: 2 },
  comp: { fontSize: 12, color: "var(--v-ink-2)", background: "var(--v-surface-2)", padding: "3px 9px", borderRadius: 6 },
  actions: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" },
  link: { background: "none", border: "none", color: "var(--v-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 },
  primary: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 9, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  ghost: { background: "var(--v-surface)", color: "var(--v-ink)", border: "1px solid var(--v-line)", borderRadius: 10, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  ghostSm: { background: "var(--v-surface)", color: "var(--v-ink)", border: "1px solid var(--v-line)", borderRadius: 9, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  modalWrap: { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "grid", placeItems: "center", zIndex: 60, padding: 20 },
  modal: { background: "var(--v-surface)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 640, maxHeight: "82vh", overflowY: "auto", boxShadow: "var(--v-shadow-lg)" },
}
