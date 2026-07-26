"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconLock } from "@/components/ui/Icons"
import { hasFeature, FEATURE_LABEL, FEATURE_UPGRADE, type Feature } from "@/lib/entitlements"

/* Wrap a page whose whole purpose is gated behind a plan. Fetches the current
   user, and either renders the children or a clean upgrade screen — never a blank
   or a half-loaded gated page. Server APIs enforce the same rule; this is the UI. */
export default function FeatureGate({ feature, title, children }: { feature: Feature; title?: string; children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading")

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json())
      .then(d => setState(hasFeature(d.user, feature) ? "ok" : "denied"))
      .catch(() => setState("denied"))
  }, [feature])

  if (state === "ok") return <>{children}</>
  if (state === "loading") return <AppShell title={title}><div style={S.dim}>Loading…</div></AppShell>

  const up = FEATURE_UPGRADE[feature]
  return (
    <AppShell title={title}>
      <div style={S.wrap}>
        <div style={S.icon}><IconLock size={22} /></div>
        <h1 style={S.h1}>{FEATURE_LABEL[feature]} is an enterprise feature</h1>
        <p style={S.p}>
          {FEATURE_LABEL[feature]} is available on the <b>{up.name}</b> plan, for large
          organisations. It isn’t part of your current plan.
        </p>
        <div style={S.row}>
          <Link href="/pricing" style={S.primary}>See the {up.name} plan</Link>
          <Link href="/dashboard" style={S.ghost}>Back to dashboard</Link>
        </div>
      </div>
    </AppShell>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 460, margin: "8vh auto 0", textAlign: "center", padding: "0 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 },
  icon: { width: 54, height: 54, borderRadius: 15, background: "var(--v-accent-soft)", color: "var(--v-accent)", display: "grid", placeItems: "center" },
  h1: { fontSize: 22, fontWeight: 650, color: "var(--v-ink)", margin: 0, letterSpacing: "-.02em" },
  p: { fontSize: 14.5, lineHeight: 1.6, color: "var(--v-ink-2)", margin: 0 },
  row: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 6 },
  primary: { padding: "11px 20px", borderRadius: 11, background: "var(--v-accent)", color: "#fff", fontSize: 14, fontWeight: 650, textDecoration: "none" },
  ghost: { padding: "11px 20px", borderRadius: 11, border: "1px solid var(--v-line-2)", color: "var(--v-ink)", fontSize: 14, fontWeight: 600, textDecoration: "none" },
  dim: { padding: 40, textAlign: "center", color: "var(--v-ink-3)" },
}
