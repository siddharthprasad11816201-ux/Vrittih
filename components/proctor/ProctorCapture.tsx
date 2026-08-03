"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { IconShield } from "@/components/ui/Icons"

/* EROS Module 6/7 — Semantic Proctoring capture (Phase 1, on-device).
 *
 * Consent-first: nothing is captured or sent until the candidate explicitly opts in,
 * and they can withdraw at any time. Captures ONLY observable browser signals as
 * metadata (never audio/video/keystroke content) and batches them to the semantic
 * event API. This is integrity evidence for HUMAN review, not a verdict. */

type Ev = { type: string; source?: string; ts?: number; confidence?: number; evidence?: any }

export default function ProctorCapture({ kind, refId }: { kind: "interview" | "assessment"; refId: string }) {
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<"idle" | "active" | "off">("idle")
  const buf = useRef<Ev[]>([])
  const lastActivity = useRef<number>(0)
  const idleTimer = useRef<any>(null)

  const flush = useCallback(async (extra?: { consent?: boolean }) => {
    const events = buf.current.splice(0, buf.current.length)
    if (!events.length && !extra) return
    try {
      await fetch("/api/proctor/events", {
        method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
        body: JSON.stringify({ kind, refId, consent: extra?.consent ?? true, events }),
      })
    } catch { /* best-effort; events are advisory */ }
  }, [kind, refId])

  const push = useCallback((type: string, evidence?: any, confidence = 1) => {
    buf.current.push({ type, source: "browser", ts: Date.now(), confidence, evidence })
    if (buf.current.length >= 20) flush()
  }, [flush])

  useEffect(() => {
    if (!consent) return
    setStatus("active")

    const onVis = () => push(document.hidden ? "tab.hidden" : "tab.visible")
    const onBlur = () => push("window.blur")
    const onFocus = () => push("window.focus")
    const onFs = () => { if (!document.fullscreenElement) push("fullscreen.exit") }
    const onPaste = () => push("clipboard.paste")
    const onCopy = () => push("clipboard.copy")
    const onOffline = () => push("network.offline")
    const onOnline = () => push("network.online")
    const bump = () => { lastActivity.current = Date.now() }

    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("blur", onBlur)
    window.addEventListener("focus", onFocus)
    document.addEventListener("fullscreenchange", onFs)
    document.addEventListener("paste", onPaste)
    document.addEventListener("copy", onCopy)
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    document.addEventListener("mousemove", bump, { passive: true })
    document.addEventListener("keydown", bump)

    // multiple displays (Window Management API where available — no permission read of content)
    try { if ((window.screen as any)?.isExtended) push("screens.multiple") } catch {}

    lastActivity.current = Date.now()
    idleTimer.current = setInterval(() => {
      if (Date.now() - lastActivity.current > 60000) { push("idle"); lastActivity.current = Date.now() }
    }, 20000)
    const flushTimer = setInterval(() => flush(), 12000)
    const onUnload = () => flush()
    window.addEventListener("pagehide", onUnload)

    return () => {
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("blur", onBlur)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("fullscreenchange", onFs)
      document.removeEventListener("paste", onPaste)
      document.removeEventListener("copy", onCopy)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
      document.removeEventListener("mousemove", bump)
      document.removeEventListener("keydown", bump)
      window.removeEventListener("pagehide", onUnload)
      clearInterval(idleTimer.current); clearInterval(flushTimer)
      flush()
    }
  }, [consent, push, flush])

  function withdraw() {
    setConsent(false); setStatus("off")
    flush({ consent: false })   // signals the server to end the session
  }

  if (status === "off") return (
    <div style={S.box}><IconShield size={14} /><span style={S.txt}>Integrity monitoring stopped. You withdrew consent.</span></div>
  )
  if (!consent) return (
    <div style={S.box}>
      <IconShield size={14} />
      <span style={S.txt}>
        This session can record <b>observable integrity events</b> (tab switches, focus loss, paste, network) — metadata only,
        never audio, video or what you type. A human reviews any flags; it never decides on its own.
      </span>
      <button style={S.btn} onClick={() => setConsent(true)}>I consent</button>
    </div>
  )
  return (
    <div style={S.box}>
      <span style={S.dot} /> <span style={S.txt}>Integrity monitoring on (metadata only).</span>
      <button style={S.link} onClick={withdraw}>Withdraw</button>
    </div>
  )
}

const S: Record<string, any> = {
  box: { display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", padding: "9px 12px", borderRadius: 10, background: "rgba(100,149,237,.10)", border: "1px solid rgba(100,149,237,.28)", fontSize: 12, color: "var(--v-ink-2, #667085)", margin: "10px 0" },
  txt: { flex: 1, minWidth: 160, lineHeight: 1.5 },
  btn: { background: "var(--v-accent, #4F63D2)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  link: { background: "none", border: "none", color: "var(--v-accent, #4F63D2)", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline" },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 0 3px rgba(34,197,94,.2)" },
}
