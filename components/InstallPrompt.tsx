"use client"
import { useEffect, useState } from "react"
import { IconBriefcase, IconX } from "@/components/ui/Icons"

// Custom "Install Vrittih" banner (captures the browser's install event so we can
// show a branded prompt instead of only the toolbar icon).
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const dismissed = typeof localStorage !== "undefined" && localStorage.getItem("vrittih-install-dismissed")
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); if (!dismissed) setShow(true) }
    window.addEventListener("beforeinstallprompt", onPrompt)
    const onInstalled = () => { setShow(false); setDeferred(null) }
    window.addEventListener("appinstalled", onInstalled)
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled) }
  }, [])

  if (!show) return null

  async function install() {
    if (!deferred) return
    deferred.prompt()
    try { await deferred.userChoice } catch {}
    setShow(false); setDeferred(null)
  }
  function later() { setShow(false); try { localStorage.setItem("vrittih-install-dismissed", "1") } catch {} }

  return (
    <div style={S.wrap} role="dialog" aria-label="Install Vrittih">
      <span style={S.ic}><IconBriefcase size={18} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.title}>Install Vrittih</div>
        <div style={S.sub}>Add to your home screen for faster access, offline pages and a full-screen app.</div>
      </div>
      <button onClick={install} style={S.install}>Install</button>
      <button onClick={later} style={S.later} aria-label="Dismiss"><IconX size={16} /></button>
    </div>
  )
}

const S: Record<string, any> = {
  wrap: { position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", zIndex: 90, width: "min(460px, calc(100vw - 24px))",
    display: "flex", alignItems: "center", gap: 12, padding: "12px 12px 12px 16px", borderRadius: 16,
    background: "linear-gradient(150deg,#0F6E56,#04342C)", color: "#EAF3EE", boxShadow: "0 18px 50px rgba(4,52,44,.4)", fontFamily: "var(--font-sans)" },
  ic: { width: 38, height: 38, borderRadius: 11, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.22)", display: "grid", placeItems: "center", flexShrink: 0 },
  title: { fontSize: 14.5, fontWeight: 700 },
  sub: { fontSize: 12, color: "rgba(234,243,238,.8)", marginTop: 1, lineHeight: 1.4 },
  install: { background: "#fff", color: "#0B6B45", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 },
  later: { background: "rgba(255,255,255,.12)", color: "#EAF3EE", border: "none", borderRadius: 9, padding: 8, cursor: "pointer", display: "flex", flexShrink: 0 },
}
