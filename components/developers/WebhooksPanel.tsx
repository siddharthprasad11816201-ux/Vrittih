"use client"
import { useEffect, useState } from "react"

/* Webhook management for the Developer portal — subscribe an https endpoint to
 * events, see delivery health, reveal the signing secret once, remove hooks. */

type Hook = { id: string; url: string; events: string; active: boolean; lastStatus: number | null; lastAt: string | null; failCount: number }

export default function WebhooksPanel() {
  const [show, setShow] = useState(false)
  const [hooks, setHooks] = useState<Hook[]>([])
  const [events, setEvents] = useState<string[]>([])
  const [url, setUrl] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  async function load() {
    const r = await fetch("/api/webhooks")
    if (r.status === 403 || r.status === 401) { setShow(false); return }
    const d = await r.json().catch(() => null)
    if (!d) return
    setShow(true); setHooks(d.webhooks || []); setEvents(d.events || [])
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!url.trim()) { setErr("An https URL is required"); return }
    setBusy(true); setErr(""); setFresh(null)
    try {
      const r = await fetch("/api/webhooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: url.trim(), events: picked.length ? picked : undefined }) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || "Could not add webhook"); return }
      setFresh(d.secret); setUrl(""); setPicked([]); load()
    } finally { setBusy(false) }
  }
  async function remove(id: string) {
    await fetch("/api/webhooks", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) })
    load()
  }
  function toggle(e: string) { setPicked((p) => p.includes(e) ? p.filter((x) => x !== e) : [...p, e]) }
  async function copy() { if (fresh) { try { await navigator.clipboard.writeText(fresh); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {} } }

  if (!show) return null

  return (
    <div style={S.card}>
      <div style={S.title}>Webhooks</div>
      <p style={S.muted}>Get a signed POST to your endpoint the instant something happens. Leave events unchecked to receive all.</p>

      <div style={S.row}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourapp.com/webhooks/vrittih" style={S.input} />
        <button onClick={add} disabled={busy} style={{ ...S.btn, opacity: busy ? 0.6 : 1 }}>{busy ? "Adding…" : "Subscribe"}</button>
      </div>
      <div style={S.events}>
        {events.map((e) => (
          <label key={e} style={S.chk}><input type="checkbox" checked={picked.includes(e)} onChange={() => toggle(e)} /> <code style={S.mono}>{e}</code></label>
        ))}
      </div>
      {err && <div style={S.err}>{err}</div>}

      {fresh && (
        <div style={S.freshBox}>
          <div style={S.freshLabel}>Signing secret — copy now, shown once. Verify with <code style={S.monoDark}>X-Vrittih-Signature</code>.</div>
          <div style={S.freshRow}><code style={S.freshKey}>{fresh}</code><button onClick={copy} style={S.copyBtn}>{copied ? "Copied ✓" : "Copy"}</button></div>
        </div>
      )}

      {hooks.length > 0 && (
        <table style={S.table}><tbody>
          <tr><th style={S.th}>Endpoint</th><th style={S.th}>Events</th><th style={S.th}>Last</th><th style={S.th}></th></tr>
          {hooks.map((h) => (
            <tr key={h.id} style={{ opacity: h.active ? 1 : 0.5 }}>
              <td style={S.td}><span style={S.urlCell}>{h.url}</span></td>
              <td style={S.td}><code style={S.mono}>{h.events}</code></td>
              <td style={S.td}>{h.lastStatus ? <span style={{ color: h.lastStatus < 300 ? "#2F6BE0" : "#DC2626" }}>{h.lastStatus}</span> : <span style={S.muted}>—</span>}{h.failCount > 0 && <span style={{ color: "#DC2626", fontSize: 11 }}> ({h.failCount} fails)</span>}</td>
              <td style={{ ...S.td, textAlign: "right" }}><button onClick={() => remove(h.id)} style={S.del}>Remove</button></td>
            </tr>
          ))}
        </tbody></table>
      )}
      {hooks.length === 0 && !fresh && <div style={{ ...S.muted, marginTop: 10 }}>No webhooks yet.</div>}
    </div>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "22px 22px 24px", margin: "0 0 34px", boxShadow: "0 1px 2px rgba(51,78,172,.04)" },
  title: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "#0B1126", marginBottom: 6 },
  muted: { fontSize: 13.5, color: "#64748B", lineHeight: 1.6, margin: 0 },
  row: { display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" },
  input: { flex: "1 1 260px", border: "1px solid #E9EDF2", borderRadius: 8, padding: "9px 12px", fontSize: 13.5, fontFamily: "var(--font-sans)", color: "#1F2937", background: "#fff" },
  btn: { background: "#6495ED", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  events: { display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 },
  chk: { fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 5 },
  mono: { fontFamily: "var(--font-mono)", fontSize: 12, background: "#F1F5F9", color: "#2F6BE0", padding: "1px 6px", borderRadius: 5 },
  monoDark: { fontFamily: "var(--font-mono)", fontSize: 11.5 },
  err: { marginTop: 10, fontSize: 13, color: "#DC2626", background: "#FBECEC", border: "1px solid #F0D2D2", borderRadius: 8, padding: "8px 12px" },
  freshBox: { marginTop: 14, background: "#0B1126", borderRadius: 12, padding: "14px 16px" },
  freshLabel: { fontSize: 12, color: "#A9C6F6", marginBottom: 8 },
  freshRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  freshKey: { flex: "1 1 280px", fontFamily: "var(--font-mono)", fontSize: 13, color: "#EAF1FE", wordBreak: "break-all" },
  copyBtn: { background: "#4F86E8", color: "#0B1126", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 16 },
  th: { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", color: "#94A3B8", fontWeight: 600, padding: "0 10px 8px 0" },
  td: { padding: "9px 10px 9px 0", borderBottom: "1px solid #EDF0F4", color: "#334155", verticalAlign: "middle" },
  urlCell: { fontFamily: "var(--font-mono)", fontSize: 12, wordBreak: "break-all" },
  del: { background: "transparent", color: "#DC2626", border: "1px solid #F0D2D2", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
}
