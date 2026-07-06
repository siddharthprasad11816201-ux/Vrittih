"use client"
import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import CrmShell from "@/components/crm/CrmShell"
import { STAGES, STAGE_META, formatMoney, initials, avatarColor } from "@/lib/crmMeta"

const BOARD = ["LEAD", "QUALIFIED", "PROPOSAL", "WON"] as const

export default function PipelinePage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const d = await fetch("/api/crm/contacts?limit=100&sort=value").then(r => r.json())
    setContacts(d.contacts || []); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function move(id: string, stage: string) {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, stage } : c)) // optimistic
    await fetch(`/api/crm/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) })
    load()
  }

  const byStage = (s: string) => contacts.filter(c => c.stage === s)
  const colTotal = (s: string) => byStage(s).reduce((a, c) => a + (c.value || 0), 0)

  return (
    <CrmShell>
      <div style={S.wrap}>
        <div style={S.head}>
          <div>
            <h1 style={S.title}>Pipeline</h1>
            <p style={S.sub}>Drag a card to move a deal between stages</p>
          </div>
        </div>

        {loading ? <div style={{ color: "#8A8595", padding: "2rem" }}>Loading…</div> : (
          <div style={S.board}>
            {BOARD.map(s => {
              const m = STAGE_META[s]
              const items = byStage(s)
              return (
                <div key={s}
                  onDragOver={e => { e.preventDefault(); setOverStage(s) }}
                  onDragLeave={() => setOverStage(o => o === s ? null : o)}
                  onDrop={() => { if (dragId) move(dragId, s); setDragId(null); setOverStage(null) }}
                  style={{ ...S.col, ...(overStage === s ? S.colOver : {}) }}>
                  <div style={S.colHead}>
                    <span style={{ ...S.colDot, background: m.color }} />
                    <span style={S.colName}>{m.label}</span>
                    <span style={S.colCount}>{items.length}</span>
                  </div>
                  <div style={S.colTotal}>{formatMoney(colTotal(s))}</div>
                  <div style={S.cards}>
                    {items.map(c => (
                      <div key={c.id} draggable
                        onDragStart={() => setDragId(c.id)}
                        onDragEnd={() => { setDragId(null); setOverStage(null) }}
                        onClick={() => router.push(`/contacts/${c.id}`)}
                        style={{ ...S.dcard, opacity: dragId === c.id ? 0.5 : 1 }}>
                        <div style={S.dcardTop}>
                          <div style={{ ...S.avatar, background: avatarColor(c.id) }}>{initials(c.firstName, c.lastName)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={S.dname}>{c.firstName} {c.lastName}</div>
                            {c.company && <div style={S.dcompany}>{c.company}</div>}
                          </div>
                        </div>
                        {c.value > 0 && <div style={S.dvalue}>{formatMoney(c.value, c.currency)}</div>}
                        {c.tags.length > 0 && <div style={S.dtags}>{c.tags.slice(0, 3).map((t: string) => <span key={t} style={S.dtag}>{t}</span>)}</div>}
                      </div>
                    ))}
                    {items.length === 0 && <div style={S.drop}>Drop here</div>}
                  </div>
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
  wrap: { padding: "2rem", height: "100%" },
  head: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 700, color: "#1A1A2E", letterSpacing: "-.02em" },
  sub: { fontSize: 13.5, color: "#8A8595", marginTop: 3 },
  board: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, alignItems: "start" },
  col: { background: "#F0F0F4", borderRadius: 14, padding: 12, minHeight: 200, border: "2px solid transparent", transition: "border-color .12s, background .12s" },
  colOver: { borderColor: "#534AB7", background: "#EEEDF9" },
  colHead: { display: "flex", alignItems: "center", gap: 8, padding: "2px 4px" },
  colDot: { width: 8, height: 8, borderRadius: "50%" },
  colName: { fontSize: 13.5, fontWeight: 700, color: "#2A2A3E" },
  colCount: { fontSize: 12, fontWeight: 600, color: "#8A8595", background: "#fff", borderRadius: 999, padding: "1px 8px", marginLeft: "auto" },
  colTotal: { fontSize: 12, color: "#8A8595", padding: "2px 4px 10px", fontWeight: 600 },
  cards: { display: "flex", flexDirection: "column", gap: 8 },
  dcard: { background: "#fff", border: "1px solid #E7E6EC", borderRadius: 11, padding: 12, cursor: "grab", boxShadow: "0 1px 2px rgba(20,15,40,.04)" },
  dcardTop: { display: "flex", gap: 10, alignItems: "center" },
  avatar: { width: 34, height: 34, borderRadius: 9, color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  dname: { fontSize: 13.5, fontWeight: 600, color: "#1A1A2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  dcompany: { fontSize: 12, color: "#8A8595", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  dvalue: { fontSize: 13, fontWeight: 700, color: "#047857", marginTop: 9 },
  dtags: { display: "flex", gap: 5, flexWrap: "wrap", marginTop: 9 },
  dtag: { fontSize: 10.5, color: "#6B6777", background: "#F3F4F6", padding: "2px 7px", borderRadius: 5 },
  drop: { border: "1.5px dashed #D4D2DC", borderRadius: 10, padding: "18px 0", textAlign: "center", fontSize: 12.5, color: "#B4B0BE" },
}
