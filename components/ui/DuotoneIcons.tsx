import type { CSSProperties } from "react"

/* Original DUOTONE icon family per IMPLEMENTATION.md §4 — a soft fill under
 * linework, 24×24, stroke 1.7, round cap/join. Kept state-colorable: linework is
 * `currentColor`, the fill is a translucent `currentColor`, so the nav's
 * active/inactive colours still apply. The 9-glyph starter set from turn 8;
 * extend keeping the same optical weight + corner radius. */

type P = { size?: number; style?: CSSProperties; title?: string }
const base = (size: number) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const,
  stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
})
const F = "currentColor"
const fill = { fill: F, opacity: 0.18, stroke: "none" as const }

export const DuoSearch = ({ size = 22, style, title }: P) => (
  <svg {...base(size)} style={style} role={title ? "img" : undefined} aria-label={title} aria-hidden={!title}>
    <circle cx="11" cy="11" r="7" {...fill} /><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" />
  </svg>
)
export const DuoBriefcase = ({ size = 22, style, title }: P) => (
  <svg {...base(size)} style={style} aria-label={title} aria-hidden={!title}>
    <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" {...fill} /><rect x="3" y="7.5" width="18" height="12.5" rx="2.5" /><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 12.5h18" />
  </svg>
)
export const DuoSpark = ({ size = 22, style, title }: P) => (
  <svg {...base(size)} style={style} aria-label={title} aria-hidden={!title}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" {...fill} />
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /><path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" />
  </svg>
)
export const DuoProfile = ({ size = 22, style, title }: P) => (
  <svg {...base(size)} style={style} aria-label={title} aria-hidden={!title}>
    <circle cx="12" cy="8" r="3.6" {...fill} /><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5" fill={F} fillOpacity={0.18} /><path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5" />
  </svg>
)
export const DuoChat = ({ size = 22, style, title }: P) => (
  <svg {...base(size)} style={style} aria-label={title} aria-hidden={!title}>
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5V6.5Z" {...fill} />
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5V6.5Z" /><path d="M8 9h8M8 12h5" />
  </svg>
)
export const DuoDocument = ({ size = 22, style, title }: P) => (
  <svg {...base(size)} style={style} aria-label={title} aria-hidden={!title}>
    <path d="M6 3h7l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" {...fill} />
    <path d="M6 3h7l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M13 3v5h5M8 13h8M8 16.5h5" />
  </svg>
)
export const DuoCalendar = ({ size = 22, style, title }: P) => (
  <svg {...base(size)} style={style} aria-label={title} aria-hidden={!title}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" {...fill} /><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
)
export const DuoBell = ({ size = 22, style, title }: P) => (
  <svg {...base(size)} style={style} aria-label={title} aria-hidden={!title}>
    <path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2.2H4.5L6 16Z" {...fill} /><path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2.2H4.5L6 16Z" /><path d="M10 20.5a2 2 0 0 0 4 0" />
  </svg>
)
export const DuoCompass = ({ size = 22, style, title }: P) => (
  <svg {...base(size)} style={style} aria-label={title} aria-hidden={!title}>
    <circle cx="12" cy="12" r="8.5" {...fill} /><circle cx="12" cy="12" r="8.5" /><path d="M15.5 8.5l-2 5-5 2 2-5 5-2Z" fill={F} fillOpacity={0.35} stroke="none" /><path d="M15.5 8.5l-2 5-5 2 2-5 5-2Z" />
  </svg>
)
