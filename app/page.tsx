"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

/*
  Vrittih homepage — built to DESIGN_SYSTEM.md (Inter, #0D7A5F, 8px space,
  20/16/14 radii, soft shadows, 250ms/150ms motion).

  Where this deliberately differs from the supplied mockup, and why:
  · The mockup's logo wall listed Stripe, Vercel, Linear, Ramp, Notion and
    Mercury. They are not customers. Naming them would be false endorsement and
    trademark misuse, so the wall shows the real brands hiring here, pulled live.
  · The mockup advertised "successful placements across 200+ countries", an "AI
    match accuracy" figure and an average time-to-hire. There have been no
    placements yet, so there is nothing to measure — invented numbers are exactly
    what a hiring platform cannot afford to be caught doing. The band shows live
    counts from the database instead.
  · The mockup claimed SOC 2 Type II and ISO 27001. Those are specific
    attestations from external auditors that Vrittih has not undergone; claiming
    them is the kind of thing enterprise buyers verify and regulators punish. The
    trust section states only what is actually true today.
*/

type Stats = { jobs: number; companies: number; industries: number; brands: { name: string; slug: string }[] }

const JOURNEY = [
  { t: "Create your profile", d: "Experience, skills and education in one place" },
  { t: "Get matched", d: "Every role scored against your profile" },
  { t: "Apply in one click", d: "No re-typing the same form again" },
  { t: "Screen & test", d: "Assessments and interviews inside the platform" },
  { t: "Interview", d: "Scheduled, with both sides seeing the same status" },
  { t: "Offer", d: "Live status from first click to offer letter" },
]

const ENGINE = ["Profile", "Skills", "Matching", "Ranking", "Recommendation"]

const PRINCIPLES = [
  "Every match shows the score it was given",
  "The reasons are visible, never hidden",
  "A human always makes the decision",
]

const TRUST = [
  { t: "Encrypted in transit and at rest", d: "TLS on every request; the database encrypts stored data." },
  { t: "Verified identities", d: "Face-vector and document checks. Encrypted vectors only — raw images are never stored." },
  { t: "Your data stays yours", d: "Export or delete your profile and applications at any time." },
  { t: "Built in-house", d: "Auth, matching, messaging and mail are ours — not resold third-party services." },
]

function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } }, { rootMargin: "-40px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, shown }
}

function Section({ eyebrow, title, lead, children }: any) {
  const { ref, shown } = useReveal()
  return (
    <section ref={ref} className={"sec" + (shown ? " in" : "")}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="h2">{title}</h2>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </section>
  )
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then((d: Stats) => { if (d?.jobs) setStats(d) }).catch(() => {})
  }, [])

  const brands = stats?.brands ?? []
  const n = (v?: number) => (v == null ? "—" : v.toLocaleString())

  return (
    <div className="vh">
      <a href="#main" className="skip">Skip to content</a>

      <header className={"nav" + (scrolled ? " on" : "")}>
        <div className="navIn">
          <Link href="/" className="brand">
            <span className="mark" aria-hidden><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg></span>
            Vrittih
          </Link>
          <nav className="navLinks" aria-label="Main">
            <Link href="/jobs" className="nl">Find jobs</Link>
            <Link href="/companies" className="nl">Companies</Link>
            <Link href="/dashboard/recruiter" className="nl">For recruiters</Link>
            <Link href="/pricing" className="nl">Pricing</Link>
          </nav>
          <div className="navR">
            <Link href="/login" className="btnGhost">Sign in</Link>
            <Link href="/register" className="btn">Get started</Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ---------- HERO ---------- */}
        <section className="hero">
          <Link href="/jobs" className="pill">
            <span className="pillNew">Live</span>
            {stats ? `${n(stats.jobs)} open roles across ${n(stats.companies)} companies` : "Roles open across every industry"}
          </Link>

          <h1 className="h1">Hiring, reduced to a certainty.</h1>
          <p className="sub">
            One platform for every job seeker and every employer — apply, interview, test and get
            hired in one place, with live status from first click to offer letter.
          </p>
          <div className="ctaRow">
            <Link href="/register" className="btn lg">Get started free</Link>
            <Link href="/jobs" className="btnGhost lg">Browse {stats ? n(stats.jobs) : ""} roles</Link>
          </div>

          {/* the interface is the hero — a real view of the product */}
          <div className="shot">
            <div className="shotBar">
              <span className="dot" /><span className="dot" /><span className="dot" />
              <span className="url">vrittih.online/dashboard</span>
            </div>
            <div className="shotBody">
              <div className="shotHead">
                <div>
                  <div className="shotHi">Your pipeline</div>
                  <div className="shotSub">Every stage visible — to you and to the employer</div>
                </div>
                <span className="chip">Live</span>
              </div>
              <div className="kpis">
                <div className="kpi"><span className="kpiN">{stats ? n(stats.jobs) : "—"}</span><span className="kpiL">Open roles</span></div>
                <div className="kpi"><span className="kpiN">{stats ? n(stats.companies) : "—"}</span><span className="kpiL">Companies</span></div>
                <div className="kpi"><span className="kpiN">7</span><span className="kpiL">Stages, all visible</span></div>
              </div>
              <div className="stages">
                {["Applied", "Screen", "Task", "Interview", "Team", "Offer", "Hired"].map((s, i) => (
                  <div key={s} className="stage">
                    <span className={"sDot" + (i < 4 ? " done" : "")} />
                    <span className="sLabel">{s}</span>
                  </div>
                ))}
              </div>
              {brands[0] && (
                <div className="matchCard">
                  <div>
                    <div className="mcRole">Open role</div>
                    <div className="mcCo">{brands[0].name}</div>
                  </div>
                  <Link href="/jobs" className="mcBtn">View</Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ---------- REAL BRANDS ---------- */}
        {brands.length > 0 && (
          <section className="logos">
            <p className="logosT">Hiring on Vrittih</p>
            <div className="logoRow">
              {brands.map((b) => (
                <Link key={b.slug} href={`/companies/${b.slug}`} className="logo">{b.name}</Link>
              ))}
            </div>
          </section>
        )}

        {/* ---------- JOURNEY ---------- */}
        <Section
          eyebrow="The candidate journey"
          title="From profile to offer, guided end to end."
          lead="Every stage is visible and moves forward in the open — no black boxes, no dead ends, no silence."
        >
          <div className="grid3">
            {JOURNEY.map((s, i) => (
              <div key={s.t} className="card">
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="h3">{s.t}</h3>
                <p className="p">{s.d}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------- ENGINE ---------- */}
        <Section
          eyebrow="The matching engine"
          title="Matching you can actually explain."
          lead="Profiles become structured skills, skills become a score against every role, and every recommendation shows the reasoning behind it."
        >
          <div className="flow">
            {ENGINE.map((s, i) => (
              <div key={s} className="flowStep">
                <span className="flowDot">{i + 1}</span>
                <span className="flowT">{s}</span>
                {i < ENGINE.length - 1 && <span className="flowArrow" aria-hidden>→</span>}
              </div>
            ))}
          </div>
          <div className="grid3">
            {PRINCIPLES.map((p) => (
              <div key={p} className="card tight">
                <span className="tick" aria-hidden>✓</span>
                <p className="pStrong">{p}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------- LIVE NUMBERS (real, or nothing) ---------- */}
        <section className="band">
          <div className="bandIn">
            <div className="bStat"><span className="bN">{n(stats?.jobs)}</span><span className="bL">Open roles<em>live on the board</em></span></div>
            <div className="bStat"><span className="bN">{n(stats?.companies)}</span><span className="bL">Companies hiring<em>verified employers only</em></span></div>
            <div className="bStat"><span className="bN">{n(stats?.industries)}</span><span className="bL">Industries<em>every sector, no niche</em></span></div>
            <div className="bStat"><span className="bN">7</span><span className="bL">Hiring stages<em>all of them visible</em></span></div>
          </div>
        </section>

        {/* ---------- TRUST ---------- */}
        <Section eyebrow="Trust &amp; security" title="Built to be trusted with a career.">
          <div className="grid2">
            {TRUST.map((t) => (
              <div key={t.t} className="card">
                <h3 className="h3">{t.t}</h3>
                <p className="p">{t.d}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------- CTA ---------- */}
        <section className="cta">
          <h2 className="ctaH">Your next opportunity starts here.</h2>
          <p className="ctaP">Create an account in under a minute and apply to every role on the board.</p>
          <div className="ctaRow center">
            <Link href="/register" className="btn lg light">Get started free</Link>
            <Link href="/jobs" className="btnGhost lg onDark">Browse roles</Link>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="footIn">
          <div className="footBrand">
            <Link href="/" className="brand dark">
              <span className="mark" aria-hidden><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg></span>
              Vrittih
            </Link>
            <p className="footP">Every industry. Every professional. One network.</p>
          </div>
          <div className="footCols">
            <div><span className="fcT">Product</span>
              <Link href="/jobs" className="fl">Find jobs</Link>
              <Link href="/companies" className="fl">Companies</Link>
              <Link href="/jobs/match" className="fl">Matched for you</Link>
              <Link href="/pricing" className="fl">Pricing</Link>
            </div>
            <div><span className="fcT">Employers</span>
              <Link href="/dashboard/post-job" className="fl">Post a job</Link>
              <Link href="/dashboard/recruiter" className="fl">Candidates</Link>
              <Link href="/hrms" className="fl">HRMS</Link>
              <Link href="/developers" className="fl">Developer API</Link>
            </div>
            <div><span className="fcT">Account</span>
              <Link href="/login" className="fl">Sign in</Link>
              <Link href="/register" className="fl">Create account</Link>
              <Link href="/settings" className="fl">Settings</Link>
            </div>
          </div>
        </div>
        <div className="footBar">© {new Date().getFullYear()} Vrittih · vrittih.online</div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  )
}

const CSS = `
.vh{--bg:#FAFAF8;--card:#FFFFFF;--ink:#101828;--ink2:#667085;--ink3:#98A2B3;--line:#EAECF0;--line2:#F2F4F1;
 --g:#0D7A5F;--gh:#0B6C54;--gt:rgba(13,122,95,.08);--gt2:rgba(13,122,95,.14);
 --r-card:20px;--r-in:16px;--r-btn:14px;
 --sh:0 1px 2px rgba(16,24,40,.04),0 1px 3px rgba(16,24,40,.05);
 --shH:0 10px 26px rgba(16,24,40,.07);
 --e:cubic-bezier(.22,1,.36,1);
 background:var(--bg);color:var(--ink);
 font-family:var(--font-inter),Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
 font-feature-settings:"cv02","cv03","cv04";-webkit-font-smoothing:antialiased;}
.vh *{box-sizing:border-box;min-width:0}
html,body{margin:0;overflow-x:hidden;max-width:100%}
.skip{position:absolute;left:-9999px}
.skip:focus{left:12px;top:12px;background:var(--g);color:#fff;padding:8px 14px;border-radius:8px;z-index:100}

/* nav */
.nav{position:sticky;top:0;z-index:50;transition:background .25s var(--e),border-color .25s,backdrop-filter .25s;border-bottom:1px solid transparent}
.nav.on{background:rgba(250,250,248,.82);backdrop-filter:blur(14px) saturate(160%);border-bottom-color:var(--line)}
.navIn{max-width:1200px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;gap:24px}
.brand{display:inline-flex;align-items:center;gap:10px;font-size:18px;font-weight:600;color:var(--ink);text-decoration:none;letter-spacing:-.01em}
.brand.dark{color:#fff}
.mark{width:30px;height:30px;border-radius:9px;background:var(--g);display:grid;place-items:center;flex-shrink:0}
.navLinks{display:flex;gap:4px;flex:1;margin-left:8px}
.nl{padding:8px 12px;border-radius:10px;font-size:14.5px;font-weight:500;color:var(--ink2);text-decoration:none;transition:color .15s,background .15s}
.nl:hover{color:var(--ink);background:var(--line2)}
.navR{display:flex;align-items:center;gap:8px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--g);color:#fff;border:none;border-radius:var(--r-btn);padding:10px 18px;font-size:14.5px;font-weight:600;text-decoration:none;transition:background .15s,transform .1s var(--e),box-shadow .15s;box-shadow:var(--sh)}
.btn:hover{background:var(--gh)}
.btn:active{transform:scale(.97)}
.btn.lg{padding:14px 26px;font-size:16px}
.btn.light{background:#fff;color:var(--g)}
.btnGhost{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:var(--r-btn);font-size:14.5px;font-weight:600;color:var(--ink);text-decoration:none;border:1px solid var(--line);background:var(--card);transition:border-color .15s,transform .1s var(--e)}
.btnGhost:hover{border-color:var(--ink3)}
.btnGhost:active{transform:scale(.97)}
.btnGhost.lg{padding:14px 24px;font-size:16px}
.btnGhost.onDark{background:transparent;color:#fff;border-color:rgba(255,255,255,.28)}
.btnGhost.onDark:hover{border-color:rgba(255,255,255,.6)}

/* hero */
.hero{max-width:1200px;margin:0 auto;padding:clamp(48px,8vw,104px) 24px 0;text-align:center}
.pill{display:inline-flex;align-items:center;gap:10px;padding:7px 16px 7px 7px;border-radius:999px;border:1px solid var(--line);background:var(--card);box-shadow:var(--sh);font-size:14px;color:var(--ink2);text-decoration:none;transition:border-color .15s,transform .15s var(--e)}
.pill:hover{border-color:var(--ink3);transform:translateY(-1px)}
.pillNew{background:var(--gt2);color:var(--g);font-weight:600;font-size:12px;padding:3px 10px;border-radius:999px}
.h1{font-size:clamp(40px,6.4vw,68px);line-height:1.04;letter-spacing:-.035em;font-weight:600;margin:24px auto 0;max-width:16ch}
.sub{font-size:clamp(17px,2vw,19px);line-height:1.6;color:var(--ink2);max-width:60ch;margin:20px auto 0}
.ctaRow{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:32px}
.ctaRow.center{justify-content:center}

/* product shot */
.shot{margin:56px auto 0;max-width:1000px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);box-shadow:var(--shH);overflow:hidden;text-align:left}
.shotBar{display:flex;align-items:center;gap:7px;padding:12px 16px;border-bottom:1px solid var(--line2);background:#FCFCFB}
.dot{width:10px;height:10px;border-radius:50%;background:var(--line)}
.url{margin-left:12px;font-size:12.5px;color:var(--ink3)}
.shotBody{padding:clamp(18px,3vw,28px)}
.shotHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.shotHi{font-size:20px;font-weight:600;letter-spacing:-.02em}
.shotSub{font-size:14px;color:var(--ink2);margin-top:4px}
.chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--g);background:var(--gt);padding:5px 12px;border-radius:999px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:20px}
.kpi{border:1px solid var(--line);border-radius:var(--r-in);padding:16px;background:var(--bg)}
.kpiN{display:block;font-size:26px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.kpiL{display:block;font-size:13px;color:var(--ink2);margin-top:4px}
.stages{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:20px;padding-top:18px;border-top:1px solid var(--line2)}
.stage{display:inline-flex;align-items:center;gap:7px}
.sDot{width:9px;height:9px;border-radius:50%;background:var(--line);flex-shrink:0}
.sDot.done{background:var(--g)}
.sLabel{font-size:13px;color:var(--ink2)}
.matchCard{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:18px;padding:14px 16px;border:1px solid var(--line);border-radius:var(--r-in);background:var(--bg)}
.mcRole{font-size:12px;color:var(--ink3)}
.mcCo{font-size:15px;font-weight:600;margin-top:2px}
.mcBtn{font-size:13.5px;font-weight:600;color:var(--g);text-decoration:none;padding:8px 14px;border-radius:10px;background:var(--gt)}

/* logo wall */
.logos{max-width:1200px;margin:0 auto;padding:64px 24px 8px;text-align:center}
.logosT{font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}
.logoRow{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:20px}
.logo{font-size:15px;font-weight:600;color:var(--ink2);text-decoration:none;padding:9px 18px;border-radius:999px;border:1px solid var(--line);background:var(--card);transition:color .15s,border-color .15s,transform .15s var(--e)}
.logo:hover{color:var(--g);border-color:var(--g);transform:translateY(-2px)}

/* sections */
.sec{max-width:1200px;margin:0 auto;padding:clamp(56px,8vw,96px) 24px 0;opacity:0;transform:translateY(14px);transition:opacity .5s var(--e),transform .5s var(--e)}
.sec.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.sec{opacity:1;transform:none;transition:none}}
.eyebrow{font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--g);margin:0}
.h2{font-size:clamp(28px,4vw,38px);line-height:1.14;letter-spacing:-.03em;font-weight:600;margin:12px 0 0;max-width:22ch}
.lead{font-size:17px;line-height:1.65;color:var(--ink2);max-width:66ch;margin:14px 0 0}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:36px}
.grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:36px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);padding:24px;box-shadow:var(--sh);transition:box-shadow .15s,transform .15s var(--e)}
.card:hover{box-shadow:var(--shH);transform:translateY(-3px)}
.card.tight{padding:20px;display:flex;gap:12px;align-items:flex-start}
.num{font-size:13px;font-weight:600;color:var(--g);font-variant-numeric:tabular-nums}
.h3{font-size:18px;font-weight:600;letter-spacing:-.015em;margin:10px 0 0}
.p{font-size:15px;line-height:1.6;color:var(--ink2);margin:8px 0 0}
.pStrong{font-size:15px;font-weight:500;line-height:1.55;margin:0}
.tick{width:22px;height:22px;border-radius:50%;background:var(--gt);color:var(--g);display:grid;place-items:center;font-size:12px;font-weight:700;flex-shrink:0}

/* flow */
.flow{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:36px;padding:22px;border:1px solid var(--line);border-radius:var(--r-card);background:var(--card);box-shadow:var(--sh)}
.flowStep{display:inline-flex;align-items:center;gap:10px}
.flowDot{width:26px;height:26px;border-radius:50%;background:var(--gt);color:var(--g);display:grid;place-items:center;font-size:12.5px;font-weight:600;flex-shrink:0}
.flowT{font-size:15px;font-weight:500}
.flowArrow{color:var(--ink3);margin-left:6px}

/* band */
.band{max-width:1200px;margin:clamp(56px,8vw,96px) auto 0;padding:0 24px}
.bandIn{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);padding:32px;box-shadow:var(--sh)}
.bStat{display:flex;flex-direction:column;gap:6px}
.bN{font-size:clamp(28px,3.4vw,38px);font-weight:600;letter-spacing:-.03em;color:var(--g);font-variant-numeric:tabular-nums;line-height:1}
.bL{font-size:14px;font-weight:500;color:var(--ink)}
.bL em{display:block;font-style:normal;font-size:13px;font-weight:400;color:var(--ink3);margin-top:2px}

/* cta */
.cta{max-width:1152px;margin:clamp(56px,8vw,96px) auto 0;padding:clamp(44px,6vw,72px) 24px;background:#0B1F1A;border-radius:28px;text-align:center;color:#fff}
.ctaH{font-size:clamp(28px,4vw,40px);font-weight:600;letter-spacing:-.03em;margin:0}
.ctaP{font-size:17px;color:rgba(255,255,255,.72);margin:14px 0 0}

/* footer */
.foot{margin-top:clamp(56px,8vw,96px);background:#0B1F1A;color:rgba(255,255,255,.7)}
.footIn{max-width:1200px;margin:0 auto;padding:56px 24px 32px;display:grid;grid-template-columns:1.4fr 2fr;gap:40px}
.footP{font-size:14.5px;line-height:1.6;margin:14px 0 0;max-width:36ch}
.footCols{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.fcT{display:block;font-size:13px;font-weight:600;color:#fff;margin-bottom:12px}
.fl{display:block;font-size:14px;color:rgba(255,255,255,.66);text-decoration:none;padding:5px 0;transition:color .15s}
.fl:hover{color:#fff}
.footBar{border-top:1px solid rgba(255,255,255,.1);padding:20px 24px;text-align:center;font-size:13px;color:rgba(255,255,255,.5)}

/* responsive */
@media (max-width:900px){
 .navLinks{display:none}
 .grid3,.grid2{grid-template-columns:1fr 1fr}
 .bandIn{grid-template-columns:1fr 1fr;padding:24px}
 .footIn{grid-template-columns:1fr;gap:28px}
 .kpis{grid-template-columns:1fr}
}
@media (max-width:560px){
 .grid3,.grid2{grid-template-columns:1fr}
 .bandIn{grid-template-columns:1fr}
 .footCols{grid-template-columns:1fr 1fr}
 .navR .btnGhost{display:none}
 .ctaRow{flex-direction:column}
 .ctaRow .btn,.ctaRow .btnGhost{width:100%}
}
`
