"use client"
import { useEffect, useState } from "react"

/* Domain verification for the Developer portal. A company adds a domain, gets a
 * DNS TXT record (or a file), verifies it, and an admin approves the company —
 * only then do its API-posted jobs go public. */

type Dom = { domain: string; method: string; verified: boolean; instructions?: any }

export default function DomainsPanel() {
  const [show, setShow] = useState(false)
  const [approved, setApproved] = useState(false)
  const [domains, setDomains] = useState<Dom[]>([])
  const [input, setInput] = useState("")
  const [method, setMethod] = useState("dns")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [msg, setMsg] = useState<Record<string, string>>({})

  async function load() {
    const r = await fetch("/api/domains")
    if (r.status === 403 || r.status === 401) { setShow(false); return }
    const d = await r.json().catch(() => null)
    if (!d) return
    setShow(true); setApproved(!!d.approved); setDomains(d.domains || [])
  }
  useEffect(() => { load() }, [])

  async function add() {
    if (!input.trim()) return
    setBusy(true); setErr("")
    try {
      const r = await fetch("/api/domains", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domain: input.trim(), method }) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || "Could not add domain"); return }
      setInput(""); load()
    } finally { setBusy(false) }
  }
  async function verify(domain: string) {
    setMsg((m) => ({ ...m, [domain]: "Checking…" }))
    const r = await fetch("/api/domains", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domain, verify: true }) })
    const d = await r.json()
    setMsg((m) => ({ ...m, [domain]: r.ok ? "Verified ✓" : (d.detail || d.error || "Not verified yet") }))
    if (r.ok) load()
  }
  async function remove(domain: string) {
    await fetch("/api/domains", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ domain }) })
    load()
  }

  if (!show) return null

  return (
    <div style={S.card}>
      <div style={S.title}>Verified domains</div>
      <p style={S.muted}>Jobs you post via the API go public only when your company is approved <b>and</b> the apply link is on a domain you've verified here. This is how we keep the board free of fake listings.</p>

      <div style={{ ...S.banner, ...(approved ? S.ok : S.warn) }}>
        {approved ? "Your company is approved for public posting." : "Your company is pending Vrittih review — verified-domain jobs publish automatically once approved."}
      </div>

      <div style={S.genRow}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="yourcompany.com" style={S.input} />
        <select value={method} onChange={(e) => setMethod(e.target.value)} style={S.select}>
          <option value="dns">DNS TXT</option>
          <option value="file">File</option>
        </select>
        <button onClick={add} disabled={busy} style={{ ...S.btn, opacity: busy ? 0.6 : 1 }}>{busy ? "Adding…" : "Add domain"}</button>
      </div>
      {err && <div style={S.err}>{err}</div>}

      {domains.map((d) => (
        <div key={d.domain} style={S.domBox}>
          <div style={S.domHead}>
            <span style={S.domName}>{d.domain}</span>
            <span style={{ ...S.pill, ...(d.verified ? S.pillOk : S.pillPend) }}>{d.verified ? "verified" : "unverified"}</span>
            <div style={{ flex: 1 }} />
            {!d.verified && <button onClick={() => verify(d.domain)} style={S.smallBtn}>Verify</button>}
            <button onClick={() => remove(d.domain)} style={S.smallGhost}>Remove</button>
          </div>
          {!d.verified && d.instructions && (
            <div style={S.instr}>
              {d.method === "file" ? (
                <>Serve <code style={S.codeInline}>{d.instructions.file.url}</code> containing exactly:<pre style={S.pre}>{d.instructions.file.content}</pre></>
              ) : (
                <>Add this DNS record, then click Verify:<pre style={S.pre}>{`TYPE  TXT
HOST  ${d.instructions.dns.host}
VALUE ${d.instructions.dns.value}`}</pre></>
              )}
            </div>
          )}
          {msg[d.domain] && <div style={{ fontSize: 12.5, color: msg[d.domain].includes("✓") ? "#2F6BE0" : "#DC2626", marginTop: 4 }}>{msg[d.domain]}</div>}
        </div>
      ))}
      {domains.length === 0 && <div style={{ ...S.muted, marginTop: 10 }}>No domains yet — add the one your careers page lives on.</div>}
    </div>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "22px 22px 24px", margin: "0 0 34px", boxShadow: "0 1px 2px rgba(51,78,172,.04)" },
  title: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "#0B1126", marginBottom: 6 },
  muted: { fontSize: 13.5, color: "#64748B", lineHeight: 1.6, margin: 0 },
  banner: { marginTop: 12, borderRadius: 10, padding: "9px 13px", fontSize: 13 },
  ok: { background: "#EAF1FE", color: "#2F6BE0" },
  warn: { background: "#FDF3E3", color: "#8A5A12" },
  genRow: { display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" },
  input: { flex: "1 1 220px", border: "1px solid #E9EDF2", borderRadius: 8, padding: "9px 12px", fontSize: 13.5, fontFamily: "var(--font-sans)", color: "#1F2937", background: "#fff" },
  select: { border: "1px solid #E9EDF2", borderRadius: 8, padding: "9px 10px", fontSize: 13.5, background: "#fff", color: "#1F2937" },
  btn: { background: "#6495ED", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  err: { marginTop: 10, fontSize: 13, color: "#DC2626", background: "#FBECEC", border: "1px solid #F0D2D2", borderRadius: 8, padding: "8px 12px" },
  domBox: { border: "1px solid #E5E7EB", borderRadius: 11, padding: "12px 14px", marginTop: 12 },
  domHead: { display: "flex", alignItems: "center", gap: 10 },
  domName: { fontFamily: "var(--font-mono)", fontSize: 13.5, color: "#1F2937", fontWeight: 600 },
  pill: { fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 9px" },
  pillOk: { background: "#EAF1FE", color: "#2F6BE0" },
  pillPend: { background: "#FDF3E3", color: "#8A5A12" },
  smallBtn: { background: "#6495ED", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  smallGhost: { background: "transparent", color: "#DC2626", border: "1px solid #F0D2D2", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  instr: { marginTop: 10, fontSize: 13, color: "#475569", lineHeight: 1.6 },
  codeInline: { fontFamily: "var(--font-mono)", fontSize: 12.5, background: "#F1F5F9", color: "#2F6BE0", padding: "1px 6px", borderRadius: 5 },
  pre: { background: "#0B1126", color: "#EAF1FE", borderRadius: 10, padding: "12px 14px", fontSize: 12.5, fontFamily: "var(--font-mono)", overflowX: "auto", lineHeight: 1.6, marginTop: 6 },
}
