"use client"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import CrmShell from "@/components/crm/CrmShell"
import { IconSearch, IconPlus, IconUser, IconMessage } from "@/components/ui/Icons"
import { STAGES, STAGE_META, formatMoney, initials, avatarColor } from "@/lib/crmMeta"

export default function ContactsPage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<any[]>([])
  const [pipeline, setPipeline] = useState<Record<string, any>>({})
  const [q, setQ] = useState("")
  const [stage, setStage] = useState("")
  const [sort, setSort] = useState("recent")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (stage) params.set("stage", stage)
    params.set("sort", sort)
    const d = await fetch("/api/crm/contacts?" + params).then(r => r.json())
    setContacts(d.contacts || [])
    setPipeline(d.pipeline || {})
    setLoading(false)
  }, [q, stage, sort])

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])

  const total = STAGES.filter(s => s !== "LOST").reduce((a, s) => a + (pipeline[s]?.value || 0), 0)

  return (
    <CrmShell>
      <div style={S.wrap}>
        <div style={S.head}>
          <div>
            <h1 style={S.title}>Contacts</h1>
            <p style={S.sub}>{contacts.length} shown · open pipeline {formatMoney(total)}</p>
          </div>
          <Link href="/contacts/new" style={S.addBtn}><IconPlus size={16} /> Add contact</Link>
        </div>

        <div style={S.toolbar}>
          <div style={S.searchWrap}>
            <IconSearch size={16} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, company…" style={S.search} />
          </div>
          <div style={S.chips}>
            <button onClick={() => setStage("")} style={{ ...S.chip, ...(stage === "" ? S.chipOn : {}) }}>All</button>
            {STAGES.map(s => (
              <button key={s} onClick={() => setStage(stage === s ? "" : s)} style={{ ...S.chip, ...(stage === s ? { background: STAGE_META[s].bg, color: STAGE_META[s].color, borderColor: STAGE_META[s].bg } : {}) }}>
                {STAGE_META[s].label}{pipeline[s]?.count ? ` ${pipeline[s].count}` : ""}
              </button>
            ))}
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)} style={S.sort}>
            <option value="recent">Recent activity</option>
            <option value="name">Name</option>
            <option value="value">Deal value</option>
            <option value="created">Newest</option>
          </select>
        </div>

        {loading ? (
          <div style={S.empty}>Loading…</div>
        ) : contacts.length === 0 ? (
          <div style={S.empty}>
            <span style={{ color: "#C7C4D1" }}><IconUser size={40} /></span>
            <p style={{ fontWeight: 600, color: "#4B4761", marginTop: 12 }}>No contacts yet</p>
            <p style={{ fontSize: 13, color: "#8A8595", marginTop: 4 }}>Add your first contact to start tracking relationships.</p>
            <Link href="/contacts/new" style={{ ...S.addBtn, marginTop: 16, display: "inline-flex" }}><IconPlus size={16} /> Add contact</Link>
          </div>
        ) : (
          <div style={S.list}>
            {contacts.map(c => {
              const m = STAGE_META[c.stage] || STAGE_META.LEAD
              return (
                <div key={c.id} onClick={() => router.push(`/contacts/${c.id}`)} style={S.row}>
                  <div style={{ ...S.avatar, background: avatarColor(c.id) }}>{initials(c.firstName, c.lastName)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.name}>{c.firstName} {c.lastName}</div>
                    <div style={S.meta}>{[c.jobTitle, c.company].filter(Boolean).join(" · ") || c.email || "—"}</div>
                  </div>
                  <div style={S.tagsRow}>
                    {c.tags.slice(0, 2).map((t: string) => <span key={t} style={S.tag}>{t}</span>)}
                  </div>
                  {c.messageCount > 0 && <span style={S.msgCount}><IconMessage size={13} /> {c.messageCount}</span>}
                  <span style={S.value}>{formatMoney(c.value, c.currency)}</span>
                  <span style={{ ...S.stagePill, background: m.bg, color: m.color }}>{m.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </CrmShell>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 1080, margin: "0 auto", padding: "2rem" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 },
  title: { fontSize: 24, fontWeight: 700, color: "#1A1A2E", letterSpacing: "-.02em" },
  sub: { fontSize: 13.5, color: "#8A8595", marginTop: 3 },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 7, background: "#0F6E56", color: "#fff", padding: "10px 16px", borderRadius: 9, fontSize: 14, fontWeight: 600, textDecoration: "none" },
  toolbar: { display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" },
  searchWrap: { display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #E7E6EC", borderRadius: 10, padding: "0 12px", color: "#9A96A5", flex: 1, minWidth: 220 },
  search: { border: "none", outline: "none", padding: "11px 0", fontSize: 14, flex: 1, background: "transparent", color: "#1A1A2E" },
  chips: { display: "flex", gap: 6, flexWrap: "wrap" },
  chip: { border: "1px solid #E7E6EC", background: "#fff", borderRadius: 999, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, color: "#6B6777", cursor: "pointer" },
  chipOn: { background: "#E1F5EE", color: "#0F6E56", borderColor: "#E1F5EE" },
  sort: { border: "1px solid #E7E6EC", background: "#fff", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#4B4761", cursor: "pointer" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: { display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "1px solid #ECEBF0", borderRadius: 12, padding: "13px 18px", cursor: "pointer", transition: "border-color .12s, box-shadow .12s" },
  avatar: { width: 42, height: 42, borderRadius: 11, color: "#fff", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 },
  name: { fontSize: 15, fontWeight: 600, color: "#1A1A2E" },
  meta: { fontSize: 13, color: "#8A8595", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  tagsRow: { display: "flex", gap: 5 },
  tag: { fontSize: 11, color: "#6B6777", background: "#F3F4F6", border: "1px solid #ECEBF0", padding: "3px 8px", borderRadius: 6 },
  msgCount: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#8A8595" },
  value: { fontSize: 13.5, fontWeight: 600, color: "#1A1A2E", fontVariantNumeric: "tabular-nums", minWidth: 92, textAlign: "right" },
  stagePill: { fontSize: 11.5, fontWeight: 600, padding: "4px 11px", borderRadius: 999, minWidth: 74, textAlign: "center" },
  empty: { background: "#fff", border: "1px solid #ECEBF0", borderRadius: 14, padding: "3.5rem 2rem", textAlign: "center", color: "#8A8595" },
}
