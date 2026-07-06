import Link from "next/link"
import type { ReactNode } from "react"
import { IconBriefcase, IconCheckCircle, IconZap, IconShield } from "@/components/ui/Icons"

// Shared premium split-screen frame for every auth page (login, register, …).
// Left: branded Vrittih panel. Right: the page's form. Collapses to form-only on mobile.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="vauth">
      <aside className="vauth-brand">
        <svg className="vauth-topo" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <path key={i} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1"
              d={`M-40 ${80 + i * 82} C 120 ${40 + i * 82}, 240 ${140 + i * 82}, 360 ${70 + i * 82} S 620 ${120 + i * 82}, 660 ${60 + i * 82}`} />
          ))}
        </svg>
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
                <span className="vauth-feat-ic vauth-feat-gold"><IconCheckCircle size={16} /></span>
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
    linear-gradient(155deg, #15806A 0%, #0F6E56 46%, #04342C 100%);
}
.vauth-topo { position:absolute; inset:-4% -2%; width:104%; height:108%; opacity:.06;
  animation:vauth-drift 26s ease-in-out infinite alternate; }
@keyframes vauth-drift { from { transform:translate3d(0,0,0) scale(1); } to { transform:translate3d(-14px,-22px,0) scale(1.05); } }
.vauth-brand::after { content:""; position:absolute; width:520px; height:520px; right:-160px; top:-140px; border-radius:50%;
  border:1px solid rgba(255,255,255,.10); box-shadow:0 0 0 60px rgba(255,255,255,.04), 0 0 0 130px rgba(255,255,255,.03); }
.vauth-feat-gold { background:linear-gradient(135deg,#E7CE8E,#C8A24B) !important; border-color:rgba(255,255,255,.4) !important; color:#3F3010 !important; }
@media (prefers-reduced-motion: reduce) { .vauth-topo { animation:none; } }
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
.vauth-formwrap .va-input { width:100%; border:1px solid var(--v-line-2); border-radius:11px; padding:12px 14px;
  font-size:14.5px; font-family:inherit; color:var(--v-ink); outline:none; background:var(--v-surface);
  box-shadow:inset 2px 2px 5px rgba(4,52,44,.05), inset -2px -2px 5px rgba(255,255,255,.7);
  transition:border-color .15s, box-shadow .15s; }
.vauth-formwrap .va-input:focus { border-color:var(--brand-400); box-shadow:0 0 0 3px rgba(29,158,117,.18), inset 2px 2px 5px rgba(4,52,44,.05); }
.vauth-formwrap .va-input::placeholder { color:var(--v-ink-3); }

/* passkey-first + spring collapse */
.vauth-formwrap .va-passkey { width:100%; display:flex; align-items:center; justify-content:center; gap:10px;
  background:var(--brand-900); color:#fff; border:none; border-radius:12px; padding:14px; font-size:14.5px; font-weight:600;
  cursor:pointer; transition:transform .12s var(--v-spring), background .15s; }
.vauth-formwrap .va-passkey:hover:not(:disabled) { background:var(--brand-700); transform:translateY(-1px); }
.vauth-formwrap .va-toggle { width:100%; background:none; border:none; color:var(--v-ink-2); font-size:13px; font-weight:600;
  cursor:pointer; padding:6px; margin-top:2px; }
.vauth-formwrap .va-toggle:hover { color:var(--brand-700); }
.vauth-formwrap .va-collapse { display:grid; grid-template-rows:0fr; transition:grid-template-rows .34s var(--v-ease), opacity .3s; opacity:0; }
.vauth-formwrap .va-collapse.open { grid-template-rows:1fr; opacity:1; }
.vauth-formwrap .va-collapse > div { overflow:hidden; min-height:0; }
.vauth-formwrap .va-forgot { font-size:12.5px; color:var(--v-ink-3); text-decoration:none; }
.vauth-formwrap .va-forgot:hover { color:var(--brand-600); }
.vauth-formwrap .va-btn.ok { background:var(--brand-400); }
@keyframes va-draw { to { stroke-dashoffset:0; } }
.vauth-formwrap .va-checkmark { stroke-dasharray:20; stroke-dashoffset:20; animation:va-draw .4s var(--v-ease) forwards; }
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
