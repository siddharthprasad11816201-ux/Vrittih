"use client"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  IconActivity, IconBriefcase, IconTarget, IconFileText, IconUsers, IconTrendingUp,
  IconClipboard, IconMessage, IconMail, IconVideo, IconNetwork, IconSettings, IconSearch,
  IconPlus, IconUser, IconLock,
} from "@/components/ui/Icons"

type Cmd = { id: string; label: string; hint?: string; icon: ReactNode; run: () => void; keywords?: string }

export default function CommandPalette({ isEmployer }: { isEmployer: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: Cmd[] = useMemo(() => {
    const go = (href: string) => () => { setOpen(false); router.push(href) }
    const nav: Cmd[] = [
      { id: "overview", label: "Overview", icon: <IconActivity size={16} />, run: go("/dashboard"), keywords: "home dashboard" },
      { id: "jobs", label: "Find jobs", icon: <IconBriefcase size={16} />, run: go("/jobs") },
      { id: "matched", label: "Matched for you", icon: <IconTarget size={16} />, run: go("/jobs/match") },
      { id: "apps", label: "Applications", icon: <IconFileText size={16} />, run: go("/dashboard/applications") },
      { id: "contacts", label: "Contacts", icon: <IconUsers size={16} />, run: go("/contacts") },
      { id: "pipeline", label: "Pipeline", icon: <IconTrendingUp size={16} />, run: go("/pipeline") },
      { id: "forms", label: "Forms", icon: <IconClipboard size={16} />, run: go("/forms") },
      { id: "messages", label: "Messages", icon: <IconMessage size={16} />, run: go("/messages") },
      { id: "mail", label: "Mail", icon: <IconMail size={16} />, run: go("/mail") },
      { id: "interviews", label: "Interviews", icon: <IconVideo size={16} />, run: go("/interviews") },
      { id: "network", label: "Network", icon: <IconNetwork size={16} />, run: go("/network") },
      { id: "community", label: "Community", icon: <IconMessage size={16} />, run: go("/community") },
      { id: "tests", label: "Assessments", icon: <IconClipboard size={16} />, run: go("/tests") },
      { id: "resume", label: "Résumé", icon: <IconFileText size={16} />, run: go("/resume") },
      { id: "profile", label: "Profile", icon: <IconUser size={16} />, run: go("/profile") },
      { id: "settings", label: "Settings", icon: <IconSettings size={16} />, run: go("/settings") },
    ]
    const actions: Cmd[] = [
      { id: "a-contact", label: "New contact", hint: "Action", icon: <IconPlus size={16} />, run: go("/contacts/new"), keywords: "create add crm" },
      { id: "a-form", label: "New form", hint: "Action", icon: <IconPlus size={16} />, run: go("/forms"), keywords: "create lead capture" },
      { id: "a-2fa", label: "Set up 2-factor / passkey", hint: "Security", icon: <IconLock size={16} />, run: go("/settings"), keywords: "totp authenticator fingerprint webauthn" },
      { id: "a-logout", label: "Log out", hint: "Account", icon: <IconUser size={16} />, keywords: "sign out", run: async () => { setOpen(false); await fetch("/api/auth/logout", { method: "POST" }); router.push("/login") } },
    ]
    if (isEmployer) actions.unshift(
      { id: "a-post", label: "Post a job", hint: "Action", icon: <IconPlus size={16} />, run: go("/dashboard/post-job"), keywords: "create hire" },
      { id: "a-cand", label: "View candidates", hint: "Hiring", icon: <IconUsers size={16} />, run: go("/dashboard/recruiter"), keywords: "applicants ranked" },
    )
    return [...nav, ...actions]
  }, [isEmployer, router])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return commands
    return commands.filter(c => (c.label + " " + (c.keywords || "") + " " + (c.hint || "")).toLowerCase().includes(s))
  }, [q, commands])

  // global open/close shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(o => !o) }
      else if (e.key === "/" && !typing && !open) { e.preventDefault(); setOpen(true) }
      else if (e.key === "Escape" && open) setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  useEffect(() => { if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 20) } }, [open])
  useEffect(() => { setActive(0) }, [q])

  // expose an opener for the topbar search button
  useEffect(() => {
    const h = () => setOpen(true)
    window.addEventListener("vrittih:open-command", h)
    return () => window.removeEventListener("vrittih:open-command", h)
  }, [])

  if (!open) return null

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === "Enter") { e.preventDefault(); results[active]?.run() }
  }

  return (
    <div style={S.overlay} onClick={() => setOpen(false)}>
      <div style={S.panel} onClick={e => e.stopPropagation()} onKeyDown={onListKey}>
        <div style={S.searchRow}>
          <IconSearch size={17} />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search or jump to…" style={S.input} />
          <kbd style={S.kbd}>Esc</kbd>
        </div>
        <div style={S.list}>
          {results.length === 0 && <div style={S.empty}>No matches</div>}
          {results.map((c, i) => (
            <button key={c.id} onMouseEnter={() => setActive(i)} onClick={() => c.run()}
              style={{ ...S.item, ...(i === active ? S.itemActive : {}) }}>
              <span style={S.itemIcon}>{c.icon}</span>
              <span style={S.itemLabel}>{c.label}</span>
              {c.hint && <span style={S.itemHint}>{c.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const S: Record<string, any> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(20,15,40,.34)", backdropFilter: "blur(2px)", zIndex: 200, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "12vh" },
  panel: { width: "100%", maxWidth: 560, background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 16, boxShadow: "0 24px 70px rgba(20,15,40,.28)", overflow: "hidden" },
  searchRow: { display: "flex", alignItems: "center", gap: 11, padding: "15px 18px", borderBottom: "1px solid var(--v-line)", color: "var(--v-ink-3)" },
  input: { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, color: "var(--v-ink)" },
  kbd: { fontSize: 11, fontWeight: 600, color: "var(--v-ink-3)", border: "1px solid var(--v-line-2)", borderRadius: 6, padding: "2px 7px" },
  list: { maxHeight: 380, overflowY: "auto", padding: 8 },
  empty: { padding: "24px", textAlign: "center", color: "var(--v-ink-3)", fontSize: 14 },
  item: { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", background: "none", cursor: "pointer", textAlign: "left" },
  itemActive: { background: "var(--v-accent-soft)" },
  itemIcon: { display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, background: "var(--v-surface-2)", color: "var(--v-accent)", flexShrink: 0 },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: 500, color: "var(--v-ink)" },
  itemHint: { fontSize: 11.5, fontWeight: 600, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".04em" },
}
