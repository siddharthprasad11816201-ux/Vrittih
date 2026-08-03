"use client"
import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import CommandPalette from "@/components/vrittih/CommandPalette"
import {
  IconActivity, IconBriefcase, IconTarget, IconFileText, IconUsers, IconTrendingUp,
  IconClipboard, IconMessage, IconMail, IconNetwork, IconUser, IconSearch, IconBell,
  IconShield, IconMenu, IconX, IconHome, IconBookmark, IconGlobe, IconBanknote,
  IconKey, IconCheckCircle, IconStar, IconAward, IconZap, IconMonitor,
} from "@/components/ui/Icons"

/* Vrittih shell — Architecture A (compact island sidebar), per the redesign brief.
 *  · 216px sidebar as a rounded card floating on the canvas with a gutter.
 *  · 34px rows, 18px icons, 14px labels, 11px uppercase group labels — the nav
 *    fits 768px height with NO internal scrollbar (no nested scroll regions).
 *  · One active state: tinted pill + accent icon. Hover = neutral surface step.
 *  · Every item a unique icon. The Coach docks as a footer row above a hairline,
 *    never as an overlay. Nav is capability-driven (Module 6), never role-driven. */

type Item = { href: string; label: string; icon: ReactNode; badge?: number }
type Section = { title?: string; items: Item[] }

function Keystone({ size = 26 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.3, background: "var(--v-accent)", display: "grid", placeItems: "center", flex: "none" }}>
      <svg viewBox="0 0 48 48" width={size * 0.58} height={size * 0.58} aria-hidden="true">
        <path d="M14.6 15 L33.4 15 Q34.9 15 34.7 16.6 L31.6 32.9 Q31.3 34.4 29.8 34.4 L18.2 34.4 Q16.7 34.4 16.4 32.9 L13.3 16.6 Q13.1 15 14.6 15 Z" fill="#fff" />
      </svg>
    </span>
  )
}

// Capability-driven, curated to fit without scrolling. Each item has a UNIQUE icon.
function buildNav(caps: Set<string>): Section[] {
  const emp = caps.has("jobs.post")
  const can = (c: string) => caps.has(c)
  const sections: Section[] = [{ items: [{ href: "/dashboard", label: "Overview", icon: <IconHome size={18} /> }] }]

  if (emp) {
    const hiring: Item[] = [
      { href: "/dashboard/post-job", label: "Post a job", icon: <IconFileText size={18} /> },
      { href: "/dashboard/recruiter", label: "Candidates", icon: <IconUsers size={18} /> },
      { href: "/dashboard/pipeline", label: "Pipeline", icon: <IconTrendingUp size={18} /> },
      { href: "/jobs", label: "All jobs", icon: <IconBriefcase size={18} /> },
      { href: "/companies", label: "Companies", icon: <IconGlobe size={18} /> },
    ]
    sections.push({ title: "Hiring", items: hiring })
    const ops: Item[] = []
    if (can("hrms.view")) ops.push({ href: "/hrms", label: "HRMS", icon: <IconClipboard size={18} /> })
    if (can("payroll.view")) ops.push({ href: "/hrms/payroll", label: "Payroll", icon: <IconBanknote size={18} /> })
    if (can("tasks.view")) ops.push({ href: "/tasks", label: "Tasks", icon: <IconCheckCircle size={18} /> })
    if (can("crm.view")) ops.push({ href: "/contacts", label: "Contacts", icon: <IconTarget size={18} /> })
    if (ops.length) sections.push({ title: "Operations", items: ops })
    const comms: Item[] = [{ href: "/messages", label: "Messages", icon: <IconMessage size={18} /> }]
    if (can("mail.send")) comms.push({ href: "/mail", label: "Mail", icon: <IconMail size={18} /> })
    sections.push({ title: "Communication", items: comms })
  } else {
    sections.push({ title: "Career", items: [
      { href: "/career", label: "Career AI", icon: <IconActivity size={18} /> },
      { href: "/learn", label: "Learn", icon: <IconMonitor size={18} /> },      // internships (learn & earn)
      { href: "/jobs", label: "Find jobs", icon: <IconBriefcase size={18} /> }, // full-time / contract / freelance (earn)
      { href: "/jobs/match", label: "Matched", icon: <IconTarget size={18} /> },
      { href: "/applications", label: "Applications", icon: <IconFileText size={18} /> },
      { href: "/jobs/saved", label: "Saved", icon: <IconBookmark size={18} /> },
      { href: "/resume", label: "Résumé", icon: <IconClipboard size={18} /> },
    ] })
    // Professional networking (Feed/Network/Community) is an advanced-tier feature;
    // Messages stays available to everyone (core to recruiter communication).
    const net: Item[] = []
    if (can("network.access")) net.push(
      { href: "/feed", label: "Feed", icon: <IconTrendingUp size={18} /> },
      { href: "/network", label: "Network", icon: <IconNetwork size={18} /> },
      { href: "/community", label: "Community", icon: <IconUsers size={18} /> },
    )
    net.push({ href: "/messages", label: "Messages", icon: <IconMessage size={18} /> })
    sections.push({ title: "Network", items: net })
    sections.push({ title: "Resources", items: [
      { href: "/tests", label: "Assessments", icon: <IconAward size={18} /> },
      { href: "/tools", label: "Tools", icon: <IconZap size={18} /> },
    ] })
  }

  // Account & security is always reachable; admin/developer only with the capability.
  const foot: Item[] = [{ href: "/account", label: "Account", icon: <IconUser size={18} /> }]
  if (can("api.keys")) foot.push({ href: "/developers", label: "Developers", icon: <IconKey size={18} /> })
  if (caps.has("admin.access")) foot.push({ href: "/admin", label: "Admin", icon: <IconShield size={18} /> })
  sections.push({ title: "You", items: foot })
  return sections
}

function bottomTabs(caps: Set<string>): Item[] {
  return caps.has("jobs.post")
    ? [
        { href: "/dashboard", label: "Home", icon: <IconHome size={22} /> },
        { href: "/jobs", label: "Jobs", icon: <IconBriefcase size={22} /> },
        { href: "/dashboard/recruiter", label: "Candidates", icon: <IconUsers size={22} /> },
        { href: "/messages", label: "Messages", icon: <IconMessage size={22} /> },
        { href: "/account", label: "Account", icon: <IconUser size={22} /> },
      ]
    : [
        { href: "/dashboard", label: "Home", icon: <IconHome size={22} /> },
        { href: "/jobs", label: "Jobs", icon: <IconBriefcase size={22} /> },
        { href: "/applications", label: "Applied", icon: <IconFileText size={22} /> },
        // Network is advanced-tier; free users get Matched in the tab bar instead.
        caps.has("network.access")
          ? { href: "/network", label: "Network", icon: <IconNetwork size={22} /> }
          : { href: "/jobs/match", label: "Matched", icon: <IconTarget size={22} /> },
        { href: "/account", label: "Account", icon: <IconUser size={22} /> },
      ]
}

export default function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [caps, setCaps] = useState<Set<string>>(new Set())
  const [authLoaded, setAuthLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setUser(d.user || null)).catch(() => setUser(null)).finally(() => setAuthLoaded(true))
    fetch("/api/me/capabilities").then((r) => r.json()).then((d) => setCaps(new Set(d.capabilities || []))).catch(() => setCaps(new Set()))
  }, [])
  useEffect(() => {
    const m = window.matchMedia("(max-width: 860px)")
    const on = () => setIsMobile(m.matches); on()
    m.addEventListener("change", on); return () => m.removeEventListener("change", on)
  }, [])
  useEffect(() => { setDrawerOpen(false) }, [pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false) }
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey)
  }, [])

  const isEmployer = caps.has("jobs.post")
  const sections = buildNav(caps)
  const tabs = bottomTabs(caps)
  const active = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(href + "/"))
  const activeTab = tabs.findIndex((t) => active(t.href))
  const initials = (user?.name || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
  const signOut = async () => { try { await fetch("/api/auth/logout", { method: "POST" }) } catch {} ; window.location.href = "/login" }
  const SignOutRow = () => (
    <button onClick={signOut} className="ks-nav" style={S.signOut} aria-label="Sign out">
      <span style={{ display: "inline-flex", width: 18, height: 18, color: "var(--danger)" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
      </span>
      Sign out
    </button>
  )

  const NavRow = ({ it }: { it: Item }) => {
    const on = active(it.href)
    return (
      <Link href={it.href} className="ks-nav" style={{ ...S.row, ...(on ? S.rowOn : {}) }} aria-current={on ? "page" : undefined}>
        <span style={{ display: "inline-flex", width: 18, height: 18, color: on ? "var(--v-accent)" : "var(--v-ink-3)" }}>{it.icon}</span>
        <span style={S.rowLabel}>{it.label}</span>
        {typeof it.badge === "number" && it.badge > 0 && <span style={S.badge}>{it.badge}</span>}
      </Link>
    )
  }

  const Nav = () => (
    <>
      {sections.map((sec, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          {sec.title && <div style={S.group}>{sec.title}</div>}
          {sec.items.map((it) => <NavRow key={it.href} it={it} />)}
        </div>
      ))}
    </>
  )

  return (
    <div className="v-app" style={S.root}>
      <style>{ksCss}</style>

      <header style={S.topbar}>
        {isMobile && <button onClick={() => setDrawerOpen(true)} style={S.iconBtnPlain} aria-label="Open menu"><IconMenu size={20} /></button>}
        <Link href="/dashboard" style={S.brand} aria-label="Vrittih home">
          <Keystone size={26} />
          {!isMobile && <span style={S.brandName}>Vrittih</span>}
        </Link>

        {!isMobile && (
          <button onClick={() => window.dispatchEvent(new Event("vrittih:open-command"))} style={S.search} aria-label="Search (Ctrl+K)">
            <span style={{ display: "inline-flex", color: "var(--v-ink-3)" }}><IconSearch size={16} /></span>
            <span style={S.searchText}>Search jobs, people, companies</span>
            <span style={S.kbd}>⌘K</span>
          </button>
        )}
        <div style={{ flex: 1 }} />

        {isMobile && <button onClick={() => window.dispatchEvent(new Event("vrittih:open-command"))} style={S.iconBtnPlain} aria-label="Search"><IconSearch size={19} /></button>}
        <Link href="/notifications" style={S.iconBtn} aria-label="Notifications"><IconBell size={18} /><span style={S.redDot} /></Link>
        {!isMobile && <Link href="/messages" style={S.iconBtn} aria-label="Messages"><IconMessage size={18} /></Link>}
        {authLoaded && !user ? (
          <Link href={`/login?next=${encodeURIComponent(pathname || "/dashboard")}`} style={S.chip} aria-label="Sign in">
            <span style={{ ...S.avatar, background: "var(--v-surface-2)", color: "var(--v-ink-2)" }}>–</span>
            {!isMobile && <span style={S.chipName}>Sign in</span>}
          </Link>
        ) : (
          <Link href="/account" style={S.chip} aria-label="Account">
            <span style={S.avatar}>{initials}</span>
            {!isMobile && <span style={S.chipName}>{(user?.name || "Account").split(" ")[0]}</span>}
          </Link>
        )}
      </header>

      <div style={S.body}>
        {!isMobile && (
          <aside style={S.island}>
            <nav style={S.nav}><Nav /></nav>
            <Link href="/career/coach" className="ks-coach" style={S.coach} aria-label="AI Career Coach">
              <span style={{ display: "inline-flex", color: "var(--v-accent)" }}><IconStar size={18} /></span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={S.coachTitle}>AI Career Coach</span>
                <span style={S.coachSub}>Ask about your next move</span>
              </span>
            </Link>
            <SignOutRow />
          </aside>
        )}
        <main style={{ ...S.main, paddingBottom: isMobile ? 84 : 32 }}>{children}</main>
      </div>

      {isMobile && (
        <>
          <nav style={S.bottom}>
            {activeTab >= 0 && <span style={{ ...S.pill, left: `calc(${activeTab} * 20% + 6px)` }} className="ks-pill" />}
            {tabs.map((t) => {
              const on = active(t.href)
              return (
                <Link key={t.href} href={t.href} style={S.tab} aria-current={on ? "page" : undefined}>
                  <span style={{ display: "inline-flex", color: on ? "var(--v-accent)" : "var(--v-ink-3)" }}>{t.icon}</span>
                  <span style={{ font: "500 10px var(--font-sans)", color: on ? "var(--v-accent)" : "var(--v-ink-3)" }}>{t.label}</span>
                </Link>
              )
            })}
          </nav>

          {drawerOpen && <div style={S.scrim} onClick={() => setDrawerOpen(false)} />}
          <div style={{ ...S.drawer, transform: drawerOpen ? "translateX(0)" : "translateX(-104%)" }} className="ks-drawer">
            <div style={S.drawerHead}>
              <span style={S.avatar}>{initials}</span>
              <div style={{ minWidth: 0 }}>
                <div style={S.drawerName}>{user?.name || "Guest"}</div>
                <div style={S.drawerRole}>{isEmployer ? "Employer" : "Job seeker"}</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--v-ink-2)", cursor: "pointer" }} aria-label="Close menu"><IconX size={20} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}><Nav /></div>
            <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border)" }}><SignOutRow /></div>
          </div>
        </>
      )}

      <CommandPalette isEmployer={isEmployer} canCrm={caps.has("crm.view")} canMail={caps.has("mail.send")} canInterviews={caps.has("interviews.host")} canApi={caps.has("api.keys")} />
    </div>
  )
}

const ksCss = `
.ks-nav:hover{ background:var(--v-surface-2) !important; }
.ks-coach:hover{ border-color:var(--border-strong) !important; }
.ks-pill{ transition:left .24s cubic-bezier(.4,0,.2,1); }
@media (prefers-reduced-motion: reduce){ .ks-pill,.ks-drawer{ transition:none !important; } }
`

const S: Record<string, any> = {
  root: { minHeight: "100vh", background: "var(--v-bg)", color: "var(--v-ink)", fontFamily: "var(--font-sans)" },

  topbar: { position: "sticky", top: 0, zIndex: 40, height: 56, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", background: "var(--v-surface)", borderBottom: "1px solid var(--border)" },
  brand: { display: "flex", alignItems: "center", gap: 9, textDecoration: "none", flex: "none" },
  brandName: { font: "500 17px var(--font-display)", color: "var(--v-ink)", letterSpacing: "-.01em" },
  search: { display: "flex", alignItems: "center", gap: 9, height: 36, width: 340, maxWidth: "38vw", padding: "0 12px", marginLeft: 8, background: "var(--v-surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", cursor: "pointer" },
  searchText: { flex: 1, textAlign: "left", color: "var(--v-ink-3)", font: "400 13.5px var(--font-sans)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  kbd: { font: "500 11px var(--font-sans)", padding: "1px 6px", background: "var(--v-surface)", border: "1px solid var(--border)", borderRadius: 5, color: "var(--v-ink-3)" },
  iconBtn: { position: "relative", width: 36, height: 36, borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--v-surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--v-ink-2)", textDecoration: "none", flex: "none" },
  iconBtnPlain: { width: 38, height: 38, borderRadius: "var(--r-md)", border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--v-ink-2)", cursor: "pointer", flex: "none" },
  redDot: { position: "absolute", top: 8, right: 9, width: 7, height: 7, borderRadius: "50%", background: "var(--danger)", border: "2px solid var(--v-surface)" },
  chip: { display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flex: "none", padding: "3px 8px 3px 3px", borderRadius: "var(--r-pill)", border: "1px solid var(--border)" },
  avatar: { width: 30, height: 30, borderRadius: "50%", background: "var(--v-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", font: "500 12px var(--font-sans)", flex: "none" },
  chipName: { font: "500 13px var(--font-sans)", color: "var(--v-ink)" },

  body: { display: "flex", alignItems: "flex-start", minHeight: "calc(100vh - 56px)" },
  island: { width: 216, flex: "none", margin: 16, position: "sticky", top: 72, maxHeight: "calc(100vh - 88px)", background: "var(--v-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", display: "flex", flexDirection: "column", padding: 10 },
  // Fits 768px without scrolling; on shorter viewports the nav scrolls rather than
  // clipping (never a nested scroll at the 768px target).
  nav: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column" },
  group: { font: "400 11px var(--font-sans)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--v-ink-3)", padding: "10px 10px 4px" },
  row: { position: "relative", display: "flex", alignItems: "center", gap: 11, height: 34, padding: "0 10px", borderRadius: "var(--r-md)", color: "var(--v-ink-2)", font: "400 14px var(--font-sans)", textDecoration: "none", marginBottom: 1 },
  rowOn: { background: "var(--v-accent-soft)", color: "var(--v-accent)", fontWeight: 500 },
  rowLabel: { flex: 1, minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  badge: { font: "500 11px var(--font-sans)", color: "var(--v-accent)", background: "var(--v-accent-soft)", borderRadius: "var(--r-pill)", padding: "1px 7px", flex: "none" },

  coach: { display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 12, textDecoration: "none", borderRadius: "var(--r-md)", border: "1px solid transparent" },
  coachTitle: { font: "500 13px var(--font-sans)", color: "var(--v-ink)" },
  coachSub: { font: "400 11.5px var(--font-sans)", color: "var(--v-ink-3)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  signOut: { display: "flex", alignItems: "center", gap: 11, width: "100%", height: 38, marginTop: 6, padding: "0 10px", borderRadius: "var(--r-md)", border: "none", background: "none", color: "var(--danger)", font: "500 14px var(--font-sans)", cursor: "pointer", textAlign: "left" },

  main: { flex: 1, minWidth: 0, padding: "24px 28px" },

  bottom: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 45, height: 64, background: "var(--v-surface)", borderTop: "1px solid var(--border)", display: "flex" },
  pill: { position: "absolute", top: 8, bottom: 12, width: "calc(20% - 12px)", background: "var(--v-accent-soft)", borderRadius: "var(--r-md)" },
  tab: { position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, textDecoration: "none" },

  scrim: { position: "fixed", inset: 0, background: "rgba(15,17,21,.4)", zIndex: 55 },
  drawer: { position: "fixed", top: 0, left: 0, bottom: 0, width: 288, zIndex: 60, background: "var(--v-surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", transition: "transform .24s cubic-bezier(.4,0,.2,1)" },
  drawerHead: { display: "flex", alignItems: "center", gap: 11, padding: "16px 16px 14px", borderBottom: "1px solid var(--border)" },
  drawerName: { font: "500 15px var(--font-sans)", color: "var(--v-ink)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  drawerRole: { font: "400 12px var(--font-sans)", color: "var(--v-ink-3)" },
}
