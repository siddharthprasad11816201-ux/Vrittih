"use client"
import { useEffect, useState } from "react"

/* Self-serve API-key panel embedded on /developers. A logged-in company can mint,
 * copy (once), revoke and live-test a key without an admin. Talks to /api/keys
 * (own keys) and does a non-destructive GET /api/v1/jobs to prove the key works. */

type Key = { id: string; prefix: string; label: string | null; active: boolean; createdAt: string; lastUsedAt: string | null }

export default function KeysPanel() {
  const [state, setState] = useState<"loading" | "anon" | "nocompany" | "ready">("loading")
  const [keys, setKeys] = useState<Key[]>([])
  const [label, setLabel] = useState("")
  const [fresh, setFresh] = useState<string | null>(null) // raw key shown once
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [test, setTest] = useState<{ ok: boolean; msg: string } | null>(null)

  async function load() {
    const me = await fetch("/api/auth/me").then((r) => r.json()).catch(() => ({}))
    if (!me?.user) { setState("anon"); return }
    if (!["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(me.user.role)) { setState("nocompany"); return }
    const d = await fetch("/api/keys").then((r) => r.json()).catch(() => ({ keys: [] }))
    setKeys(d.keys || [])
    setState("ready")
  }
  useEffect(() => { load() }, [])

  async function generate() {
    setBusy(true); setErr(""); setFresh(null); setTest(null)
    try {
      const r = await fetch("/api/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: label.trim() || undefined }) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || "Could not create key"); return }
      setFresh(d.key); setLabel("")
      await load()
    } finally { setBusy(false) }
  }

  async function revoke(id: string) {
    setErr("")
    const r = await fetch("/api/keys", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) })
    if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || "Could not revoke"); return }
    if (keys.find((k) => k.id === id)) load()
  }

  async function copy() {
    if (!fresh) return
    try { await navigator.clipboard.writeText(fresh); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {}
  }

  async function runTest() {
    if (!fresh) return
    setTest(null)
    try {
      const r = await fetch("/api/v1/jobs", { headers: { authorization: `Bearer ${fresh}` } })
      const d = await r.json().catch(() => ({}))
      if (r.ok) setTest({ ok: true, msg: `Connected — your account currently has ${d.count ?? 0} job${d.count === 1 ? "" : "s"} via the API.` })
      else setTest({ ok: false, msg: d.error || `HTTP ${r.status}` })
    } catch (e: any) { setTest({ ok: false, msg: e?.message || "Request failed" }) }
  }

  if (state === "loading") return <div style={S.card}><div style={S.muted}>Loading your keys…</div></div>

  if (state === "anon")
    return (
      <div style={S.card}>
        <div style={S.title}>Your API keys</div>
        <p style={S.muted}>Sign in with your company account to generate a key and start posting jobs.</p>
        <a href="/login?next=/developers" style={S.btn}>Sign in</a>
        <span style={{ ...S.muted, marginLeft: 12 }}>No account? <a href="/register" style={S.link}>Create one</a></span>
      </div>
    )

  if (state === "nocompany")
    return (
      <div style={S.card}>
        <div style={S.title}>Your API keys</div>
        <p style={S.muted}>API access is for company (employer) accounts — that's who posts jobs and runs HRMS. Switch to or create an employer account to get a key.</p>
        <a href="/register?role=employer" style={S.btn}>Create a company account</a>
      </div>
    )

  return (
    <div style={S.card}>
      <div style={S.title}>Your API keys</div>
      <p style={S.muted}>Generate a key, then use it as a bearer token against the endpoints below. Keep it secret — treat it like a password.</p>

      <div style={S.genRow}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Website integration)" style={S.input} maxLength={80} />
        <button onClick={generate} disabled={busy} style={{ ...S.btn, opacity: busy ? 0.6 : 1 }}>{busy ? "Generating…" : "Generate key"}</button>
      </div>
      {err && <div style={S.err}>{err}</div>}

      {fresh && (
        <div style={S.freshBox}>
          <div style={S.freshLabel}>Your new key — copy it now, it won't be shown again</div>
          <div style={S.freshRow}>
            <code style={S.freshKey}>{fresh}</code>
            <button onClick={copy} style={S.copyBtn}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
          <div style={S.testRow}>
            <button onClick={runTest} style={S.ghostBtn}>Test connection</button>
            {test && <span style={{ fontSize: 13, color: test.ok ? "#2F6BE0" : "#DC2626" }}>{test.msg}</span>}
          </div>
        </div>
      )}

      {keys.length > 0 && (
        <table style={S.table}><tbody>
          <tr><th style={S.th}>Key</th><th style={S.th}>Label</th><th style={S.th}>Created</th><th style={S.th}>Last used</th><th style={S.th}></th></tr>
          {keys.map((k) => (
            <tr key={k.id} style={{ opacity: k.active ? 1 : 0.5 }}>
              <td style={S.td}><code style={S.inline}>{k.prefix}</code>{!k.active && <span style={S.revoked}>revoked</span>}</td>
              <td style={S.td}>{k.label || "—"}</td>
              <td style={S.td}>{new Date(k.createdAt).toLocaleDateString()}</td>
              <td style={S.td}>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "never"}</td>
              <td style={{ ...S.td, textAlign: "right" }}>{k.active && <button onClick={() => revoke(k.id)} style={S.revokeBtn}>Revoke</button>}</td>
            </tr>
          ))}
        </tbody></table>
      )}
      {keys.length === 0 && !fresh && <div style={{ ...S.muted, marginTop: 10 }}>No keys yet — generate your first one above.</div>}
    </div>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "22px 22px 24px", margin: "6px 0 34px", boxShadow: "0 1px 2px rgba(51,78,172,.04)" },
  title: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "#0B1126", marginBottom: 6 },
  muted: { fontSize: 13.5, color: "#64748B", lineHeight: 1.6, margin: 0 },
  link: { color: "#6495ED", fontWeight: 600, textDecoration: "none" },
  btn: { display: "inline-block", background: "#6495ED", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", textDecoration: "none", marginTop: 12 },
  ghostBtn: { background: "#EAF1FE", color: "#2F6BE0", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  genRow: { display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" },
  input: { flex: "1 1 240px", border: "1px solid #E9EDF2", borderRadius: 8, padding: "9px 12px", fontSize: 13.5, fontFamily: "var(--font-sans)", color: "#1F2937", background: "#fff" },
  err: { marginTop: 10, fontSize: 13, color: "#DC2626", background: "#FBECEC", border: "1px solid #F0D2D2", borderRadius: 8, padding: "8px 12px" },
  freshBox: { marginTop: 16, background: "#0B1126", borderRadius: 12, padding: "14px 16px" },
  freshLabel: { fontSize: 12, color: "#A9C6F6", marginBottom: 8 },
  freshRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  freshKey: { flex: "1 1 300px", fontFamily: "var(--font-mono)", fontSize: 13, color: "#EAF1FE", wordBreak: "break-all" },
  copyBtn: { background: "#4F86E8", color: "#0B1126", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  testRow: { display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 18 },
  th: { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", color: "#94A3B8", fontWeight: 600, padding: "0 10px 8px 0" },
  td: { padding: "9px 10px 9px 0", borderBottom: "1px solid #EDF0F4", color: "#334155", verticalAlign: "middle" },
  inline: { fontFamily: "var(--font-mono)", fontSize: 12.5, background: "#F1F5F9", color: "#2F6BE0", padding: "2px 7px", borderRadius: 5 },
  revoked: { fontSize: 11, color: "#DC2626", marginLeft: 8 },
  revokeBtn: { background: "transparent", color: "#DC2626", border: "1px solid #F0D2D2", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
}
