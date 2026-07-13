// Company helpers shared by the API, backfill and UI.

export function slugify(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "company"
}

// Deterministic brand colour from the name, so a company's monogram is stable.
export function brandColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 52% 42%)`
}

export function initials(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Headcount band inferred from how many roles a company runs (a reasonable proxy
// when we don't have declared headcount — the backfill uses this).
export function sizeBand(openRoles: number): string {
  if (openRoles >= 90) return "1000-5000"
  if (openRoles >= 60) return "501-1000"
  if (openRoles >= 35) return "201-500"
  if (openRoles >= 15) return "51-200"
  if (openRoles >= 5) return "11-50"
  return "1-10"
}

export function generatedAbout(name: string, industry: string, hq: string): string {
  const ind = (industry || "technology").toLowerCase()
  return `${name} is a ${ind} company${hq ? ` headquartered in ${hq}` : ""}. We build products and services that matter to our customers, and we hire people who care about doing excellent work. Our teams value ownership, craft and clear communication — and we back that with real investment in learning and growth. Explore our open roles below and find where you fit.`
}
