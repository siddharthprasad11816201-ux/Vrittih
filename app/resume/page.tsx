"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconLock, IconCheck, IconFileText } from "@/components/ui/Icons"
import { templatesFor, palettesFor, tierOf, TEMPLATES, PALETTES, COUNTS, type ResumeTemplate, type Palette } from "@/lib/resumeTemplates"

/* Résumé builder — 26 templates across 8 structural layouts, 14 accent palettes,
   gated by plan (free / basic 1 CHF / pro 12 CHF). Locked options stay visible
   and previewable in the picker so you can see what upgrading actually buys,
   but selecting one routes to pricing rather than silently doing nothing. */

const FONTS = {
  sans: `var(--font-inter),Inter,-apple-system,"Segoe UI",Roboto,sans-serif`,
  serif: `"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif`,
}
const DENSITY = { airy: 1.18, normal: 1, tight: .86 }

export default function ResumeBuilder() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tplId, setTplId] = useState("classic")
  const [palId, setPalId] = useState("graphite")
  const [tab, setTab] = useState<"design" | "colour">("design")

  useEffect(() => {
    fetch("/api/resume").then(r => r.json()).then(d => { setUser(d.user || null); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const tier = tierOf(user?.plan)
  const templates = useMemo(() => templatesFor(tier), [tier])
  const palettes = useMemo(() => palettesFor(tier), [tier])
  const tpl = (TEMPLATES.find(t => t.id === tplId) || TEMPLATES[0]) as ResumeTemplate
  const pal = (PALETTES.find(p => p.id === palId) || PALETTES[0]) as Palette
  const lockedTpl = !!templates.find(t => t.id === tplId)?.locked
  const lockedPal = !!palettes.find(p => p.id === palId)?.locked

  if (loading) return <AppShell title="Résumé"><div style={S.dim}>Building your résumé…</div></AppShell>
  if (!user) return <AppShell title="Résumé"><div style={S.dim}>Please sign in to build your résumé.</div></AppShell>

  const fmt = (d: any) => d ? new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : ""
  const skills: string[] = (user.skills || []).map((s: any) => s.skill?.name).filter(Boolean)
  const exp = user.experience || []
  const edu = user.education || []
  const empty = !exp.length && !edu.length && !skills.length && !user.bio

  const d = DENSITY[tpl.density]
  const nameFont = tpl.font === "serif" || tpl.font === "mixed" ? FONTS.serif : FONTS.sans
  const bodyFont = tpl.font === "serif" ? FONTS.serif : FONTS.sans
  const A = pal.accent
  const showAccent = tpl.accent !== "none"
  const acc = showAccent ? A : "#101828"

  const Section = ({ title, children }: any) => (
    <section style={{ marginTop: 18 * d }}>
      <h2 style={{ ...S.secTitle, color: acc, fontFamily: nameFont, letterSpacing: tpl.accent === "rules" ? ".08em" : "-.01em",
        textTransform: tpl.accent === "rules" ? "uppercase" : "none", fontSize: tpl.accent === "rules" ? 11.5 : 13.5 }}>{title}</h2>
      {(tpl.accent === "rules" || tpl.accent === "text") && <div style={{ height: 1, background: showAccent ? A : "#E4E7EC", opacity: tpl.accent === "rules" ? .35 : .9, margin: "5px 0 10px" }} />}
      {children}
    </section>
  )

  const ExpList = () => (
    <>{exp.map((e: any) => (
      <div key={e.id} style={{ marginBottom: 12 * d, position: "relative", paddingLeft: tpl.layout === "timeline" ? 18 : 0 }}>
        {tpl.layout === "timeline" && <><span style={{ position: "absolute", left: 0, top: 5, width: 8, height: 8, borderRadius: "50%", background: acc }} /><span style={{ position: "absolute", left: 3.5, top: 15, bottom: -12, width: 1, background: "#E4E7EC" }} /></>}
        <div style={S.row}><b style={{ fontSize: 13.5 }}>{e.title}</b><span style={S.when}>{fmt(e.startDate)} — {e.endDate ? fmt(e.endDate) : "Present"}</span></div>
        <div style={{ ...S.org, color: showAccent ? A : "#475467" }}>{e.company}{e.location ? ` · ${e.location}` : ""}</div>
        {e.description && <p style={S.body}>{e.description}</p>}
      </div>
    ))}</>
  )
  const EduList = () => (
    <>{edu.map((e: any) => (
      <div key={e.id} style={{ marginBottom: 9 * d }}>
        <div style={S.row}><b style={{ fontSize: 13 }}>{e.degree}{e.field ? `, ${e.field}` : ""}</b><span style={S.when}>{e.startYear}{e.endYear ? `–${e.endYear}` : ""}</span></div>
        <div style={{ ...S.org, color: showAccent ? A : "#475467" }}>{e.school}</div>
      </div>
    ))}</>
  )
  const SkillList = ({ stacked }: { stacked?: boolean }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flexDirection: stacked ? "column" : "row" }}>
      {skills.map(s => <span key={s} style={{ ...S.skill, ...(stacked ? { background: "none", padding: 0 } : { background: showAccent ? `${A}14` : "#F2F4F7", color: showAccent ? A : "#344054" }) }}>{s}</span>)}
    </div>
  )

  const Header = () => {
    const contact = [user.email, user.phone, user.location].filter(Boolean).join("  ·  ")
    if (tpl.layout === "band") return (
      <div style={{ background: pal.id === "ink" || tpl.id === "obsidian" ? "#0B1220" : A, color: "#fff", padding: `${tpl.density === "tight" ? 20 : 30}px 30px`, margin: "-34px -34px 6px" }}>
        <h1 style={{ ...S.name, fontFamily: nameFont, color: "#fff", fontSize: 27 * (tpl.density === "airy" ? 1.1 : 1) }}>{user.name}</h1>
        {user.headline && <div style={{ ...S.headline, color: "rgba(255,255,255,.85)" }}>{user.headline}</div>}
        <div style={{ ...S.contact, color: "rgba(255,255,255,.72)" }}>{contact}</div>
      </div>
    )
    if (tpl.layout === "split" || tpl.layout === "academic") return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap",
        borderBottom: tpl.accent === "band" ? `3px solid ${A}` : "1px solid #E4E7EC", paddingBottom: 12 }}>
        <div><h1 style={{ ...S.name, fontFamily: nameFont, color: acc }}>{user.name}</h1>
          {user.headline && <div style={S.headline}>{user.headline}</div>}</div>
        <div style={{ ...S.contact, textAlign: "right" }}>{[user.email, user.phone, user.location].filter(Boolean).map((x: string) => <div key={x}>{x}</div>)}</div>
      </div>
    )
    return (
      <div style={{ textAlign: tpl.layout === "single" && tpl.density === "airy" ? "center" : "left", borderBottom: tpl.accent === "rules" ? `2px solid ${showAccent ? A : "#101828"}` : "none", paddingBottom: 10 }}>
        <h1 style={{ ...S.name, fontFamily: nameFont, color: acc }}>{user.name}</h1>
        {user.headline && <div style={S.headline}>{user.headline}</div>}
        <div style={S.contact}>{contact}</div>
      </div>
    )
  }

  const Main = () => (
    <>
      {user.bio && <Section title="Summary"><p style={S.body}>{user.bio}</p></Section>}
      {!!exp.length && <Section title={tpl.layout === "academic" ? "Appointments" : "Experience"}><ExpList /></Section>}
      {!!edu.length && <Section title="Education"><EduList /></Section>}
      {!!skills.length && !tpl.layout.startsWith("sidebar") && <Section title="Skills"><SkillList /></Section>}
    </>
  )

  const Rail = () => (
    <aside style={{ background: tpl.accent === "band" ? (pal.id === "ink" ? "#0B1220" : A) : `${A}0F`, color: tpl.accent === "band" ? "#fff" : "inherit",
      padding: 18, borderRadius: 8, fontSize: 12 }}>
      <div style={{ ...S.railH, color: tpl.accent === "band" ? "rgba(255,255,255,.75)" : acc }}>Contact</div>
      {[user.email, user.phone, user.location].filter(Boolean).map((x: string) => <div key={x} style={{ marginBottom: 4, wordBreak: "break-word" }}>{x}</div>)}
      {!!skills.length && <><div style={{ ...S.railH, color: tpl.accent === "band" ? "rgba(255,255,255,.75)" : acc, marginTop: 14 }}>Skills</div><SkillList stacked /></>}
      {!!edu.length && <><div style={{ ...S.railH, color: tpl.accent === "band" ? "rgba(255,255,255,.75)" : acc, marginTop: 14 }}>Education</div>
        {edu.map((e: any) => <div key={e.id} style={{ marginBottom: 7 }}><b>{e.degree}</b><div style={{ opacity: .8 }}>{e.school}</div></div>)}</>}
    </aside>
  )

  const sidebar = tpl.layout === "sidebarLeft" || tpl.layout === "sidebarRight"

  return (
    <AppShell title="Résumé">
      <div style={S.wrap}>
        {/* controls */}
        <div style={S.panel} className="no-print">
          <div style={S.panelHead}>
            <div>
              <h1 style={S.h1}>Résumé builder</h1>
              <p style={S.sub}>{COUNTS.templates} templates · {COUNTS.palettes} colours · your profile, formatted properly</p>
            </div>
            <div style={S.actions}>
              <Link href="/profile/edit" style={S.ghost}>Edit profile</Link>
              <button onClick={() => window.print()} disabled={lockedTpl || lockedPal} style={{ ...S.primary, ...(lockedTpl || lockedPal ? S.off : {}) }}>
                <IconFileText size={15} /> Download PDF
              </button>
            </div>
          </div>

          {empty && <div style={S.warn}>Your profile is empty, so the résumé is too. <Link href="/profile/edit" style={S.link}>Add your experience, education and skills</Link> — every template fills in instantly.</div>}

          <div style={S.tabs}>
            {(["design", "colour"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}>
                {t === "design" ? `Design (${COUNTS.templates})` : `Colour (${COUNTS.palettes})`}
              </button>
            ))}
            <span style={S.planTag}>{tier === "pro" ? "Pro — everything unlocked" : tier === "basic" ? "Basic — Pro designs locked" : "Free — 4 designs, 2 colours"}</span>
          </div>

          {tab === "design" ? (
            <div style={S.picker}>
              {templates.map(t => (
                <button key={t.id} onClick={() => setTplId(t.id)}
                  style={{ ...S.opt, ...(tplId === t.id ? { borderColor: A, background: `${A}0D` } : {}), ...(t.locked ? S.optLocked : {}) }}>
                  <span style={S.optTop}>
                    <b style={S.optName}>{t.name}</b>
                    {t.locked ? <span style={S.lock}><IconLock size={11} />{t.tier === "pro" ? "Pro" : "Basic"}</span>
                      : tplId === t.id ? <IconCheck size={14} /> : null}
                  </span>
                  <span style={S.optDesc}>{t.desc}</span>
                  {t.ats && <span style={S.ats}>ATS-safe</span>}
                </button>
              ))}
            </div>
          ) : (
            <div style={S.swatches}>
              {palettes.map(p => (
                <button key={p.id} onClick={() => setPalId(p.id)} title={p.name}
                  style={{ ...S.swatch, background: p.accent, outline: palId === p.id ? `2px solid ${p.accent}` : "none", outlineOffset: 2, opacity: p.locked ? .4 : 1 }}>
                  {p.locked && <IconLock size={12} />}
                </button>
              ))}
            </div>
          )}

          {(lockedTpl || lockedPal) && (
            <div style={S.upsell}>
              <b>{tpl.tier === "pro" || pal.tier === "pro" ? "Pro" : "Basic"} design.</b> You can preview it, but downloading needs {tpl.tier === "pro" || pal.tier === "pro" ? "Pro — 12 CHF" : "Basic — 1 CHF"} / month.
              <Link href="/pricing" style={S.upBtn}>See plans</Link>
            </div>
          )}
        </div>

        {/* preview */}
        <div style={S.stage}>
          <div className="resume-page" style={{ ...S.page, fontFamily: bodyFont, color: pal.ink, position: "relative", overflow: "hidden" }}>
            {lockedTpl || lockedPal ? <div className="no-print" style={S.wm}>PREVIEW</div> : null}
            {tpl.layout === "band" ? <><Header /><div style={{ paddingTop: 4 }}><Main /></div></>
              : sidebar ? (
                <><Header />
                  <div style={{ display: "grid", gridTemplateColumns: tpl.layout === "sidebarLeft" ? "34% 1fr" : "1fr 34%", gap: 22, marginTop: 16 }} data-keep-cols>
                    {tpl.layout === "sidebarLeft" && <Rail />}
                    <div><Main /></div>
                    {tpl.layout === "sidebarRight" && <Rail />}
                  </div></>
              ) : <><Header /><Main /></>}
            <div style={S.foot}>Generated with Vrittih · {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print, .v-app aside, .v-app header { display: none !important; }
          .v-app, .v-app > div { display: block !important; }
          .resume-page { box-shadow: none !important; border: none !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
          @page { size: A4; margin: 14mm; }
        }
        @media (max-width: 820px) {
          .resume-page [data-keep-cols] { grid-template-columns: 1fr !important; }
        }
      ` }} />
    </AppShell>
  )
}

const S: Record<string, any> = {
  wrap: { display: "grid", gridTemplateColumns: "360px 1fr", gap: 20, alignItems: "start", maxWidth: 1240, margin: "0 auto", padding: "4px 4px 40px" },
  panel: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: 18, position: "sticky", top: 76 },
  panelHead: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" },
  h1: { fontSize: 20, fontWeight: 650, margin: 0, color: "var(--v-ink)" },
  sub: { fontSize: 12.5, color: "var(--v-ink-3)", marginTop: 3 },
  actions: { display: "flex", gap: 8, flexWrap: "wrap" },
  ghost: { padding: "8px 13px", borderRadius: 10, border: "1px solid var(--v-line-2)", fontSize: 12.5, fontWeight: 600, color: "var(--v-ink)", textDecoration: "none" },
  primary: { display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 15px", borderRadius: 10, border: "none", background: "var(--v-accent)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  off: { opacity: .45, cursor: "not-allowed" },
  warn: { marginTop: 12, padding: "10px 12px", borderRadius: 10, background: "#FFFAEB", color: "#93370D", fontSize: 12.5, lineHeight: 1.5 },
  link: { color: "#93370D", fontWeight: 600 },
  tabs: { display: "flex", gap: 6, alignItems: "center", marginTop: 14, flexWrap: "wrap" },
  tab: { padding: "7px 12px", borderRadius: 9, border: "1px solid var(--v-line-2)", background: "transparent", fontSize: 12.5, fontWeight: 600, color: "var(--v-ink-2)", cursor: "pointer" },
  tabOn: { background: "var(--v-accent-soft)", color: "var(--v-accent)", borderColor: "var(--v-accent)" },
  planTag: { marginLeft: "auto", fontSize: 11, color: "var(--v-ink-3)" },
  picker: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12, maxHeight: 380, overflowY: "auto" },
  opt: { textAlign: "left", padding: "10px 11px", borderRadius: 11, border: "1.5px solid var(--v-line)", background: "var(--v-bg)", cursor: "pointer", display: "flex", flexDirection: "column", gap: 3 },
  optLocked: { opacity: .62 },
  optTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 },
  optName: { fontSize: 13, fontWeight: 650, color: "var(--v-ink)" },
  optDesc: { fontSize: 11, color: "var(--v-ink-3)", lineHeight: 1.4 },
  lock: { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, color: "var(--v-accent)", background: "var(--v-accent-soft)", padding: "2px 6px", borderRadius: 999 },
  ats: { fontSize: 10, fontWeight: 700, color: "#067647", background: "#ECFDF3", padding: "2px 6px", borderRadius: 999, alignSelf: "flex-start", marginTop: 2 },
  swatches: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 },
  swatch: { width: 34, height: 34, borderRadius: 9, border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "#fff" },
  upsell: { marginTop: 12, padding: "11px 13px", borderRadius: 11, background: "var(--v-accent-soft)", color: "var(--v-ink-2)", fontSize: 12.5, lineHeight: 1.55, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  upBtn: { marginLeft: "auto", padding: "6px 12px", borderRadius: 9, background: "var(--v-accent)", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none" },

  stage: { display: "flex", justifyContent: "center" },
  page: { width: "100%", maxWidth: 794, minHeight: 700, background: "#fff", border: "1px solid var(--v-line)", borderRadius: 8, boxShadow: "0 10px 26px rgba(16,24,40,.07)", padding: 34, fontSize: 12.5, lineHeight: 1.55 },
  wm: { position: "absolute", top: "42%", left: "50%", transform: "translate(-50%,-50%) rotate(-24deg)", fontSize: 74, fontWeight: 800, color: "rgba(16,24,40,.06)", letterSpacing: ".2em", pointerEvents: "none" },
  name: { fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-.02em", lineHeight: 1.1 },
  headline: { fontSize: 13, color: "#475467", marginTop: 3 },
  contact: { fontSize: 11.5, color: "#667085", marginTop: 6, wordBreak: "break-word" },
  secTitle: { fontWeight: 700, margin: 0 },
  row: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" },
  when: { fontSize: 11, color: "#98A2B3", whiteSpace: "nowrap" },
  org: { fontSize: 12, fontWeight: 600, marginTop: 1 },
  body: { fontSize: 12, color: "#475467", margin: "4px 0 0", lineHeight: 1.6 },
  skill: { fontSize: 11, padding: "3px 8px", borderRadius: 999 },
  railH: { fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 },
  foot: { marginTop: 26, paddingTop: 10, borderTop: "1px solid #EAECF0", fontSize: 10, color: "#98A2B3", textAlign: "center" },
  dim: { padding: 40, textAlign: "center", color: "var(--v-ink-3)" },
}
