"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconCheck, IconAlert, IconBanknote } from "@/components/ui/Icons"

/* Admin pricing. These numbers are what customers are charged, so the page is
   deliberately blunt: it shows the shipped default next to the live price, marks
   anything overridden, warns before saving, and lets you put a plan back to its
   default in one click. Every change is written to the audit log. */

type Row = { id: string; name: string; audience?: string; unit?: string; tagline?: string; priceCHF: number; defaultCHF: number; overridden: boolean }

export default function AdminPricing() {
  const [data, setData] = useState<{ plans: Row[]; addons: Row[] } | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [denied, setDenied] = useState(false)

  async function load() {
    const r = await fetch("/api/admin/pricing")
    if (r.status === 403) { setDenied(true); return }
    const d = await r.json()
    setData(d)
    const init: Record<string, string> = {}
    for (const p of [...d.plans, ...d.addons]) init[p.id] = String(p.priceCHF)
    setDraft(init)
  }
  useEffect(() => { load() }, [])

  if (denied) return <AppShell title="Pricing"><div style={S.dim}>Admin access required.</div></AppShell>
  if (!data) return <AppShell title="Pricing"><div style={S.dim}>Loading pricing…</div></AppShell>

  const all = [...data.plans, ...data.addons]
  const changed = all.filter(p => String(p.priceCHF) !== (draft[p.id] ?? "").trim() && (draft[p.id] ?? "").trim() !== "")

  async function save() {
    if (!changed.length) return
    const summary = changed.map(c => `${c.name}: ${c.priceCHF} → ${draft[c.id]} CHF`).join("\n")
    if (!window.confirm(`This changes what customers are charged:\n\n${summary}\n\nApply now?`)) return
    setBusy(true); setMsg(null)
    const r = await fetch("/api/admin/pricing", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: changed.map(c => ({ id: c.id, priceCHF: Number(draft[c.id]) })) }),
    })
    const d = await r.json()
    setBusy(false)
    if (!r.ok) { setMsg({ kind: "err", text: d.error || "Could not save." }); return }
    const bad = (d.rejected || []).length
    setMsg({ kind: bad ? "err" : "ok", text: bad ? `${d.applied.length} saved, ${bad} rejected: ${d.rejected.map((x: any) => x.error).join("; ")}` : `${d.applied.length} price${d.applied.length === 1 ? "" : "s"} updated and live.` })
    load()
  }

  async function reset(id: string, name: string) {
    if (!window.confirm(`Put ${name} back to its shipped default price?`)) return
    setBusy(true)
    await fetch("/api/admin/pricing", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset: id }) })
    setBusy(false); setMsg({ kind: "ok", text: `${name} reset to default.` })
    load()
  }

  const Table = ({ title, rows, note }: { title: string; rows: Row[]; note?: string }) => (
    <section style={S.card}>
      <h2 style={S.h2}>{title}</h2>
      {note && <p style={S.note}>{note}</p>}
      <div style={S.table} data-table-wrap>
        <div data-table style={{ ...S.tr, ...S.th }}><span>Plan</span><span>Default</span><span>Live price (CHF/mo)</span><span /></div>
        {rows.map(p => {
          const edited = String(p.priceCHF) !== (draft[p.id] ?? "")
          return (
            <div key={p.id} data-table style={S.tr}>
              <span>
                <b style={S.name}>{p.name}</b>
                {p.overridden && <em style={S.tag}>changed</em>}
                <span style={S.meta}>{p.tagline || p.unit || p.audience}</span>
              </span>
              <span style={S.def}>{p.defaultCHF}</span>
              <span>
                <input type="number" min={0} step="0.01" value={draft[p.id] ?? ""}
                  onChange={e => setDraft({ ...draft, [p.id]: e.target.value })}
                  style={{ ...S.input, ...(edited ? S.inputEdited : {}) }} />
              </span>
              <span style={{ textAlign: "right" }}>
                {p.overridden && <button onClick={() => reset(p.id, p.name)} disabled={busy} style={S.mini}>Reset</button>}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )

  return (
    <AppShell title="Pricing">
      <div style={S.wrap}>
        <div style={S.head}>
          <div>
            <h1 style={S.h1}><IconBanknote size={20} /> Pricing</h1>
            <p style={S.sub}>Live prices for every plan. Changes take effect immediately on /pricing and /pay.</p>
          </div>
          <Link href="/admin" style={S.ghost}>← Admin</Link>
        </div>

        <div style={S.warn}>
          <IconAlert size={15} />
          <span>These are the amounts customers are charged. Prices are shown in CHF and converted to the buyer's currency at the live rate at checkout. Existing subscribers are not re-billed retroactively — a change applies to new charges.</span>
        </div>

        {msg && <div style={{ ...S.msg, ...(msg.kind === "err" ? S.msgErr : S.msgOk) }}>{msg.text}</div>}

        <Table title="Applicant plans" rows={data.plans.filter(p => p.audience === "individual")} />
        <Table title="Employer plans" rows={data.plans.filter(p => p.audience === "employer")} />
        <Table title="Add-ons" rows={data.addons} note="Charged per unit, per month, on top of a plan." />

        <div style={S.bar}>
          <span style={S.barText}>{changed.length ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}` : "No changes"}</span>
          <button onClick={save} disabled={!changed.length || busy} style={{ ...S.primary, ...(!changed.length || busy ? S.off : {}) }}>
            {busy ? "Saving…" : <><IconCheck size={15} /> Save prices</>}
          </button>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 900, margin: "0 auto", padding: "4px 4px 40px", display: "flex", flexDirection: "column", gap: 14 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
  h1: { display: "flex", alignItems: "center", gap: 9, fontSize: 24, fontWeight: 650, margin: 0, color: "var(--v-ink)", letterSpacing: "-.02em" },
  sub: { fontSize: 13.5, color: "var(--v-ink-3)", marginTop: 4 },
  h2: { fontSize: 16, fontWeight: 650, margin: "0 0 10px", color: "var(--v-ink)" },
  note: { fontSize: 12.5, color: "var(--v-ink-3)", margin: "-4px 0 10px" },
  ghost: { padding: "8px 14px", borderRadius: 10, border: "1px solid var(--v-line-2)", fontSize: 13, fontWeight: 600, color: "var(--v-ink)", textDecoration: "none" },
  warn: { display: "flex", gap: 10, alignItems: "flex-start", background: "#FFFAEB", color: "#93370D", padding: "12px 15px", borderRadius: 12, fontSize: 13, lineHeight: 1.6 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 18 },
  table: { display: "flex", flexDirection: "column" },
  tr: { display: "grid", gridTemplateColumns: "2fr .7fr 1.1fr .7fr", gap: 12, alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--v-line)", fontSize: 13.5 },
  th: { fontSize: 11, fontWeight: 700, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".05em" },
  name: { fontWeight: 650, color: "var(--v-ink)" },
  tag: { fontStyle: "normal", fontSize: 10.5, fontWeight: 700, color: "var(--v-accent)", background: "var(--v-accent-soft)", padding: "2px 7px", borderRadius: 999, marginLeft: 7 },
  meta: { display: "block", fontSize: 12, color: "var(--v-ink-3)", marginTop: 2 },
  def: { color: "var(--v-ink-3)", fontVariantNumeric: "tabular-nums" },
  input: { width: "100%", border: "1px solid var(--v-line-2)", borderRadius: 9, padding: "8px 10px", fontSize: 14, color: "var(--v-ink)", background: "var(--v-bg)", outline: "none", fontVariantNumeric: "tabular-nums", boxSizing: "border-box" },
  inputEdited: { borderColor: "var(--v-accent)", background: "var(--v-accent-soft)" },
  mini: { padding: "6px 11px", borderRadius: 8, border: "1px solid var(--v-line-2)", background: "transparent", color: "var(--v-ink-2)", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  bar: { position: "sticky", bottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 14, padding: "12px 16px", boxShadow: "0 8px 26px rgba(16,24,40,.10)" },
  barText: { fontSize: 13, color: "var(--v-ink-2)" },
  primary: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 11, border: "none", background: "var(--v-accent)", color: "#fff", fontSize: 14, fontWeight: 650, cursor: "pointer" },
  off: { opacity: .5, cursor: "not-allowed" },
  msg: { padding: "11px 14px", borderRadius: 11, fontSize: 13.5 },
  msgOk: { background: "var(--v-accent-soft)", color: "var(--v-accent)" },
  msgErr: { background: "#FEF3F2", color: "#B42318" },
  dim: { padding: 40, textAlign: "center", color: "var(--v-ink-3)" },
}
