import Link from "next/link"
import "@/styles/home.css"
import { IconSearch, IconArrowRight } from "@/components/ui/Icons"

const INDUSTRIES = ["Technology","Finance","Healthcare","Education","Manufacturing","Retail","Legal","Government","Logistics","Energy","Agriculture","Media","Hospitality","Real Estate","Pharma","Consulting","NGO","Other"]

const FEATURES = [
  { n:"01", t:"Live application tracking", d:"Every stage visible, from applied to hired. Both sides see the same truth at the same moment — nothing hidden, nothing stale." },
  { n:"02", t:"Interviews built in", d:"Video calls, panels, group discussions, coding tests and whiteboards run inside the platform. No external tools, no lost links.", tags:["1-on-1","Panel","Group","Coding","Whiteboard","Recording"] },
  { n:"03", t:"Verified identities", d:"Face-vector login with liveness detection and document checks. Encrypted vectors only — raw images are never stored." },
  { n:"04", t:"Matching that works both ways", d:"Your profile is scored against every role — skills, industry, seniority, location. Employers see their best-fit candidates ranked the same way." },
  { n:"05", t:"Mail, chat and channels", d:"A complete communication layer built in-house: real mail, real-time messaging, and community channels. Zero third-party services." },
  { n:"06", t:"Pay once. That is the price.", d:"No subscription, no renewals, no tiers. One payment, lifetime access to everything.", price:"1 CHF" },
]

const STEPS = [
  { n:"01", t:"Join for 1 CHF, once", d:"Create your account and pay the single joining fee. Full access, no limits, nothing recurring." },
  { n:"02", t:"Build your profile", d:"Add experience, skills, education and your resume. The more complete it is, the sharper your matches." },
  { n:"03", t:"Apply and track live", d:"Apply to any role and watch it move through every stage in real time — interview to offer letter." },
]

export default function Home() {
  return (
    <div className="page">
      <a href="#main" className="skip">Skip to content</a>

      <header className="nav">
        <Link href="/" className="logo">
          <span className="logoMark">
            <svg viewBox="0 0 24 24" fill="none" stroke="#F4F1E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
          </span>
          Vrittih<em>.online</em>
        </Link>
        <nav className="navLinks" aria-label="Main navigation">
          <Link href="/jobs" className="navLink">Find jobs</Link>
          <Link href="/network" className="navLink">Network</Link>
          <Link href="/dashboard" className="navLink">Dashboard</Link>
        </nav>
        <div className="navRight">
          <Link href="/login" className="signIn">Sign in</Link>
          <Link href="/register" className="join">Join — 1 CHF</Link>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <div>
            <p className="kicker">Every industry · Every opportunity</p>
            <h1 className="h1">Find work that <em>changes your life.</em></h1>
            <p className="lede">
              One platform for every job seeker and every employer. Apply, interview,
              test and get hired in one place — with live status from first click to offer letter.
            </p>
            <form className="search" action="/jobs" method="get" role="search">
              <IconSearch size={17} />
              <input type="text" name="q" placeholder="Role, company, or skill…" aria-label="Search jobs" />
              <button type="submit" className="searchBtn">Search</button>
            </form>
            <div className="tags">
              {["Technology","Finance","Healthcare","Education","Retail","Legal"].map(t => (
                <Link key={t} href={`/jobs?industry=${encodeURIComponent(t)}`} className="tag">{t}</Link>
              ))}
              <Link href="/jobs?remote=true" className="tag">Remote</Link>
              <Link href="/jobs?type=INTERNSHIP" className="tag">Internships</Link>
            </div>
          </div>

          <aside className="heroCard" aria-label="Example application pipeline">
            <div className="heroCardHead">
              <span className="heroCardTitle">Application pipeline</span>
              <span className="liveDot"><i />Live</span>
            </div>
            {[
              ["#1D4ED8","Applied","Just now"],
              ["#B45309","Under review","2h ago"],
              ["#C8502F","Interview scheduled","Today, 15:00"],
              ["#0C5A3A","Offer extended","Pending"],
            ].map(([c,label,time]) => (
              <div key={label} className="statusRow">
                <span className="statusDot" style={{ background: c }} />
                <span className="statusLabel">{label}</span>
                <span className="statusTime">{time}</span>
              </div>
            ))}
            <p className="heroCardFoot">Every application, visible at every stage — for both sides.</p>
          </aside>
        </section>

        <section className="stats" aria-label="Platform statistics">
          <div className="statsInner">
            {[["48,000+","Active jobs"],["12,400+","Companies"],["2.1M+","Professionals"],["1 CHF","Lifetime access"]].map(([n,l]) => (
              <div key={l} className="stat"><div className="statNum">{n}</div><div className="statLabel">{l}</div></div>
            ))}
          </div>
        </section>

        <section className="section">
          <p className="eyebrow">What makes this different</p>
          <h2 className="h2">Everything you need. Nothing you don&apos;t.</h2>
          <div className="features">
            {FEATURES.map(f => (
              <div key={f.n} className="feature">
                <div className="featureNum">{f.n}</div>
                <div className="featureTitle">{f.t}</div>
                <p className="featureText">{f.d}</p>
                {f.tags && <div className="featureTags">{f.tags.map(t => <span key={t} className="featureTag">{t}</span>)}</div>}
                {f.price && <div className="priceLine">{f.price}</div>}
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <p className="eyebrow">How it works</p>
          <h2 className="h2">Three steps to your next role.</h2>
          <div className="steps">
            {STEPS.map(s => (
              <div key={s.n}>
                <div className="stepNum">{s.n}</div>
                <div className="stepTitle">{s.t}</div>
                <p className="stepText">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <p className="eyebrow">Every industry</p>
          <h2 className="h2">No niche. No limits.</h2>
          <div className="chips">
            {INDUSTRIES.map(i => (
              <Link key={i} href={`/jobs?industry=${encodeURIComponent(i)}`} className="chip">{i}</Link>
            ))}
          </div>
        </section>

        <section className="split">
          <div className="splitInner">
            <p className="eyebrow">Built for both sides</p>
            <h2 className="h2">Employers find the right hire. Applicants get real visibility.</h2>
            <div className="splitGrid">
              <div className="splitCard">
                <h3>For employers</h3>
                <p>Post a role and receive candidates ranked by genuine fit — skills, seniority, industry and location, scored by our own matching engine. Interview, test and message them without leaving the platform.</p>
              </div>
              <div className="splitCard">
                <h3>For job seekers</h3>
                <p>Your profile is matched precisely against every posting, and staying active raises your visibility to relevant employers. You always know exactly where your application stands.</p>
              </div>
            </div>
          </div>
        </section>

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
          <div className="footLinks">
            {[["Jobs","/jobs"],["Network","/network"],["Sign in","/login"],["Join","/register"],["Dashboard","/dashboard"]].map(([l,h]) => (
              <Link key={l} href={h} className="footLink">{l}</Link>
            ))}
          </div>
          <span className="footCopy">© 2026 Vrittih</span>
        </div>
      </footer>
    </div>
  )
}
