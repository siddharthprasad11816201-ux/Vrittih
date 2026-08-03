"use client"
import Link from "next/link"
import type { ReactNode } from "react"

/* Design 10a — "Overview stats → one circle". A single donut with one colour
 * segment per pipeline metric, the total in the centre, and a legend. Compact,
 * visual read of the recruiter's hiring pipeline. Pure SVG, tabular numbers,
 * honest empty state (grey ring when nothing is in the pipeline). */

export type DonutSegment = { label: string; value: number; color: string; icon?: ReactNode; href?: string }

export default function PipelineDonut({
  segments, centerLabel = "IN PIPELINE", title,
}: { segments: DonutSegment[]; centerLabel?: string; title?: string }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0)
  const size = 200, sw = 20, r = (size - sw) / 2 - 2, cx = size / 2, cy = size / 2
  const C = 2 * Math.PI * r
  const GAP = total > 0 ? 6 : 0            // px gap between segments (in circumference units)

  // Build the coloured arcs (skip zero-value segments). Each arc is a dashed
  // stroke: a visible run proportional to its share, then the rest transparent,
  // rotated to start where the previous arc ended.
  let acc = 0
  const arcs = segments.filter((s) => s.value > 0).map((s, i) => {
    const frac = s.value / total
    const len = Math.max(0, frac * C - GAP)
    const rotation = (acc / total) * 360 - 90
    acc += s.value
    return (
      <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw}
        strokeDasharray={`${len} ${C - len}`} strokeLinecap="round"
        transform={`rotate(${rotation} ${cx} ${cy})`} />
    )
  })

  return (
    <div style={S.card}>
      {title && <div style={S.title}>{title}</div>}
      <div style={S.body}>
        <div style={S.donutWrap}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }} role="img" aria-label={`${total} in pipeline`}>
            {/* base track */}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EAEFF5" strokeWidth={sw} />
            {arcs}
          </svg>
          <div style={S.center}>
            <span style={S.total}>{total}</span>
            <span style={S.centerLabel}>{centerLabel}</span>
          </div>
        </div>

        <ul style={S.legend}>
          {segments.map((s) => {
            const row = (
              <>
                <span style={{ ...S.dot, background: s.color }} />
                {s.icon && <span style={{ ...S.legIcon, color: s.color }}>{s.icon}</span>}
                <span style={S.legLabel}>{s.label}</span>
                <span style={S.legVal}>{s.value}</span>
              </>
            )
            return (
              <li key={s.label} style={S.legRow}>
                {s.href ? <Link href={s.href} style={S.legLink} className="pd-legrow">{row}</Link> : <div style={S.legLink}>{row}</div>}
              </li>
            )
          })}
        </ul>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `.pd-legrow:hover{background:#F7F9FC}` }} />
    </div>
  )
}

const S: Record<string, any> = {
  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 18, padding: "22px 24px", boxShadow: "0 1px 2px rgba(16,24,40,.04)" },
  title: { fontSize: 16, fontWeight: 650, color: "#1F2937", letterSpacing: "-.01em", marginBottom: 16 },
  body: { display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap", justifyContent: "center" },
  donutWrap: { position: "relative", width: 200, height: 200, flexShrink: 0 },
  center: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  total: { fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 600, color: "#1F2937", lineHeight: 1, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" },
  centerLabel: { fontSize: 10.5, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".1em", marginTop: 6 },
  legend: { listStyle: "none", margin: 0, padding: 0, flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 2 },
  legRow: { margin: 0 },
  legLink: { display: "flex", alignItems: "center", gap: 11, padding: "9px 10px", borderRadius: 10, textDecoration: "none", transition: "background .14s" },
  dot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  legIcon: { display: "inline-flex", flexShrink: 0 },
  legLabel: { flex: 1, fontSize: 14, fontWeight: 500, color: "#334155" },
  legVal: { fontSize: 16, fontWeight: 700, color: "#1F2937", fontVariantNumeric: "tabular-nums" },
}
