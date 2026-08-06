"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { IconActivity, IconAward, IconUsers, IconCheckCircle } from "@/components/ui/Icons"

const bandColor = (b: string) => b === "Outstanding" || b === "Strong" ? "var(--v-green)" : b === "Solid" ? "var(--v-accent)" : b === "Developing" ? "var(--v-amber)" : "var(--v-red)"

export default function PerformancePage() {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")
  const [tab, setTab] = useState<"goals" | "reviews" | "recognition" | "team">("goals")
  const [d, setD] = useState<any>(null); const [org, setOrg] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState("")
  const [ng, setNg] = useState({ title: "", period: "", krs: "" })
  const [rec, setRec] = useState({ to: "", message: "", badge: "" })

  async function load() { try { const r = await fetch("/api/hrms/performance"); if (r.status === 401) { setState("denied"); return } const j = await r.json(); setD(j); setState("ok"); if (j.isManager) fetch("/api/hrms/org").then(x => { if (x.ok) x.json().then(setOrg).catch(() => {}) }).catch(() => {}) } catch { setState("denied") } }
  useEffect(() => { load() }, [])
  async function post(body: any) { setBusy("x"); setErr(""); try { const j = await fetch("/api/hrms/performance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()); if (j.error) setErr(j.error); await load(); return j } finally { setBusy(null) } }
  async function createGoal() {
    if (!ng.title.trim()) { setErr("Goal title required."); return }
    const krs = ng.krs.split("\n").map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(.*?)\s*:\s*(\d+)\s*\/\s*(\d+)/); return m ? { text: m[1], current: +m[2], target: +m[3] } : { text: l, current: 0, target: 1 } })
    const j = await post({ action: "create-goal", title: ng.title, period: ng.period, keyResults: krs }); if (j?.success) setNg({ title: "", period: "", krs: "" })
  }
  async function bumpKR(goal: any, i: number, delta: number) {
    const krs = goal.keyResults.map((k: any, j: number) => j === i ? { ...k, current: Math.max(0, (k.current || 0) + delta) } : k)
    await post({ action: "update-goal", id: goal.id, keyResults: krs })
  }
  async function recognize() { if (!rec.to.trim() || !rec.message.trim()) { setErr("Recipient + message required."); return } const j = await post({ action: "recognize", ...rec }); if (j?.success) setRec({ to: "", message: "", badge: "" }) }

  if (state === "loading") return <AppShell title="Performance"><div style={S.page}><div style={S.empty}><p style={S.sub}>Loading…</p></div></div></AppShell>
  if (state === "denied") return <AppShell title="Performance"><div style={S.page}><div style={S.empty}><h1 style={S.h1}>Sign in</h1></div></div></AppShell>

  const tabs: [string, string][] = [["goals", `Goals (${d?.goals?.length || 0})`], ["reviews", `Reviews (${d?.reviews?.length || 0})`], ["recognition", "Recognition"]]
  if (d?.isManager) tabs.push(["team", "Team"])

  return (
    <AppShell title="Performance">
      <div style={S.page}>
        <header style={S.head}><h1 style={S.h1}><IconActivity size={20} /> Performance & Development</h1><p style={S.sub}>Goals & OKRs, performance reviews, recognition and 1:1s. Review ratings become competency evidence — performance feeds the same graph as hiring and learning.</p></header>
        {err && <div style={S.err}>{err}</div>}
        <div style={S.tabs}>{tabs.map(([k, l]) => <button key={k} style={{ ...S.tab, ...(tab === k ? S.tabOn : {}) }} onClick={() => setTab(k as any)}>{l}</button>)}</div>

        {tab === "goals" && (
          <div>
            <div style={S.card}>
              <div style={S.cardH}>New goal / OKR</div>
              <input style={S.input} placeholder="Objective" value={ng.title} onChange={e => setNg({ ...ng, title: e.target.value })} />
              <input style={{ ...S.input, marginTop: 8 }} placeholder="Period (e.g. Q3 2026)" value={ng.period} onChange={e => setNg({ ...ng, period: e.target.value })} />
              <textarea style={{ ...S.input, marginTop: 8 }} rows={3} placeholder={"Key results, one per line:\nShip 3 features: 0/3\nGrow NPS: 30/50"} value={ng.krs} onChange={e => setNg({ ...ng, krs: e.target.value })} />
              <button style={{ ...S.cta, marginTop: 10 }} onClick={createGoal} disabled={busy === "x"}>Create</button>
            </div>
            <div style={S.list}>
              {(d?.goals || []).map((g: any) => (
                <div key={g.id} style={S.card}>
                  <div style={S.rowTop}><div><div style={S.gt}>{g.title}</div><div style={S.gs}>{g.period || "—"} · {g.status}</div></div><span style={S.pct}>{g.progress}%</span></div>
                  <div style={S.bar}><div style={{ ...S.barFill, width: `${g.progress}%` }} /></div>
                  {g.keyResults.map((k: any, i: number) => (
                    <div key={i} style={S.kr}><span style={{ flex: 1 }}>{k.text}</span><span style={S.krN}>{k.current}/{k.target}{k.unit ? ` ${k.unit}` : ""}</span><button style={S.krBtn} onClick={() => bumpKR(g, i, 1)}>+</button><button style={S.krBtn} onClick={() => bumpKR(g, i, -1)}>−</button></div>
                  ))}
                  {g.status === "ACTIVE" && <div style={{ marginTop: 8 }}><button style={S.ghost} onClick={() => post({ action: "update-goal", id: g.id, status: "ACHIEVED" })}>Mark achieved</button></div>}
                </div>
              ))}
              {(d?.goals || []).length === 0 && <div style={S.empty}><p style={S.sub}>No goals yet.</p></div>}
            </div>
          </div>
        )}

        {tab === "reviews" && (
          <div>
            {d?.isManager && (d?.draftReviews || []).length > 0 && (<><div style={S.sec}>Draft reviews (submit to share)</div>{d.draftReviews.map((r: any) => (<div key={r.id} style={S.appRow}><span style={{ flex: 1 }}>{r.subject} · {r.period || "—"} · {r.ratings.length} ratings</span><button style={S.mini} onClick={() => post({ action: "submit-review", id: r.id })}>Submit</button></div>))}</>)}
            <div style={S.sec}>My reviews</div>
            <div style={S.list}>
              {(d?.reviews || []).map((r: any) => (
                <div key={r.id} style={S.card}>
                  <div style={S.rowTop}><div><div style={S.gt}>{r.period || "Review"} <span style={S.gs}>by {r.reviewer || "—"}</span></div></div><span style={{ ...S.band, color: bandColor(r.rollup?.band) }}>{r.rollup?.band} · {r.rollup?.overallPct}%</span></div>
                  {r.summary && <p style={S.sum}>{r.summary}</p>}
                  <div style={S.chips}>{(r.ratings || []).map((x: any) => <span key={x.competencyKey} style={S.chip}>{x.competencyKey}: {x.rating}/5</span>)}</div>
                </div>
              ))}
              {(d?.reviews || []).length === 0 && <div style={S.empty}><p style={S.sub}>No reviews shared with you yet.</p></div>}
            </div>
          </div>
        )}

        {tab === "recognition" && (
          <div>
            <div style={S.card}>
              <div style={S.cardH}>Recognise a colleague</div>
              <div style={S.grid2}><input style={S.input} placeholder="Recipient email" value={rec.to} onChange={e => setRec({ ...rec, to: e.target.value })} /><input style={S.input} placeholder="Badge (e.g. Team player)" value={rec.badge} onChange={e => setRec({ ...rec, badge: e.target.value })} /></div>
              <textarea style={{ ...S.input, marginTop: 8 }} rows={2} placeholder="Message" value={rec.message} onChange={e => setRec({ ...rec, message: e.target.value })} />
              <button style={{ ...S.cta, marginTop: 10 }} onClick={recognize} disabled={busy === "x"}><IconAward size={15} /> Send recognition</button>
            </div>
            <div style={S.sec}>Recognition you've received</div>
            <div style={S.list}>{(d?.recognition || []).map((r: any) => (<div key={r.id} style={S.card}><div style={S.rowTop}><div style={S.gt}>{r.badge || "Recognition"}</div><span style={S.gs}>from {r.from || "—"}</span></div><p style={S.sum}>{r.message}</p></div>))}{(d?.recognition || []).length === 0 && <div style={S.empty}><p style={S.sub}>No recognition yet.</p></div>}</div>
          </div>
        )}

        {tab === "team" && d?.isManager && (
          <div>
            <div style={S.card}>
              <div style={S.cardH}>Schedule a 1:1</div>
              <div style={S.grid2}><input style={S.input} id="e1" placeholder="Employee email" /><input style={S.input} id="e2" type="date" /></div>
              <button style={{ ...S.cta, marginTop: 10 }} onClick={() => { const e = (document.getElementById("e1") as HTMLInputElement)?.value; const dt = (document.getElementById("e2") as HTMLInputElement)?.value; if (e) post({ action: "schedule-1on1", employee: e, scheduledAt: dt }) }} disabled={busy === "x"}>Schedule</button>
            </div>
            {(d?.oneOnOnes || []).length > 0 && (<><div style={S.sec}>1:1s</div>{d.oneOnOnes.map((o: any) => (<div key={o.id} style={S.appRow}><span style={{ flex: 1 }}>{o.asManager ? "With" : "From"} {o.with} {o.scheduledAt ? `· ${new Date(o.scheduledAt).toLocaleDateString()}` : ""}</span></div>))}</>)}
            {org && (<><div style={S.sec}>Org chart</div><div style={S.card}>{(org.employees || []).length === 0 ? <p style={S.sub}>No employees yet.</p> : org.employees.map((e: any) => (<div key={e.id} style={S.orgRow}><span style={{ paddingLeft: e.managerId ? 18 : 0 }}>{e.name} <em style={S.gs}>{e.designation || e.department || ""}</em></span><span style={S.gs}>{e.status}</span></div>))}</div></>)}
          </div>
        )}
      </div>
    </AppShell>
  )
}
const S: Record<string, any> = {
  page: { padding: "clamp(16px,3vw,28px)", maxWidth: 820, margin: "0 auto", paddingBottom: 60 },
  head: { marginBottom: 14 }, h1: { fontFamily: "var(--font-display)", fontSize: "clamp(20px,3vw,26px)", fontWeight: 600, letterSpacing: "-.02em", color: "var(--v-ink)", margin: 0, display: "flex", alignItems: "center", gap: 9 },
  sub: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "6px 0 0", maxWidth: 640 },
  err: { background: "#FEF2F2", border: "0.5px solid #FECACA", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#B91C1C", margin: "12px 0" },
  empty: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "36px 24px", textAlign: "center" },
  tabs: { display: "flex", gap: 4, background: "var(--v-surface-2)", padding: 4, borderRadius: 12, margin: "14px 0", width: "fit-content", flexWrap: "wrap" },
  tab: { padding: "8px 15px", border: "none", background: "none", borderRadius: 9, font: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--v-ink-2)", cursor: "pointer" },
  tabOn: { background: "var(--v-surface)", color: "var(--v-ink)", boxShadow: "var(--v-shadow-sm)" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 16, marginBottom: 10 },
  cardH: { fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--v-ink)", marginBottom: 12 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  input: { border: "1px solid var(--v-line)", borderRadius: 8, padding: "9px 11px", fontSize: 13, color: "var(--v-ink)", outline: "none", fontFamily: "inherit", width: "100%", background: "var(--v-surface)" },
  cta: { display: "inline-flex", alignItems: "center", gap: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  ghost: { background: "var(--v-surface)", color: "var(--v-ink)", border: "1px solid var(--v-line)", borderRadius: 9, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  sec: { fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "var(--v-ink)", margin: "16px 0 10px" },
  rowTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  gt: { fontSize: 14.5, fontWeight: 600, color: "var(--v-ink)" }, gs: { fontSize: 12, color: "var(--v-ink-2)", fontStyle: "normal", fontWeight: 400 },
  pct: { fontSize: 15, fontWeight: 700, color: "var(--v-accent)" },
  bar: { height: 7, background: "var(--v-surface-2)", borderRadius: 999, overflow: "hidden", margin: "8px 0 10px" }, barFill: { height: "100%", background: "var(--v-accent)", borderRadius: 999 },
  kr: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0", color: "var(--v-ink)" },
  krN: { color: "var(--v-ink-2)", fontVariantNumeric: "tabular-nums" },
  krBtn: { width: 26, height: 26, borderRadius: 7, border: "1px solid var(--v-line)", background: "var(--v-surface)", color: "var(--v-ink)", cursor: "pointer", fontWeight: 700 },
  band: { fontSize: 12.5, fontWeight: 700 },
  sum: { fontSize: 13, color: "var(--v-ink-2)", lineHeight: 1.5, margin: "8px 0" },
  chips: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 },
  chip: { fontSize: 11.5, color: "var(--v-ink-2)", background: "var(--v-surface-2)", padding: "2px 8px", borderRadius: 6 },
  appRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 10, padding: "10px 13px", marginBottom: 6 },
  mini: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  orgRow: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--v-line-2)", color: "var(--v-ink)" },
}
