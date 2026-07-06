"use client"
import { useEffect, useState } from "react"
import { IconEye } from "@/components/ui/Icons"

/** Global banner shown while a super-admin is impersonating another user. */
export default function ImpersonationBanner() {
  const [name, setName] = useState<string | null>(null)
  const [returning, setReturning] = useState(false)

  useEffect(() => {
    const match = document.cookie.split("; ").find(c => c.startsWith("er_impersonating="))
    if (match) setName(decodeURIComponent(match.split("=")[1] || "user"))
  }, [])

  if (!name) return null

  async function stop() {
    setReturning(true)
    await fetch("/api/admin/impersonate", { method: "DELETE" })
    window.location.href = "/admin/super"
  }

  return (
    <div style={bar}>
      <span style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 7 }}>
        <IconEye size={14} /> You are impersonating <strong>{name}</strong>. Actions are performed as this user.
      </span>
      <button onClick={stop} disabled={returning} style={btn}>
        {returning ? "Returning..." : "Return to admin"}
      </button>
    </div>
  )
}

const bar: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
  background: "#534AB7", color: "#fff", padding: "8px 16px",
  boxShadow: "0 2px 10px rgba(0,0,0,.2)",
}
const btn: React.CSSProperties = {
  background: "#fff", color: "#534AB7", border: "none", borderRadius: 7,
  padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
}
