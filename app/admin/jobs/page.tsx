"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import AdminShell, { AdminTopBar } from "@/components/admin/AdminShell"
import { IconSearch, IconCheckCircle, IconX, IconArrowRight, IconTrash, IconHelp } from "@/components/ui/Icons"

const FILTERS = ["All", "Active", "Deactivated"] as const
const rel = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  return d <= 0 ? "today" : d === 1 ? "1d ago" : d < 30 ? `${d}d ago` : d < 365 ? `${Math.floor(d / 30)}mo ago` : `${Math.floor(d / 365)}y ago`
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<typeof FILTERS[number]>("All")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState(0)
  const [drawer, setDrawer] = useState<any>(null)
  const [help, setHelp] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    params.set("page", String(page))
    const d = await fetch("/api/admin/jobs?" + params).then(r => r.json())
    if (d.error) { setError(d.error); setLoading(false); return }
    setJobs(d.jobs || []); setTotal(d.total || 0); setLoading(false); setSel(new Set())
  }, [q, page])
  useEffect(() => { load() }, [load])

  const shown = jobs.filter(j => filter === "All" || (filter === "Active" ? j.active : !j.active))

  async function act(ids: string[], action: "activate" | "deactivate" | "delete") {
    setBusy(true)
    for (const jobId of ids) {
      if (action === "delete") await fetch("/api/admin/jobs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) })
      else await fetch("/api/admin/jobs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId, active: action === "activate" }) })
    }
    setBusy(false); setDrawer(null); await load()
  }
  const toggleSel = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  // keyboard triage: j/k move, x select, e deactivate, enter open, ? help, esc close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return
      if (e.key === "?") { setHelp(h => !h); return }
      if (e.key === "Escape") { setDrawer(null); setHelp(false); return }
      if (!shown.length) return
      if (e.key === "j") { e.preventDefault(); setCursor(c => Math.min(shown.length - 1, c + 1)) }
      else if (e.key === "k") { e.preventDefault(); setCursor(c => Math.max(0, c - 1)) }
      else if (e.key === "x") { e.preventDefault(); toggleSel(shown[cursor]?.id) }
      else if (e.key === "e") { e.preventDefault(); const j = shown[cursor]; if (j) act([j.id], j.active ? "deactivate" : "activate") }
      else if (e.key === "Enter") { e.preventDefault(); setDrawer(shown[cursor]) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [shown, cursor])

  const allSel = shown.length > 0 && shown.every(j => sel.has(j.id))

  return (
    <AdminShell>
      <style>{CSS}</style>
      <AdminTopBar title={<>Jobs <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 16 }}>({total})</span></>}
        subtitle="Moderate every job posting — triage-grade controls"
        right={<button onClick={() => setHelp(true)} className="ajHelp"><IconHelp size={14} /> Shortcuts</button>} />

      <div className="ajBar">
        <span className="ajSearch"><IconSearch size={15} /><input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search title or company…" /></span>
        <div className="ajChips">
          {FILTERS.map(f => {
            const n = f === "All" ? jobs.length : f === "Active" ? jobs.filter(j => j.active).length : jobs.filter(j => !j.active).length
            return <button key={f} onClick={() => setFilter(f)} className={"ajChip" + (filter === f ? " on" : "")}>{f}<span className="ajChipN">{n}</span></button>
          })}
        </div>
      </div>

      {error ? <div className="ajErr">{error}<br /><small>Your account role must be ADMIN or SUPER_ADMIN.</small></div> : (
        <div className="ajWrap">
          <table className="ajTable">
            <thead><tr>
              <th style={{ width: 40 }}><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(shown.map(j => j.id)))} /></th>
              {["Title", "Company", "Applications", "Posted", "Status"].map(h => <th key={h}>{h}</th>)}
              <th style={{ width: 44 }} />
            </tr></thead>
            <tbody>
              {loading ? [0, 1, 2, 3].map(i => <tr key={i}><td colSpan={7}><div className="v-skeleton" style={{ height: 22, margin: "10px 0" }} /></td></tr>)
                : shown.length === 0 ? <tr><td colSpan={7} className="ajEmpty">No jobs match this view.</td></tr>
                  : shown.map((j, i) => (
                    <tr key={j.id} className={"ajRow" + (i === cursor ? " cur" : "") + (sel.has(j.id) ? " sel" : "")} onClick={() => { setCursor(i); setDrawer(j) }}>
                      <td onClick={e => { e.stopPropagation(); toggleSel(j.id) }}><input type="checkbox" checked={sel.has(j.id)} readOnly /></td>
                      <td><span className="ajTitle">{j.title}</span><span className="ajInd">{j.industry}</span></td>
                      <td>
                        <span className="ajco">{j.company}</span>
                        {j.postedBy?.idVerified && <span className="v-gold ajVer"><IconCheckCircle size={11} /> Verified</span>}
                      </td>
                      <td><Link href={`/jobs/${j.id}`} onClick={e => e.stopPropagation()} className="ajLink">{j._count?.applications ?? 0}</Link></td>
                      <td><span className="ajTime" title={new Date(j.createdAt).toLocaleString()}>{rel(j.createdAt)}</span></td>
                      <td><span className={"ajPill " + (j.active ? "on" : "off")}>{j.active ? "Active" : "Deactivated"}</span></td>
                      <td onClick={e => e.stopPropagation()}><button className="ajKebab" onClick={() => setDrawer(j)}>⋯</button></td>
                    </tr>
                  ))}
            </tbody>
          </table>

          <div className="ajFoot">
            <span>{shown.length ? `1–${shown.length}` : "0"} of {total}</span>
            <div className="ajPag">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="ajPage">← Prev</button>
              <span className="ajPageN">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={jobs.length < 20} className="ajPage">Next →</button>
            </div>
          </div>
        </div>
      )}

      {/* floating glass bulk action bar */}
      {sel.size > 0 && (
        <div className="ajBulk v-glass">
          <span className="ajBulkN">{sel.size} selected</span>
          <button onClick={() => act([...sel], "activate")} disabled={busy} className="ajBulkBtn">Activate</button>
          <button onClick={() => act([...sel], "deactivate")} disabled={busy} className="ajBulkBtn">Deactivate</button>
          <button onClick={() => { if (confirm(`Delete ${sel.size} job(s) permanently? Their applications are removed too.`)) act([...sel], "delete") }} disabled={busy} className="ajBulkBtn danger">Delete</button>
          <button onClick={() => setSel(new Set())} className="ajBulkX"><IconX size={15} /></button>
        </div>
      )}

      {/* side detail drawer */}
      {drawer && (
        <>
          <div className="ajScrim" onClick={() => setDrawer(null)} />
          <aside className="ajDrawer">
            <div className="ajDrawerHead">
              <span className={"ajPill " + (drawer.active ? "on" : "off")}>{drawer.active ? "Active" : "Deactivated"}</span>
              <button onClick={() => setDrawer(null)} className="ajKebab"><IconX size={16} /></button>
            </div>
            <h2 className="ajDTitle">{drawer.title}</h2>
            <div className="ajDMeta">{drawer.company} · {drawer.location} · {drawer.type}</div>
            {drawer.postedBy?.idVerified && <span className="v-gold ajVer" style={{ marginTop: 8 }}><IconCheckCircle size={11} /> Verified employer</span>}
            <div className="ajDGrid">
              <div><div className="ajDLabel">Industry</div><div className="ajDVal">{drawer.industry}</div></div>
              <div><div className="ajDLabel">Applications</div><div className="ajDVal">{drawer._count?.applications ?? 0}</div></div>
              <div><div className="ajDLabel">Posted by</div><div className="ajDVal">{drawer.postedBy?.name || "—"}</div></div>
              <div><div className="ajDLabel">Posted</div><div className="ajDVal">{new Date(drawer.createdAt).toLocaleDateString()}</div></div>
            </div>
            {drawer.description && <p className="ajDDesc">{drawer.description}</p>}
            <div className="ajDActions">
              <button onClick={() => act([drawer.id], drawer.active ? "deactivate" : "activate")} disabled={busy} className="ajDBtn">{drawer.active ? "Deactivate" : "Activate"}</button>
              <Link href={`/jobs/${drawer.id}`} className="ajDBtn ghost">View public page <IconArrowRight size={14} /></Link>
              <button onClick={() => { if (confirm("Delete this job permanently? Applications attached will be removed.")) act([drawer.id], "delete") }} disabled={busy} className="ajDBtn danger"><IconTrash size={14} /> Delete</button>
            </div>
          </aside>
        </>
      )}

      {/* keyboard shortcuts sheet */}
      {help && (
        <div className="ajScrim center" onClick={() => setHelp(false)}>
          <div className="ajSheet" onClick={e => e.stopPropagation()}>
            <h3 className="ajSheetH">Keyboard shortcuts</h3>
            {[["j / k", "Move down / up"], ["x", "Select row"], ["e", "Activate / deactivate"], ["Enter", "Open details"], ["?", "Toggle this sheet"], ["Esc", "Close"]].map(([k, d]) => (
              <div key={k} className="ajSheetRow"><kbd className="ajKbd">{k}</kbd><span>{d}</span></div>
            ))}
          </div>
        </div>
      )}
    </AdminShell>
  )
}

const CSS = `
.ajHelp { display:inline-flex; align-items:center; gap:6px; background:#fff; border:1px solid rgba(0,0,0,.12); border-radius:8px; padding:6px 12px; font-size:12.5px; color:#3D3D4E; cursor:pointer; }
.ajBar { display:flex; align-items:center; gap:16px; padding:1rem 2rem; background:#fff; border-bottom:1px solid rgba(0,0,0,.06); flex-wrap:wrap; }
.ajSearch { display:flex; align-items:center; gap:8px; flex:1; max-width:340px; border:1px solid rgba(0,0,0,.13); border-radius:10px; padding:0 12px; color:#9ca3af; }
.ajSearch input { border:none; outline:none; padding:9px 0; font-size:13.5px; width:100%; color:#0A0A0F; }
.ajChips { display:flex; gap:6px; }
.ajChip { display:inline-flex; align-items:center; gap:7px; background:#F3F0E7; border:1px solid transparent; border-radius:999px; padding:7px 14px; font-size:13px; font-weight:500; color:#3D3D4E; cursor:pointer; }
.ajChip.on { background:#0F6E56; color:#fff; }
.ajChipN { font-size:11px; opacity:.75; background:rgba(0,0,0,.06); padding:1px 7px; border-radius:999px; }
.ajChip.on .ajChipN { background:rgba(255,255,255,.2); }
.ajErr { margin:2rem; background:#FBEBEB; border:1px solid #E7C9C9; border-radius:12px; padding:1.5rem; font-size:14px; color:#A32D2D; text-align:center; }
.ajWrap { padding:0 0 6rem; }
.ajTable { width:100%; border-collapse:collapse; font-size:13.5px; }
.ajTable thead th { padding:11px 16px; text-align:left; font-size:11px; color:#9ca3af; font-weight:600; text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid rgba(0,0,0,.07); background:#FBFAF6; }
.ajRow { border-bottom:1px solid rgba(0,0,0,.04); cursor:pointer; transition:background .12s; }
.ajRow td { padding:12px 16px; vertical-align:middle; }
.ajRow:hover { background:#FAF8F2; }
.ajRow.cur { background:#E1F5EE; box-shadow:inset 3px 0 0 #0F6E56; }
.ajRow.sel { background:#EAF6F1; }
.ajTitle { font-weight:600; color:#0A0A0F; display:block; }
.ajInd { font-size:11.5px; color:#9ca3af; }
.ajco { font-size:13px; color:#3D3D4E; }
.ajVer { display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:999px; margin-left:8px; }
.ajLink { color:#0F6E56; font-weight:600; text-decoration:none; }
.ajTime { font-family:var(--font-mono); font-size:12px; color:#6b7280; }
.ajPill { font-size:11px; font-weight:600; padding:3px 10px; border-radius:999px; }
.ajPill.on { background:#E1F5EE; color:#0B6B45; }
.ajPill.off { background:#F3EDE3; color:#8a6d3b; }
.ajKebab { background:none; border:none; font-size:18px; color:#9ca3af; cursor:pointer; padding:2px 8px; border-radius:6px; line-height:1; }
.ajKebab:hover { background:rgba(0,0,0,.06); color:#0A0A0F; }
.ajEmpty { padding:2.5rem; text-align:center; color:#9ca3af; }
.ajFoot { display:flex; align-items:center; justify-content:space-between; padding:1rem 2rem; font-size:13px; color:#6b7280; }
.ajPag { display:flex; align-items:center; gap:12px; }
.ajPage { background:#fff; border:1px solid rgba(0,0,0,.13); border-radius:8px; padding:6px 14px; font-size:13px; cursor:pointer; color:#3D3D4E; }
.ajPage:disabled { opacity:.4; cursor:default; }

.ajBulk { position:fixed; bottom:26px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:10px; padding:10px 12px 10px 18px; border-radius:14px; z-index:60; }
.ajBulkN { font-size:13px; font-weight:700; color:#0A0A0F; margin-right:4px; }
.ajBulkBtn { background:#0F6E56; color:#fff; border:none; border-radius:9px; padding:8px 15px; font-size:13px; font-weight:600; cursor:pointer; }
.ajBulkBtn.danger { background:#A32D2D; }
.ajBulkBtn:disabled { opacity:.6; }
.ajBulkX { background:rgba(0,0,0,.06); border:none; border-radius:8px; padding:8px; cursor:pointer; color:#3D3D4E; display:flex; }

.ajScrim { position:fixed; inset:0; background:rgba(4,52,44,.28); z-index:70; animation:ajFade .2s ease; }
.ajScrim.center { display:grid; place-items:center; }
@keyframes ajFade { from { opacity:0; } }
.ajDrawer { position:fixed; top:0; right:0; height:100vh; width:min(420px,92vw); background:#fff; z-index:71; box-shadow:-20px 0 60px rgba(4,52,44,.18); padding:1.5rem; overflow-y:auto; animation:ajSlide .28s var(--v-ease); }
@keyframes ajSlide { from { transform:translateX(100%); } }
.ajDrawerHead { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.ajDTitle { font-family:var(--font-display); font-size:22px; font-weight:600; color:#0A0A0F; letter-spacing:-.02em; }
.ajDMeta { font-size:13px; color:#6b7280; margin-top:4px; }
.ajDGrid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:20px 0; padding:16px 0; border-top:1px solid rgba(0,0,0,.07); border-bottom:1px solid rgba(0,0,0,.07); }
.ajDLabel { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#9ca3af; font-weight:600; }
.ajDVal { font-size:14px; color:#0A0A0F; margin-top:3px; }
.ajDDesc { font-size:13px; line-height:1.6; color:#3D3D4E; margin-bottom:20px; white-space:pre-wrap; }
.ajDActions { display:flex; flex-direction:column; gap:8px; }
.ajDBtn { display:inline-flex; align-items:center; justify-content:center; gap:7px; background:#0F6E56; color:#fff; border:none; border-radius:10px; padding:11px; font-size:13.5px; font-weight:600; cursor:pointer; text-decoration:none; }
.ajDBtn.ghost { background:#fff; border:1px solid rgba(0,0,0,.13); color:#0A0A0F; }
.ajDBtn.danger { background:#fff; border:1px solid rgba(163,45,45,.3); color:#A32D2D; }

.ajSheet { background:#fff; border-radius:16px; padding:1.5rem 1.75rem; width:min(360px,90vw); box-shadow:var(--v-shadow-lg); z-index:72; }
.ajSheetH { font-family:var(--font-display); font-size:18px; font-weight:600; margin-bottom:14px; color:#0A0A0F; }
.ajSheetRow { display:flex; align-items:center; gap:14px; padding:7px 0; font-size:13.5px; color:#3D3D4E; }
.ajKbd { font-family:var(--font-mono); font-size:12px; background:#F3F0E7; border:1px solid rgba(0,0,0,.1); border-radius:6px; padding:3px 9px; min-width:64px; text-align:center; }
`
