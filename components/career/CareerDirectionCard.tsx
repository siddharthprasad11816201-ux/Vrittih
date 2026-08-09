"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { IconTarget, IconArrowRight, IconCheckCircle } from "@/components/ui/Icons"

/* ICIRE — the PRIMARY, evidence-based "best-fit career direction". Computed in-house
 * from the applicant's real skills + experience (/api/career/direction), with the
 * exact skills that justify it. This is the honest career signal; the astrological
 * reading below it is kept only as a secondary reflection. */

type Direction = { label: string; blurb: string; score: number; matched: string[] }
type CareerDirection = {
  hasEvidence: boolean
  strength: "STRONG" | "EMERGING" | "EARLY"
  headline: string
  note: string
  basis: string
  directions: Direction[]
  strengths: { skill: string; level: string; demonstrated: boolean }[]
}

const BADGE: Record<CareerDirection["strength"], { label: string; bg: string; fg: string }> = {
  STRONG: { label: "STRONG", bg: "#DCFCE7", fg: "#15803D" },
  EMERGING: { label: "EMERGING", bg: "#E0EAFF", fg: "#3538CD" },
  EARLY: { label: "EARLY", bg: "#F1F5F9", fg: "#64748B" },
}

export default function CareerDirectionCard() {
  const [d, setD] = useState<CareerDirection | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "hide">("loading")

  useEffect(() => {
    let alive = true
    fetch("/api/career/direction")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!alive) return; if (j?.direction) { setD(j.direction); setState("ready") } else setState("hide") })
      .catch(() => { if (alive) setState("hide") })
    return () => { alive = false }
  }, [])

  if (state === "loading") return <section style={S.card}><div style={S.head}><span style={S.headIc}><IconTarget size={16} /></span><h2 style={S.title}>Best-fit career direction</h2></div><p style={S.muted}>Reading your evidence…</p></section>
  if (state === "hide" || !d) return null

  const badge = BADGE[d.strength]
  return (
    <section style={S.card}>
      <div style={S.head}>
        <span style={S.headIc}><IconTarget size={16} /></span>
        <div style={{ flex: 1 }}>
          <h2 style={S.title}>Best-fit career direction</h2>
          <p style={S.sub}>Computed in-house from your real skills &amp; experience</p>
        </div>
        <span style={{ ...S.badge, background: badge.bg, color: badge.fg }}>{badge.label}</span>
      </div>

      <p style={S.headline}>{d.headline}</p>
      <p style={S.note}>{d.note}</p>

      {d.directions.length > 0 && (
        <div style={S.bars}>
          {d.directions.map((x) => (
            <div key={x.label} style={S.barRow}>
              <span style={S.barName}>{x.label}</span>
              <div style={S.barTrack}><div style={{ ...S.barFill, width: `${Math.max(4, x.score)}%` }} /></div>
              <span style={S.barVal}>{x.score}%</span>
            </div>
          ))}
        </div>
      )}

      {d.strengths.length > 0 && (
        <div style={S.block}>
          <div style={S.blockLabel}>What this is based on</div>
          <div style={S.chips}>
            {d.strengths.map((s) => (
              <span key={s.skill} style={s.demonstrated ? S.chipStrong : S.chipSoft}>
                {s.demonstrated && <IconCheckCircle size={12} />} {s.skill}
              </span>
            ))}
          </div>
        </div>
      )}

      <p style={S.basis}>{d.basis}</p>
      <Link href={d.hasEvidence ? "/career" : "/profile/edit"} style={S.cta}>
        {d.hasEvidence ? "See your best-fit roles" : "Complete your profile"} <IconArrowRight size={14} />
      </Link>
    </section>
  )
}

const S: Record<string, any> = {
  card: { background: "var(--v-surface)", border: "1px solid var(--brand-200, #cdd6f5)", borderRadius: 16, padding: "1.4rem 1.5rem", boxShadow: "var(--v-shadow-sm)", marginBottom: 16 },
  head: { display: "flex", alignItems: "center", gap: 11, marginBottom: 14 },
  headIc: { width: 34, height: 34, borderRadius: 10, background: "var(--brand-100)", color: "var(--brand-600)", display: "grid", placeItems: "center", flexShrink: 0 },
  title: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--v-ink)", letterSpacing: "-.01em" },
  sub: { fontSize: 11.5, color: "var(--v-ink-3)", marginTop: 2 },
  muted: { fontSize: 13, color: "var(--v-ink-3)" },
  badge: { fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", padding: "4px 10px", borderRadius: 999, flexShrink: 0 },
  headline: { fontSize: 15.5, fontWeight: 700, color: "var(--v-ink)", lineHeight: 1.45, margin: "2px 0 6px" },
  note: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, marginBottom: 14 },
  bars: { display: "flex", flexDirection: "column", gap: 9, marginBottom: 14 },
  barRow: { display: "flex", alignItems: "center", gap: 10 },
  barName: { fontSize: 12.5, fontWeight: 600, color: "var(--v-ink-2)", width: 168, flexShrink: 0 },
  barTrack: { flex: 1, height: 8, background: "var(--v-surface-2)", borderRadius: 5, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 5, background: "var(--brand-600)", transition: "width .5s var(--v-ease)" },
  barVal: { fontSize: 12, fontWeight: 700, color: "var(--brand-700)", width: 38, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  block: { border: "1px solid var(--v-line)", borderRadius: 14, padding: "12px 14px", marginBottom: 12 },
  blockLabel: { fontSize: 11.5, fontWeight: 700, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 9 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chipStrong: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--brand-700)", background: "var(--brand-100)", padding: "5px 10px", borderRadius: 999 },
  chipSoft: { display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 500, color: "var(--v-ink-3)", background: "var(--v-surface-2)", padding: "5px 10px", borderRadius: 999 },
  basis: { fontSize: 12, color: "var(--v-ink-3)", lineHeight: 1.5, marginBottom: 14 },
  cta: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand-600)", color: "#fff", padding: "9px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, textDecoration: "none" },
}
