"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  IconSearch, IconArrowRight, IconCheckCircle, IconShield, IconZap,
  IconVideo, IconTarget, IconMessage, IconBriefcase,
} from "@/components/ui/Icons"

const INDUSTRIES = ["Technology","Finance","Healthcare","Education","Manufacturing","Retail","Legal","Government","Logistics","Energy","Agriculture","Media","Hospitality","Real Estate","Pharma","Consulting","NGO","Other"]

const PIPELINE = [
  { c: "#185FA5", label: "Applied", time: "Just now" },
  { c: "#BA7517", label: "Under review", time: "2h ago" },
  { c: "#1D9E75", label: "Interview scheduled", time: "Today, 15:00" },
  { c: "#0F6E56", label: "Offer extended", time: "Pending" },
]

const FEATURES = [
  { icon: <IconTarget size={20} />, t: "Live application tracking", d: "Every stage visible, from applied to hired — both sides see the same truth at the same moment.", big: true },
  { icon: <IconShield size={20} />, t: "Verified identities", d: "Face-vector login with liveness and document checks. Encrypted vectors only; raw images never stored." },
  { icon: <IconVideo size={20} />, t: "Interviews built in", d: "Video, panels, group rounds, coding tests and whiteboards — all inside the platform." },
  { icon: <IconZap size={20} />, t: "Two-way matching", d: "Profiles scored against every role by skills, industry, seniority and location." },
  { icon: <IconMessage size={20} />, t: "Mail, chat & channels", d: "A full in-house communication layer. Zero third-party services." },
]

const STEPS = [
  { n: "01", t: "Join for 1 CHF, once", d: "Create your account and pay the single joining fee. Full access, nothing recurring." },
  { n: "02", t: "Build your profile", d: "Add experience, skills and education. The more complete, the sharper your matches." },
  { n: "03", t: "Apply and track live", d: "Watch every role move through all seven stages in real time — interview to offer letter." },
]

/* ---- in-house canvas node-lattice (the one 3D-ish hero moment) ---- */
function NodeLattice() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return
    const ctx = canvas.getContext("2d"); if (!ctx) return
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let W = 0, H = 0, raf = 0, running = true
    const N = 32
    const nodes = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - .5) * 0.0007, vy: (Math.random() - .5) * 0.0007,
      gold: Math.random() < 0.14, r: 1.6 + Math.random() * 2.4,
    }))
    const resize = () => {
      const rect = canvas.getBoundingClientRect(); W = rect.width; H = rect.height
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize(); window.addEventListener("resize", resize)
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const n of nodes) {
        if (!reduce) { n.x += n.vx; n.y += n.vy; if (n.x < 0 || n.x > 1) n.vx *= -1; if (n.y < 0 || n.y > 1) n.vy *= -1 }
      }
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = nodes[i], b = nodes[j], dx = (a.x - b.x) * W, dy = (a.y - b.y) * H, d = Math.hypot(dx, dy)
        if (d < 128) { ctx.strokeStyle = `rgba(226,240,233,${(1 - d / 128) * 0.34})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(b.x * W, b.y * H); ctx.stroke() }
      }
      for (const n of nodes) {
        ctx.beginPath(); ctx.arc(n.x * W, n.y * H, n.r, 0, Math.PI * 2)
        ctx.fillStyle = n.gold ? "#EAD79B" : "#BFE9D8"; ctx.globalAlpha = n.gold ? 1 : 0.85; ctx.fill(); ctx.globalAlpha = 1
      }
      if (running && !reduce) raf = requestAnimationFrame(draw)
    }
    draw()
    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting
      cancelAnimationFrame(raf)
      if (running && !reduce) raf = requestAnimationFrame(draw)
    })
    io.observe(canvas)
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); io.disconnect() }
  }, [])
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true" />
}

/* ---- live pipeline glass widget (the signature element) ---- */
function LivePipeline() {
  const [active, setActive] = useState(2)
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const t = setInterval(() => setActive(a => (a + 1) % (PIPELINE.length + 1)), 2200)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="lp v-glass">
      <div className="lpHead">
        <span className="lpTitle">Application pipeline</span>
        <span className="lpLive"><i className="v-live" />Live</span>
      </div>
      {PIPELINE.map((s, i) => {
        const done = i < active, cur = i === active
        return (
          <div key={s.label} className={"lpRow" + (done ? " done" : "") + (cur ? " cur" : "")}>
            <span className="lpDot" style={{ background: done || cur ? s.c : "transparent", borderColor: s.c }} />
            <span className="lpLabel">{s.label}</span>
            <span className="lpTime">{s.time}</span>
          </div>
        )
      })}
      <p className="lpFoot">Every application, visible at every stage — for both sides.</p>
    </div>
  )
}

/* ---- in-house count-up on first view ---- */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    const el = ref.current; if (!el) return
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(to); return }
    let raf = 0, started = false
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started) {
        started = true; const t0 = performance.now(), dur = 900
        const tick = (t: number) => { const p = Math.min(1, (t - t0) / dur); setN(Math.round((1 - Math.pow(1 - p, 3)) * to)); if (p < 1) raf = requestAnimationFrame(tick) }
        raf = requestAnimationFrame(tick)
      }
    })
    io.observe(el)
    return () => { cancelAnimationFrame(raf); io.disconnect() }
  }, [to])
  return <span ref={ref}>{n}{suffix}</span>
}

/* ---- magnetic primary button ---- */
function Magnetic({ children, ...rest }: any) {
  const ref = useRef<HTMLButtonElement>(null)
  const move = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left - r.width / 2) / (r.width / 2)
    const y = (e.clientY - r.top - r.height / 2) / (r.height / 2)
    el.style.transform = `translate(${x * 6}px, ${y * 6}px)`
  }
  const reset = () => { if (ref.current) ref.current.style.transform = "" }
  return <button ref={ref} onMouseMove={move} onMouseLeave={reset} {...rest}>{children}</button>
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const [industry, setIndustry] = useState("All")
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  const chips = ["All", "Technology", "Finance", "Healthcare", "Education", "Remote"]

  return (
    <div className="home">
      <a href="#main" className="skip">Skip to content</a>

      <header className={"nav" + (scrolled ? " navOn" : "")}>
        <div className="navInner">
          <Link href="/" className="logo">
            <span className="logoMark"><IconBriefcase size={15} /></span>
            Vrittih<em>.online</em>
          </Link>
          <nav className="navLinks" aria-label="Main">
            <Link href="/jobs" className="navLink">Find jobs</Link>
            <Link href="/network" className="navLink">Network</Link>
            <Link href="/dashboard" className="navLink">Dashboard</Link>
          </nav>
          <div className="navRight">
            <Link href="/login" className="signIn">Sign in</Link>
            <Link href="/register" className="join">Join — 1 CHF</Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* HERO */}
        <section className="hero">
          <div className="heroText">
            <p className="kicker">Every industry · Every professional · One network</p>
            <h1 className="h1">
              Find work that{" "}
              <em className="kinetic">
                {"changes your life.".split(" ").map((w, i) => (
                  <span key={i} style={{ animationDelay: `${0.15 + i * 0.09}s` }}>{w}&nbsp;</span>
                ))}
              </em>
            </h1>
            <p className="lede">
              One platform for every job seeker and every employer — apply, interview, test and get
              hired in one place, with live status from first click to offer letter.
            </p>
            <form className="search" action="/jobs" method="get" role="search">
              <span className="searchField v-neu">
                <IconSearch size={17} />
                <input type="text" name="q" placeholder="Role, company, or skill…" aria-label="Search jobs" />
              </span>
              <Magnetic type="submit" className="searchBtn">Search</Magnetic>
            </form>
            <div className="chips">
              {chips.map(c => (
                <Link key={c} href={c === "All" ? "/jobs" : c === "Remote" ? "/jobs?remote=true" : `/jobs?industry=${encodeURIComponent(c)}`}
                  className={"chip" + (industry === c ? " chipOn" : "")} onClick={() => setIndustry(c)}>{c}</Link>
              ))}
            </div>
          </div>

          <div className="heroVis">
            <div className="lattice"><NodeLattice /></div>
            <LivePipeline />
          </div>
        </section>

        {/* PROOF — bento, honest */}
        <section className="bento">
          <div className="bCard bWide">
            <p className="eyebrow">The promise</p>
            <h2 className="bTitle">Live status from first click to offer letter.</h2>
            <div className="miniPipe">
              {["Applied", "Screen", "Task", "Interview", "Team", "Offer", "Hired"].map((s, i) => (
                <div key={s} className="miniStep">
                  <span className="miniDot" style={{ background: i < 4 ? "#0F6E56" : "#D9D3C4" }} />
                  <span className="miniLabel">{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bCard bStat">
            <div className="bNum"><CountUp to={INDUSTRIES.length} /></div>
            <div className="bLabel">Industries at launch</div>
          </div>
          <div className="bCard bStat">
            <div className="bNum"><CountUp to={7} /></div>
            <div className="bLabel">Hiring stages, all visible</div>
          </div>
          <div className="bCard bGold v-gold">
            <span className="bGoldBadge"><IconCheckCircle size={15} /> Verified</span>
            <div className="bGoldText">Every profile identity-checked. Verification reads as precious — the gold mark is earned.</div>
          </div>
          <div className="bCard bStat">
            <div className="bNum">1 CHF</div>
            <div className="bLabel">One-time · lifetime access</div>
          </div>
        </section>

        {/* FEATURES — bento */}
        <section className="section">
          <p className="eyebrow">What makes this different</p>
          <h2 className="h2">Everything you need. Nothing you don&apos;t.</h2>
          <div className="feats">
            {FEATURES.map(f => (
              <div key={f.t} className={"feat" + (f.big ? " featBig" : "")}>
                <span className="featIc">{f.icon}</span>
                <div className="featTitle">{f.t}</div>
                <p className="featText">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW */}
        <section className="section">
          <p className="eyebrow">How it works</p>
          <h2 className="h2">Three steps to your next role.</h2>
          <div className="steps">
            {STEPS.map(s => (
              <div key={s.n} className="step">
                <div className="stepNum">{s.n}</div>
                <div className="stepTitle">{s.t}</div>
                <p className="stepText">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* INDUSTRIES */}
        <section className="section">
          <p className="eyebrow">Every industry</p>
          <h2 className="h2">No niche. No limits.</h2>
          <div className="chips chipsWrap">
            {INDUSTRIES.map(i => (
              <Link key={i} href={`/jobs?industry=${encodeURIComponent(i)}`} className="chip">{i}</Link>
            ))}
          </div>
        </section>

        {/* CTA slab */}
        <section className="cta">
          <h2 className="ctaH">Your next opportunity starts here.</h2>
          <p className="ctaP">Join once for 1 CHF. Access everything, in every industry, for life.</p>
          <div className="ctaRow">
            <Link href="/register" className="ctaPrimary">Get started — 1 CHF <IconArrowRight size={15} /></Link>
            <Link href="/jobs" className="ctaSecondary">Browse jobs</Link>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="footInner">
          <Link href="/" className="logo footLogo">
            <span className="logoMark"><IconBriefcase size={15} /></span>Vrittih<em>.online</em>
          </Link>
          <div className="footLinks">
            {[["Jobs", "/jobs"], ["Network", "/network"], ["Sign in", "/login"], ["Join", "/register"], ["Dashboard", "/dashboard"]].map(([l, h]) => (
              <Link key={l} href={h} className="footLink">{l}</Link>
            ))}
          </div>
          <span className="footCopy">© 2026 Vrittih · Every industry. Every professional. One network.</span>
        </div>
      </footer>

      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
html, body { overflow-x: hidden; max-width: 100%; }
.home, .home *, .home *::before, .home *::after { box-sizing: border-box; }
.home { background: var(--cream-0); color: var(--v-ink); font-family: var(--font-sans); overflow-x: clip; width: 100%; }
.hero, .bento, .section, .feats, .steps { width: 100%; }
.heroText, .heroVis, .bCard, .feat, .step { min-width: 0; }
.skip { position: absolute; left: -9999px; }
.skip:focus { left: 12px; top: 12px; background: var(--brand-900); color: #fff; padding: 8px 14px; border-radius: 8px; z-index: 100; }

/* NAV */
.nav { position: sticky; top: 0; z-index: 50; transition: padding .25s var(--v-ease), background .25s; }
.navInner { max-width: 1180px; margin: 0 auto; padding: 20px 24px; display: flex; align-items: center; gap: 20px; transition: padding .25s var(--v-ease); }
.nav.navOn { background: var(--v-topbar); -webkit-backdrop-filter: blur(16px) saturate(160%); backdrop-filter: blur(16px) saturate(160%); border-bottom: 1px solid rgba(4,52,44,.08); }
.nav.navOn .navInner { padding: 12px 24px; }
.logo { display: inline-flex; align-items: center; gap: 9px; font-family: var(--font-display); font-size: 19px; font-weight: 600; color: var(--brand-900); text-decoration: none; letter-spacing: -.01em; }
.logo em { font-style: normal; color: var(--brand-600); font-weight: 500; }
.logoMark { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; background: var(--brand-600); color: #fff; }
.navLinks { display: flex; gap: 4px; margin-left: 12px; flex: 1; }
.navLink { padding: 8px 14px; border-radius: 9px; font-size: 14px; color: var(--v-ink-2); text-decoration: none; transition: background .14s, color .14s; }
.navLink:hover { background: var(--brand-100); color: var(--brand-700); }
.navRight { display: flex; align-items: center; gap: 8px; }
.signIn { padding: 9px 14px; font-size: 14px; font-weight: 500; color: var(--v-ink); text-decoration: none; border-radius: 9px; }
.signIn:hover { background: var(--v-surface-2); }
.join { padding: 9px 16px; font-size: 14px; font-weight: 600; color: #fff; background: var(--brand-600); border-radius: 999px; text-decoration: none; transition: background .14s, transform .05s; }
.join:hover { background: var(--brand-700); }

/* HERO */
.hero { max-width: 1180px; margin: 0 auto; padding: clamp(2rem,5vw,4.5rem) 24px; display: grid; grid-template-columns: 1.05fr .95fr; gap: clamp(1.5rem,4vw,3.5rem); align-items: center; }
.kicker { font-size: 12.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--brand-600); margin-bottom: 18px; }
.h1 { font-family: var(--font-display); font-size: var(--fs-display); line-height: 1.04; font-weight: 600; letter-spacing: -.03em; color: var(--brand-900); margin-bottom: 20px; }
.h1 em { font-style: italic; color: var(--brand-600); }
.kinetic span { display: inline-block; opacity: 0; animation: v-rise .6s var(--v-spring) forwards; }
@media (prefers-reduced-motion: reduce) { .kinetic span { opacity: 1; animation: none; } }
.lede { font-size: var(--fs-body); line-height: 1.65; color: var(--v-ink-2); max-width: 46ch; margin-bottom: 26px; }
.search { display: flex; gap: 10px; margin-bottom: 18px; max-width: 520px; }
.searchField { flex: 1; display: flex; align-items: center; gap: 10px; padding: 0 16px; border-radius: 999px; color: var(--v-ink-3); }
.searchField input { border: none; background: none; outline: none; padding: 14px 0; font-size: 15px; font-family: inherit; color: var(--v-ink); width: 100%; }
.searchBtn { background: var(--brand-900); color: #fff; border: none; border-radius: 999px; padding: 0 26px; font-size: 15px; font-weight: 600; cursor: pointer; transition: transform .12s var(--v-spring), background .14s; }
.searchBtn:hover { background: var(--brand-700); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chipsWrap { max-width: 820px; }
.chip { padding: 8px 15px; border-radius: 999px; font-size: 13.5px; color: var(--v-ink-2); background: var(--v-surface); border: 1px solid var(--v-line); text-decoration: none; transition: all .14s; }
.chip:hover { border-color: var(--brand-400); color: var(--brand-700); }
.chipOn { background: var(--brand-900); color: #fff; border-color: var(--brand-900); }

/* HERO VISUAL */
.heroVis { position: relative; min-height: 420px; display: flex; align-items: center; justify-content: center; }
.lattice { position: absolute; inset: -6% -4%; border-radius: 28px; overflow: hidden;
  background: radial-gradient(120% 100% at 30% 15%, #0F6E56 0%, #0B5A46 45%, #04342C 100%); box-shadow: var(--v-shadow-lg); }
.lattice::after { content: ""; position: absolute; inset: 0; background: radial-gradient(80% 60% at 80% 90%, rgba(0,0,0,.3), transparent 60%); }
.lp { position: relative; z-index: 2; width: min(340px, 86%); border-radius: 18px; padding: 18px; }
.lpHead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.lpTitle { font-size: 13.5px; font-weight: 700; color: var(--brand-900); }
.lpLive { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600; color: var(--brand-600); }
.lpLive i { width: 7px; height: 7px; border-radius: 50%; background: var(--brand-400); display: inline-block; }
.lpRow { display: flex; align-items: center; gap: 11px; padding: 9px 0; opacity: .5; transition: opacity .4s var(--v-ease); }
.lpRow.done, .lpRow.cur { opacity: 1; }
.lpDot { width: 11px; height: 11px; border-radius: 50%; border: 2px solid; flex-shrink: 0; transition: background .4s; }
.lpRow.cur .lpDot { box-shadow: 0 0 0 4px rgba(29,158,117,.18); }
.lpLabel { flex: 1; font-size: 13.5px; font-weight: 500; color: var(--v-ink); }
.lpTime { font-family: var(--font-mono); font-size: 11px; color: var(--v-ink-3); }
.lpFoot { font-size: 11.5px; color: var(--v-ink-3); margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--v-line); line-height: 1.5; }

/* BENTO PROOF */
.bento { max-width: 1180px; margin: 0 auto; padding: 0 24px clamp(2rem,5vw,4rem); display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.bCard { background: var(--v-surface); border: 1px solid var(--v-line); border-radius: 18px; padding: 22px; }
.bWide { grid-column: span 2; grid-row: span 1; }
.bStat { display: flex; flex-direction: column; justify-content: center; }
.bNum { font-family: var(--font-display); font-size: clamp(2rem,3vw,2.6rem); font-weight: 600; color: var(--brand-700); line-height: 1; }
.bLabel { font-size: 13px; color: var(--v-ink-2); margin-top: 8px; }
.eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--brand-600); }
.bTitle { font-family: var(--font-display); font-size: clamp(1.3rem,2vw,1.7rem); font-weight: 600; color: var(--brand-900); margin: 8px 0 16px; letter-spacing: -.02em; }
.miniPipe { display: flex; flex-wrap: wrap; gap: 6px 14px; }
.miniStep { display: inline-flex; align-items: center; gap: 6px; }
.miniDot { width: 9px; height: 9px; border-radius: 50%; }
.miniLabel { font-size: 12px; color: var(--v-ink-2); }
.bGold { grid-column: span 2; border-radius: 18px; padding: 22px; }
.bGoldBadge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; padding: 4px 11px; border-radius: 999px; background: rgba(255,255,255,.4); }
.bGoldText { font-size: 14px; line-height: 1.55; margin-top: 12px; color: #4A3B12; }

/* SECTIONS */
.section { max-width: 1180px; margin: 0 auto; padding: clamp(2.5rem,5vw,4.5rem) 24px; }
.h2 { font-family: var(--font-display); font-size: var(--fs-h1); font-weight: 600; color: var(--brand-900); letter-spacing: -.02em; margin: 10px 0 30px; }
.feats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.feat { background: var(--v-surface); border: 1px solid var(--v-line); border-radius: 16px; padding: 22px; transition: transform .18s var(--v-ease), box-shadow .18s; }
.feat:hover { transform: translateY(-3px); box-shadow: var(--v-shadow); }
.featBig { grid-column: span 3; display: grid; grid-template-columns: auto 1fr; gap: 6px 18px; align-items: start; }
.featBig .featText { grid-column: 2; }
.featBig .featTitle { grid-column: 2; }
.featIc { width: 42px; height: 42px; border-radius: 11px; display: grid; place-items: center; background: var(--brand-100); color: var(--brand-600); grid-row: span 2; }
.featBig .featIc { grid-row: span 2; }
.featTitle { font-size: 16px; font-weight: 650; color: var(--brand-900); margin: 14px 0 6px; }
.featBig .featTitle { margin-top: 0; }
.featText { font-size: 13.5px; line-height: 1.6; color: var(--v-ink-2); }
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
.stepNum { font-family: var(--font-mono); font-size: 13px; color: var(--brand-600); font-weight: 600; }
.stepTitle { font-family: var(--font-display); font-size: 20px; font-weight: 600; color: var(--brand-900); margin: 10px 0 8px; }
.stepText { font-size: 14px; line-height: 1.6; color: var(--v-ink-2); }

/* CTA */
.cta { background: var(--brand-900); color: #fff; text-align: center; padding: clamp(3rem,6vw,5rem) 24px; margin: clamp(2rem,4vw,3rem) 24px; border-radius: 28px; max-width: 1132px; margin-left: auto; margin-right: auto; }
.ctaH { font-family: var(--font-display); font-size: var(--fs-h1); font-weight: 600; letter-spacing: -.02em; }
.ctaP { font-size: var(--fs-body); color: rgba(255,255,255,.72); margin: 12px 0 26px; }
.ctaRow { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.ctaPrimary { display: inline-flex; align-items: center; gap: 8px; background: #fff; color: var(--brand-900); padding: 13px 24px; border-radius: 999px; font-weight: 600; font-size: 15px; text-decoration: none; }
.ctaSecondary { display: inline-flex; align-items: center; background: rgba(255,255,255,.1); color: #fff; padding: 13px 24px; border-radius: 999px; font-weight: 600; font-size: 15px; text-decoration: none; border: 1px solid rgba(255,255,255,.2); }

/* FOOTER */
.foot { background: var(--brand-900); color: rgba(255,255,255,.7); padding: 40px 24px; }
.footInner { max-width: 1180px; margin: 0 auto; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.footLogo { color: #fff; }
.footLogo em { color: var(--brand-200); }
.footLinks { display: flex; gap: 6px; flex: 1; flex-wrap: wrap; }
.footLink { color: rgba(255,255,255,.7); font-size: 13.5px; text-decoration: none; padding: 6px 10px; border-radius: 8px; }
.footLink:hover { background: rgba(255,255,255,.08); color: #fff; }
.footCopy { font-family: var(--font-mono); font-size: 11.5px; color: rgba(255,255,255,.45); }

/* RESPONSIVE — phone + laptop */
@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr; }
  .heroVis { min-height: 340px; order: 2; padding: 0; }
  .lattice { inset: 0; }
  .lp { width: min(340px, 100%); }
  .navLinks { display: none; }
  .bento { grid-template-columns: repeat(2, 1fr); }
  .bWide, .bGold { grid-column: span 2; }
  .feats { grid-template-columns: 1fr 1fr; }
  .featBig { grid-column: span 2; }
  .steps { grid-template-columns: 1fr; gap: 20px; }
}
@media (max-width: 560px) {
  .navRight .signIn { display: none; }
  .search { flex-direction: column; }
  .searchBtn { padding: 13px; }
  .bento { grid-template-columns: 1fr; }
  .bWide, .bGold, .bStat { grid-column: span 1; }
  .feats { grid-template-columns: 1fr; }
  .featBig { grid-column: span 1; }
  .h1 { font-size: clamp(2.2rem, 11vw, 3rem); }
}
`
