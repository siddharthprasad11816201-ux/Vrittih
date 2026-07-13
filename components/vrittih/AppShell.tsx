"use client"
import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import CommandPalette from "@/components/vrittih/CommandPalette"
import {
  IconActivity, IconBriefcase, IconTarget, IconFileText, IconUsers, IconTrendingUp,
  IconClipboard, IconMessage, IconMail, IconVideo, IconNetwork, IconUser, IconSettings,
  IconSearch, IconBell, IconShield, IconScan, IconMenu, IconX, IconHome, IconBookmark, IconGlobe,
} from "@/components/ui/Icons"

type Item = { href: string; label: string; icon: ReactNode }
type Group = { title: string; items: Item[] }

function nav(isEmployer: boolean, isAdmin: boolean): Group[] {
  const work: Group = isEmployer
    ? { title: "Hiring", items: [
        { href: "/dashboard/post-job", label: "Post a job", icon: <IconFileText size={17} /> },
        { href: "/dashboard/recruiter", label: "Candidates", icon: <IconUsers size={17} /> },
        { href: "/dashboard/pipeline", label: "Pipeline", icon: <IconTrendingUp size={17} /> },
        { href: "/hrms", label: "HRMS", icon: <IconClipboard size={17} /> },
        { href: "/jobs", label: "All jobs", icon: <IconBriefcase size={17} /> },
        { href: "/companies", label: "Companies", icon: <IconGlobe size={17} /> },
      ] }
    : { title: "Jobs", items: [
        { href: "/jobs", label: "Find jobs", icon: <IconBriefcase size={17} /> },
        { href: "/jobs/match", label: "Matched", icon: <IconTarget size={17} /> },
        { href: "/companies", label: "Companies", icon: <IconGlobe size={17} /> },
        { href: "/jobs/saved", label: "Saved", icon: <IconBookmark size={17} /> },
        { href: "/applications", label: "Applications", icon: <IconFileText size={17} /> },
        { href: "/resume", label: "Résumé", icon: <IconFileText size={17} /> },
      ] }
  const groups: Group[] = [
    { title: "", items: [
      { href: "/dashboard", label: "Overview", icon: <IconActivity size={17} /> },
      { href: "/feed", label: "Feed", icon: <IconHome size={17} /> },
    ] },
    work,
    { title: "CRM", items: [
      { href: "/contacts", label: "Contacts", icon: <IconUsers size={17} /> },
      { href: "/pipeline", label: "Pipeline", icon: <IconTrendingUp size={17} /> },
      { href: "/forms", label: "Forms", icon: <IconClipboard size={17} /> },
    ] },
    { title: "Connect", items: [
      { href: "/messages", label: "Messages", icon: <IconMessage size={17} /> },
      { href: "/mail", label: "Mail", icon: <IconMail size={17} /> },
      { href: "/interviews", label: "Interviews", icon: <IconVideo size={17} /> },
      { href: "/network", label: "Network", icon: <IconNetwork size={17} /> },
      { href: "/community", label: "Community", icon: <IconMessage size={17} /> },
    ] },
    { title: "Grow", items: [
      { href: "/tests", label: "Assessments", icon: <IconClipboard size={17} /> },
      { href: "/tools", label: "Tools", icon: <IconTarget size={17} /> },
      { href: "/verify/face-setup", label: "Security", icon: <IconScan size={17} /> },
    ] },
  ]
  if (isAdmin) groups.push({ title: "Admin", items: [{ href: "/admin", label: "Admin panel", icon: <IconShield size={17} /> }] })
  return groups
}

export default function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [q, setQ] = useState("")
  const [isMobile, setIsMobile] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => { fetch("/api/auth/me").then(r => r.json()).then(d => setUser(d.user || null)).catch(() => {}) }, [])
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)")
    const on = () => setIsMobile(mq.matches)
    on(); mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  useEffect(() => { setNavOpen(false) }, [pathname]) // close drawer on navigate

  const isEmployer = ["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(user?.role)
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(user?.role)
  const groups = nav(isEmployer, isAdmin)
  const active = (href: string) => href === "/dashboard" ? pathname === "/dashboard" : (pathname === href || pathname.startsWith(href + "/"))
  const initials = (user?.name || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()

  const sidebarStyle = isMobile
    ? { ...S.sidebar, position: "fixed" as const, zIndex: 60, transform: navOpen ? "translateX(0)" : "translateX(-110%)", transition: "transform .22s ease", boxShadow: navOpen ? "0 20px 60px rgba(20,15,40,.25)" : "none" }
    : S.sidebar

  return (
    <div className="v-app" style={S.root}>
      {isMobile && navOpen && <div style={S.backdrop} onClick={() => setNavOpen(false)} />}

      <aside style={sidebarStyle}>
        <div style={S.brandRow}>
          <Link href="/dashboard" style={S.brand}>
            <span style={S.brandMark}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </span>
            <span style={S.brandName}>Vrittih<span style={{ color: "var(--v-accent)" }}>.online</span></span>
          </Link>
          {isMobile && <button onClick={() => setNavOpen(false)} style={S.closeBtn} aria-label="Close menu"><IconX size={18} /></button>}
        </div>

        <nav style={S.nav}>
          {groups.map((g, gi) => (
            <div key={gi} style={S.group}>
              {g.title && <div style={S.groupTitle}>{g.title}</div>}
              {g.items.map(it => {
                const on = active(it.href)
                return (
                  <Link key={it.href} href={it.href} style={{ ...S.item, ...(on ? S.itemOn : {}) }}>
                    <span style={{ display: "flex", color: on ? "var(--v-accent)" : "var(--v-ink-3)" }}>{it.icon}</span>
                    {it.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <Link href="/settings" style={S.userChip}>
          <span style={S.avatar}>{initials}</span>
          <span style={{ minWidth: 0 }}>
            <span style={S.userName}>{user?.name || "Account"}</span>
            <span style={S.userRole}>{isEmployer ? "Employer" : "Job seeker"}</span>
          </span>
        </Link>
      </aside>

      <div style={S.main}>
        <header style={S.topbar}>
          {isMobile && <button onClick={() => setNavOpen(true)} style={S.hamburger} aria-label="Open menu"><IconMenu size={19} /></button>}
          <h1 style={S.pageTitle}>{title || pageTitleFrom(pathname)}</h1>
          <button
            onClick={() => window.dispatchEvent(new Event("vrittih:open-command"))}
            style={S.search} aria-label="Search (Ctrl+K)">
            <IconSearch size={15} />
            <span style={S.searchPlaceholder}>Search or jump to…</span>
            <kbd style={S.kbd}>⌘K</kbd>
          </button>
          <Link href="/notifications" style={S.iconBtn} aria-label="Notifications"><IconBell size={17} /></Link>
          <Link href="/settings" style={S.avatarSm}>{initials}</Link>
        </header>
        <div style={S.content}>{children}</div>
      </div>

      <CommandPalette isEmployer={isEmployer} />
    </div>
  )
}

function pageTitleFrom(pathname: string): string {
  const map: Record<string, string> = {
    "/dashboard": "Overview", "/jobs": "Find jobs", "/jobs/match": "Matched for you",
    "/contacts": "Contacts", "/pipeline": "Pipeline", "/forms": "Forms",
    "/messages": "Messages", "/mail": "Mail", "/interviews": "Interviews",
    "/network": "Network", "/community": "Community", "/tests": "Assessments",
    "/resume": "Résumé", "/settings": "Settings", "/notifications": "Notifications",
  }
  if (map[pathname]) return map[pathname]
  const seg = pathname.split("/").filter(Boolean)[0] || "Vrittih"
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

const S: Record<string, any> = {
  root: { display: "flex", minHeight: "100vh", background: "var(--v-bg)" },
  backdrop: { position: "fixed", inset: 0, background: "rgba(20,15,40,.35)", zIndex: 55 },
  sidebar: { width: 236, flexShrink: 0, background: "var(--v-sidebar)", borderRight: "1px solid var(--v-line)", position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column", padding: "18px 14px" },
  brandRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  brand: { display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 18px", textDecoration: "none" },
  brandMark: { width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,var(--v-accent),#6E64D6)", display: "grid", placeItems: "center", flexShrink: 0 },
  brandName: { fontSize: 17, fontWeight: 700, color: "var(--v-ink)", letterSpacing: "-.02em" },
  closeBtn: { background: "none", border: "none", color: "var(--v-ink-3)", cursor: "pointer", padding: 6, marginBottom: 12 },
  nav: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 },
  group: { display: "flex", flexDirection: "column", gap: 2 },
  groupTitle: { fontSize: 10.5, fontWeight: 700, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".07em", padding: "4px 10px 4px" },
  item: { display: "flex", alignItems: "center", gap: 11, padding: "8px 10px", borderRadius: 9, fontSize: 13.5, fontWeight: 500, color: "var(--v-ink-2)", textDecoration: "none", transition: "background .12s" },
  itemOn: { background: "var(--v-accent-soft)", color: "var(--v-accent)", fontWeight: 600 },
  userChip: { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, textDecoration: "none", borderTop: "1px solid var(--v-line)", marginTop: 10, paddingTop: 14 },
  avatar: { width: 32, height: 32, borderRadius: 9, background: "var(--v-accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  userName: { display: "block", fontSize: 13, fontWeight: 600, color: "var(--v-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  userRole: { display: "block", fontSize: 11.5, color: "var(--v-ink-3)" },

  main: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  topbar: { position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 12, height: 60, padding: "0 20px", background: "var(--v-topbar)", backdropFilter: "saturate(1.2) blur(8px)", borderBottom: "1px solid var(--v-line)" },
  hamburger: { background: "none", border: "1px solid var(--v-line-2)", borderRadius: 9, width: 38, height: 38, display: "grid", placeItems: "center", color: "var(--v-ink-2)", cursor: "pointer", flexShrink: 0 },
  pageTitle: { fontSize: 17, fontWeight: 650, color: "var(--v-ink)", letterSpacing: "-.01em", marginRight: "auto", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  search: { display: "flex", alignItems: "center", gap: 8, background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 10, padding: "0 10px 0 12px", height: 38, color: "var(--v-ink-3)", width: 260, maxWidth: "34vw", cursor: "pointer" },
  searchPlaceholder: { flex: 1, fontSize: 13.5, color: "var(--v-ink-3)", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden" },
  kbd: { fontSize: 11, fontWeight: 600, color: "var(--v-ink-3)", border: "1px solid var(--v-line-2)", borderRadius: 6, padding: "2px 6px" },
  iconBtn: { width: 38, height: 38, borderRadius: 10, border: "1px solid var(--v-line-2)", background: "var(--v-surface)", color: "var(--v-ink-2)", display: "grid", placeItems: "center", textDecoration: "none", flexShrink: 0 },
  avatarSm: { width: 38, height: 38, borderRadius: 10, background: "var(--v-accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700, textDecoration: "none", flexShrink: 0 },
  content: { flex: 1 },
}
