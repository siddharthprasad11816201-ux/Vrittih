import type { CSSProperties } from "react"

/* Vrittih "Keystone" logo — the pivotal stone that holds an arch together.
 * White keystone knocked out of a cornflower→indigo gradient tile. Identity
 * System v1. Use <Keystone/> for the mark and <Wordmark/> for the lockup. */

export function Keystone({ size = 36, style }: { size?: number; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: size * 0.3, background: "linear-gradient(135deg,#6495ED,#334EAC)", display: "grid", placeItems: "center", flex: "none", ...style }}
    >
      <svg viewBox="0 0 48 48" width={size * 0.56} height={size * 0.56}>
        <path d="M14.6 15 L33.4 15 Q34.9 15 34.7 16.6 L31.6 32.9 Q31.3 34.4 29.8 34.4 L18.2 34.4 Q16.7 34.4 16.4 32.9 L13.3 16.6 Q13.1 15 14.6 15 Z" fill="#fff" />
        {size >= 28 && <path d="M24 15 L33.4 15 Q34.9 15 34.7 16.6 L31.6 32.9 Q31.3 34.4 29.8 34.4 L24 34.4 Z" fill="#0B1126" opacity=".18" />}
      </svg>
    </span>
  )
}

export function Wordmark({ size = 18, color = "#1F2937", faint = "#94A3B8" }: { size?: number; color?: string; faint?: string }) {
  return (
    <span style={{ font: `600 ${size}px/1 var(--font-sans, Inter, sans-serif)`, color, letterSpacing: "-.02em" }}>
      Vrittih<span style={{ color: faint, fontWeight: 500 }}>.online</span>
    </span>
  )
}

export function Logo({ size = 36, wordmark = true, color, faint }: { size?: number; wordmark?: boolean; color?: string; faint?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
      <Keystone size={size} />
      {wordmark && <Wordmark color={color} faint={faint} />}
    </span>
  )
}
