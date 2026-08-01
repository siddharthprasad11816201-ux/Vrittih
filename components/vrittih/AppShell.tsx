"use client"
import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import CommandPalette from "@/components/vrittih/CommandPalette"
import {
  IconActivity, IconBriefcase, IconTarget, IconFileText, IconUsers, IconTrendingUp,
  IconClipboard, IconMessage, IconMail, IconVideo, IconNetwork, IconUser, IconSettings,
  IconSearch, IconBell, IconShield, IconScan, IconMenu, IconX, IconHome, IconBookmark, IconGlobe,
  IconBanknote, IconKey, IconCheckCircle,
} from "@/components/ui/Icons"
import { hasFeature, type Feature } from "@/lib/entitlements"

/* Vrittih Identity System v1 navigation — cornflower shell.
 * Desktop: glass top bar + 264px sectioned sidebar (active indicator + AI Coach).
 * Mobile: top bar (☰ · logo · avatar) + 64px bottom nav with an animated sliding
 * pill + a 298px slide-out drawer with a gradient profile header.
 * Tier/role gating is preserved: every advanced item is gated by hasFeature(). */

type Item = { href: string; label: string; icon: ReactNode }
type Section = { title?: string; items: Item[] }

// White "Keystone" mark knocked out of a gradient tile — the brand logo.
function Keystone({ size = 36 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.3, background: "linear-gradient(135deg,#6495ED,#334EAC)", display: "grid", placeItems: "center", flex: "none" }}>
      <svg viewBox="0 0 48 48" width={size * 0.56} height={size * 0.56} aria-hidden="true">
        <path d="M14.6 15 L33.4 15 Q34.9 15 34.7 16.6 L31.6 32.9 Q31.3 34.4 29.8 34.4 L18.2 34.4 Q16.7 34.4 16.4 32.9 L13.3 16.6 Q13.1 15 14.6 15 Z" fill="#fff" />
        <path d="M24 15 L33.4 15 Q34.9 15 34.7 16.6 L31.6 32.9 Q31.3 34.4 29.8 34.4 L24 34.4 Z" fill="#0B1126" opacity=".18" />
      </svg>
    </span>
  )
}

function buildNav(user: any): Section[] {
  const emp = !!user && ["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(user.role)
  const isAdmin = !!user && ["ADMIN", "SUPER_ADMIN"].includes(user.role)
  const can = (f: Feature) => hasFeature(user, f)
  const I = (n: ReactNode) => n

  const sections: Section[] = [{ items: [{ href: "/dashboard", label: "Overview", icon: <IconHome size={19} /> }] }]

  sections.push({
    title: "CAREER",
    items: emp
      ? [
          { href: "/dashboard/post-job", label: "Post a job", icon: <IconFileText size={19} /> },
          { href: "/dashboard/recruiter", label: "Candidates", icon: <IconUsers size={19} /> },
          { href: "/dashboard/pipeline", label: "Pipeline", icon: <IconTrendingUp size={19} /> },
          ...(can("hrms") ? [{ href: "/hrms", label: "HRMS", icon: <IconClipboard size={19} /> }] : []),
          ...(can("payroll") ? [{ href: "/hrms/payroll", label: "Payroll", icon: <IconBanknote size={19} /> }] : []),
          ...(can("tasks") ? [{ href: "/tasks", label: "Tasks", icon: <IconCheckCircle size={19} /> }] : []),
          { href: "/jobs", label: "All jobs", icon: <IconBriefcase size={19} /> },
          { href: "/companies", label: "Companies", icon: <IconGlobe size={19} /> },
        ]
      : [
          { href: "/jobs", label: "Find jobs", icon: <IconBriefcase size={19} /> },
          { href: "/jobs/match", label: "Matched", icon: <IconTarget size={19} /> },
          { href: "/applications", label: "Applications", icon: <IconFileText size={19} /> },
          { href: "/jobs/saved", label: "Saved", icon: <IconBookmark size={19} /> },
          { href: "/resume", label: "Résumé", icon: <IconFileText size={19} /> },
        ],
  })

  const networking: Item[] = [
    { href: "/feed", label: "Feed", icon: <IconActivity size={19} /> },
    { href: "/network", label: "Network", icon: <IconNetwork size={19} /> },
    { href: "/community", label: "Community", icon: <IconUsers size={19} /> },
    { href: "/messages", label: "Messages", icon: <IconMessage size={19} /> },
  ]
  if (can("mail")) networking.push({ href: "/mail", label: "Mail", icon: <IconMail size={19} /> })
  sections.push({ title: "NETWORKING", items: networking })

  if (can("crm")) sections.push({
    title: "CRM",
    items: [
      { href: "/contacts", label: "Contacts", icon: <IconUsers size={19} /> },
      { href: "/pipeline", label: "Deal pipeline", icon: <IconTrendingUp size={19} /> },
      { href: "/forms", label: "Forms", icon: <IconClipboard size={19} /> },
    ],
  })

  const resources: Item[] = [
    { href: "/tests", label: "Assessments", icon: <IconClipboard size={19} /> },
    { href: "/tools", label: "Tools", icon: <IconTarget size={19} /> },
  ]
  if (can("api")) resources.push({ href: "/developers", label: "Developers", icon: <IconKey size={19} /> })
  resources.push({ href: "/verify/face-setup", label: "Security", icon: <IconScan size={19} /> })
  if (isAdmin) resources.push({ href: "/admin", label: "Admin panel", icon: <IconShield size={19} /> })
  sections.push({ title: "RESOURCES", items: resources })

  return sections
}

// The five primary destinations for the mobile bottom bar (role-aware).
function bottomTabs(user: any): Item[] {
  const emp = !!user && ["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(user.role)
  return emp
    ? [
        { href: "/dashboard", label: "Home", icon: <IconHome size={22} /> },
        { href: "/jobs", label: "Jobs", icon: <IconBriefcase size={22} /> },
        { href: "/dashboard/recruiter", label: "Candidates", icon: <IconUsers size={22} /> },
        { href: "/messages", label: "Messages", icon: <IconMessage size={22} /> },
        { href: "/profile", label: "Profile", icon: <IconUser size={22} /> },
      ]
    : [
        { href: "/dashboard", label: "Home", icon: <IconHome size={22} /> },
        { href: "/jobs", label: "Jobs", icon: <IconBriefcase size={22} /> },
        { href: "/applications", label: "Applied", icon: <IconFileText size={22} /> },
        { href: "/network", label: "Network", icon: <IconNetwork size={22} /> },
        { href: "/profile", label: "Profile", icon: <IconUser size={22} /> },
      ]
}

export default function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setUser(d.user || null)).catch(() => setUser(null)).finally(() => setAuthLoaded(true))
  }, [])
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)")
    const on = () => setIsMobile(mq.matches)
    on(); mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  useEffect(() => { setDrawerOpen(false) }, [pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false) }
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey)
  }, [])

  const isEmployer = !!user && ["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(user.role)
  const sections = buildNav(user)
  const tabs = bottomTabs(user)
  const active = (href: string) => href === "/dashboard" ? pathname === "/dashboard" : (pathname === href || pathname.startsWith(href + "/"))
  const activeTab = tabs.findIndex((t) => active(t.href))
  const initials = (user?.name || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()

  const NavItem = ({ it, indicator = true }: { it: Item; indicator?: boolean }) => {
    const on = active(it.href)
    return (
      <Link href={it.href} style={{ ...S.item, ...(on ? S.itemOn : {}) }} className="ks-navitem">
        {indicator && <span style={{ ...S.indicator, background: on ? "#6495ED" : "transparent" }} />}
        <span style={{ display: "inline-flex", width: 19, height: 19, color: on ? "#2F6BE0" : "#94A3B8" }}>{it.icon}</span>
        {it.label}
      </Link>
    )
  }

  const SectionedNav = () => (
    <>
      {sections.map((sec, i) => (
        <div key={i}>
          {sec.title && <div style={S.secLabel}>{sec.title}</div>}
          {sec.items.map((it) => <NavItem key={it.href} it={it} />)}
        </div>
      ))}
    </>
  )

  const CoachCard = () => (
    <div style={S.coach}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span style={{ width: 18, height: 18, display: "inline-flex" }}><IconActivity size={18} /></span>
        <span style={{ font: "600 13.5px var(--font-sans)" }}>AI Career Coach</span>
      </div>
      <p style={{ margin: "0 0 12px", font: "400 12.5px/1.5 var(--font-sans)", color: "rgba(255,255,255,.85)" }}>Tailored guidance for your next move.</p>
      <Link href="/tools" style={S.coachBtn}>Ask the coach</Link>
    </div>
  )

  return (
    <div style={S.root}>
      <style>{ksCss}</style>
      <div style={S.orb1} aria-hidden="true" />
      <div style={S.orb2} aria-hidden="true" />

      <header style={S.topbar}>
        {isMobile && <button onClick={() => setDrawerOpen(true)} style={S.iconBtnPlain} aria-label="Open menu"><IconMenu size={20} /></button>}
        <Link href="/dashboard" style={S.brand}>
          <Keystone size={isMobile ? 32 : 36} />
          {!isMobile && <span style={S.brandName}>Vrittih<span style={{ color: "#94A3B8", fontWeight: 500 }}>.online</span></span>}
        </Link>

        {!isMobile && (
          <button onClick={() => window.dispatchEvent(new Event("vrittih:open-command"))} style={S.searchPill} aria-label="Search (Ctrl+K)">
            <span style={{ width: 17, height: 17, display: "inline-flex", color: "#94A3B8" }}><IconSearch size={17} /></span>
            <span style={{ flex: 1, textAlign: "left", color: "#94A3B8", font: "400 14px var(--font-sans)" }}>Search jobs, companies, people…</span>
            <span style={S.kbd}>⌘K</span>
          </button>
        )}
        <div style={{ flex: 1 }} />

        {isMobile && <button onClick={() => window.dispatchEvent(new Event("vrittih:open-command"))} style={S.iconBtnPlain} aria-label="Search"><IconSearch size={19} /></button>}
        {!isMobile && (
          <>
            <Link href="/notifications" style={S.iconBtn} aria-label="Notifications"><IconBell size={20} /><span style={S.redDot} /></Link>
            <Link href="/messages" style={S.iconBtn} aria-label="Messages"><IconMessage size={20} /></Link>
            <div style={S.divider} />
          </>
        )}
        {authLoaded && !user ? (
          <Link href={`/login?next=${encodeURIComponent(pathname || "/dashboard")}`} style={S.profileChip}>
            <span style={{ ...S.avatar, background: "#F1F5F9", color: "#64748B" }}>–</span>
            {!isMobile && <span style={{ lineHeight: 1.15 }}><span style={S.pName}>Sign in</span><span style={S.pRole}>Signed out</span></span>}
          </Link>
        ) : (
          <Link href="/settings" style={S.profileChip}>
            <span style={S.avatar}>{initials}</span>
            {!isMobile && <span style={{ lineHeight: 1.15 }}><span style={S.pName}>{user?.name || "Account"}</span><span style={S.pRole}>{isEmployer ? "Employer" : "Job seeker"}</span></span>}
          </Link>
        )}
      </header>

      <div style={S.body}>
        {!isMobile && (
          <aside style={S.sidebar}>
            <nav style={{ display: "flex", flexDirection: "column" }}><SectionedNav /></nav>
            <div style={{ flex: 1, minHeight: 16 }} />
            <CoachCard />
          </aside>
        )}
        {/* `title` is accepted for backward-compat; pages render their own headers
            (the design keeps the top bar to brand + search + actions). */}
        <main style={{ ...S.main, paddingBottom: isMobile ? 84 : 34 }}>
          {children}
        </main>
      </div>

      {isMobile && (
        <>
          <nav style={S.bottomNav}>
            {activeTab >= 0 && <span style={{ ...S.pill, left: `calc(${activeTab} * 20% + 6px)` }} />}
            {tabs.map((t) => {
              const on = active(t.href)
              return (
                <Link key={t.href} href={t.href} style={S.tab}>
                  <span style={{ width: 22, height: 22, display: "inline-flex", color: on ? "#2F6BE0" : "#94A3B8" }}>{t.icon}</span>
                  <span style={{ font: "600 10px var(--font-sans)", color: on ? "#2F6BE0" : "#94A3B8" }}>{t.label}</span>
                </Link>
              )
            })}
          </nav>

          {drawerOpen && <div style={S.scrim} onClick={() => setDrawerOpen(false)} />}
          <div style={{ ...S.drawer, transform: drawerOpen ? "translateX(0)" : "translateX(-104%)" }}>
            <div style={S.drawerHeader}>
              <span style={{ ...S.avatar, width: 46, height: 46, fontSize: 17, background: "rgba(255,255,255,.22)", color: "#fff" }}>{initials}</span>
              <div>
                <div style={{ font: "600 15.5px var(--font-sans)", color: "#fff" }}>{user?.name || "Guest"}</div>
                <div style={{ font: "400 12.5px var(--font-sans)", color: "rgba(255,255,255,.8)" }}>{isEmployer ? "Employer" : "Job seeker"}</div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#fff", cursor: "pointer" }} aria-label="Close"><IconX size={20} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 12px" }}><SectionedNav /></div>
          </div>
        </>
      )}

      <CommandPalette isEmployer={isEmployer} canCrm={hasFeature(user, "crm")} canMail={hasFeature(user, "mail")} canInterviews={hasFeature(user, "interviews")} canApi={hasFeature(user, "api")} />
    </div>
  )
}

const ksCss = `
body{ overflow-x:clip; }
.ks-navitem:hover { background:#F1F5F9 !important; }
@keyframes vgfloat{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(6px,-20px) scale(1.06)}}
@media (prefers-reduced-motion: reduce){
  .ks-pill,.ks-drawer{ transition:none !important; }
  [style*="vgfloat"]{ animation:none !important; }
}
`

const S: Record<string, any> = {
  // "Never flat": content sits on a mesh-gradient environment (IMPLEMENTATION.md §5, light recipe).
  root: { position: "relative", minHeight: "100vh", color: "#1F2937", fontFamily: "var(--font-sans)",
    background: "radial-gradient(760px 420px at 8% -8%, rgba(142,205,248,.30), transparent 60%), radial-gradient(620px 440px at 96% 4%, rgba(100,149,237,.22), transparent 58%), radial-gradient(720px 540px at 62% 120%, rgba(51,78,172,.14), transparent 62%), #F4F7FE",
    backgroundAttachment: "fixed" },
  orb1: { position: "fixed", top: -90, left: -70, width: 340, height: 340, borderRadius: "50%", filter: "blur(60px)", opacity: .16, background: "radial-gradient(circle,#6495ED,transparent 70%)", animation: "vgfloat 15s cubic-bezier(.4,0,.2,1) infinite", zIndex: 0, pointerEvents: "none" },
  orb2: { position: "fixed", bottom: -110, right: -50, width: 320, height: 320, borderRadius: "50%", filter: "blur(60px)", opacity: .15, background: "radial-gradient(circle,#8ECDF8,transparent 70%)", animation: "vgfloat 18s cubic-bezier(.4,0,.2,1) infinite reverse", zIndex: 0, pointerEvents: "none" },
  topbar: { position: "sticky", top: 0, zIndex: 40, height: 72, display: "flex", alignItems: "center", gap: 16, padding: "0 24px", background: "rgba(255,255,255,.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid #ECEFF3" },
  brand: { display: "flex", alignItems: "center", gap: 11, textDecoration: "none", flex: "none" },
  brandName: { font: "600 18px/1 var(--font-sans)", color: "#1F2937", letterSpacing: "-.02em" },
  searchPill: { flex: 1, maxWidth: 420, display: "flex", alignItems: "center", gap: 10, height: 42, padding: "0 14px", background: "#F1F5F9", border: "1px solid #E9EDF2", borderRadius: 12, cursor: "pointer" },
  kbd: { font: "600 11px var(--font-sans)", padding: "2px 7px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 6, color: "#64748B" },
  iconBtn: { position: "relative", width: 42, height: 42, borderRadius: 12, border: "1px solid #E9EDF2", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", cursor: "pointer", textDecoration: "none", flex: "none" },
  iconBtnPlain: { width: 40, height: 40, borderRadius: 12, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", cursor: "pointer", flex: "none" },
  redDot: { position: "absolute", top: 9, right: 10, width: 8, height: 8, borderRadius: "50%", background: "#EF4444", border: "2px solid #fff" },
  divider: { width: 1, height: 28, background: "#E9EDF2", flex: "none" },
  profileChip: { display: "flex", alignItems: "center", gap: 9, cursor: "pointer", padding: "4px 6px 4px 4px", borderRadius: 12, textDecoration: "none", flex: "none" },
  avatar: { width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#6495ED,#334EAC)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", font: "600 14px var(--font-sans)", flex: "none" },
  pName: { display: "block", font: "600 13.5px var(--font-sans)", color: "#1F2937" },
  pRole: { display: "block", font: "400 11.5px var(--font-sans)", color: "#94A3B8" },

  body: { position: "relative", zIndex: 1, display: "flex", alignItems: "stretch", minHeight: "calc(100vh - 72px)" },
  sidebar: { width: 264, flex: "none", background: "#fff", borderRight: "1px solid #ECEFF3", display: "flex", flexDirection: "column", padding: "16px 14px", position: "sticky", top: 72, height: "calc(100vh - 72px)", overflowY: "auto" },
  secLabel: { font: "600 11px var(--font-sans)", letterSpacing: ".07em", color: "#94A3B8", padding: "16px 12px 6px" },
  item: { position: "relative", display: "flex", alignItems: "center", gap: 12, height: 42, padding: "0 12px", borderRadius: 10, color: "#475569", font: "500 14px var(--font-sans)", textDecoration: "none", marginBottom: 2 },
  itemOn: { background: "#EAF1FE", color: "#2F6BE0" },
  indicator: { position: "absolute", left: 0, top: 9, bottom: 9, width: 3, borderRadius: "0 3px 3px 0" },
  coach: { borderRadius: 16, padding: 16, background: "linear-gradient(135deg,#6495ED,#334EAC)", color: "#fff", boxShadow: "0 14px 30px -16px rgba(51,78,172,.7)" },
  coachBtn: { display: "block", textAlign: "center", width: "100%", height: 36, lineHeight: "36px", border: "none", borderRadius: 9, background: "#fff", color: "#334EAC", font: "600 13px var(--font-sans)", cursor: "pointer", textDecoration: "none", boxSizing: "border-box" },

  main: { flex: 1, minWidth: 0, padding: "28px 32px 34px" },
  pageTitle: { font: "600 26px var(--font-sans)", letterSpacing: "-.02em", color: "#1F2937", margin: "0 0 18px" },

  bottomNav: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 45, height: 64, background: "#fff", borderTop: "1px solid #EEF1F5", display: "flex" },
  pill: { position: "absolute", top: 9, bottom: 13, width: "calc(20% - 12px)", background: "#EAF1FE", borderRadius: 14, transition: "left .32s cubic-bezier(.4,0,.2,1)" },
  tab: { position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, textDecoration: "none" },

  scrim: { position: "fixed", inset: 0, background: "rgba(16,26,21,.44)", zIndex: 55 },
  drawer: { position: "fixed", top: 0, left: 0, bottom: 0, width: 298, zIndex: 60, background: "#fff", boxShadow: "16px 0 44px -14px rgba(51,78,172,.32)", display: "flex", flexDirection: "column", transition: "transform .34s cubic-bezier(.4,0,.2,1)" },
  drawerHeader: { padding: "18px 20px 16px", background: "linear-gradient(135deg,#6495ED,#334EAC)", display: "flex", alignItems: "center", gap: 12 },
}
