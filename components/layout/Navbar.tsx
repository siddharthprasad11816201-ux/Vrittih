"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import styles from "@/styles/navbar.module.css"
import NotificationBell from "@/components/ui/NotificationBell"
import { IconX, IconMenu } from "@/components/ui/Icons"

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const pathname = usePathname()

  useEffect(() => {
    fetch("/api/auth/me").then(r=>r.json()).then(d => setUser(d.user || null)).catch(()=>{})
  }, [pathname])

  const links = [
    { href:"/jobs", label:"Jobs" },
    { href:"/contacts", label:"CRM" },
    { href:"/jobs/match", label:"Matched" },
    { href:"/network", label:"Network" },
    { href:"/messages", label:"Messages" },
    { href:"/mail", label:"Mail" },
    { href:"/interviews", label:"Interviews" },
    { href:"/tests", label:"Tests" },
    { href:"/community", label:"Community" },
    { href:"/analytics", label:"Analytics" },
    { href:"/dashboard", label:"Dashboard" },
  ]

  return (
    <>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>
          <div className={styles.logoMark}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
          </div>
          Vrittih<span>.online</span>
        </Link>

        <div className={styles.links}>
          {links.slice(0,6).map(l => (
            <Link key={l.href} href={l.href} className={`${styles.link}${pathname===l.href?` ${styles.linkActive}`:""}`}>{l.label}</Link>
          ))}
        </div>

        <div className={styles.right}>
          {user && <NotificationBell />}
          {user ? (
            <>
              <Link href="/resume" className={styles.btnOutline}>Resume</Link>
              <Link href="/settings" className={styles.btnOutline}>Settings</Link>
              <Link href="/dashboard" className={styles.btnPrimary}>{user.name?.split(" ")[0]}</Link>
            </>
          ) : (
            <>
              <Link href="/login" className={styles.btnOutline}>Sign in</Link>
              <Link href="/register" className={styles.btnPrimary}>Join — 1 CHF</Link>
            </>
          )}
          <button className={styles.menuBtn} onClick={()=>setMenuOpen(!menuOpen)} aria-label="Menu">
            {menuOpen ? <IconX size={18} /> : <IconMenu size={18} />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          {links.map(l => (
            <Link key={l.href} href={l.href} className={styles.mobileLink} onClick={()=>setMenuOpen(false)}>{l.label}</Link>
          ))}
          {user ? (
            <>
              <Link href="/resume" className={styles.mobileLink} onClick={()=>setMenuOpen(false)}>Resume builder</Link>
              <Link href="/settings" className={styles.mobileLink} onClick={()=>setMenuOpen(false)}>Settings</Link>
            </>
          ) : (
            <>
              <Link href="/login" className={styles.mobileLinkPrimary} onClick={()=>setMenuOpen(false)}>Sign in</Link>
              <Link href="/register" className={styles.mobileLinkPrimary} onClick={()=>setMenuOpen(false)}>Join — 1 CHF</Link>
            </>
          )}
        </div>
      )}
    </>
  )
}