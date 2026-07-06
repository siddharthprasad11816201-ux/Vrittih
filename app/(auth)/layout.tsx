import Link from "next/link"
import type { ReactNode } from "react"
import { IconBriefcase, IconCheckCircle, IconZap, IconShield } from "@/components/ui/Icons"

// Shared premium split-screen frame for every auth page (login, register, …).
// Left: branded Vrittih panel. Right: the page's form. Collapses to form-only on mobile.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="vauth">
      <aside className="vauth-brand">
        <div className="vauth-brand-inner">
          <Link href="/" className="vauth-logo">
            <span className="vauth-logo-mark"><IconBriefcase size={19} /></span>
            Vrittih
          </Link>

          <div>
            <h2 className="vauth-head">Every industry.<br />Every professional.<br />One network.</h2>
            <p className="vauth-sub">
              Vrittih connects verified talent with real opportunities — hiring,
              networking and career growth on one trusted platform.
            </p>
            <ul className="vauth-feats">
              <li>
                <span className="vauth-feat-ic"><IconCheckCircle size={16} /></span>
                <div><b>Verified professionals</b><span>Identity &amp; document checks built in</span></div>
              </li>
              <li>
                <span className="vauth-feat-ic"><IconZap size={16} /></span>
                <div><b>Intelligent matching</b><span>Roles matched to your real skills</span></div>
              </li>
              <li>
                <span className="vauth-feat-ic"><IconShield size={16} /></span>
                <div><b>Transparent 7-tier hiring</b><span>Every step tracked, screening to offer</span></div>
              </li>
            </ul>
          </div>

          <div className="vauth-foot">Trusted by professionals across industries · One-time 1 CHF to join</div>
        </div>
      </aside>

      <main className="vauth-main">
        <div className="vauth-formwrap">{children}</div>
      </main>

      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.vauth { display:grid; grid-template-columns:1.05fr 1fr; min-height:100vh; background:var(--v-bg); font-family:var(--v-sans); }
.vauth-brand { position:relative; overflow:hidden; color:#fff;
  background:
    radial-gradient(120% 80% at 12% 8%, rgba(255,255,255,.14), transparent 42%),
    radial-gradient(90% 70% at 100% 100%, rgba(0,0,0,.28), transparent 55%),
    linear-gradient(155deg, #5D53C9 0%, #4A41AE 46%, #352E86 100%);
}
.vauth-brand::before { content:""; position:absolute; inset:0;
  background-image:radial-gradient(rgba(255,255,255,.10) 1px, transparent 1.4px);
  background-size:22px 22px; mask-image:linear-gradient(180deg, transparent, #000 30%, #000 70%, transparent); opacity:.5; }
.vauth-brand::after { content:""; position:absolute; width:520px; height:520px; right:-160px; top:-140px; border-radius:50%;
  border:1px solid rgba(255,255,255,.10); box-shadow:0 0 0 60px rgba(255,255,255,.04), 0 0 0 130px rgba(255,255,255,.03); }
.vauth-brand-inner { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:space-between;
  padding:3rem 3.25rem; max-width:560px; }
.vauth-logo { display:inline-flex; align-items:center; gap:10px; text-decoration:none; color:#fff;
  font-family:var(--v-serif); font-size:22px; font-weight:600; letter-spacing:-.01em; }
.vauth-logo-mark { width:38px; height:38px; border-radius:11px; display:grid; place-items:center;
  background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.22); }
.vauth-head { font-family:var(--v-serif); font-size:40px; line-height:1.12; font-weight:600; letter-spacing:-.02em; margin:0 0 18px; }
.vauth-sub { font-size:15px; line-height:1.65; color:rgba(255,255,255,.82); max-width:400px; margin:0 0 30px; }
.vauth-feats { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:16px; }
.vauth-feats li { display:flex; gap:13px; align-items:flex-start; }
.vauth-feat-ic { width:34px; height:34px; border-radius:10px; flex-shrink:0; display:grid; place-items:center;
  background:rgba(255,255,255,.13); border:1px solid rgba(255,255,255,.18); color:#fff; }
.vauth-feats b { display:block; font-size:14.5px; font-weight:600; color:#fff; }
.vauth-feats span { font-size:13px; color:rgba(255,255,255,.72); }
.vauth-foot { font-size:12.5px; color:rgba(255,255,255,.62); }

.vauth-main { display:flex; align-items:center; justify-content:center; padding:2.5rem 1.5rem; }
.vauth-formwrap { width:100%; max-width:392px; }

/* form primitives shared by login & register (Vrittih tokens) */
.vauth-formwrap .va-card { }
.vauth-formwrap .va-h1 { font-family:var(--v-serif); font-size:27px; font-weight:600; color:var(--v-ink); letter-spacing:-.02em; margin:0 0 5px; }
.vauth-formwrap .va-sub { font-size:14px; color:var(--v-ink-3); margin:0 0 22px; }
.vauth-formwrap .va-fg { display:flex; flex-direction:column; gap:6px; margin-bottom:15px; }
.vauth-formwrap .va-label { font-size:12.5px; font-weight:600; color:var(--v-ink-2); }
.vauth-formwrap .va-input { width:100%; border:1px solid var(--v-line-2); border-radius:11px; padding:11px 14px;
  font-size:14.5px; font-family:inherit; color:var(--v-ink); outline:none; background:var(--v-surface);
  transition:border-color .15s, box-shadow .15s; }
.vauth-formwrap .va-input:focus { border-color:var(--v-accent); box-shadow:0 0 0 3px var(--v-accent-soft); }
.vauth-formwrap .va-input::placeholder { color:var(--v-ink-3); }
.vauth-formwrap .va-btn { width:100%; background:var(--v-accent); color:#fff; border:none; border-radius:11px;
  padding:12px; font-size:14.5px; font-weight:600; cursor:pointer; transition:background .15s, transform .05s; }
.vauth-formwrap .va-btn:hover:not(:disabled) { background:var(--v-accent-2); }
.vauth-formwrap .va-btn:active:not(:disabled) { transform:translateY(1px); }
.vauth-formwrap .va-btn:disabled { opacity:.6; cursor:default; }
.vauth-formwrap .va-btn2 { width:100%; display:flex; align-items:center; justify-content:center; gap:9px;
  background:var(--v-surface); border:1px solid var(--v-line-2); border-radius:11px; padding:11px; font-size:14px;
  font-weight:600; color:var(--v-ink); cursor:pointer; transition:background .15s; }
.vauth-formwrap .va-btn2:hover:not(:disabled) { background:var(--v-surface-2); }
.vauth-formwrap .va-err { background:#FEF2F2; border:1px solid #FECACA; border-radius:9px; padding:10px 13px;
  font-size:13px; color:#B91C1C; margin-bottom:15px; }
.vauth-formwrap .va-eye { position:absolute; right:11px; top:50%; transform:translateY(-50%); background:none; border:none;
  cursor:pointer; padding:4px; color:var(--v-ink-3); display:flex; }
.vauth-formwrap .va-div { display:flex; align-items:center; gap:12px; margin:18px 0; color:var(--v-ink-3); font-size:12.5px; }
.vauth-formwrap .va-div::before, .vauth-formwrap .va-div::after { content:""; flex:1; height:1px; background:var(--v-line); }
.vauth-formwrap .va-foot { text-align:center; font-size:13.5px; color:var(--v-ink-2); margin-top:20px; }
.vauth-formwrap .va-link { color:var(--v-accent); font-weight:600; text-decoration:none; }

@media (max-width: 880px) {
  .vauth { grid-template-columns:1fr; }
  .vauth-brand { display:none; }
  .vauth-main { padding:2rem 1.25rem; }
}
@media (prefers-color-scheme: dark) {
  .vauth { background:#0F0E15; }
}
`
