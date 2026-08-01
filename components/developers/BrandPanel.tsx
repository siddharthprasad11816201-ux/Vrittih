"use client"
import { useEffect, useState } from "react"

/* White-label brand editor for the Developer portal. Sets the company's public
 * careers microsite (/c/<slug>) — name, link, colour, logo, tagline. */

export default function BrandPanel() {
  const [show, setShow] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [tagline, setTagline] = useState("")
  const [about, setAbout] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [color, setColor] = useState("#0F6E56")
  const [customDomain, setCustomDomain] = useState("")
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/brand")
      if (r.status === 403 || r.status === 401) { setShow(false); return }
      const d = await r.json().catch(() => null)
      if (!d) return
      setShow(true)
      if (d.brand) {
        setName(d.brand.name || ""); setSlug(d.brand.slug || ""); setTagline(d.brand.tagline || "")
        setAbout(d.brand.about || ""); setLogoUrl(d.brand.logoUrl || ""); setColor(d.brand.color || "#0F6E56")
        setCustomDomain(d.brand.customDomain || "")
        setSaved(`/c/${d.brand.slug}`)
      } else { setName(d.suggestedName || ""); setSlug(d.suggestedSlug || "") }
    })()
  }, [])

  async function save() {
    if (!name.trim()) { setErr("Company name is required"); return }
    setBusy(true); setErr("")
    try {
      const r = await fetch("/api/brand", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, slug, tagline, about, logoUrl, color, customDomain }) })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || "Could not save"); return }
      setSlug(d.brand.slug); setSaved(d.url)
    } finally { setBusy(false) }
  }

  if (!show) return null

  return (
    <div style={S.card}>
      <div style={S.title}>Your careers site (white-label)</div>
      <p style={S.muted}>A public careers page under your own brand, showing your live jobs — powered by Vrittih behind the scenes.</p>

      <div style={S.grid}>
        <label style={S.field}><span style={S.lab}>Company name</span><input value={name} onChange={(e) => setName(e.target.value)} style={S.input} maxLength={120} /></label>
        <label style={S.field}><span style={S.lab}>Link</span>
          <div style={S.slugRow}><span style={S.slugPre}>/c/</span><input value={slug} onChange={(e) => setSlug(e.target.value)} style={{ ...S.input, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} /></div>
        </label>
        <label style={S.field}><span style={S.lab}>Tagline</span><input value={tagline} onChange={(e) => setTagline(e.target.value)} style={S.input} maxLength={200} placeholder="Build the future with us" /></label>
        <label style={S.field}><span style={S.lab}>Accent colour</span>
          <div style={S.slugRow}><input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#0F6E56"} onChange={(e) => setColor(e.target.value)} style={S.colorPick} /><input value={color} onChange={(e) => setColor(e.target.value)} style={S.input} /></div>
        </label>
        <label style={{ ...S.field, gridColumn: "1 / -1" }}><span style={S.lab}>Logo URL (optional)</span><input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} style={S.input} placeholder="https://yourcompany.com/logo.png" /></label>
        <label style={{ ...S.field, gridColumn: "1 / -1" }}><span style={S.lab}>About (optional)</span><textarea value={about} onChange={(e) => setAbout(e.target.value)} style={{ ...S.input, minHeight: 70, resize: "vertical" }} maxLength={2000} /></label>
        <label style={{ ...S.field, gridColumn: "1 / -1" }}><span style={S.lab}>Custom domain (optional)</span>
          <input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} style={S.input} placeholder="careers.yourcompany.com" />
          <span style={S.hint}>Must be a verified domain (see Domains above). Point its CNAME to Vrittih and add it to the Vercel project — then your careers site loads on your own domain.</span>
        </label>
      </div>
      {err && <div style={S.err}>{err}</div>}
      <div style={S.actions}>
        <button onClick={save} disabled={busy} style={{ ...S.btn, opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save careers site"}</button>
        {saved && <a href={saved} target="_blank" rel="noreferrer" style={S.view}>View your site ↗ <span style={S.link}>{saved}</span></a>}
      </div>
    </div>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E8E3D7", borderRadius: 16, padding: "22px 22px 24px", margin: "0 0 34px", boxShadow: "0 1px 2px rgba(4,52,44,.04)" },
  title: { fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color: "#04342C", marginBottom: 6 },
  muted: { fontSize: 13.5, color: "#6E7A73", lineHeight: 1.6, margin: "0 0 14px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  lab: { fontSize: 12, color: "#7B857E", fontWeight: 600 },
  hint: { fontSize: 11.5, color: "#9AA49E", lineHeight: 1.5, marginTop: 3 },
  input: { border: "1px solid #D9D3C4", borderRadius: 8, padding: "9px 12px", fontSize: 13.5, fontFamily: "var(--font-sans)", color: "#14201B", background: "#fff", width: "100%", boxSizing: "border-box" },
  slugRow: { display: "flex", alignItems: "stretch" },
  slugPre: { display: "flex", alignItems: "center", padding: "0 10px", background: "#F3F0E7", border: "1px solid #D9D3C4", borderRight: "none", borderRadius: "8px 0 0 8px", fontSize: 13, color: "#6E7A73", fontFamily: "var(--font-mono)" },
  colorPick: { width: 42, height: 38, border: "1px solid #D9D3C4", borderRadius: 8, padding: 2, background: "#fff", cursor: "pointer", marginRight: 8 },
  err: { marginTop: 10, fontSize: 13, color: "#A32D2D", background: "#FBECEC", border: "1px solid #F0D2D2", borderRadius: 8, padding: "8px 12px" },
  actions: { display: "flex", alignItems: "center", gap: 16, marginTop: 14, flexWrap: "wrap" },
  btn: { background: "#0F6E56", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  view: { fontSize: 13, color: "#4A5750", textDecoration: "none" },
  link: { fontFamily: "var(--font-mono)", color: "#0F6E56" },
}
