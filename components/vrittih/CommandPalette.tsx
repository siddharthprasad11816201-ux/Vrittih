"use client"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
  IconActivity, IconBriefcase, IconTarget, IconFileText, IconUsers, IconTrendingUp,
  IconClipboard, IconMessage, IconMail, IconVideo, IconNetwork, IconSettings, IconSearch,
  IconPlus, IconUser, IconLock, IconGlobe,
} from "@/components/ui/Icons"

type Item = { id: string; group: string; label: string; sub?: string; icon: ReactNode; run: () => void; keywords?: string }
type SearchResults = { jobs: any[]; people: any[]; companies: any[] }

export default function CommandPalette({ isEmployer }: { isEmployer: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const [data, setData] = useState<SearchResults>({ jobs: [], people: [], companies: [] })
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const go = (href: string) => () => { setOpen(false); router.push(href) }

  // static navigation + actions
  const commands: Item[] = useMemo(() => {
    const nav: Item[] = [
      { id: "overview", group: "Go to", label: "Overview", icon: <IconActivity size={16} />, run: go("/dashboard"), keywords: "home dashboard" },
      { id: "jobs", group: "Go to", label: "Find jobs", icon: <IconBriefcase size={16} />, run: go("/jobs") },
      { id: "matched", group: "Go to", label: "Matched for you", icon: <IconTarget size={16} />, run: go("/jobs/match") },
      { id: "apps", group: "Go to", label: "Applications", icon: <IconFileText size={16} />, run: go("/dashboard/applications") },
      { id: "contacts", group: "Go to", label: "Contacts", icon: <IconUsers size={16} />, run: go("/contacts") },
      { id: "pipeline", group: "Go to", label: "Pipeline", icon: <IconTrendingUp size={16} />, run: go("/pipeline") },
      { id: "forms", group: "Go to", label: "Forms", icon: <IconClipboard size={16} />, run: go("/forms") },
      { id: "messages", group: "Go to", label: "Messages", icon: <IconMessage size={16} />, run: go("/messages") },
      { id: "mail", group: "Go to", label: "Mail", icon: <IconMail size={16} />, run: go("/mail") },
      { id: "interviews", group: "Go to", label: "Interviews", icon: <IconVideo size={16} />, run: go("/interviews") },
      { id: "network", group: "Go to", label: "Network", icon: <IconNetwork size={16} />, run: go("/network") },
      { id: "community", group: "Go to", label: "Community", icon: <IconMessage size={16} />, run: go("/community") },
      { id: "tests", group: "Go to", label: "Assessments", icon: <IconClipboard size={16} />, run: go("/tests") },
      { id: "resume", group: "Go to", label: "Résumé", icon: <IconFileText size={16} />, run: go("/resume") },
      { id: "profile", group: "Go to", label: "Profile", icon: <IconUser size={16} />, run: go("/profile") },
      { id: "settings", group: "Go to", label: "Settings", icon: <IconSettings size={16} />, run: go("/settings") },
    ]
    const actions: Item[] = [
      { id: "a-contact", group: "Actions", label: "New contact", icon: <IconPlus size={16} />, run: go("/contacts/new"), keywords: "create add crm" },
      { id: "a-2fa", group: "Actions", label: "Set up 2-factor / passkey", icon: <IconLock size={16} />, run: go("/settings"), keywords: "totp authenticator fingerprint webauthn security" },
      { id: "a-logout", group: "Actions", label: "Log out", icon: <IconUser size={16} />, keywords: "sign out account", run: async () => { setOpen(false); await fetch("/api/auth/logout", { method: "POST" }); router.push("/login") } },
    ]
    if (isEmployer) actions.unshift(
      { id: "a-post", group: "Actions", label: "Post a job", icon: <IconPlus size={16} />, run: go("/dashboard/post-job"), keywords: "create hire" },
      { id: "a-cand", group: "Actions", label: "View candidates", icon: <IconUsers size={16} />, run: go("/dashboard/recruiter"), keywords: "applicants ranked" },
    )
    return [...nav, ...actions]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmployer])

  // debounced live search against the platform (jobs + people + companies)
  useEffect(() => {
    const s = q.trim()
    if (s.length < 2) { setData({ jobs: [], people: [], companies: [] }); setLoading(false); return }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(s)}`, { signal: ctrl.signal })
        if (r.ok) setData(await r.json())
      } catch { /* aborted */ } finally { setLoading(false) }
    }, 170)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  // build the flat, ordered result list: matching commands first, then live content
  const results: Item[] = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return commands
    const cmds = commands.filter((c) => (c.label + " " + (c.keywords || "")).toLowerCase().includes(s)).slice(0, 4)
    const jobs: Item[] = (data.jobs || []).map((j) => ({
      id: "job-" + j.id, group: "Jobs", label: j.title,
      sub: [j.company, j.location, j.remote ? "Remote" : ""].filter(Boolean).join(" · "),
      icon: <IconBriefcase size={16} />, run: go(`/jobs/${j.id}`),
    }))
    const people: Item[] = (data.people || []).map((u) => ({
      id: "user-" + u.id, group: "People", label: u.name,
      sub: [u.headline, u.location].filter(Boolean).join(" · ") || (u.isEmployer ? "Employer" : "Member"),
      icon: <IconUser size={16} />, run: go(`/u/${u.id}`),
    }))
    const companies: Item[] = (data.companies || []).map((c) => ({
      id: "co-" + c.company, group: "Companies", label: c.company,
      sub: `${c.count.toLocaleString()} open ${c.count === 1 ? "role" : "roles"}`,
      icon: <IconGlobe size={16} />, run: go(`/jobs?q=${encodeURIComponent(c.company)}`),
    }))
    return [...cmds, ...jobs, ...companies, ...people]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, commands, data])

  // global open/close shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o) }
      else if (e.key === "/" && !typing && !open) { e.preventDefault(); setOpen(true) }
      else if (e.key === "Escape" && open) setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  useEffect(() => { if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 20) } }, [open])
  useEffect(() => { setActive(0) }, [q, data])

  // expose an opener for the topbar search button
  useEffect(() => {
    const h = () => setOpen(true)
    window.addEventListener("vrittih:open-command", h)
    return () => window.removeEventListener("vrittih:open-command", h)
  }, [])

  if (!open) return null

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === "Enter") { e.preventDefault(); results[active]?.run() }
  }

  const showEmpty = !loading && q.trim().length >= 2 && results.length === 0

  return (
    <div style={S.overlay} onClick={() => setOpen(false)}>
      <div style={S.panel} onClick={(e) => e.stopPropagation()} onKeyDown={onListKey}>
        <div style={S.searchRow}>
          <IconSearch size={17} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs, people, companies…" style={S.input} />
          {loading ? <span style={S.spinner} aria-hidden /> : <kbd style={S.kbd}>Esc</kbd>}
        </div>
        <div style={S.list}>
          {showEmpty && <div style={S.empty}>No matches for “{q.trim()}”</div>}
          {results.map((c, i) => {
            const header = i === 0 || results[i - 1].group !== c.group
            return (
              <div key={c.id}>
                {header && <div style={S.group}>{c.group}</div>}
                <button onMouseEnter={() => setActive(i)} onClick={() => c.run()}
                  style={{ ...S.item, ...(i === active ? S.itemActive : {}) }}>
                  <span style={S.itemIcon}>{c.icon}</span>
                  <span style={S.itemBody}>
                    <span style={S.itemLabel}>{c.label}</span>
                    {c.sub && <span style={S.itemSub}>{c.sub}</span>}
                  </span>
                </button>
              </div>
            )
          })}
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
  spinner: { width: 15, height: 15, borderRadius: "50%", border: "2px solid var(--v-line-2)", borderTopColor: "var(--v-accent)", display: "inline-block", animation: "vspin .6s linear infinite" },
  list: { maxHeight: 420, overflowY: "auto", padding: 8 },
  empty: { padding: "24px", textAlign: "center", color: "var(--v-ink-3)", fontSize: 14 },
  group: { fontSize: 10.5, fontWeight: 700, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".06em", padding: "10px 12px 4px" },
  item: { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "9px 12px", borderRadius: 10, border: "none", background: "none", cursor: "pointer", textAlign: "left" },
  itemActive: { background: "var(--v-accent-soft)" },
  itemIcon: { display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, background: "var(--v-surface-2)", color: "var(--v-accent)", flexShrink: 0 },
  itemBody: { display: "flex", flexDirection: "column", minWidth: 0, flex: 1 },
  itemLabel: { fontSize: 14, fontWeight: 500, color: "var(--v-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  itemSub: { fontSize: 12, color: "var(--v-ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
}
