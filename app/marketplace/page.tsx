"use client"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import EmptyState from "@/components/vrittih/EmptyState"
import { IconZap, IconStar, IconSearch, IconCheck } from "@/components/ui/Icons"

type Item = {
  slug: string; name: string; kind: string; category: string | null; summary: string | null
  author: string; installs: number; rating: { avg: number | null; count: number }
  installed: boolean; mine: boolean; runnable: boolean; status: string
}
const KINDS = ["ALL", "AGENT", "PROMPT", "WORKFLOW", "TOOL"]
const SORTS: [string, string][] = [["installs", "Popular"], ["rating", "Top rated"], ["new", "Newest"]]

export default function MarketplacePage() {
  const [tab, setTab] = useState<"browse" | "installed" | "mine">("browse")
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [q, setQ] = useState("")
  const [kind, setKind] = useState("ALL")
  const [sort, setSort] = useState("installs")
  const [showPublish, setShowPublish] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setErr(false)
    try {
      const p = new URLSearchParams()
      if (q) p.set("q", q)
      if (kind !== "ALL") p.set("kind", kind)
      p.set("sort", sort)
      if (tab === "installed") p.set("installed", "1")
      if (tab === "mine") p.set("mine", "1")
      const r = await fetch("/api/marketplace?" + p.toString())
      if (!r.ok) throw new Error(String(r.status))
      const d = await r.json()
      setItems(d.items || [])
    } catch { setErr(true); setItems([]) }
    finally { setLoading(false) }
  }, [q, kind, sort, tab])

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])

  async function toggleInstall(slug: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    setItems(prev => prev.map(i => i.slug === slug ? { ...i, installed: !i.installed, installs: i.installs + (i.installed ? -1 : 1) } : i)) // optimistic
    try { await fetch(`/api/marketplace/${slug}/install`, { method: "POST" }) } catch {}
  }

  return (
    <AppShell title="AI Marketplace">
      <div style={S.wrap}>
        <div style={S.head}>
          <div>
            <h1 style={S.h1}>AI Marketplace</h1>
            <p style={S.sub}>Install evidence-based agents that run on the Enterprise Brain — and publish your own prompts &amp; workflows.</p>
          </div>
          <button onClick={() => setShowPublish(true)} style={S.publishBtn}>Publish</button>
        </div>

        <div style={S.tabs}>
          {(["browse", "installed", "mine"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}>
              {t === "browse" ? "Browse" : t === "installed" ? "Installed" : "My items"}
            </button>
          ))}
        </div>

        <div style={S.controls}>
          <div style={S.searchBox}>
            <IconSearch size={16} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search agents, prompts, workflows…" style={S.searchInput} />
          </div>
          <div style={S.sortRow}>
            {SORTS.map(([k, label]) => (
              <button key={k} onClick={() => setSort(k)} style={{ ...S.sortBtn, ...(sort === k ? S.sortOn : {}) }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={S.kinds}>
          {KINDS.map(k => (
            <button key={k} onClick={() => setKind(k)} style={{ ...S.kindChip, ...(kind === k ? S.kindOn : {}) }}>{k === "ALL" ? "All" : k.charAt(0) + k.slice(1).toLowerCase()}</button>
          ))}
        </div>

        {loading ? (
          <div style={S.center}>Loading marketplace…</div>
        ) : err ? (
          <div style={S.center}>Couldn&rsquo;t load the marketplace. <button onClick={load} style={S.retry}>Retry</button></div>
        ) : items.length === 0 ? (
          <EmptyState
            title={tab === "installed" ? "No installed items yet" : tab === "mine" ? "You haven't published anything yet" : "Nothing matches your filters"}
            reason={tab === "installed" ? "Install an agent from Browse to run it from here." : tab === "mine" ? "Publish a prompt or workflow to share it with the platform." : "Try a broader search or a different category."}
            ctaLabel={tab === "mine" ? "Publish an item" : "Browse all"}
            onCta={() => tab === "mine" ? setShowPublish(true) : (setTab("browse"), setKind("ALL"), setQ(""))}
          />
        ) : (
          <div style={S.grid}>
            {items.map(it => (
              <Link key={it.slug} href={`/marketplace/${it.slug}`} style={S.card}>
                <div style={S.cardTop}>
                  <span style={{ ...S.kindBadge, ...(it.kind === "AGENT" ? S.kindAgent : {}) }}>{it.kind === "AGENT" && <IconZap size={11} />}{it.kind.toLowerCase()}</span>
                  {it.mine && <span style={S.mineTag}>Yours</span>}
                </div>
                <div style={S.cardName}>{it.name}</div>
                <div style={S.cardSummary}>{it.summary}</div>
                <div style={S.cardMeta}>
                  <span style={S.rating}>
                    {it.rating.avg != null ? <><IconStar size={12} /> {it.rating.avg} <span style={S.muted}>({it.rating.count})</span></> : <span style={S.muted}>New</span>}
                  </span>
                  <span style={S.muted}>{it.installs} install{it.installs === 1 ? "" : "s"}</span>
                </div>
                <div style={S.cardFoot}>
                  <span style={S.author}>{it.author}</span>
                  <button onClick={e => toggleInstall(it.slug, e)} style={{ ...S.installBtn, ...(it.installed ? S.installedBtn : {}) }}>
                    {it.installed ? <><IconCheck size={13} /> Installed</> : "Install"}
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      {showPublish && <PublishModal onClose={() => setShowPublish(false)} onDone={() => { setShowPublish(false); setTab("mine"); load() }} />}
    </AppShell>
  )
}

function PublishModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: "", kind: "PROMPT", category: "", summary: "", spec: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function submit(e: any) {
    e.preventDefault()
    setSaving(true); setError("")
    try {
      const r = await fetch("/api/marketplace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, kind: form.kind, category: form.category || undefined, summary: form.summary || undefined, spec: form.spec || undefined }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.success) { setError(d.error || "Couldn't publish."); return }
      onDone()
    } catch { setError("Couldn't reach the server. Try again.") }
    finally { setSaving(false) }
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h2 style={S.modalTitle}>Publish an item</h2>
        <p style={S.modalSub}>Share a prompt or workflow with the platform. Agents &amp; tools are platform-governed.</p>
        {error && <div style={S.err}>{error}</div>}
        <form onSubmit={submit}>
          <label style={S.label}>Name</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={S.input} placeholder="e.g. Cold outreach email writer" required />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Kind</label>
              <select value={form.kind} onChange={e => setForm(p => ({ ...p, kind: e.target.value }))} style={S.input}>
                <option value="PROMPT">Prompt</option>
                <option value="WORKFLOW">Workflow</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Category</label>
              <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={S.input} placeholder="e.g. Sales" />
            </div>
          </div>
          <label style={S.label}>Summary</label>
          <textarea value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} style={S.textarea} rows={3} placeholder="What does it do?" />
          <label style={S.label}>Spec (optional JSON)</label>
          <textarea value={form.spec} onChange={e => setForm(p => ({ ...p, spec: e.target.value }))} style={{ ...S.textarea, fontFamily: "monospace" }} rows={4} placeholder='{"template":"..."}' />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button type="submit" disabled={saving} style={S.publishBtn}>{saving ? "Publishing…" : "Publish"}</button>
            <button type="button" onClick={onClose} style={S.cancelBtn}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 1080, margin: "0 auto", padding: "0 4px" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" as const },
  h1: { fontSize: 22, fontWeight: 700, color: "var(--v-ink)", letterSpacing: "-.3px" },
  sub: { fontSize: 13.5, color: "var(--v-ink-3)", marginTop: 4, maxWidth: 560, lineHeight: 1.5 },
  publishBtn: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  tabs: { display: "flex", gap: 4, borderBottom: "1px solid var(--v-line-2)", marginBottom: 16 },
  tab: { background: "none", border: "none", padding: "9px 14px", fontSize: 14, color: "var(--v-ink-3)", cursor: "pointer", borderBottom: "2px solid transparent", marginBottom: -1 },
  tabOn: { color: "var(--v-accent)", borderBottomColor: "var(--v-accent)", fontWeight: 600 },
  controls: { display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" as const },
  searchBox: { display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 220, background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 10, padding: "0 12px", color: "var(--v-ink-3)" },
  searchInput: { flex: 1, border: "none", background: "none", outline: "none", padding: "10px 0", fontSize: 14, color: "var(--v-ink)", fontFamily: "inherit" },
  sortRow: { display: "flex", gap: 6 },
  sortBtn: { background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--v-ink-2)", cursor: "pointer" },
  sortOn: { background: "var(--v-accent-soft)", borderColor: "var(--v-accent)", color: "var(--v-accent)", fontWeight: 600 },
  kinds: { display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" as const },
  kindChip: { background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 999, padding: "5px 13px", fontSize: 12.5, color: "var(--v-ink-2)", cursor: "pointer" },
  kindOn: { background: "var(--v-ink)", borderColor: "var(--v-ink)", color: "#fff" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 },
  card: { display: "flex", flexDirection: "column" as const, gap: 8, background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 14, padding: "16px 16px 14px", textDecoration: "none", color: "inherit", transition: "border-color .15s" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  kindBadge: { display: "inline-flex", alignItems: "center", gap: 4, background: "var(--v-surface-2)", color: "var(--v-ink-3)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, textTransform: "capitalize" as const },
  kindAgent: { background: "var(--v-accent-soft)", color: "var(--v-accent)" },
  mineTag: { fontSize: 11, color: "var(--v-ink-3)", fontWeight: 500 },
  cardName: { fontSize: 15.5, fontWeight: 650, color: "var(--v-ink)" },
  cardSummary: { fontSize: 13, color: "var(--v-ink-3)", lineHeight: 1.5, flex: 1, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" },
  cardMeta: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 },
  rating: { display: "inline-flex", alignItems: "center", gap: 4, color: "var(--v-ink-2)", fontWeight: 600 },
  muted: { color: "var(--v-ink-3)", fontWeight: 400 },
  cardFoot: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--v-line-2)", paddingTop: 11, marginTop: 3 },
  author: { fontSize: 12.5, color: "var(--v-ink-3)" },
  installBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  installedBtn: { background: "var(--v-surface-2)", color: "var(--v-ink-2)" },
  center: { textAlign: "center" as const, padding: "3rem 0", color: "var(--v-ink-3)", fontSize: 14 },
  retry: { marginLeft: 8, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer" },
  overlay: { position: "fixed" as const, inset: 0, background: "rgba(10,10,15,.45)", display: "grid", placeItems: "center", padding: 20, zIndex: 100 },
  modal: { background: "var(--v-surface)", borderRadius: 16, padding: "1.75rem", width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" as const },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "var(--v-ink)" },
  modalSub: { fontSize: 13, color: "var(--v-ink-3)", marginTop: 4, marginBottom: 16 },
  err: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#B91C1C", marginBottom: 12 },
  label: { display: "block", fontSize: 12, fontWeight: 500, color: "var(--v-ink-3)", margin: "10px 0 5px" },
  input: { width: "100%", border: "1px solid var(--v-line-2)", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, color: "var(--v-ink)", background: "var(--v-surface)", outline: "none", fontFamily: "inherit" },
  textarea: { width: "100%", border: "1px solid var(--v-line-2)", borderRadius: 8, padding: "9px 11px", fontSize: 13.5, color: "var(--v-ink)", background: "var(--v-surface)", outline: "none", fontFamily: "inherit", resize: "vertical" as const },
  cancelBtn: { background: "none", border: "1px solid var(--v-line-2)", color: "var(--v-ink-2)", borderRadius: 9, padding: "9px 18px", fontSize: 14, cursor: "pointer" },
}
