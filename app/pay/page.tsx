"use client"
import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { IconCheckCircle, IconLock, IconArrowRight, IconBriefcase } from "@/components/ui/Icons"

function PayInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const [me, setMe] = useState<any>(null)
  const [prices, setPrices] = useState<any[]>([])
  const [live, setLive] = useState(true)
  const [currency, setCurrency] = useState("CHF")
  const [type, setType] = useState<"jobseeker" | "employer">("jobseeker")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [phase, setPhase] = useState<"idle" | "confirming" | "success" | "cancelled">("idle")

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.user) { setMe(d.user); if (d.user.role === "EMPLOYER") setType("employer") } })
    fetch("/api/payment/rates").then(r => r.json()).then(d => { setPrices(d.prices || []); setLive(d.live !== false) })
    const status = sp.get("status"), sid = sp.get("session_id")
    if (status === "success" && sid) {
      setPhase("confirming")
      fetch("/api/payment/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: sid }) })
        .then(r => r.json()).then(d => { if (d.paid) { setPhase("success"); setTimeout(() => router.push("/dashboard"), 2200) } else { setPhase("idle"); setError("Payment not completed. Please try again.") } })
        .catch(() => { setPhase("idle"); setError("Could not confirm payment.") })
    } else if (status === "cancelled") setPhase("cancelled")
  }, [])

  const price = prices.find(p => p.code === currency)
  const fmt = (p: any) => p ? `${p.symbol}${p.amount.toLocaleString(undefined, { minimumFractionDigits: p.code === "JPY" ? 0 : 2, maximumFractionDigits: p.code === "JPY" ? 0 : 2 })}` : "…"

  async function pay() {
    setBusy(true); setError("")
    try {
      const d = await fetch("/api/payment/create-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency, type }) }).then(r => r.json())
      if (d.url) { window.location.href = d.url; return }
      setError(d.error || "Could not start checkout.")
    } catch { setError("Network error. Please try again.") }
    setBusy(false)
  }

  if (phase === "success") return (
    <div style={S.page}><div style={S.card}>
      <div style={S.okIc}><IconCheckCircle size={30} /></div>
      <h1 style={S.h1}>You're in.</h1>
      <p style={S.sub}>Payment confirmed — welcome to Vrittih. Taking you to your dashboard…</p>
      <Link href="/dashboard" style={S.payBtn}>Go to dashboard <IconArrowRight size={15} /></Link>
    </div></div>
  )

  return (
    <div style={S.page}>
      <div style={S.card}>
        <Link href="/" style={S.brand}><span style={S.brandMark}><IconBriefcase size={16} /></span>Vrittih</Link>
        <h1 style={S.h1}>Join Vrittih</h1>
        <p style={S.sub}>One-time fee. Lifetime access. No subscription, ever.</p>

        {phase === "cancelled" && <div style={S.info}>Checkout cancelled — you haven't been charged. Try again whenever you're ready.</div>}
        {phase === "confirming" && <div style={S.info}>Confirming your payment…</div>}

        <div style={S.priceBox}>
          <div style={S.priceMain}>{fmt(price)}</div>
          <div style={S.priceSub}>= 1 CHF{currency !== "CHF" && price ? ` · live rate ${price.rate}` : ""} · once</div>
        </div>

        <label style={S.label}>Pay in your currency</label>
        <select value={currency} onChange={e => setCurrency(e.target.value)} style={S.select}>
          {prices.map(p => <option key={p.code} value={p.code}>{p.code} — {p.symbol}{p.amount.toLocaleString(undefined, { maximumFractionDigits: p.code === "JPY" ? 0 : 2 })} · {p.name}</option>)}
        </select>
        <p style={S.fxNote}>{live ? "Charged in your currency at the live ECB reference rate." : "Live rate feed unavailable — using latest known rate."}</p>

        <div style={S.roleRow}>
          {(["jobseeker", "employer"] as const).map(r => (
            <button key={r} onClick={() => setType(r)} style={{ ...S.roleBtn, ...(type === r ? S.roleOn : {}) }}>
              <div style={S.roleLabel}>{r === "jobseeker" ? "Job seeker" : "Employer"}</div>
              <div style={S.roleDesc}>{r === "jobseeker" ? "Looking for work" : "Hiring talent"}</div>
            </button>
          ))}
        </div>

        <ul style={S.list}>
          {(type === "jobseeker"
            ? ["Apply to every job", "Full profile, résumé & verification", "Network, messaging & interviews", "Lifetime access"]
            : ["Post jobs & manage applicants", "Drag-and-drop hiring pipeline", "Interviews, assessments & HRMS", "Lifetime access"]
          ).map(f => <li key={f} style={S.li}><IconCheckCircle size={15} /> {f}</li>)}
        </ul>

        {error && <div style={S.err}>{error}</div>}

        <button onClick={pay} disabled={busy || phase === "confirming"} style={{ ...S.payBtn, opacity: busy ? .7 : 1 }}>
          <IconLock size={15} /> {busy ? "Opening secure checkout…" : `Pay ${fmt(price)} by card`}
        </button>
        <p style={S.trust}>Secure checkout by Stripe · cards, Apple&nbsp;Pay &amp; Google&nbsp;Pay · 256-bit encrypted</p>
      </div>
    </div>
  )
}

export default function PayPage() {
  return <Suspense fallback={<div style={S.page} />}><PayInner /></Suspense>
}

const S: Record<string, any> = {
  page: { minHeight: "100vh", background: "linear-gradient(160deg,#0F6E56,#0A5442 55%,#04342C)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", fontFamily: "var(--font-sans)" },
  card: { background: "#fff", borderRadius: 20, padding: "2.25rem", width: "100%", maxWidth: 420, boxShadow: "0 30px 80px rgba(4,52,44,.35)" },
  brand: { display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#04342C", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, marginBottom: 18 },
  brandMark: { width: 32, height: 32, borderRadius: 9, background: "#0F6E56", color: "#fff", display: "grid", placeItems: "center" },
  h1: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "#14201B", letterSpacing: "-.02em" },
  sub: { fontSize: 14, color: "#4A5750", marginTop: 5, marginBottom: 18 },
  priceBox: { background: "#E1F5EE", borderRadius: 14, padding: "18px 20px", textAlign: "center", marginBottom: 18 },
  priceMain: { fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 600, color: "#0B6B45", letterSpacing: "-.02em", lineHeight: 1 },
  priceSub: { fontSize: 12.5, color: "#4A5750", marginTop: 8 },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, color: "#4A5750", marginBottom: 6 },
  select: { width: "100%", border: "1px solid #D9D3C4", borderRadius: 11, padding: "11px 13px", fontSize: 14, outline: "none", background: "#fff", color: "#14201B", fontFamily: "inherit" },
  fxNote: { fontSize: 11.5, color: "#7C877F", margin: "7px 0 16px" },
  roleRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 },
  roleBtn: { background: "#fff", border: "1.5px solid #E8E3D7", borderRadius: 12, padding: "11px 12px", cursor: "pointer", textAlign: "left" },
  roleOn: { borderColor: "#0F6E56", background: "#E1F5EE" },
  roleLabel: { fontSize: 13.5, fontWeight: 600, color: "#14201B" },
  roleDesc: { fontSize: 11.5, color: "#7C877F", marginTop: 1 },
  list: { listStyle: "none", padding: 0, margin: "0 0 18px", display: "flex", flexDirection: "column", gap: 8 },
  li: { display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "#2c3a33" },
  payBtn: { width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#0F6E56", color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 15, fontWeight: 600, cursor: "pointer", textDecoration: "none" },
  trust: { textAlign: "center", fontSize: 11.5, color: "#7C877F", marginTop: 12 },
  info: { background: "#E6F1FB", border: "1px solid #C9DEF0", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#185FA5", marginBottom: 14 },
  err: { background: "#FBEBEB", border: "1px solid #E7C9C9", borderRadius: 9, padding: "10px 13px", fontSize: 13, color: "#A32D2D", marginBottom: 12 },
  okIc: { width: 60, height: 60, borderRadius: "50%", background: "#E1F5EE", color: "#0B6B45", display: "grid", placeItems: "center", margin: "0 auto 16px" },
}
