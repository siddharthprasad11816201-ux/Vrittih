import Link from "next/link"
import type { ReactNode } from "react"

/* Empty state per IMPLEMENTATION.md §8 — never blank: a custom keystone-motif
 * illustration on the brand environment, a one-line reason, one CTA, and an AI
 * suggestion. Colours/tokens from §2. */

export default function EmptyState({
  title, reason, ctaLabel, ctaHref, onCta, aiTip, icon,
}: {
  title: string
  reason: string
  ctaLabel?: string
  ctaHref?: string
  onCta?: () => void
  aiTip?: string
  icon?: ReactNode
}) {
  return (
    <div style={S.wrap}>
      <div style={S.illo} aria-hidden="true">
        {/* soft environment disc + keystone motif */}
        <span style={S.disc} />
        {icon || (
          <svg viewBox="0 0 48 48" width={40} height={40} style={{ position: "relative" }}>
            <defs>
              <linearGradient id="es-ks" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#8ECDF8" /><stop offset=".5" stopColor="#6495ED" /><stop offset="1" stopColor="#334EAC" />
              </linearGradient>
            </defs>
            <path d="M14.6 15 L33.4 15 Q34.9 15 34.7 16.6 L31.6 32.9 Q31.3 34.4 29.8 34.4 L18.2 34.4 Q16.7 34.4 16.4 32.9 L13.3 16.6 Q13.1 15 14.6 15 Z" fill="url(#es-ks)" />
          </svg>
        )}
      </div>
      <div style={S.title}>{title}</div>
      <p style={S.reason}>{reason}</p>
      {ctaLabel && (ctaHref ? (
        <Link href={ctaHref} style={S.cta}>{ctaLabel}</Link>
      ) : (
        <button onClick={onCta} style={S.cta}>{ctaLabel}</button>
      ))}
      {aiTip && (
        <div style={S.ai}>
          <span style={S.aiDot}><Spark /></span>
          <span><b style={{ color: "#334EAC" }}>AI tip</b> · {aiTip}</span>
        </div>
      )}
    </div>
  )
}

function Spark() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="#334EAC" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 4.8L18.6 9.6 13.8 11.4 12 16.2 10.2 11.4 5.4 9.6 10.2 7.8 12 3Z" />
    </svg>
  )
}

const S: Record<string, any> = {
  wrap: { textAlign: "center", padding: "34px 20px 30px", display: "flex", flexDirection: "column", alignItems: "center" },
  illo: { position: "relative", width: 96, height: 96, display: "grid", placeItems: "center", marginBottom: 16 },
  disc: { position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, rgba(142,205,248,.5), rgba(100,149,237,.18) 60%, transparent 72%)" },
  title: { font: "600 16.5px/1.3 var(--font-sans)", color: "#1F2937", letterSpacing: "-.01em" },
  reason: { font: "400 13.5px/1.6 var(--font-sans)", color: "#64748B", margin: "6px 0 0", maxWidth: "38ch" },
  cta: { display: "inline-block", marginTop: 16, background: "#6495ED", color: "#fff", border: "none", borderRadius: 11, padding: "10px 20px", font: "600 13.5px var(--font-sans)", textDecoration: "none", cursor: "pointer", boxShadow: "0 12px 24px -10px rgba(100,149,237,.8)" },
  ai: { display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16, background: "#EAF1FE", border: "1px solid #DCE8FD", borderRadius: 20, padding: "6px 14px", font: "500 12.5px var(--font-sans)", color: "#475569", maxWidth: "44ch" },
  aiDot: { display: "inline-flex", flex: "none" },
}
