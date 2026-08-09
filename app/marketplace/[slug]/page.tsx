"use client"
import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconZap, IconStar, IconCheck } from "@/components/ui/Icons"

type Detail = {
  slug: string; name: string; kind: string; category: string | null; summary: string | null
  author: string; isAuthor: boolean; installs: number; version: string
  rating: { avg: number | null; count: number }; installed: boolean; hasReviewed: boolean
  runnable: boolean; runField: { key: string; label: string; placeholder: string } | null; spec: any
}
type Review = { id: string; rating: number; comment: string | null; by: string; createdAt: string }

export default function MarketplaceItemPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const [item, setItem] = useState<Detail | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setNotFound(false)
    try {
      const r = await fetch(`/api/marketplace/${slug}`)
      if (r.status === 404) { setNotFound(true); return }
      if (!r.ok) throw new Error(String(r.status))
      const d = await r.json()
      setItem(d.item); setReviews(d.reviews || [])
    } catch { setNotFound(true) }
    finally { setLoading(false) }
  }, [slug])
  useEffect(() => { load() }, [load])

  async function toggleInstall() {
    if (!item) return
    setItem({ ...item, installed: !item.installed, installs: item.installs + (item.installed ? -1 : 1) })
    try { await fetch(`/api/marketplace/${slug}/install`, { method: "POST" }) } catch {}
  }
  async function remove() {
    if (!confirm("Remove this item from the marketplace?")) return
    try { const r = await fetch(`/api/marketplace/${slug}`, { method: "DELETE" }); if (r.ok) router.push("/marketplace") } catch {}
  }

  if (loading) return <AppShell title="Marketplace"><div style={S.center}>Loading…</div></AppShell>
  if (notFound || !item) return <AppShell title="Marketplace"><div style={S.center}>This item doesn&rsquo;t exist. <Link href="/marketplace" style={S.back}>← Back to marketplace</Link></div></AppShell>

  return (
    <AppShell title={item.name}>
      <div style={S.wrap}>
        <Link href="/marketplace" style={S.back}>← Marketplace</Link>
        <div style={S.header}>
          <div style={{ flex: 1 }}>
            <div style={S.topRow}>
              <span style={{ ...S.kindBadge, ...(item.kind === "AGENT" ? S.kindAgent : {}) }}>{item.kind === "AGENT" && <IconZap size={11} />}{item.kind.toLowerCase()}</span>
              {item.category && <span style={S.cat}>{item.category}</span>}
              <span style={S.ver}>v{item.version}</span>
            </div>
            <h1 style={S.h1}>{item.name}</h1>
            <p style={S.summary}>{item.summary}</p>
            <div style={S.metaRow}>
              <span>{item.rating.avg != null ? <span style={S.rating}><IconStar size={13} /> {item.rating.avg} <span style={S.muted}>({item.rating.count})</span></span> : <span style={S.muted}>Not yet rated</span>}</span>
              <span style={S.muted}>·</span>
              <span style={S.muted}>{item.installs} install{item.installs === 1 ? "" : "s"}</span>
              <span style={S.muted}>·</span>
              <span style={S.muted}>by {item.author}</span>
            </div>
          </div>
          <div style={S.actions}>
            <button onClick={toggleInstall} style={{ ...S.installBtn, ...(item.installed ? S.installedBtn : {}) }}>
              {item.installed ? <><IconCheck size={15} /> Installed</> : "Install"}
            </button>
            {item.isAuthor && <button onClick={remove} style={S.deleteBtn}>Delete</button>}
          </div>
        </div>

        {item.kind === "AGENT" && (
          <RunPanel slug={item.slug} runnable={item.runnable} installed={item.installed} runField={item.runField} />
        )}

        {item.kind !== "AGENT" && item.spec && Object.keys(item.spec).length > 0 && (
          <section style={S.section}>
            <h2 style={S.h2}>Spec</h2>
            <pre style={S.pre}>{JSON.stringify(item.spec, null, 2)}</pre>
          </section>
        )}

        <ReviewsPanel slug={item.slug} reviews={reviews} installed={item.installed} hasReviewed={item.hasReviewed} onDone={load} />
      </div>
    </AppShell>
  )
}

function RunPanel({ slug, runnable, installed, runField }: { slug: string; runnable: boolean; installed: boolean; runField: Detail["runField"] }) {
  const [val, setVal] = useState("")
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")

  async function run() {
    setRunning(true); setError(""); setResult(null)
    try {
      const input = runField ? { [runField.key]: val } : {}
      const r = await fetch(`/api/marketplace/${slug}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) { setError(d.error || "This agent could not run."); return }
      setResult(d)
    } catch { setError("Couldn't reach the server. Try again.") }
    finally { setRunning(false) }
  }

  return (
    <section style={S.section}>
      <h2 style={S.h2}>Run this agent</h2>
      {!runnable ? (
        <p style={S.muted}>This agent isn&rsquo;t runnable in your workspace.</p>
      ) : !installed ? (
        <p style={S.muted}>Install this agent to run it. It executes through the Enterprise Brain and only does what your account is already permitted to do.</p>
      ) : (
        <>
          {runField && (
            <div style={{ marginBottom: 10 }}>
              <label style={S.label}>{runField.label}</label>
              <input value={val} onChange={e => setVal(e.target.value)} placeholder={runField.placeholder} style={S.input} />
            </div>
          )}
          <button onClick={run} disabled={running || (!!runField && !val.trim())} style={S.runBtn}>{running ? "Running…" : "Run"}</button>
          {error && <div style={S.err}>{error}</div>}
          {result && (
            <div style={S.result}>
              {result.explanation && <p style={S.explanation}>{result.explanation}</p>}
              <pre style={S.pre}>{JSON.stringify(result.output, null, 2)}</pre>
              {result.runId && <div style={S.runId}>Audited run · {result.runId}</div>}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function ReviewsPanel({ slug, reviews, installed, hasReviewed, onDone }: { slug: string; reviews: Review[]; installed: boolean; hasReviewed: boolean; onDone: () => void }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function submit(e: any) {
    e.preventDefault()
    setSaving(true); setError("")
    try {
      const r = await fetch(`/api/marketplace/${slug}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, comment: comment || undefined }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.success) { setError(d.error || "Couldn't save your review."); return }
      setComment(""); onDone()
    } catch { setError("Couldn't reach the server. Try again.") }
    finally { setSaving(false) }
  }

  return (
    <section style={S.section}>
      <h2 style={S.h2}>Reviews {reviews.length > 0 && <span style={S.muted}>({reviews.length})</span>}</h2>
      {installed && (
        <form onSubmit={submit} style={S.reviewForm}>
          <div style={S.stars}>
            {[1, 2, 3, 4, 5].map(n => (
              <button type="button" key={n} onClick={() => setRating(n)} style={{ ...S.starBtn, color: n <= rating ? "#F59E0B" : "var(--v-line-2)" }} aria-label={`${n} star`}><IconStar size={20} /></button>
            ))}
          </div>
          <input value={comment} onChange={e => setComment(e.target.value)} placeholder={hasReviewed ? "Update your review…" : "Add a comment (optional)"} style={S.input} />
          <button type="submit" disabled={saving} style={S.runBtn}>{saving ? "Saving…" : hasReviewed ? "Update" : "Submit"}</button>
        </form>
      )}
      {error && <div style={S.err}>{error}</div>}
      {reviews.length === 0 ? (
        <p style={S.muted}>No reviews yet{installed ? " — be the first." : "."}</p>
      ) : (
        <div style={S.reviewList}>
          {reviews.map(r => (
            <div key={r.id} style={S.review}>
              <div style={S.reviewHead}>
                <span style={S.reviewBy}>{r.by}</span>
                <span style={S.rating}><IconStar size={12} /> {r.rating}</span>
              </div>
              {r.comment && <p style={S.reviewComment}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 760, margin: "0 auto", padding: "0 4px" },
  back: { fontSize: 13, color: "var(--v-ink-3)", textDecoration: "none", display: "inline-block", marginBottom: 14 },
  header: { display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" as const },
  topRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 },
  kindBadge: { display: "inline-flex", alignItems: "center", gap: 4, background: "var(--v-surface-2)", color: "var(--v-ink-3)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, textTransform: "capitalize" as const },
  kindAgent: { background: "var(--v-accent-soft)", color: "var(--v-accent)" },
  cat: { fontSize: 12, color: "var(--v-ink-3)" },
  ver: { fontSize: 12, color: "var(--v-ink-3)" },
  h1: { fontSize: 24, fontWeight: 700, color: "var(--v-ink)", letterSpacing: "-.4px" },
  summary: { fontSize: 14.5, color: "var(--v-ink-2)", lineHeight: 1.6, marginTop: 8 },
  metaRow: { display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 13 },
  rating: { display: "inline-flex", alignItems: "center", gap: 4, color: "var(--v-ink-2)", fontWeight: 600 },
  muted: { color: "var(--v-ink-3)", fontWeight: 400 },
  actions: { display: "flex", flexDirection: "column" as const, gap: 8 },
  installBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" as const },
  installedBtn: { background: "var(--v-surface-2)", color: "var(--v-ink-2)" },
  deleteBtn: { background: "none", border: "1px solid var(--v-line-2)", color: "var(--danger)", borderRadius: 9, padding: "8px 18px", fontSize: 13, cursor: "pointer" },
  section: { marginTop: 26, borderTop: "1px solid var(--v-line-2)", paddingTop: 20 },
  h2: { fontSize: 16, fontWeight: 650, color: "var(--v-ink)", marginBottom: 12 },
  label: { display: "block", fontSize: 12, fontWeight: 500, color: "var(--v-ink-3)", marginBottom: 5 },
  input: { width: "100%", border: "1px solid var(--v-line-2)", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "var(--v-ink)", background: "var(--v-surface)", outline: "none", fontFamily: "inherit" },
  runBtn: { background: "var(--v-accent)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  err: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#B91C1C", marginTop: 12 },
  result: { marginTop: 14, background: "var(--v-surface-2)", border: "1px solid var(--v-line-2)", borderRadius: 12, padding: "14px 16px" },
  explanation: { fontSize: 14, color: "var(--v-ink)", lineHeight: 1.6, marginBottom: 10 },
  pre: { fontSize: 12, color: "var(--v-ink-2)", background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 8, padding: 12, overflowX: "auto" as const, whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const, maxHeight: 360 },
  runId: { fontSize: 11, color: "var(--v-ink-3)", marginTop: 8 },
  reviewForm: { display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" as const },
  stars: { display: "flex", gap: 2 },
  starBtn: { background: "none", border: "none", cursor: "pointer", padding: 2, display: "inline-flex" },
  reviewList: { display: "flex", flexDirection: "column" as const, gap: 12 },
  review: { background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 10, padding: "12px 14px" },
  reviewHead: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  reviewBy: { fontSize: 13.5, fontWeight: 600, color: "var(--v-ink)" },
  reviewComment: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.55, marginTop: 6 },
  center: { textAlign: "center" as const, padding: "3rem 0", color: "var(--v-ink-3)", fontSize: 14 },
}
