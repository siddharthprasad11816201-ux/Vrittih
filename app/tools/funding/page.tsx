"use client"
import { useMemo, useState } from "react"
import AppShell from "@/components/vrittih/AppShell"
import { FUNDING, F_TYPES, F_REGIONS, F_STAGES } from "@/lib/funding"
import { IconSearch, IconArrowRight, IconGlobe } from "@/components/ui/Icons"

const TYPE_COLOR: Record<string, string> = {
  VC: "#5A4FB0", Angel: "#B45309", Accelerator: "#0F6E56", Grant: "#185FA5",
  Government: "#0B6B45", Foundation: "#8a5a12", Scholarship: "#A32D2D",
}

export default function FundingFinder() {
  const [q, setQ] = useState("")
  const [type, setType] = useState("")
  const [region, setRegion] = useState("")
  const [stage, setStage] = useState("")

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    return FUNDING.filter(f =>
      (!type || f.type === type) &&
      (!region || f.region === region) &&
      (!stage || f.stage.includes(stage)) &&
      (!term || (f.name + " " + f.desc + " " + f.focus.join(" ") + " " + f.type).toLowerCase().includes(term))
    )
  }, [q, type, region, stage])

  const Chip = ({ label, active, on }: { label: string; active: boolean; on: () => void }) =>
    <button onClick={on} className={"ffChip" + (active ? " on" : "")}>{label}</button>

  return (
    <AppShell title="Funding finder">
      <style>{CSS}</style>
      <div className="ff">
        <header className="ffHead">
          <h1 className="ffTitle">Funding &amp; investors</h1>
          <p className="ffSub">A curated directory of real grant agencies, VCs, angels, accelerators and scholarships — for students, researchers and early-career founders. Search and filter to find the right fit.</p>
        </header>

        <div className="ffSearch">
          <IconSearch size={16} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, focus or keyword (e.g. deeptech, health, seed)…" />
        </div>

        <div className="ffFilters">
          <div className="ffRow"><span className="ffLabel">Type</span><Chip label="All" active={!type} on={() => setType("")} />{F_TYPES.map(t => <Chip key={t} label={t} active={type === t} on={() => setType(type === t ? "" : t)} />)}</div>
          <div className="ffRow"><span className="ffLabel">Region</span><Chip label="All" active={!region} on={() => setRegion("")} />{F_REGIONS.map(r => <Chip key={r} label={r} active={region === r} on={() => setRegion(region === r ? "" : r)} />)}</div>
          <div className="ffRow"><span className="ffLabel">Stage</span><Chip label="All" active={!stage} on={() => setStage("")} />{F_STAGES.map(s => <Chip key={s} label={s} active={stage === s} on={() => setStage(stage === s ? "" : s)} />)}</div>
        </div>

        <div className="ffCount">{results.length} source{results.length === 1 ? "" : "s"}</div>

        <div className="ffGrid">
          {results.map(f => (
            <a key={f.name} href={f.url} target="_blank" rel="noreferrer" className="ffCard">
              <div className="ffCardTop">
                <span className="ffType" style={{ background: `${TYPE_COLOR[f.type]}18`, color: TYPE_COLOR[f.type] }}>{f.type}</span>
                <span className="ffRegion"><IconGlobe size={12} /> {f.region}</span>
              </div>
              <div className="ffName">{f.name}</div>
              <p className="ffDesc">{f.desc}</p>
              <div className="ffTags">{f.focus.slice(0, 4).map(t => <span key={t} className="ffTag">{t}</span>)}</div>
              <div className="ffFoot"><span className="ffTicket">{f.ticket}</span><span className="ffVisit">Visit <IconArrowRight size={13} /></span></div>
            </a>
          ))}
          {results.length === 0 && <p className="ffEmpty">No matches — try clearing a filter.</p>}
        </div>
      </div>
    </AppShell>
  )
}

const CSS = `
.ff{ max-width:1000px; margin:0 auto; padding:clamp(1.25rem,3vw,2rem); }
.ffHead{ margin-bottom:18px; }
.ffTitle{ font-family:var(--font-display); font-size:clamp(1.6rem,3vw,2.1rem); font-weight:600; color:var(--v-ink); letter-spacing:-.02em; }
.ffSub{ font-size:14.5px; color:var(--v-ink-2); margin-top:5px; max-width:66ch; line-height:1.55; }
.ffSearch{ display:flex; align-items:center; gap:10px; background:var(--v-surface); border:1px solid var(--v-line-2); border-radius:12px; padding:0 14px; color:var(--v-ink-3); margin-bottom:14px; }
.ffSearch input{ border:none; outline:none; padding:12px 0; font-size:14.5px; width:100%; background:none; color:var(--v-ink); }
.ffFilters{ display:flex; flex-direction:column; gap:9px; margin-bottom:16px; }
.ffRow{ display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.ffLabel{ font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--v-ink-3); width:56px; flex-shrink:0; }
.ffChip{ background:var(--v-surface); border:1px solid var(--v-line); border-radius:999px; padding:6px 13px; font-size:12.5px; font-weight:500; color:var(--v-ink-2); cursor:pointer; text-transform:capitalize; }
.ffChip.on{ background:var(--brand-900); color:#fff; border-color:var(--brand-900); }
.ffCount{ font-size:12.5px; color:var(--v-ink-3); margin-bottom:12px; }
.ffGrid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; }
.ffCard{ display:flex; flex-direction:column; background:var(--v-surface); border:1px solid var(--v-line); border-radius:15px; padding:18px; text-decoration:none; box-shadow:var(--v-shadow-sm); transition:transform .16s var(--v-ease), box-shadow .16s, border-color .16s; }
.ffCard:hover{ transform:translateY(-3px); box-shadow:var(--v-shadow); border-color:var(--v-line-2); }
.ffCardTop{ display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.ffType{ font-size:11px; font-weight:700; padding:3px 10px; border-radius:999px; }
.ffRegion{ display:inline-flex; align-items:center; gap:4px; font-size:11.5px; color:var(--v-ink-3); }
.ffName{ font-size:16px; font-weight:650; color:var(--v-ink); }
.ffDesc{ font-size:13px; color:var(--v-ink-2); line-height:1.5; margin:6px 0 12px; flex:1; }
.ffTags{ display:flex; flex-wrap:wrap; gap:5px; margin-bottom:12px; }
.ffTag{ font-size:11px; color:var(--brand-700); background:var(--brand-100); padding:2px 9px; border-radius:999px; text-transform:capitalize; }
.ffFoot{ display:flex; justify-content:space-between; align-items:center; padding-top:11px; border-top:1px solid var(--v-line); }
.ffTicket{ font-size:12px; font-weight:600; color:var(--v-ink); }
.ffVisit{ display:inline-flex; align-items:center; gap:5px; font-size:12.5px; font-weight:600; color:var(--brand-700); }
.ffEmpty{ grid-column:1/-1; text-align:center; color:var(--v-ink-3); padding:2rem; }
`
