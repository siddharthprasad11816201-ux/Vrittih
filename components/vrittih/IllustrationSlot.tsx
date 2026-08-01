import type { CSSProperties } from "react"

/* Hero illustration slot per IMPLEMENTATION.md §8/§10 — a branded environment
 * panel holding a drop-in vector scene (replace `src` with commissioned art).
 * Falls back to an in-house abstract "AI insight" scene so it is never blank. */

export default function IllustrationSlot({
  src, alt = "", ratio = "16 / 9", rounded = 18, style,
}: { src?: string; alt?: string; ratio?: string; rounded?: number; style?: CSSProperties }) {
  return (
    <div style={{ ...S.frame, aspectRatio: ratio, borderRadius: rounded, ...style }} aria-hidden={!alt}>
      <span style={S.orbA} /><span style={S.orbB} />
      {src ? (
        <img src={src} alt={alt} style={S.img} />
      ) : (
        <svg viewBox="0 0 320 180" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ position: "relative" }}>
          <defs>
            <linearGradient id="isk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8ECDF8" /><stop offset=".5" stopColor="#6495ED" /><stop offset="1" stopColor="#334EAC" /></linearGradient>
            <linearGradient id="isline" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#8ECDF8" /><stop offset="1" stopColor="#6495ED" /></linearGradient>
          </defs>
          {/* rising insight line + area */}
          <path d="M28 132 L84 108 L128 118 L176 78 L224 92 L292 44" fill="none" stroke="url(#isline)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M28 132 L84 108 L128 118 L176 78 L224 92 L292 44 L292 150 L28 150 Z" fill="rgba(100,149,237,.12)" />
          {[[84,108],[176,78],[292,44]].map(([x,y],i)=>(<circle key={i} cx={x} cy={y} r="4.5" fill="#fff" stroke="#6495ED" strokeWidth="2.5" />))}
          {/* floating cards */}
          <rect x="30" y="30" width="86" height="26" rx="7" fill="#fff" opacity=".92" />
          <rect x="40" y="40" width="46" height="6" rx="3" fill="#A9C6F6" />
          <rect x="214" y="26" width="74" height="22" rx="7" fill="#fff" opacity=".85" />
          {/* keystone chip */}
          <g transform="translate(150,116)"><rect x="-16" y="-16" width="32" height="32" rx="9" fill="url(#isk)" /><path d="M-8 -6 L8 -6 Q9.3 -6 9.1 -4.6 L6.4 8.9 Q6.1 10.4 4.8 10.4 L-4.8 10.4 Q-6.1 10.4 -6.4 8.9 L-9.1 -4.6 Q-9.3 -6 -8 -6 Z" fill="#fff" /></g>
        </svg>
      )}
    </div>
  )
}

const S: Record<string, any> = {
  frame: { position: "relative", overflow: "hidden", width: "100%", border: "1px solid #E7EEF8", padding: 18, display: "grid", placeItems: "center",
    background: "radial-gradient(420px 220px at 18% -10%, rgba(142,205,248,.5), transparent 62%), radial-gradient(360px 260px at 96% 12%, rgba(100,149,237,.4), transparent 60%), linear-gradient(150deg,#EEF4FE,#F7F9FC)" },
  orbA: { position: "absolute", top: -40, right: -30, width: 150, height: 150, borderRadius: "50%", filter: "blur(40px)", opacity: .5, background: "radial-gradient(circle,#8ECDF8,transparent 70%)" },
  orbB: { position: "absolute", bottom: -50, left: -20, width: 160, height: 160, borderRadius: "50%", filter: "blur(44px)", opacity: .4, background: "radial-gradient(circle,#6495ED,transparent 70%)" },
  img: { position: "relative", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
}
