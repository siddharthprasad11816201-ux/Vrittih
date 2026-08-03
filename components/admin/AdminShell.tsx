"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { IconBarChart, IconZap, IconUsers, IconBriefcase, IconCreditCard, IconSettings, IconUpload, IconBanknote, IconKey, IconAward, IconCheckCircle } from "@/components/ui/Icons"

const NAV: [string, string, ReactNode][] = [
  ["Overview", "/admin", <IconBarChart key="i" size={15} />],
  ["Super Control", "/admin/super", <IconZap key="i" size={15} />],
  ["Users", "/admin/users", <IconUsers key="i" size={15} />],
  ["Jobs", "/admin/jobs", <IconBriefcase key="i" size={15} />],
  ["Partners", "/admin/partners", <IconKey key="i" size={15} />],
  ["Import", "/admin/import", <IconUpload key="i" size={15} />],
  ["Payments", "/admin/payments", <IconCreditCard key="i" size={15} />],
  ["Coupons", "/admin/coupons", <IconAward key="i" size={15} />],
  ["Certificates", "/admin/certificates", <IconCheckCircle key="i" size={15} />],
  ["Pricing", "/admin/pricing", <IconBanknote key="i" size={15} />],
  ["Gateway", "/admin/gateway", <IconSettings key="i" size={15} />],
]

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <div style={S.page}>
      <aside style={S.sidebar}>
        <div style={S.brand}>
          <div style={S.brandMark}><IconZap size={16} /></div>
          <span style={S.brandText}>Admin Panel</span>
        </div>
        <nav style={S.nav}>
          {NAV.map(([label, href, icon]) => {
            const on = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)
            return (
              <Link key={label} href={href} style={{ ...S.navLink, ...(on ? S.navLinkOn : {}) }}>
                <span>{icon}</span>{label}
              </Link>
            )
          })}
        </nav>
        <div style={S.sideBottom}>
          <Link href="/" style={S.backLink}>← Back to platform</Link>
          <button onClick={async () => { try { await fetch("/api/auth/logout", { method: "POST" }) } catch {} ; window.location.href = "/login" }} style={S.signOut}>Sign out</button>
        </div>
      </aside>
      <main style={S.main}>{children}</main>
    </div>
  )
}

/** Standard page header used inside AdminShell content. */
export function AdminTopBar({ title, subtitle, right }: { title: ReactNode; subtitle?: string; right?: ReactNode }) {
  return (
    <div style={S.topBar}>
      <div>
        <h1 style={S.pageTitle}>{title}</h1>
        {subtitle && <p style={S.pageSub}>{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

const S: Record<string, any> = {
  page: { display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh", background: "#F7F9FC" },
  sidebar: { background: "#0B1126", display: "flex", flexDirection: "column" as const, borderRight: "0.5px solid rgba(255,255,255,.06)" },
  brand: { display: "flex", alignItems: "center", gap: 10, padding: "1.25rem 1.5rem", borderBottom: "0.5px solid rgba(255,255,255,.06)" },
  brandMark: { width: 32, height: 32, borderRadius: 9, background: "#6495ED", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" },
  brandText: { fontSize: 14, fontWeight: 600, color: "#fff" },
  nav: { padding: "1rem .75rem", flex: 1, display: "flex", flexDirection: "column" as const, gap: 2 },
  navLink: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, fontSize: 13, color: "rgba(255,255,255,.6)", textDecoration: "none", transition: "all .15s" },
  navLinkOn: { background: "rgba(15,110,86,.2)", color: "#9FD4C3" },
  sideBottom: { padding: "1rem 1.5rem", borderTop: "0.5px solid rgba(255,255,255,.06)", display: "flex", flexDirection: "column" as const, gap: 10, alignItems: "flex-start" },
  backLink: { fontSize: 13, color: "rgba(255,255,255,.4)", textDecoration: "none" },
  signOut: { fontSize: 13, fontWeight: 600, color: "#FCA5A5", background: "rgba(220,38,38,.12)", border: "1px solid rgba(220,38,38,.3)", borderRadius: 8, padding: "7px 14px", cursor: "pointer" },
  main: { overflow: "auto" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5rem 2rem", background: "#fff", borderBottom: "0.5px solid rgba(0,0,0,.07)" },
  pageTitle: { fontSize: 20, fontWeight: 600, color: "#0A0A0F", letterSpacing: "-.3px" },
  pageSub: { fontSize: 13, color: "#7B7B8F", marginTop: 2 },
}
