"use client"
import { useCallback, useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconLayers, IconPlus, IconZap, IconUsers, IconAward, IconTarget } from "@/components/ui/Icons"

export default function UniversityPage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [d, setD] = useState<any>(null)
  const [ai, setAi] = useState<any>(null)
  const [sel, setSel] = useState<string>("")
  const [tab, setTab] = useState<"programs" | "admissions" | "students" | "faculty">("programs")
  const [newInst, setNewInst] = useState("")

  const loadAi = useCallback(() => { fetch("/api/university/intelligence").then(r => r.ok ? r.json() : null).then(x => x && setAi(x)).catch(() => {}) }, [])
  const load = useCallback((institutionId?: string) => {
    const q = institutionId ? `?institutionId=${institutionId}` : ""
    fetch(`/api/university${q}`).then(async r => {
      if (r.status === 401 || r.status === 403) { setState("denied"); return }
      const j = await r.json(); setD(j); setSel(j.selected || ""); setState("ok"); loadAi()
    }).catch(() => setState("denied"))
  }, [loadAi])
  useEffect(() => { load() }, [load])
  const post = async (body: any) => { const r = await fetch("/api/university", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, institutionId: body.institutionId || sel }) }); if (r.ok) load(sel); return r.ok }
  const createInst = async () => { if (!newInst.trim()) return; const r = await fetch("/api/university", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create-institution", name: newInst }) }); if (r.ok) { setNewInst(""); const j = await r.json(); load(j.id) } }

  if (state === "loading") return <AppShell title="University"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="University"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in to manage a campus</h1></div></div></AppShell>

  const meta = d?.meta || {}
  const detail = d?.detail
  const stats = detail?.stats
  return (
    <AppShell title="University">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconLayers size={20} /> University OS</h1>
          <p style={S.sub}>Admissions, programs, students, faculty and examinations — one campus system with in-house Campus Intelligence (admissions funnel, placement, at-risk students). No external LLM.</p>
        </header>

        {(d.institutions || []).length === 0 ? (
          <div style={S.card}>
            <div style={S.formRow}>
              <input value={newInst} onChange={e => setNewInst(e.target.value)} placeholder="Create your institution (e.g. Helvetia Institute of Technology)" style={{ ...S.input, flex: 1 }} onKeyDown={e => e.key === "Enter" && createInst()} />
              <button onClick={createInst} disabled={!newInst.trim()} style={{ ...S.btnSm, opacity: newInst.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Create</button>
            </div>
          </div>
        ) : (
          <>
            {ai && ai.hasData && <CampusIntel ai={ai} />}

            <div style={S.instRow}>
              <select value={sel} onChange={e => { setSel(e.target.value); load(e.target.value) }} style={S.select}>
                {d.institutions.map((i: any) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              <input value={newInst} onChange={e => setNewInst(e.target.value)} placeholder="New institution…" style={{ ...S.input, width: 220 }} onKeyDown={e => e.key === "Enter" && createInst()} />
              <button onClick={createInst} disabled={!newInst.trim()} style={{ ...S.btnGhost, opacity: newInst.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
            </div>

            {stats && (
              <div style={S.kpis}>
                <Kpi n={stats.counts.active} l="Active students" />
                <Kpi n={`${stats.funnel.offerRate}%`} l="Offer rate" />
                <Kpi n={`${stats.funnel.yield}%`} l="Offer yield" />
                <Kpi n={`${stats.seats.utilization}%`} l="Seat fill" />
                <Kpi n={`${stats.placement.rate}%`} l="Placement" />
                <Kpi n={stats.gpa.avg ?? "—"} l="Avg GPA" />
              </div>
            )}

            <div style={S.tabs}>
              {(["programs", "admissions", "students", "faculty"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}>{t[0].toUpperCase() + t.slice(1)}</button>
              ))}
            </div>

            {detail && tab === "programs" && <Programs detail={detail} meta={meta} post={post} />}
            {detail && tab === "admissions" && <Admissions detail={detail} meta={meta} post={post} />}
            {detail && tab === "students" && <Students detail={detail} meta={meta} post={post} />}
            {detail && tab === "faculty" && <Faculty detail={detail} post={post} />}
          </>
        )}
      </div>
    </AppShell>
  )
}

function CampusIntel({ ai }: { ai: any }) {
  const advice = ai.advice || {}; const sugg = advice.suggestions || []
  const sev: any = { urgent: "var(--v-red)", high: "#b7791f", medium: "var(--v-accent)", low: "var(--v-ink-3)" }
  return (
    <div style={S.ai}>
      <div style={S.aiHead}><span style={S.aiTitle}><IconZap size={16} /> Campus Intelligence</span><span style={S.aiSummary}>{advice.summary}</span></div>
      {sugg.length > 0 && <div style={S.aiList}>{sugg.slice(0, 6).map((s: any) => (
        <div key={s.id} style={S.aiItem}><span style={{ ...S.aiDot, background: sev[s.severity] }} /><div style={{ flex: 1 }}><div style={S.aiItemTitle}>{s.title} <span style={{ ...S.sevTag, color: sev[s.severity] }}>{s.severity}</span></div><div style={S.aiItemDetail}>{s.detail}</div></div></div>
      ))}</div>}
      <p style={S.aiFine}>Deterministic campus analytics — audited through the AI gateway. No external LLM.</p>
    </div>
  )
}

function Programs({ detail, meta, post }: any) {
  const [f, setF] = useState({ name: "", department: "", level: "UG", seats: "60", durationMonths: "48" })
  const add = async () => { if (!f.name.trim()) return; if (await post({ action: "create-program", ...f, seats: Number(f.seats) || 60, durationMonths: Number(f.durationMonths) || 48 })) setF({ name: "", department: "", level: "UG", seats: "60", durationMonths: "48" }) }
  return (
    <div>
      <div style={S.card}><div style={S.formRow}>
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Program name" style={{ ...S.input, flex: 1.6 }} />
        <input value={f.department} onChange={e => setF({ ...f, department: e.target.value })} placeholder="Department" style={{ ...S.input, flex: 1 }} />
        <select value={f.level} onChange={e => setF({ ...f, level: e.target.value })} style={S.select}>{(meta.levels || []).map((l: string) => <option key={l}>{l}</option>)}</select>
        <input type="number" value={f.seats} onChange={e => setF({ ...f, seats: e.target.value })} placeholder="Seats" style={{ ...S.input, width: 80 }} />
        <button onClick={add} disabled={!f.name.trim()} style={{ ...S.btnSm, opacity: f.name.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
      </div></div>
      <Table rows={detail.programs} cols={[["name", "Program"], ["department", "Dept"], ["level", "Level"], ["seats", "Seats"]]} />
    </div>
  )
}

function Admissions({ detail, meta, post }: any) {
  const [f, setF] = useState({ applicantName: "", email: "", score: "", programId: "" })
  const add = async () => { if (!f.applicantName.trim()) return; if (await post({ action: "create-admission", ...f, score: f.score === "" ? null : Number(f.score) })) setF({ applicantName: "", email: "", score: "", programId: "" }) }
  return (
    <div>
      <div style={S.card}><div style={S.formRow}>
        <input value={f.applicantName} onChange={e => setF({ ...f, applicantName: e.target.value })} placeholder="Applicant name" style={{ ...S.input, flex: 1.6 }} />
        <input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="Email" style={{ ...S.input, flex: 1 }} />
        <input type="number" value={f.score} onChange={e => setF({ ...f, score: e.target.value })} placeholder="Score" style={{ ...S.input, width: 90 }} />
        <select value={f.programId} onChange={e => setF({ ...f, programId: e.target.value })} style={S.select}><option value="">Program…</option>{detail.programs.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button onClick={add} disabled={!f.applicantName.trim()} style={{ ...S.btnSm, opacity: f.applicantName.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
      </div></div>
      {detail.admissions.length === 0 ? <div style={S.empty}><p style={S.sub}>No applications yet.</p></div> : (
        <div style={S.tableWrap}><table style={S.table}>
          <thead><tr>{["Applicant", "Score", "Status", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{detail.admissions.map((a: any) => (
            <tr key={a.id} style={S.tr}><td style={S.td}>{a.applicantName}</td><td style={S.td}>{a.score ?? "—"}</td><td style={S.td}>{a.status}</td>
              <td style={{ ...S.td, textAlign: "right" }}><select value={a.status} onChange={e => post({ action: "update-admission", admissionId: a.id, status: e.target.value })} style={S.moveSel}>{(meta.admissionStatuses || []).map((s: string) => <option key={s}>{s}</option>)}</select></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  )
}

function Students({ detail, meta, post }: any) {
  const [f, setF] = useState({ name: "", year: "1", gpa: "", programId: "" })
  const add = async () => { if (!f.name.trim()) return; if (await post({ action: "create-student", ...f, year: Number(f.year) || 1, gpa: f.gpa === "" ? null : Number(f.gpa) })) setF({ name: "", year: "1", gpa: "", programId: "" }) }
  return (
    <div>
      <div style={S.card}><div style={S.formRow}>
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Student name" style={{ ...S.input, flex: 1.6 }} />
        <input type="number" value={f.year} onChange={e => setF({ ...f, year: e.target.value })} placeholder="Year" style={{ ...S.input, width: 70 }} />
        <input type="number" step="0.1" value={f.gpa} onChange={e => setF({ ...f, gpa: e.target.value })} placeholder="GPA /10" style={{ ...S.input, width: 90 }} />
        <button onClick={add} disabled={!f.name.trim()} style={{ ...S.btnSm, opacity: f.name.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
      </div></div>
      {detail.students.length === 0 ? <div style={S.empty}><p style={S.sub}>No students yet.</p></div> : (
        <div style={S.tableWrap}><table style={S.table}>
          <thead><tr>{["Student", "Year", "GPA", "Placed", "Status", ""].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{detail.students.map((s: any) => (
            <tr key={s.id} style={S.tr}>
              <td style={S.td}>{s.name}</td><td style={S.td}>{s.year}</td>
              <td style={{ ...S.td, color: s.gpa != null && s.gpa < 5 ? "var(--v-red)" : "var(--v-ink)" }}>{s.gpa ?? "—"}</td>
              <td style={S.td}><input type="checkbox" checked={!!s.placed} onChange={e => post({ action: "update-student", studentId: s.id, placed: e.target.checked })} /></td>
              <td style={S.td}>{s.status}</td>
              <td style={{ ...S.td, textAlign: "right" }}><select value={s.status} onChange={e => post({ action: "update-student", studentId: s.id, status: e.target.value })} style={S.moveSel}>{(meta.studentStatuses || []).map((st: string) => <option key={st}>{st}</option>)}</select></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  )
}

function Faculty({ detail, post }: any) {
  const [f, setF] = useState({ name: "", department: "", designation: "" })
  const add = async () => { if (!f.name.trim()) return; if (await post({ action: "create-faculty", ...f })) setF({ name: "", department: "", designation: "" }) }
  return (
    <div>
      <div style={S.card}><div style={S.formRow}>
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Faculty name" style={{ ...S.input, flex: 1.6 }} />
        <input value={f.department} onChange={e => setF({ ...f, department: e.target.value })} placeholder="Department" style={{ ...S.input, flex: 1 }} />
        <input value={f.designation} onChange={e => setF({ ...f, designation: e.target.value })} placeholder="Designation" style={{ ...S.input, flex: 1 }} />
        <button onClick={add} disabled={!f.name.trim()} style={{ ...S.btnSm, opacity: f.name.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
      </div></div>
      <Table rows={detail.faculty} cols={[["name", "Name"], ["department", "Dept"], ["designation", "Designation"]]} />
    </div>
  )
}

function Table({ rows, cols }: { rows: any[]; cols: [string, string][] }) {
  if (!rows || rows.length === 0) return <div style={S.empty}><p style={S.sub}>Nothing here yet.</p></div>
  return <div style={S.tableWrap}><table style={S.table}>
    <thead><tr>{cols.map(c => <th key={c[0]} style={S.th}>{c[1]}</th>)}</tr></thead>
    <tbody>{rows.map(r => <tr key={r.id} style={S.tr}>{cols.map(c => <td key={c[0]} style={S.td}>{r[c[0]] ?? "—"}</td>)}</tr>)}</tbody>
  </table></div>
}

function Kpi({ n, l }: { n: any; l: string }) { return <div style={S.kpi}><div style={S.kpiN}>{n == null ? "—" : n}</div><div style={S.kpiL}>{l}</div></div> }

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 1040, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 18 },
  h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 720 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "34px 24px", textAlign: "center" },
  ai: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18, marginBottom: 16, borderLeft: "3px solid var(--v-accent)" },
  aiHead: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, marginBottom: 12 },
  aiTitle: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--v-ink)", display: "flex", alignItems: "center", gap: 7 },
  aiSummary: { fontSize: 13, color: "var(--v-ink-2)" },
  aiList: { display: "flex", flexDirection: "column", gap: 8 },
  aiItem: { display: "flex", gap: 10, alignItems: "flex-start" },
  aiDot: { width: 8, height: 8, borderRadius: 999, marginTop: 6, flexShrink: 0 },
  aiItemTitle: { fontSize: 13, fontWeight: 600, color: "var(--v-ink)" },
  sevTag: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginLeft: 4 },
  aiItemDetail: { fontSize: 12, color: "var(--v-ink-2)", lineHeight: 1.5, marginTop: 1 },
  aiFine: { fontSize: 11, color: "var(--v-ink-3)", marginTop: 12, marginBottom: 0 },
  instRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 12, marginBottom: 16 },
  kpi: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px" },
  kpiN: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--v-ink)" },
  kpiL: { fontSize: 11.5, color: "var(--v-ink-2)", marginTop: 2 },
  tabs: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" },
  tab: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 999, padding: "7px 16px", fontSize: 13, color: "var(--v-ink-2)", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 },
  tabOn: { background: "var(--v-accent)", color: "#fff", borderColor: "var(--v-accent)" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 14, marginBottom: 12 },
  formRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none" },
  select: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)" },
  btnSm: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  btnGhost: { display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", color: "var(--v-ink-2)", border: "1px solid var(--v-line)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
  tableWrap: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "11px 14px", fontSize: 11.5, fontWeight: 600, color: "var(--v-ink-2)", textTransform: "uppercase", letterSpacing: ".03em", borderBottom: "1px solid var(--v-line)", background: "var(--v-surface-2)" },
  tr: { borderBottom: "1px solid var(--v-line)" },
  td: { padding: "10px 14px", color: "var(--v-ink)", verticalAlign: "middle" },
  moveSel: { border: "1px solid var(--v-line)", borderRadius: 6, padding: "4px 7px", fontSize: 11.5, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)" },
}
