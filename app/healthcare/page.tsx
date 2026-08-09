"use client"
import { Fragment, useCallback, useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconActivity, IconPlus, IconZap, IconAlert, IconFileText } from "@/components/ui/Icons"

export default function HealthcarePage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [d, setD] = useState<any>(null)
  const [ai, setAi] = useState<any>(null)
  const [sel, setSel] = useState<string>("")
  const [tab, setTab] = useState<"appointments" | "patients" | "triage">("appointments")
  const [newFac, setNewFac] = useState("")

  const loadAi = useCallback(() => { fetch("/api/healthcare/intelligence").then(r => r.ok ? r.json() : null).then(x => x && setAi(x)).catch(() => {}) }, [])
  const load = useCallback((facilityId?: string) => {
    fetch(`/api/healthcare${facilityId ? `?facilityId=${facilityId}` : ""}`).then(async r => {
      if (r.status === 401) { setState("denied"); return }
      const j = await r.json(); setD(j); setSel(j.selected || ""); setState("ok"); loadAi()
    }).catch(() => setState("denied"))
  }, [loadAi])
  useEffect(() => { load() }, [load])
  const post = async (body: any) => { const r = await fetch("/api/healthcare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, facilityId: body.facilityId || sel }) }); if (r.ok) load(sel); return r.ok }
  const createFac = async () => { if (!newFac.trim()) return; const r = await fetch("/api/healthcare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create-facility", name: newFac }) }); if (r.ok) { setNewFac(""); const j = await r.json(); load(j.id) } }

  if (state === "loading") return <AppShell title="Healthcare"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Healthcare"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in to manage a facility</h1></div></div></AppShell>

  const meta = d?.meta || {}, detail = d?.detail, stats = detail?.stats
  return (
    <AppShell title="Healthcare">
      <div style={S.page}>
        <header style={S.head}>
          <h1 style={S.h1}><IconActivity size={20} /> Healthcare platform</h1>
          <p style={S.sub}>Patients, appointments and records with in-house Clinical Operations Intelligence — attendance/no-show, population demographics, and triage routing. Operational only — never diagnosis or medical advice. No external LLM.</p>
        </header>

        {(d.facilities || []).length === 0 ? (
          <div style={S.card}><div style={S.row}><input value={newFac} onChange={e => setNewFac(e.target.value)} placeholder="Create your facility (e.g. Northshore Clinic)" style={{ ...S.input, flex: 1 }} onKeyDown={e => e.key === "Enter" && createFac()} /><button onClick={createFac} disabled={!newFac.trim()} style={{ ...S.btnSm, opacity: newFac.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Create</button></div></div>
        ) : (
          <>
            {ai && ai.hasData && <ClinicalIntel ai={ai} />}
            <div style={S.row}>
              <select value={sel} onChange={e => { setSel(e.target.value); load(e.target.value) }} style={S.select}>{d.facilities.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
              <input value={newFac} onChange={e => setNewFac(e.target.value)} placeholder="New facility…" style={{ ...S.input, width: 200 }} onKeyDown={e => e.key === "Enter" && createFac()} />
              <button onClick={createFac} disabled={!newFac.trim()} style={{ ...S.btnGhost, opacity: newFac.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
            </div>

            {stats && (
              <div style={S.kpis}>
                <Kpi n={stats.population.patients} l="Patients" />
                <Kpi n={stats.appointments.upcoming7d} l="Upcoming (7d)" />
                <Kpi n={`${stats.appointments.noShowRate}%`} l="No-show rate" accent={stats.appointments.noShowRate >= 20 ? "var(--v-red)" : undefined} />
                <Kpi n={`${stats.appointments.completionRate}%`} l="Completion" />
                <Kpi n={`${stats.recordsCoverage}%`} l="Records coverage" />
              </div>
            )}

            <div style={S.tabs}>{(["appointments", "patients", "triage"] as const).map(t => <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
            {detail && tab === "appointments" && <Appointments detail={detail} meta={meta} post={post} />}
            {detail && tab === "patients" && <Patients detail={detail} meta={meta} records={detail.records || d.records || []} post={post} />}
            {tab === "triage" && <Triage />}
          </>
        )}
      </div>
    </AppShell>
  )
}

function ClinicalIntel({ ai }: { ai: any }) {
  const del = ai.deliberation || {}
  const vColor = del.verdict === "supported" ? "var(--v-green)" : del.verdict === "refuted" ? "var(--v-red)" : "#b7791f"
  return (
    <div style={S.ai}>
      <div style={S.aiHead}><span style={S.aiTitle}><IconZap size={16} /> Clinical Operations Intelligence</span><span style={{ ...S.verdict, color: vColor, borderColor: vColor }}>{del.verdict} · {Math.round((del.confidence || 0) * 100)}%</span></div>
      <p style={S.aiWhy}>{del.why}</p>
      {(del.risks || []).length > 0 && <div style={S.chips}>{del.risks.slice(0, 4).map((r: string, i: number) => <span key={i} style={S.riskChip}><IconAlert size={11} /> {r}</span>)}</div>}
      <p style={S.aiFine}>Operational (not clinical) intelligence — deliberated through the Enterprise Brain, audited. No external LLM; no diagnosis.</p>
    </div>
  )
}

function Appointments({ detail, meta, post }: any) {
  const [f, setF] = useState({ patientId: "", doctorName: "", department: "", scheduledAt: "", reason: "" })
  const add = async () => { if (!f.scheduledAt) return; if (await post({ action: "create-appointment", ...f })) setF({ patientId: "", doctorName: "", department: "", scheduledAt: "", reason: "" }) }
  const badge: any = { SCHEDULED: { background: "var(--v-accent-bg,#eef0fb)", color: "var(--v-accent)" }, CHECKED_IN: { background: "#fff7e6", color: "#b7791f" }, COMPLETED: { background: "var(--v-green-bg,#e9f9ef)", color: "var(--v-green)" }, CANCELLED: { background: "var(--v-surface-2)", color: "var(--v-ink-3)" }, NO_SHOW: { background: "var(--v-red-bg,#fee)", color: "var(--v-red)" } }
  const pName = (id: string) => detail.patients.find((p: any) => p.id === id)?.name || "—"
  return (
    <div>
      <div style={S.card}><div style={S.formRow}>
        <select value={f.patientId} onChange={e => setF({ ...f, patientId: e.target.value })} style={S.select}><option value="">Patient…</option>{detail.patients.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <input value={f.doctorName} onChange={e => setF({ ...f, doctorName: e.target.value })} placeholder="Doctor" style={{ ...S.input, flex: 1 }} />
        <input value={f.department} onChange={e => setF({ ...f, department: e.target.value })} placeholder="Dept" style={{ ...S.input, width: 110 }} />
        <input type="datetime-local" value={f.scheduledAt} onChange={e => setF({ ...f, scheduledAt: e.target.value })} style={S.input} />
        <button onClick={add} disabled={!f.scheduledAt} style={{ ...S.btnSm, opacity: f.scheduledAt ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
      </div></div>
      {detail.appointments.length === 0 ? <div style={S.empty}><p style={S.sub}>No appointments yet.</p></div> : (
        <div style={S.list}>{detail.appointments.map((a: any) => (
          <div key={a.id} style={S.item}>
            <span style={{ flex: 1 }}><span style={{ color: "var(--v-ink)", fontSize: 13.5 }}>{pName(a.patientId)}</span><span style={S.itemMeta}> · {a.doctorName || "—"} · {new Date(a.scheduledAt).toLocaleString()}</span></span>
            <span style={{ ...S.tBadge, ...(badge[a.status] || {}) }}>{a.status.replace("_", " ")}</span>
            <select value={a.status} onChange={e => post({ action: "update-appointment", appointmentId: a.id, status: e.target.value })} style={S.moveSel}>{(meta.appointmentStatuses || []).map((s: string) => <option key={s}>{s}</option>)}</select>
          </div>
        ))}</div>
      )}
    </div>
  )
}

function Patients({ detail, meta, records, post }: any) {
  const [f, setF] = useState({ name: "", dob: "", sex: "", bloodGroup: "", phone: "" })
  const [open, setOpen] = useState("")
  const add = async () => { if (!f.name.trim()) return; if (await post({ action: "create-patient", ...f })) setF({ name: "", dob: "", sex: "", bloodGroup: "", phone: "" }) }
  const recsFor = (id: string) => (records || []).filter((r: any) => r.patientId === id)
  return (
    <div>
      <div style={S.card}><div style={S.formRow}>
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Patient name" style={{ ...S.input, flex: 1.6 }} />
        <input type="date" value={f.dob} onChange={e => setF({ ...f, dob: e.target.value })} style={S.input} title="DOB" />
        <input value={f.sex} onChange={e => setF({ ...f, sex: e.target.value })} placeholder="Sex" style={{ ...S.input, width: 80 }} />
        <input value={f.bloodGroup} onChange={e => setF({ ...f, bloodGroup: e.target.value })} placeholder="Blood" style={{ ...S.input, width: 80 }} />
        <button onClick={add} disabled={!f.name.trim()} style={{ ...S.btnSm, opacity: f.name.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add</button>
      </div></div>
      {detail.patients.length === 0 ? <div style={S.empty}><p style={S.sub}>No patients yet.</p></div> : (
        <div style={S.tableWrap}><table style={S.table}><thead><tr>{["Name", "MRN", "Sex", "Blood", "Records"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>{detail.patients.map((p: any) => {
            const recs = recsFor(p.id); const isOpen = open === p.id
            return (
              <Fragment key={p.id}>
                <tr style={S.tr}>
                  <td style={S.td}>{p.name}</td><td style={S.td}>{p.mrn}</td><td style={S.td}>{p.sex || "—"}</td><td style={S.td}>{p.bloodGroup || "—"}</td>
                  <td style={S.td}><button onClick={() => setOpen(isOpen ? "" : p.id)} style={{ ...S.miniBtn, ...(isOpen ? S.miniBtnOn : {}) }}><IconFileText size={12} /> {recs.length} record{recs.length === 1 ? "" : "s"}</button></td>
                </tr>
                {isOpen && <tr><td colSpan={5} style={S.recCell}><PatientRecords patient={p} records={recs} kinds={meta.recordKinds || []} post={post} /></td></tr>}
              </Fragment>
            )
          })}</tbody>
        </table></div>
      )}
    </div>
  )
}

function PatientRecords({ patient, records, kinds, post }: any) {
  const [kind, setKind] = useState<string>(kinds[0] || "VISIT")
  const [summary, setSummary] = useState("")
  const add = async () => { if (!summary.trim()) return; if (await post({ action: "create-record", patientId: patient.id, kind, summary: summary.trim() })) setSummary("") }
  const kName = (k: string) => k[0] + k.slice(1).toLowerCase()
  const sorted = [...records].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
  return (
    <div style={S.recPanel}>
      <div style={S.formRow}>
        <select value={kind} onChange={e => setKind(e.target.value)} style={S.select}>{kinds.map((k: string) => <option key={k} value={k}>{kName(k)}</option>)}</select>
        <input value={summary} onChange={e => setSummary(e.target.value)} placeholder={`Record summary for ${patient.name}…`} style={{ ...S.input, flex: 1 }} onKeyDown={e => e.key === "Enter" && add()} />
        <button onClick={add} disabled={!summary.trim()} style={{ ...S.btnSm, opacity: summary.trim() ? 1 : 0.6 }}><IconPlus size={13} /> Add record</button>
      </div>
      {sorted.length === 0 ? <p style={{ ...S.sub, marginTop: 10 }}>No records yet for {patient.name}.</p> : (
        <div style={{ ...S.list, marginTop: 12 }}>{sorted.map((r: any) => (
          <div key={r.id} style={S.recItem}>
            <span style={S.kindBadge}>{kName(r.kind)}</span>
            <span style={{ flex: 1, fontSize: 13, color: "var(--v-ink)" }}>{r.summary || "—"}</span>
            <span style={S.itemMeta}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</span>
          </div>
        ))}</div>
      )}
    </div>
  )
}

function Triage() {
  const [complaint, setComplaint] = useState("")
  const [res, setRes] = useState<any>(null)
  const run = async () => { const r = await fetch("/api/healthcare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "triage", complaint }) }); if (r.ok) setRes((await r.json()).triage) }
  const color = res?.level === "URGENT" ? "var(--v-red)" : res?.level === "PRIORITY" ? "#b7791f" : "var(--v-green)"
  return (
    <div style={S.card}>
      <p style={S.sub}>Triage routing — type the presenting complaint to get an operational queue priority. This is routing only; a triage nurse confirms. Not a diagnosis.</p>
      <div style={{ ...S.formRow, marginTop: 12 }}>
        <input value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="e.g. chest pain and shortness of breath" style={{ ...S.input, flex: 1 }} onKeyDown={e => e.key === "Enter" && run()} />
        <button onClick={run} disabled={!complaint.trim()} style={{ ...S.btnSm, opacity: complaint.trim() ? 1 : 0.6 }}>Route</button>
      </div>
      {res && (
        <div style={{ marginTop: 14 }}>
          <span style={{ ...S.verdict, color, borderColor: color, fontSize: 13 }}>{res.level}</span>
          <p style={{ ...S.aiWhy, marginTop: 8 }}>{res.note}{res.matched.length ? ` (matched: ${res.matched.join(", ")})` : ""}</p>
        </div>
      )}
    </div>
  )
}

function Kpi({ n, l, accent }: { n: any; l: string; accent?: string }) { return <div style={S.kpi}><div style={{ ...S.kpiN, ...(accent ? { color: accent } : {}) }}>{n == null ? "—" : n}</div><div style={S.kpiL}>{l}</div></div> }

const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 1020, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 18 }, h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 740 },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "34px 24px", textAlign: "center" },
  ai: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18, marginBottom: 16, borderLeft: "3px solid var(--v-accent)" },
  aiHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" },
  aiTitle: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--v-ink)", display: "flex", alignItems: "center", gap: 7 },
  aiWhy: { fontSize: 13, color: "var(--v-ink-2)", lineHeight: 1.55, margin: 0 }, aiFine: { fontSize: 11, color: "var(--v-ink-3)", marginTop: 10, marginBottom: 0 },
  verdict: { fontSize: 11.5, fontWeight: 700, border: "1px solid", borderRadius: 999, padding: "2px 10px", textTransform: "capitalize", whiteSpace: "nowrap" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 },
  riskChip: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--v-ink-2)", background: "var(--v-surface-2)", borderRadius: 999, padding: "2px 9px" },
  row: { display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginBottom: 16 },
  kpi: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px" },
  kpiN: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "var(--v-ink)" }, kpiL: { fontSize: 11.5, color: "var(--v-ink-2)", marginTop: 2 },
  tabs: { display: "flex", gap: 6, marginBottom: 14 }, tab: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 999, padding: "7px 16px", fontSize: 13, color: "var(--v-ink-2)", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 },
  tabOn: { background: "var(--v-accent)", color: "#fff", borderColor: "var(--v-accent)" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 14, marginBottom: 12 },
  formRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)", outline: "none" },
  select: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)" },
  btnSm: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" },
  btnGhost: { display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", color: "var(--v-ink-2)", border: "1px solid var(--v-line)", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
  miniBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--v-surface-2)", border: "1px solid var(--v-line)", borderRadius: 7, padding: "4px 10px", fontSize: 11.5, cursor: "pointer", color: "var(--v-ink-2)", fontFamily: "inherit" },
  miniBtnOn: { background: "var(--v-accent-bg,#eef0fb)", borderColor: "var(--v-accent)", color: "var(--v-accent)" },
  recCell: { padding: 0, background: "var(--v-surface-2)", borderBottom: "1px solid var(--v-line)" },
  recPanel: { padding: "14px 16px" },
  recItem: { display: "flex", alignItems: "center", gap: 12, background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 10, padding: "9px 13px" },
  kindBadge: { fontSize: 10.5, fontWeight: 700, letterSpacing: ".02em", padding: "3px 9px", borderRadius: 999, background: "var(--v-accent-bg,#eef0fb)", color: "var(--v-accent)", whiteSpace: "nowrap" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  item: { display: "flex", alignItems: "center", gap: 12, background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 10, padding: "10px 14px" },
  itemMeta: { fontSize: 12, color: "var(--v-ink-3)" },
  tBadge: { fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, textTransform: "capitalize" },
  moveSel: { border: "1px solid var(--v-line)", borderRadius: 7, padding: "4px 7px", fontSize: 11.5, fontFamily: "inherit", color: "var(--v-ink)", background: "var(--v-surface)" },
  tableWrap: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, overflow: "hidden", overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "11px 14px", fontSize: 11.5, fontWeight: 600, color: "var(--v-ink-2)", textTransform: "uppercase", letterSpacing: ".03em", borderBottom: "1px solid var(--v-line)", background: "var(--v-surface-2)" },
  tr: { borderBottom: "1px solid var(--v-line)" }, td: { padding: "10px 14px", color: "var(--v-ink)" },
}
