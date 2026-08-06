"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Keystone } from "@/components/vrittih/Logo"
import PipelineRail from "@/components/vrittih/PipelineRail"

// Illustrative sample for the hero preview. Company names are FICTIONAL on purpose —
// never show a real, unregistered company here (they haven't consented and it invites
// legal risk). The real brands hiring appear in the brand band below, pulled live from
// the DB (those employers registered themselves).
const PREVIEW_ROWS = [
  { role: "Backend Engineer", company: "Northwind Labs", city: "Zürich", stage: "Interview", next: "Thu 3:00pm", bg: "#FEF3E2", fg: "var(--warn)" },
  { role: "Product Designer", company: "Lumen Studio", city: "Geneva", stage: "Screening", next: "In review", bg: "var(--v-accent-soft)", fg: "var(--v-accent)" },
  { role: "Data Analyst", company: "Meridian Analytics", city: "Basel", stage: "Offer", next: "Respond by Fri", bg: "var(--v-green-soft)", fg: "var(--v-green)" },
]

const PV: Record<string, any> = {
  rows: { display: "flex", flexDirection: "column", gap: 8, marginTop: 20 },
  row: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", background: "var(--v-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" },
  main: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  role: { font: "500 14px var(--font-sans)", color: "var(--v-ink)" },
  meta: { font: "400 12.5px var(--font-sans)", color: "var(--v-ink-3)", marginTop: 1 },
  badge: { font: "500 11.5px var(--font-sans)", padding: "3px 10px", borderRadius: "var(--r-pill)", flex: "none" },
  next: { font: "400 12.5px var(--font-sans)", color: "var(--v-ink-2)", flex: "none", minWidth: 84, textAlign: "right" },
}

/* ─────────────────────────────────────────────────────────────────────────────
   Vrittih — homepage, built to the supplied design (redesign2/Vrittih Home.dc.html)
   and DESIGN_SYSTEM.md. Section order, type scale, colour, radius, shadow and
   motion follow that file exactly.

   Where the design carried placeholder marketing content, the layout is kept and
   the content is replaced with what is actually true, because shipping the
   placeholders would be lying to job seekers:
     • logo wall  — design showed Stripe/Vercel/Linear/Ramp/Notion/Mercury as
       customers. They are not. The slot now shows the six brands genuinely
       hiring here, pulled live from the database.
     • stats band — design showed 128,000 placements / 8,400 companies / 96%
       match accuracy / 11-day time-to-hire. None are measured. Replaced with
       live counts we can stand behind.
     • trust      — design claimed SOC 2 Type II and ISO 27001. Neither audit has
       happened. Those tiles are replaced with controls that genuinely exist.
   Everything else is the design as given.
   ────────────────────────────────────────────────────────────────────────── */

type Stats = { jobs: number; companies: number; industries: number; brands: { name: string; slug: string }[] }

const JOURNEY = [
  { t: "Create your profile", d: "Experience, skills and résumé in one place" },
  { t: "Get matched", d: "Every role scored against your profile" },
  { t: "Apply once", d: "No re-typing the same form per employer" },
  { t: "Track live", d: "All seven stages, visible to both sides" },
  { t: "Interview", d: "Scheduled and run inside the platform" },
  { t: "Offer", d: "Reviewed and accepted in-app" },
]

const PLATFORM = [
  { t: "Search that understands you", d: "Search 2,000+ roles by title, company, skill or location — ranked by fit, not recency." },
  { t: "Transparent match scores", d: "Every role shows why it matched. No black box, and you can always disagree with it." },
  { t: "One pipeline, both sides", d: "Applicant and employer see the same seven stages at the same moment." },
  { t: "Hiring, end to end", d: "Interviews, assessments, offers, onboarding, HRMS and payroll in one workspace." },
]

const TRUST = [
  { t: "Encrypted biometrics", d: "Face vectors are AES-encrypted; raw images are never stored." },
  { t: "Verified employers", d: "Companies are identity-checked before a role goes live." },
  { t: "You own your data", d: "Export or delete your profile and applications at any time." },
  { t: "Built in-house", d: "Auth, matching, messaging and payroll are ours — not resold third-party services." },
]

/* Circular "fit" gauge — an in-house SVG ring that animates in like a little pop-up.
   Illustrative of the psychophysical fit score; no external chart library. */
function FitRing() {
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShown(true), 150); return () => clearTimeout(t) }, [])
  const pct = 87, R = 34, C = 2 * Math.PI * R
  const off = shown ? C * (1 - pct / 100) : C
  return (
    <div className={`fitPop${shown ? " on" : ""}`}>
      <div className="fitRing">
        <svg width="104" height="104" viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r={R} fill="none" stroke="var(--line)" strokeWidth="7" />
          <circle cx="40" cy="40" r={R} fill="none" stroke="var(--g)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 40 40)"
            style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)" }} />
          <text x="40" y="37" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--ink)" style={{ font: "700 17px var(--font-display)" }}>{pct}%</text>
          <text x="40" y="51" textAnchor="middle" fontSize="8" letterSpacing="1" fill="var(--ink3)">FIT</text>
        </svg>
      </div>
      <div className="fitTxt">
        <span className="fitBadge"><em />Strong fit</span>
        <strong>Product &amp; Systems Design</strong>
        <span className="fitWhy">Analytical temperament · steady energy · deep-focus disposition</span>
      </div>
    </div>
  )
}

/* Mobile-only "swipe" affordance shown above each card rail. In-house SVG chevrons. */
function SwipeHint() {
  return (
    <p className="railHint">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l-5 6 5 6M15 6l5 6-5 6" /></svg>
      Swipe to explore
    </p>
  )
}

export default function Home() {
  const [s, setS] = useState<Stats | null>(null)
  const [authed, setAuthed] = useState(false)
  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(setS).catch(() => {})
    // No-DB auth check — show "Dashboard" for signed-in visitors.
    fetch("/api/auth/status").then(r => r.json()).then(d => setAuthed(!!d.authenticated)).catch(() => {})
  }, [])

  const roles = s ? s.jobs.toLocaleString() : "—"
  const companies = s ? s.companies.toLocaleString() : "—"
  const industries = s ? String(s.industries) : "—"

  return (
    <div className="v">
      {/* NAV */}
      <header className="nav">
        <div className="wrap navIn">
          <Link href="/" className="brand"><Keystone size={26} style={{ marginRight: 9 }} />Vrittih</Link>
          <nav className="navLinks">
            <Link href="/jobs">Find jobs</Link>
            <Link href="/companies">Companies</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/developers">Developers</Link>
          </nav>
          <div className="navCta">
            {authed ? (
              <Link href="/dashboard" className="btn">Go to dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="ghost">Sign in</Link>
                <Link href="/register" className="btn">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="wrap center">
          <div className="badge">
            <span className="pill">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" /></svg>
              New
            </span>
            Every application shows its status at every stage
          </div>
          <h1 className="h1">Hiring, reduced to a certainty.</h1>
          <p className="lede">Vrittih is one platform for every job seeker and every employer — apply, interview, test and get hired in one place, with live status from first click to offer letter.</p>
          <div className="ctaRow">
            {authed
              ? <Link href="/dashboard" className="btn lg">Go to dashboard</Link>
              : <Link href="/register" className="btn lg">Get started free</Link>}
            <Link href="/jobs" className="btn lg ghostBtn">Browse {roles} roles</Link>
          </div>
        </div>

        {/* Product preview IS the hero — a real interface, larger than the CTAs:
            the live stage tracker plus real application rows with a next event. */}
        <div className="wrap">
          <div className="shot">
            <div className="shotBar"><i /><i /><i /><span>vrittih.online/dashboard</span></div>
            <div className="shotBody">
              <div className="shotHead">
                <div>
                  <div className="shotTitle">Your pipeline</div>
                  <div className="shotSub">Every stage visible — to you and to the employer, at the same moment</div>
                </div>
                <span className="live"><em />Live</span>
              </div>
              <PipelineRail stages={[
                { label: "Applied", count: 5 }, { label: "Screening", count: 3 },
                { label: "Interview", count: 2 }, { label: "Offer", count: 1 }, { label: "Hired", count: 0 },
              ]} />
              <div style={PV.rows}>
                {PREVIEW_ROWS.map(r => (
                  <div key={r.role} style={PV.row}>
                    <span style={PV.main}>
                      <span style={PV.role}>{r.role}</span>
                      <span style={PV.meta}>{r.company} · {r.city}</span>
                    </span>
                    <span style={{ ...PV.badge, background: r.bg, color: r.fg }}>{r.stage}</span>
                    <span style={PV.next}>{r.next}</span>
                  </div>
                ))}
              </div>
              <p className="sampleNote">Illustrative sample — companies shown are fictional.</p>
            </div>
          </div>
        </div>
      </section>

      {/* BRANDS — real ones */}
      <section className="band">
        <div className="wrap center">
          <p className="eyebrow">Hiring on Vrittih today</p>
          <div className="logos">
            {(s?.brands || []).map(b => (
              <Link key={b.slug} href={`/companies/${b.slug}`} className="logo">{b.name}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* JOURNEY */}
      <section className="sec">
        <div className="wrap">
          <p className="eyebrow">The candidate journey</p>
          <h2 className="h2">From profile to offer, guided end to end.</h2>
          <p className="sub">Every stage is visible and moves forward — no black boxes, no dead ends, no wondering where your application went.</p>
          <SwipeHint />
          <div className="grid6">
            {JOURNEY.map((x, i) => (
              <div key={x.t} className="step">
                <span className="stepN">{String(i + 1).padStart(2, "0")}</span>
                <div className="stepT">{x.t}</div>
                <div className="stepD">{x.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORM */}
      <section className="sec alt">
        <div className="wrap">
          <p className="eyebrow">The platform</p>
          <h2 className="h2">Everything you need, in one workspace.</h2>
          <p className="sub">Search, scoring, matching and pipeline — every signal in view, for both sides of the table.</p>
          <SwipeHint />
          <div className="grid2">
            {PLATFORM.map(x => (
              <div key={x.t} className="card">
                <div className="cardT">{x.t}</div>
                <p className="cardD">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Psychophysical nature — career clarity (a genuine differentiator) */}
      <section className="sec">
        <div className="wrap">
          <p className="eyebrow">Career clarity</p>
          <h2 className="h2">Know what fits — before you choose.</h2>
          <p className="sub">Beyond skills and experience, Vrittih analyses your psychophysical nature — your temperament, energy and disposition — to point you toward the career directions that genuinely suit you. Guidance to decide with, never a gate.</p>
          <FitRing />
          <SwipeHint />
          <div className="grid2">
            <div className="card"><div className="cardT">Best‑fit career direction</div><p className="cardD">Your nature and your experience, blended into clear, best‑fit roles — with the reasoning shown.</p></div>
            <div className="card"><div className="cardT">Guidance for your day</div><p className="cardD">Advanced members get a short daily note — what to lean into, and what to ease off.</p></div>
            <div className="card"><div className="cardT">Entirely in‑house &amp; private</div><p className="cardD">Computed on our own engine from the details you provide — no third‑party service ever sees it.</p></div>
            <div className="card"><div className="cardT">Yours to weigh</div><p className="cardD">It informs your choice; you always decide. Add your details to unlock it.</p></div>
          </div>
        </div>
      </section>

      {/* NUMBERS — only what is real */}
      <section className="sec alt">
        <div className="wrap">
          <div className="grid3">
            <div className="stat"><b>{roles}</b><span>Open roles</span><i>live on the board right now</i></div>
            <div className="stat"><b>{companies}</b><span>Companies hiring</span><i>identity-checked employers</i></div>
            <div className="stat"><b>{industries}</b><span>Industries</span><i>from aerospace to sport</i></div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="sec">
        <div className="wrap">
          <p className="eyebrow">Trust &amp; security</p>
          <h2 className="h2">Built to be trusted with your career.</h2>
          <SwipeHint />
          <div className="grid4">
            {TRUST.map(x => (
              <div key={x.t} className="card">
                <div className="cardT">{x.t}</div>
                <p className="cardD">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="wrap center">
          <h2 className="h2 white">Start with certainty.</h2>
          <p className="sub white">Create a free account in under a minute. No credit card, no setup calls.</p>
          <div className="ctaRow">
            <Link href="/register" className="btn lg white">Get started free</Link>
            <Link href="/pricing" className="btn lg ghostWhite">See pricing</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="foot">
        <div className="wrap footIn">
          <div className="footBrand">
            <Link href="/" className="brand"><Keystone size={26} style={{ marginRight: 9 }} />Vrittih</Link>
            <p>One platform for every job seeker and every employer — apply, interview, test and get hired in one place.</p>
          </div>
          <div className="footCol"><h4>Product</h4><Link href="/jobs">Find jobs</Link><Link href="/companies">Companies</Link><Link href="/pricing">Pricing</Link><Link href="/developers">Developers</Link></div>
          <div className="footCol"><h4>For employers</h4><Link href="/register">Post a job</Link><Link href="/hrms">HRMS</Link><Link href="/hrms/payroll">Payroll</Link><Link href="/pricing">Plans</Link></div>
          <div className="footCol"><h4>Account</h4><Link href="/login">Sign in</Link><Link href="/register">Create account</Link><Link href="/dashboard">Dashboard</Link></div>
        </div>
        <div className="wrap footBase">© 2026 Vrittih · Every industry. Every professional. One network.</div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  )
}

/* Tokens are DESIGN_SYSTEM.md verbatim: #FAFAF8 bg, #101828/#667085/#98A2B3 text,
   #EAECF0 borders, #6495ED brand, Inter 400–700, radius 20/16/14/999,
   soft shadows, 150ms hover / 250ms page, cubic ease-out. */
const CSS = `
.v{--bg:#FAFAF8;--card:#FFF;--ink:#101828;--ink2:#667085;--ink3:#98A2B3;--line:#EAECF0;--line2:#F2F4F1;
 --g:#6495ED;--gh:#0B6C54;--gt:rgba(13,122,95,.08);--gt2:rgba(13,122,95,.14);
 --sh:0 1px 2px rgba(16,24,40,.04),0 1px 3px rgba(16,24,40,.05);--shH:0 10px 26px rgba(16,24,40,.07);
 --e:cubic-bezier(.22,1,.36,1);
 background:var(--bg);color:var(--ink);
 font-family:var(--font-inter),Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
 -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.v *{box-sizing:border-box}
.wrap{max-width:1160px;margin:0 auto;padding:0 24px}
.center{text-align:center}
.eyebrow{font-size:13px;font-weight:600;color:var(--g);letter-spacing:.02em;margin:0 0 10px}
.h1{margin:26px auto 0;max-width:880px;font-family:var(--font-display);font-size:clamp(38px,6.4vw,62px);font-weight:500;line-height:1.05;letter-spacing:-.03em;color:var(--ink);text-wrap:balance}
.h2{font-family:var(--font-display);font-size:clamp(26px,3.6vw,36px);font-weight:500;letter-spacing:-.025em;line-height:1.15;margin:0 0 12px;text-wrap:balance}
.h2.white{color:#fff}
.lede{margin:22px auto 0;max-width:620px;font-size:clamp(16px,2vw,20px);line-height:1.6;color:var(--ink2)}
.sub{font-size:17px;line-height:1.6;color:var(--ink2);margin:0 0 32px;max-width:640px}
.sub.white{color:rgba(255,255,255,.78);margin-inline:auto}

/* nav */
.nav{position:sticky;top:0;z-index:50;background:rgba(250,250,248,.86);backdrop-filter:saturate(180%) blur(14px);border-bottom:1px solid var(--line)}
.navIn{display:flex;align-items:center;gap:28px;height:66px}
.brand{display:inline-flex;align-items:center;gap:9px;font-size:17px;font-weight:600;color:var(--ink);text-decoration:none;letter-spacing:-.01em}
.mk{width:28px;height:28px;border-radius:8px;background:var(--g);color:#fff;display:grid;place-items:center;font-size:14px;font-weight:700}
.navLinks{display:flex;gap:26px;flex:1}
.navLinks a{font-size:14.5px;font-weight:500;color:var(--ink2);text-decoration:none;transition:color .15s var(--e)}
.navLinks a:hover{color:var(--ink)}
.navCta{display:flex;align-items:center;gap:10px}
.ghost{font-size:14.5px;font-weight:600;color:var(--ink);text-decoration:none;padding:9px 14px;border-radius:14px;transition:background .15s}
.ghost:hover{background:var(--line2)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--g);color:#fff;border:none;border-radius:14px;padding:11px 20px;font-size:14.5px;font-weight:600;text-decoration:none;cursor:pointer;transition:background .15s var(--e),transform .1s var(--e),box-shadow .15s}
.btn:hover{background:var(--gh);color:#fff}
.btn:active{transform:scale(.97)}
.btn.lg{padding:15px 28px;font-size:16px;border-radius:14px}
.btn.ghostBtn{background:var(--card);color:var(--ink);border:1px solid var(--line);box-shadow:var(--sh)}
.btn.ghostBtn:hover{background:var(--card);border-color:var(--ink3);color:var(--ink)}
.btn.white{background:#fff;color:var(--g)}
.btn.white:hover{background:#F2F4F1;color:var(--g)}
.btn.ghostWhite{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.28)}
.btn.ghostWhite:hover{background:rgba(255,255,255,.2);color:#fff}

/* hero */
.hero{padding:clamp(56px,9vw,104px) 0 0}
.badge{display:inline-flex;align-items:center;gap:9px;font-size:13.5px;color:var(--ink2);background:var(--card);border:1px solid var(--line);padding:6px 14px 6px 6px;border-radius:999px;box-shadow:var(--sh)}
.pill{display:inline-flex;align-items:center;gap:6px;background:rgba(13,122,95,.1);color:var(--g);font-weight:600;padding:3px 9px;border-radius:999px;font-size:12px}
.ctaRow{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:34px}

/* product shot */
.shot{margin-top:clamp(44px,7vw,72px);background:var(--card);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shH);overflow:hidden}
.shotBar{display:flex;align-items:center;gap:7px;padding:13px 18px;border-bottom:1px solid var(--line2);background:#FCFCFB}
.shotBar i{width:10px;height:10px;border-radius:50%;background:#E4E7EC}
.shotBar span{margin-left:12px;font-size:12.5px;color:var(--ink3)}
.shotBody{padding:clamp(20px,3vw,30px)}
.shotHead{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.shotTitle{font-size:22px;font-weight:600;letter-spacing:-.01em}
.shotSub{font-size:14.5px;color:var(--ink2);margin-top:4px}
.live{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--g);background:var(--gt);padding:6px 13px;border-radius:999px}
.live em{width:7px;height:7px;border-radius:50%;background:var(--g);font-style:normal}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:24px}
.kpi{background:var(--bg);border:1px solid var(--line2);border-radius:16px;padding:20px}
.kpi b{display:block;font-size:clamp(26px,3.4vw,34px);font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.kpi span{display:block;font-size:14px;color:var(--ink2);margin-top:4px}
.stages{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:24px;padding-top:22px;border-top:1px solid var(--line2)}
.stage{display:inline-flex;align-items:center;gap:8px;font-size:14px;color:var(--ink3)}
.stage em{width:8px;height:8px;border-radius:50%;background:#E4E7EC;font-style:normal}
.stage.on{color:var(--ink)}
.stage.on em{background:var(--g)}

/* brand band */
.band{padding:clamp(44px,6vw,72px) 0 0}
.logos{display:flex;flex-wrap:wrap;justify-content:center;gap:12px 30px;margin-top:18px}
.logo{font-size:17px;font-weight:600;color:var(--ink3);text-decoration:none;transition:color .15s var(--e)}
.logo:hover{color:var(--ink)}

/* sections */
.sec{padding:clamp(56px,9vw,104px) 0}
.sec.alt{background:var(--card);border-block:1px solid var(--line)}
.grid6{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.step,.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:26px;box-shadow:var(--sh);transition:transform .15s var(--e),box-shadow .15s var(--e)}
.sec.alt .step,.sec.alt .card{background:var(--bg)}
.step:hover,.card:hover{transform:translateY(-3px);box-shadow:var(--shH)}
.stepN{font-size:12.5px;font-weight:700;color:var(--g);font-variant-numeric:tabular-nums}
.stepT,.cardT{font-size:18px;font-weight:600;margin-top:10px;letter-spacing:-.01em}
.stepD,.cardD{font-size:15px;line-height:1.6;color:var(--ink2);margin:8px 0 0}

/* sample caption under the hero mockup */
.sampleNote{font-size:12px;color:var(--ink3);margin:12px 0 0;text-align:center}

/* "Know what fits" — circular fit gauge that pops in like a little card */
.fitPop{display:inline-flex;align-items:center;gap:18px;margin:0 0 28px;padding:16px 22px 16px 16px;
 background:var(--card);border:1px solid var(--line);border-left:3px solid var(--g);border-radius:18px;box-shadow:var(--shH);
 opacity:0;transform:translateY(10px) scale(.96);transition:opacity .45s var(--e),transform .45s var(--e)}
.fitPop.on{opacity:1;transform:none}
.fitRing{flex:none;display:grid;place-items:center}
.fitTxt{display:flex;flex-direction:column;gap:3px}
.fitBadge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--g)}
.fitBadge em{width:7px;height:7px;border-radius:50%;background:var(--g);font-style:normal}
.fitTxt strong{font-size:16px;font-weight:600;color:var(--ink);letter-spacing:-.01em}
.fitWhy{font-size:13px;color:var(--ink2)}

/* mobile swipe rail — cards become flickable, snapping smooth cards with a peek of the next */
.railHint{display:none}

/* engine */
.flow{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:26px}
.node{display:inline-flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:10px 18px;font-size:14.5px;font-weight:600;box-shadow:var(--sh)}
.arrow{font-style:normal;color:var(--ink3);margin-left:2px}
.assure{display:flex;flex-direction:column;gap:10px}
.assure span{position:relative;padding-left:26px;font-size:15.5px;color:var(--ink2)}
.assure span::before{content:"";position:absolute;left:0;top:7px;width:8px;height:8px;border-radius:50%;background:var(--g)}

/* stats */
.stat{background:var(--bg);border:1px solid var(--line);border-radius:20px;padding:30px}
.stat b{display:block;font-size:clamp(34px,5vw,48px);font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1}
.stat span{display:block;font-size:16px;font-weight:600;margin-top:10px}
.stat i{display:block;font-style:normal;font-size:14px;color:var(--ink2);margin-top:4px}

/* cta */
.cta{background:var(--g);padding:clamp(56px,9vw,96px) 0}
.cta .ctaRow{margin-top:28px}

/* footer */
.foot{background:var(--card);border-top:1px solid var(--line);padding:56px 0 28px}
.footIn{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:36px}
.footBrand p{font-size:14.5px;line-height:1.6;color:var(--ink2);margin:14px 0 0;max-width:300px}
.footCol{display:flex;flex-direction:column;gap:10px}
.footCol h4{font-size:13px;font-weight:600;color:var(--ink);margin:0 0 2px}
.footCol a{font-size:14.5px;color:var(--ink2);text-decoration:none;transition:color .15s}
.footCol a:hover{color:var(--g)}
.footBase{margin-top:40px;padding-top:22px;border-top:1px solid var(--line);font-size:13.5px;color:var(--ink3)}

@media (max-width:900px){
  .navLinks{display:none}
  .grid6,.grid4,.grid3,.grid2{grid-template-columns:1fr 1fr}
  .footIn{grid-template-columns:1fr 1fr}
}
@media (max-width:620px){
  .kpis,.footIn,.grid3{grid-template-columns:1fr}
  .ctaRow .btn{width:100%}
  .fitPop{width:100%}

  /* Flashable smooth cards: horizontal scroll-snap rail, momentum, hidden scrollbar,
     and a peek of the next card so it reads as swipeable. (Stats grid3 stays stacked.) */
  .grid6,.grid4,.grid2{
    display:flex;grid-template-columns:none;overflow-x:auto;scroll-snap-type:x mandatory;
    gap:14px;margin-inline:-24px;padding:4px 24px 16px;scroll-padding-left:24px;
    -webkit-overflow-scrolling:touch;scrollbar-width:none;overscroll-behavior-x:contain}
  .grid6::-webkit-scrollbar,.grid4::-webkit-scrollbar,.grid2::-webkit-scrollbar{display:none}
  .grid6>*,.grid4>*,.grid2>*{flex:0 0 82%;scroll-snap-align:center;scroll-snap-stop:always}
  .step:hover,.card:hover{transform:none}   /* no hover-lift on touch */

  /* swipe hint under each rail-bearing section heading */
  .railHint{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink3);margin:-4px 0 14px}
  .railHint svg{color:var(--g)}
}
@media (max-width:380px){
  .grid6>*,.grid4>*,.grid2>*{flex:0 0 88%}
}
@media (prefers-reduced-motion:reduce){.v *{transition:none!important;animation:none!important}}
`
