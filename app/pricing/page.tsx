"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PLANS, ADDONS } from "@/lib/plans"
import { IconCheckCircle, IconBriefcase, IconArrowRight } from "@/components/ui/Icons"

declare global { interface Window { Razorpay: any } }

export default function PricingPage() {
  const router = useRouter()
  const [me, setMe] = useState<any>(null)
  const [rates, setRates] = useState<Record<string, number>>({ CHF: 1 })
  const [symbols, setSymbols] = useState<Record<string, string>>({ CHF: "CHF" })
  const [currency, setCurrency] = useState("CHF")
  const [audience, setAudience] = useState<"individual" | "employer">("individual")
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.user) { setMe(d.user); if (d.user.role === "EMPLOYER") setAudience("employer") } })
    fetch("/api/payment/rates").then(r => r.json()).then(d => {
      const rt: any = {}, sy: any = {}; (d.prices || []).forEach((p: any) => { rt[p.code] = p.rate; sy[p.code] = p.symbol })
      setRates(rt); setSymbols(sy)
    })
    if (!document.getElementById("rzp-sdk")) { const s = document.createElement("script"); s.id = "rzp-sdk"; s.src = "https://checkout.razorpay.com/v1/checkout.js"; document.body.appendChild(s) }
  }, [])

  const rate = rates[currency] ?? 1, sym = symbols[currency] ?? currency
  const price = (chf: number) => chf === 0 ? "Free" : `${sym}${(chf * rate).toLocaleString(undefined, { maximumFractionDigits: currency === "JPY" ? 0 : chf * rate < 10 ? 2 : 0 })}`

  async function subscribe(planId: string, chf: number) {
    if (chf === 0) { router.push(me ? "/dashboard" : "/register"); return }
    if (!me) { router.push("/register"); return }
    setBusy(planId); setError("")
    try {
      const d = await fetch("/api/payment/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency, planId, type: audience }) }).then(r => r.json())
      if (!d.orderId) { setError(d.error || "Could not start checkout."); setBusy(""); return }
      if (!window.Razorpay) { setError("Payment window failed to load."); setBusy(""); return }
      const rzp = new window.Razorpay({
        key: d.keyId, amount: d.amount, currency: d.currency, order_id: d.orderId,
        name: "Vrittih", description: `${PLANS.find(p => p.id === planId)?.name} · monthly`,
        prefill: { email: me?.email, name: me?.name }, theme: { color: "#0F6E56" },
        handler: async (resp: any) => {
          const v = await fetch("/api/payment/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(resp) }).then(r => r.json())
          if (v.success) router.push("/dashboard"); else setError(v.error || "Verification failed.")
        },
        modal: { ondismiss: () => setBusy("") },
      })
      rzp.on("payment.failed", (r: any) => { setError(r.error?.description || "Payment failed."); setBusy("") })
      rzp.open()
    } catch { setError("Network error."); setBusy("") }
  }

  const tiers = PLANS.filter(p => p.audience === audience)

  return (
    <div className="pr">
      <style>{CSS}</style>
      <header className="prTop">
        <Link href="/" className="prBrand"><span className="prMark"><IconBriefcase size={16} /></span>Vrittih</Link>
        <Link href={me ? "/dashboard" : "/login"} className="prSignIn">{me ? "Dashboard" : "Sign in"}</Link>
      </header>

      <div className="prHead">
        <h1 className="prH1">Simple, honest pricing</h1>
        <p className="prSub">One price in Swiss Francs — <b>pay in your own currency</b> at the live rate. Cancel anytime. No usage surprises, ever.</p>
        <div className="prToggle">
          <button className={audience === "individual" ? "on" : ""} onClick={() => setAudience("individual")}>For individuals</button>
          <button className={audience === "employer" ? "on" : ""} onClick={() => setAudience("employer")}>For employers</button>
        </div>
        <select className="prCur" value={currency} onChange={e => setCurrency(e.target.value)}>
          {Object.keys(symbols).map(c => <option key={c} value={c}>Show in {c}</option>)}
        </select>
      </div>

      {error && <div className="prErr">{error}</div>}

      <div className="prGrid">
        {tiers.map(t => {
          const current = me?.plan === t.id
          return (
            <div key={t.id} className={"prCard" + (t.popular ? " pop" : "")}>
              {t.popular && <span className="prBadge">Most popular</span>}
              <div className="prName">{t.name}</div>
              <div className="prTag">{t.tagline}</div>
              <div className="prPrice">{price(t.priceCHF)}<span className="prPer">{t.priceCHF ? "/mo" : ""}</span></div>
              {t.priceCHF > 0 && <div className="prChf">= {t.priceCHF} CHF / month{currency !== "CHF" ? " · live rate" : ""}</div>}
              <button onClick={() => subscribe(t.id, t.priceCHF)} disabled={busy === t.id || current} className={"prCta" + (t.popular ? " pop" : "")}>
                {current ? "Your current plan" : busy === t.id ? "Opening…" : t.cta} {!current && t.priceCHF > 0 && <IconArrowRight size={14} />}
              </button>
              <ul className="prFeat">{t.features.map(f => <li key={f}><IconCheckCircle size={15} /> {f}</li>)}</ul>
            </div>
          )
        })}
      </div>

      {audience === "employer" && (
        <div className="prAddons">
          <span className="prAddTitle">Predictable add-ons</span>
          {ADDONS.map(a => <span key={a.id} className="prAdd"><b>{price(a.priceCHF)}</b> {a.unit} — {a.name}</span>)}
        </div>
      )}

      <p className="prFoot">All prices are set in CHF and charged in your currency at the live European Central Bank rate. Fixed monthly price — never metered by usage.</p>
    </div>
  )
}

const CSS = `
.pr{ min-height:100vh; background:var(--cream-0,#FAF8F2); font-family:var(--font-sans); color:var(--v-ink,#14201B); padding-bottom:4rem; }
.prTop{ max-width:1080px; margin:0 auto; display:flex; justify-content:space-between; align-items:center; padding:20px 24px; }
.prBrand{ display:inline-flex; align-items:center; gap:9px; text-decoration:none; color:#04342C; font-family:var(--font-display); font-size:18px; font-weight:600; }
.prMark{ width:32px; height:32px; border-radius:9px; background:#0F6E56; color:#fff; display:grid; place-items:center; }
.prSignIn{ font-size:14px; font-weight:600; color:#0F6E56; text-decoration:none; }
.prHead{ text-align:center; max-width:640px; margin:1rem auto 2.25rem; padding:0 24px; }
.prH1{ font-family:var(--font-display); font-size:clamp(2rem,5vw,3rem); font-weight:600; letter-spacing:-.03em; color:#04342C; }
.prSub{ font-size:15.5px; color:#4A5750; margin-top:12px; line-height:1.6; }
.prToggle{ display:inline-flex; background:#fff; border:1px solid #E8E3D7; border-radius:999px; padding:4px; margin-top:22px; }
.prToggle button{ border:none; background:none; padding:9px 20px; border-radius:999px; font-size:13.5px; font-weight:600; color:#4A5750; cursor:pointer; }
.prToggle button.on{ background:#0F6E56; color:#fff; }
.prCur{ display:block; margin:14px auto 0; border:1px solid #D9D3C4; border-radius:9px; padding:7px 12px; font-size:13px; background:#fff; color:#14201B; }
.prErr{ max-width:520px; margin:0 auto 18px; background:#FBEBEB; border:1px solid #E7C9C9; border-radius:9px; padding:10px 14px; font-size:13px; color:#A32D2D; text-align:center; }
.prGrid{ max-width:1080px; margin:0 auto; padding:0 24px; display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:18px; align-items:start; }
.prCard{ position:relative; background:#fff; border:1px solid #E8E3D7; border-radius:18px; padding:26px 24px; box-shadow:0 1px 2px rgba(4,52,44,.04); }
.prCard.pop{ border:2px solid #0F6E56; box-shadow:0 20px 50px rgba(15,110,86,.14); }
.prBadge{ position:absolute; top:-11px; left:24px; background:#0F6E56; color:#fff; font-size:11px; font-weight:700; padding:4px 12px; border-radius:999px; }
.prName{ font-family:var(--font-display); font-size:20px; font-weight:600; color:#04342C; }
.prTag{ font-size:13px; color:#7C877F; margin-top:3px; min-height:34px; }
.prPrice{ font-family:var(--font-display); font-size:40px; font-weight:600; color:#14201B; letter-spacing:-.02em; margin-top:8px; }
.prPer{ font-family:var(--font-sans); font-size:15px; font-weight:500; color:#7C877F; }
.prChf{ font-size:12px; color:#7C877F; margin-top:2px; }
.prCta{ width:100%; display:inline-flex; align-items:center; justify-content:center; gap:7px; margin:18px 0 16px; padding:12px; border-radius:11px; font-size:14px; font-weight:600; cursor:pointer; border:1px solid #0F6E56; background:#fff; color:#0F6E56; }
.prCta.pop{ background:#0F6E56; color:#fff; }
.prCta:disabled{ opacity:.6; cursor:default; }
.prFeat{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:9px; }
.prFeat li{ display:flex; align-items:flex-start; gap:9px; font-size:13.5px; color:#2c3a33; }
.prFeat li svg{ color:#0F6E56; flex-shrink:0; margin-top:1px; }
.prAddons{ max-width:1080px; margin:26px auto 0; padding:16px 24px; display:flex; flex-wrap:wrap; gap:18px; align-items:center; }
.prAddTitle{ font-size:13px; font-weight:700; color:#04342C; }
.prAdd{ font-size:13px; color:#4A5750; }
.prFoot{ max-width:640px; margin:24px auto 0; padding:0 24px; text-align:center; font-size:12.5px; color:#7C877F; line-height:1.6; }
`
