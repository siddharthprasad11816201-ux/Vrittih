"use client"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconUpload, IconFileText, IconArrowRight, IconTarget, IconSearch } from "@/components/ui/Icons"

// Only fully-working tools are listed here — never placeholders.
const TOOLS = [
  { href: "/tools/compress", icon: <IconUpload size={20} />, title: "Image compressor", desc: "Shrink photos & assets to a fraction of their size — real WebP/JPEG compression, in your browser, nothing uploaded." },
  { href: "/tools/funding", icon: <IconTarget size={20} />, title: "Funding & investors", desc: "Curated directory of grant agencies, VCs, angels, accelerators & scholarships for students, researchers and founders." },
  { href: "/tools/citation", icon: <IconSearch size={20} />, title: "Citation helper", desc: "Auto-fill from a DOI (CrossRef) or enter by hand, then export in APA, MLA, IEEE or BibTeX." },
  { href: "/resume", icon: <IconFileText size={20} />, title: "Résumé builder", desc: "Build a clean, professional résumé and export it — ready to attach to any application." },
]

export default function ToolsHub() {
  return (
    <AppShell title="Tools">
      <style>{CSS}</style>
      <div className="tl">
        <header className="tlHead">
          <h1 className="tlTitle">Tools</h1>
          <p className="tlSub">Free, genuinely useful utilities — built in-house, fast, and private. More arrive here as they're finished to the same bar.</p>
        </header>
        <div className="tlGrid">
          {TOOLS.map(t => (
            <Link key={t.href} href={t.href} className="tlCard">
              <span className="tlIc">{t.icon}</span>
              <div className="tlName">{t.title}</div>
              <p className="tlDesc">{t.desc}</p>
              <span className="tlGo">Open <IconArrowRight size={14} /></span>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

const CSS = `
.tl{ max-width:900px; margin:0 auto; padding:clamp(1.25rem,3vw,2rem); }
.tlHead{ margin-bottom:22px; }
.tlTitle{ font-family:var(--font-display); font-size:clamp(1.6rem,3vw,2.1rem); font-weight:600; color:var(--v-ink); letter-spacing:-.02em; }
.tlSub{ font-size:14.5px; color:var(--v-ink-2); margin-top:5px; max-width:62ch; line-height:1.55; }
.tlGrid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
.tlCard{ display:flex; flex-direction:column; background:var(--v-surface); border:1px solid var(--v-line); border-radius:16px; padding:20px; text-decoration:none; box-shadow:var(--v-shadow-sm); transition:transform .18s var(--v-ease), box-shadow .18s, border-color .18s; }
.tlCard:hover{ transform:translateY(-3px); box-shadow:var(--v-shadow); border-color:var(--v-line-2); }
.tlIc{ width:44px; height:44px; border-radius:12px; display:grid; place-items:center; background:var(--brand-100); color:var(--brand-600); margin-bottom:14px; }
.tlName{ font-family:var(--font-display); font-size:17px; font-weight:600; color:var(--v-ink); }
.tlDesc{ font-size:13.5px; color:var(--v-ink-2); line-height:1.55; margin:7px 0 14px; flex:1; }
.tlGo{ display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:var(--brand-700); }
`
