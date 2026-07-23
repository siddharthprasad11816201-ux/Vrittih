"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { IconCheckCircle, IconLock, IconArrowRight } from "@/components/ui/Icons"
import { PLANS } from "@/lib/plans"

declare global { interface Window { Razorpay: any } }

/*
  Billing is MONTHLY (confirmed by the owner): Basic 1 CHF/mo, Pro 12 CHF/mo,
  employer tiers 49/149/349 CHF/mo. This page previously said "One-time fee.
  Lifetime access. No subscription, ever." in five places — charging a recurring
  fee to someone who was promised lifetime access is how you earn chargebacks and
  a reputation you cannot undo, so all of that copy is gone.

  Currency: the conversion is backend logic. We detect the visitor's currency
  from their locale, show the price in it, and keep the CHF reference and rate
  out of the way — available on request, not shoved in the buyer's face.
*/

// map a browser locale/region to the currency we support for it
const REGION_CCY: Record<string, string> = {
  IN: "INR", CH: "CHF", US: "USD", GB: "GBP", SG: "SGD", JP: "JPY", CA: "CAD", AU: "AUD",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", IE: "EUR", AT: "EUR", BE: "EUR", PT: "EUR", FI: "EUR",
}

function detectCurrency(supported: string[]): string {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || ""
    const region = (loc.split("-")[2] || loc.split("-")[1] || "").toUpperCase()
    const guess = REGION_CCY[region]
    if (guess && supported.includes(guess)) return guess
  } catch { /* fall through */ }
  return supported.includes("CHF") ? "CHF" : supported[0]
}

export default function PayPage() {
  const router = useRouter()
  const [me, setMe] = useState<any>(null)
  const [rates, setRates] = useState<any[]>([])
  const [live, setLive] = useState(true)
  const [currency, setCurrency] = useState("")
  const [audience, setAudience] = useState<"individual" | "employer">("individual")
  const [planId, setPlanId] = useState("basic")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [showFx, setShowFx] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      if (d.user) { setMe(d.user); if (d.user.role === "EMPLOYER") { setAudience("employer"); setPlanId("emp_starter") } }
    }).catch(() => {})
    fetch("/api/payment/rates").then(r => r.json()).then(d => {
      const list = d.prices || []
      setRates(list); setLive(d.live !== false)
      setCurrency(c => c || detectCurrency(list.map((p: any) => p.code)))
    }).catch(() => {})
    if (!document.getElementById("rzp-sdk")) {
      const s = document.createElement("script")
      s.id = "rzp-sdk"; s.src = "https://checkout.razorpay.com/v1/checkout.js"; document.body.appendChild(s)
    }
  }, [])

  const plans = useMemo(() => PLANS.filter(p => p.audience === audience && p.priceCHF > 0), [audience])
  const plan = plans.find(p => p.id === planId) || plans[0]
  const rate = rates.find(r => r.code === currency)

  // rates come back priced for 1 CHF; scale to the plan
  const localAmount = rate && plan ? rate.amount * plan.priceCHF : null
  const money = (n: number | null) => {
    if (n == null || !rate) return "…"
    const zero = rate.code === "JPY"
    return `${rate.symbol}${n.toLocaleString(undefined, { minimumFractionDigits: zero ? 0 : 2, maximumFractionDigits: zero ? 0 : 2 })}`
  }

  async function pay() {
    if (!plan) return
    setBusy(true); setError("")
    try {
      const d = await fetch("/api/payment/create-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, planId: plan.id, type: audience === "employer" ? "employer" : "jobseeker" }),
      }).then(r => r.json())

      if (!d.orderId) {
        setError(d.error || "We couldn't start the payment. Please try again in a moment.")
        setBusy(false); return
      }
      if (!window.Razorpay) { setError("The payment window didn't load — check your connection and retry."); setBusy(false); return }

      const rzp = new window.Razorpay({
        key: d.keyId, amount: d.amount, currency: d.currency, order_id: d.orderId,
        name: "Vrittih", description: `${plan.name} · ${plan.priceCHF} CHF / month`,
        prefill: { email: me?.email, name: me?.name },
        theme: { color: "#0D7A5F" },
        handler: async (resp: any) => {
          const v = await fetch("/api/payment/verify", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(resp),
          }).then(r => r.json())
          if (v.success) { setSuccess(true); setTimeout(() => router.push("/dashboard"), 1800) }
          else setError(v.error || "We couldn't verify that payment. Nothing has been charged twice — contact us and we'll sort it.")
        },
        modal: { ondismiss: () => setBusy(false) },
      })
      rzp.on("payment.failed", (r: any) => { setError(r.error?.description || "The payment didn't go through. Please try again."); setBusy(false) })
      rzp.open()
    } catch {
      setError("Network error. Please try again.")
      setBusy(false)
    }
  }

  if (success) return (
    <div className="pw"><div className="pcard center">
      <div className="okIc"><IconCheckCircle size={30} /></div>
      <h1 className="h1">You're in.</h1>
      <p className="sub">Subscription active — welcome to Vrittih. Taking you to your dashboard…</p>
      <Link href="/dashboard" className="btn">Go to dashboard <IconArrowRight size={15} /></Link>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div></div>
  )

  return (
    <div className="pw">
      <div className="pcard">
        <Link href="/" className="brand">
          <span className="mark" aria-hidden><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg></span>
          Vrittih
        </Link>

        <h1 className="h1">Choose your plan</h1>
        <p className="sub">Billed monthly. Cancel any time — you keep access until the period ends.</p>

        <div className="seg">
          {(["individual", "employer"] as const).map(a => (
            <button key={a} onClick={() => { setAudience(a); setPlanId(a === "employer" ? "emp_starter" : "basic") }}
              className={"segBtn" + (audience === a ? " on" : "")}>
              {a === "individual" ? "For me" : "For my company"}
            </button>
          ))}
        </div>

        <div className="plans">
          {plans.map(p => {
            const amt = rate ? rate.amount * p.priceCHF : null
            return (
              <button key={p.id} onClick={() => setPlanId(p.id)} className={"plan" + (plan?.id === p.id ? " sel" : "")}>
                <span className="planTop">
                  <span className="planName">{p.name}{p.popular && <em className="pop">Popular</em>}</span>
                  <span className="planPrice">{rate ? money(amt) : `${p.priceCHF} CHF`}<em>/mo</em></span>
                </span>
                <span className="planTag">{p.tagline}</span>
              </button>
            )
          })}
        </div>

        {plan && (
          <ul className="feats">
            {plan.features.map(f => (
              <li key={f}><IconCheckCircle size={15} /> {f}</li>
            ))}
          </ul>
        )}

        {error && <div className="err">{error}</div>}

        <button onClick={pay} disabled={busy || !plan || !rate} className={"btn wide" + (busy || !rate ? " off" : "")}>
          <IconLock size={15} />
          {busy ? "Opening secure checkout…" : plan ? `Subscribe — ${money(localAmount)} / month` : "Choose a plan"}
        </button>

        <p className="fine">
          Secure checkout by Razorpay · cards, UPI, netbanking &amp; wallets.
          {" "}
          <button type="button" className="linkBtn" onClick={() => setShowFx(v => !v)}>
            {showFx ? "Hide pricing details" : "How is this priced?"}
          </button>
        </p>

        {showFx && plan && (
          <div className="fx">
            Plans are priced in Swiss francs ({plan.priceCHF} CHF / month) and charged in your local
            currency at the {live ? "live European Central Bank reference rate" : "most recent known rate"}.
            {rate && ` Today that's ${money(localAmount)} for ${plan.name}.`}
            <div className="fxRow">
              <label htmlFor="ccy">Pay in</label>
              <select id="ccy" value={currency} onChange={e => setCurrency(e.target.value)}>
                {rates.map(r => <option key={r.code} value={r.code}>{r.code}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  )
}

const CSS = `
.pw{--bg:#FAFAF8;--card:#fff;--ink:#101828;--ink2:#667085;--ink3:#98A2B3;--line:#EAECF0;--line2:#F2F4F1;
 --g:#0D7A5F;--gh:#0B6C54;--gt:rgba(13,122,95,.08);--gt2:rgba(13,122,95,.14);
 --sh:0 1px 2px rgba(16,24,40,.04),0 1px 3px rgba(16,24,40,.05);--shH:0 10px 26px rgba(16,24,40,.07);
 --e:cubic-bezier(.22,1,.36,1);
 min-height:100vh;background:var(--bg);color:var(--ink);display:flex;align-items:flex-start;justify-content:center;
 padding:clamp(24px,6vw,64px) 20px;
 font-family:var(--font-inter),Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.pw *{box-sizing:border-box}
.pcard{width:100%;max-width:520px;background:var(--card);border:1px solid var(--line);border-radius:20px;box-shadow:var(--sh);padding:clamp(22px,4vw,34px)}
.pcard.center{text-align:center}
.brand{display:inline-flex;align-items:center;gap:9px;font-size:17px;font-weight:600;color:var(--ink);text-decoration:none;letter-spacing:-.01em}
.mark{width:28px;height:28px;border-radius:8px;background:var(--g);display:grid;place-items:center}
.h1{font-size:clamp(26px,4vw,32px);font-weight:600;letter-spacing:-.03em;margin:22px 0 0}
.sub{font-size:15px;line-height:1.6;color:var(--ink2);margin:8px 0 0}
.okIc{width:56px;height:56px;border-radius:50%;background:var(--gt);color:var(--g);display:grid;place-items:center;margin:0 auto}

.seg{display:flex;gap:4px;background:var(--line2);padding:4px;border-radius:14px;margin-top:22px}
.segBtn{flex:1;padding:9px 12px;border:none;background:none;border-radius:11px;font:inherit;font-size:14px;font-weight:600;color:var(--ink2);cursor:pointer;transition:background .15s,color .15s}
.segBtn.on{background:var(--card);color:var(--ink);box-shadow:var(--sh)}

.plans{display:flex;flex-direction:column;gap:10px;margin-top:16px}
.plan{display:flex;flex-direction:column;gap:4px;text-align:left;padding:14px 16px;border:1.5px solid var(--line);border-radius:16px;background:var(--card);cursor:pointer;font:inherit;transition:border-color .15s,transform .15s var(--e),box-shadow .15s}
.plan:hover{border-color:var(--ink3)}
.plan.sel{border-color:var(--g);background:var(--gt);box-shadow:var(--sh)}
.planTop{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.planName{font-size:16px;font-weight:600;display:inline-flex;align-items:center;gap:8px}
.pop{font-style:normal;font-size:11px;font-weight:700;color:var(--g);background:var(--gt2);padding:2px 8px;border-radius:999px}
.planPrice{font-size:20px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.planPrice em{font-style:normal;font-size:13px;font-weight:500;color:var(--ink3);margin-left:2px}
.planTag{font-size:13.5px;color:var(--ink2)}

.feats{list-style:none;margin:18px 0 0;padding:0;display:flex;flex-direction:column;gap:9px}
.feats li{display:flex;gap:9px;align-items:flex-start;font-size:14.5px;color:var(--ink2)}
.feats li svg{color:var(--g);flex-shrink:0;margin-top:1px}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;background:var(--g);color:#fff;border:none;border-radius:14px;padding:14px 24px;font:inherit;font-size:15.5px;font-weight:600;text-decoration:none;cursor:pointer;transition:background .15s,transform .1s var(--e)}
.btn:hover{background:var(--gh)}
.btn:active{transform:scale(.97)}
.btn.wide{width:100%;margin-top:20px}
.btn.off{opacity:.55;cursor:not-allowed}

.err{margin-top:16px;padding:11px 14px;border-radius:12px;background:#FEF3F2;color:#B42318;font-size:14px;line-height:1.5}
.fine{font-size:12.5px;color:var(--ink3);text-align:center;margin:12px 0 0;line-height:1.6}
.linkBtn{background:none;border:none;padding:0;font:inherit;font-size:12.5px;color:var(--g);font-weight:600;cursor:pointer;text-decoration:underline}
.fx{margin-top:12px;padding:13px 15px;border:1px solid var(--line);border-radius:14px;background:var(--bg);font-size:13px;line-height:1.6;color:var(--ink2)}
.fxRow{display:flex;align-items:center;gap:8px;margin-top:10px}
.fxRow label{font-size:12.5px;color:var(--ink3)}
.fxRow select{font:inherit;font-size:13px;padding:6px 10px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink)}
`
