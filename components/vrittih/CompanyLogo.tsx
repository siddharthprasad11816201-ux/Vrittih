import { brandColor, initials } from "@/lib/company"

// Company logo: shows the uploaded image if there is one, else a deterministic
// monogram (initials on a name-derived colour). In-house SVG — no external assets.
export default function CompanyLogo({ name, logoUrl, size = 48, radius = 12 }: {
  name: string; logoUrl?: string | null; size?: number; radius?: number
}) {
  if (logoUrl) {
    return <img src={logoUrl} alt={name} width={size} height={size}
      style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", display: "block", flexShrink: 0 }} />
  }
  const bg = brandColor(name)
  return (
    <div aria-label={name} style={{
      width: size, height: size, borderRadius: radius, background: bg, color: "#fff",
      display: "grid", placeItems: "center", flexShrink: 0,
      fontWeight: 700, fontSize: size * 0.4, letterSpacing: "-.02em",
      fontFamily: "var(--font-display), system-ui", userSelect: "none",
    }}>
      {initials(name)}
    </div>
  )
}
