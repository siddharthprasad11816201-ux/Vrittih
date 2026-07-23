// Résumé templates, accent palettes and the tier rules that gate them.
//
// Templates are built from real structural families (not one layout recoloured
// 26 times): single column, left/right sidebar, header band, timeline, compact,
// academic CV and split header. Each family is combined with a type treatment,
// accent usage and density, so the set genuinely looks different.
//
// Tiers follow lib/plans.ts — free, basic (1 CHF/mo), pro (12 CHF/mo).

export type Layout = "single" | "sidebarLeft" | "sidebarRight" | "band" | "timeline" | "compact" | "academic" | "split"
export type FontSet = "sans" | "serif" | "mixed"
export type AccentUse = "text" | "band" | "sidebar" | "rules" | "none"
export type Density = "airy" | "normal" | "tight"
export type Tier = "free" | "basic" | "pro"

export type ResumeTemplate = {
  id: string
  name: string
  tier: Tier
  layout: Layout
  font: FontSet
  accent: AccentUse
  density: Density
  desc: string
  ats?: boolean // parses cleanly in applicant tracking systems
}

export const TEMPLATES: ResumeTemplate[] = [
  // ---- free: the honest, ATS-safe basics ----
  { id: "classic", name: "Classic", tier: "free", layout: "single", font: "serif", accent: "text", density: "normal", ats: true, desc: "Traditional single column. Parses cleanly everywhere." },
  { id: "clean", name: "Clean", tier: "free", layout: "single", font: "sans", accent: "rules", density: "normal", ats: true, desc: "Plain sans-serif with hairline section rules." },
  { id: "minimal", name: "Minimal", tier: "free", layout: "single", font: "sans", accent: "none", density: "airy", ats: true, desc: "Maximum whitespace, no colour at all." },
  { id: "compact", name: "Compact", tier: "free", layout: "compact", font: "sans", accent: "rules", density: "tight", ats: true, desc: "Fits more on one page without shouting." },

  // ---- basic: structure and colour ----
  { id: "modern", name: "Modern", tier: "basic", layout: "band", font: "sans", accent: "band", density: "normal", desc: "Coloured header band with your name reversed out." },
  { id: "aster", name: "Aster", tier: "basic", layout: "sidebarLeft", font: "sans", accent: "sidebar", density: "normal", desc: "Tinted left rail for contact, skills and education." },
  { id: "ledger", name: "Ledger", tier: "basic", layout: "single", font: "serif", accent: "rules", density: "normal", ats: true, desc: "Serif headings over ruled sections. Quietly formal." },
  { id: "meridian", name: "Meridian", tier: "basic", layout: "split", font: "sans", accent: "text", density: "normal", desc: "Name left, contact right, then a clean single column." },
  { id: "atlas", name: "Atlas", tier: "basic", layout: "sidebarRight", font: "sans", accent: "sidebar", density: "normal", desc: "Content leads; supporting detail sits on the right." },
  { id: "quill", name: "Quill", tier: "basic", layout: "single", font: "serif", accent: "text", density: "airy", desc: "Editorial serif with generous leading." },
  { id: "grid", name: "Grid", tier: "basic", layout: "compact", font: "sans", accent: "rules", density: "tight", ats: true, desc: "Dense two-up detail rows. Good for long histories." },
  { id: "signal", name: "Signal", tier: "basic", layout: "band", font: "sans", accent: "band", density: "tight", desc: "Slim colour band, tighter rhythm." },
  { id: "north", name: "North", tier: "basic", layout: "single", font: "mixed", accent: "rules", density: "normal", desc: "Serif name, sans body — a small, deliberate contrast." },
  { id: "harbor", name: "Harbor", tier: "basic", layout: "sidebarLeft", font: "serif", accent: "sidebar", density: "normal", desc: "Serif sidebar résumé with a classical feel." },
  { id: "verge", name: "Verge", tier: "basic", layout: "split", font: "sans", accent: "rules", density: "tight", desc: "Split header, tight body, no wasted space." },
  { id: "cadence", name: "Cadence", tier: "basic", layout: "timeline", font: "sans", accent: "text", density: "normal", desc: "Experience runs down a marked timeline." },

  // ---- pro: the distinctive and specialist ones ----
  { id: "chronicle", name: "Chronicle", tier: "pro", layout: "timeline", font: "serif", accent: "rules", density: "airy", desc: "Serif timeline. Reads like a career narrative." },
  { id: "obsidian", name: "Obsidian", tier: "pro", layout: "band", font: "sans", accent: "band", density: "airy", desc: "Full-bleed dark band with reversed type." },
  { id: "monarch", name: "Monarch", tier: "pro", layout: "sidebarLeft", font: "mixed", accent: "sidebar", density: "airy", desc: "Wide tinted rail, serif headings, executive weight." },
  { id: "lattice", name: "Lattice", tier: "pro", layout: "sidebarRight", font: "sans", accent: "rules", density: "tight", desc: "Skill-forward layout for technical roles." },
  { id: "academia", name: "Academia", tier: "pro", layout: "academic", font: "serif", accent: "none", density: "normal", ats: true, desc: "Long-form academic CV: publications and research first." },
  { id: "praxis", name: "Praxis", tier: "pro", layout: "academic", font: "mixed", accent: "rules", density: "normal", desc: "Research CV with a modern typographic treatment." },
  { id: "vertex", name: "Vertex", tier: "pro", layout: "split", font: "sans", accent: "band", density: "normal", desc: "Split header with a colour keyline under your name." },
  { id: "beacon", name: "Beacon", tier: "pro", layout: "band", font: "mixed", accent: "band", density: "normal", desc: "Serif name in a colour band over a sans body." },
  { id: "corvus", name: "Corvus", tier: "pro", layout: "sidebarLeft", font: "sans", accent: "band", density: "tight", desc: "Dark rail, light body. High contrast, still printable." },
  { id: "orchard", name: "Orchard", tier: "pro", layout: "single", font: "serif", accent: "band", density: "airy", desc: "Understated band, serif body, lots of air." },
  { id: "summit", name: "Summit", tier: "pro", layout: "timeline", font: "mixed", accent: "sidebar", density: "normal", desc: "Timeline plus a tinted skills rail." },
]

export type Palette = { id: string; name: string; accent: string; ink: string; tier: Tier }

export const PALETTES: Palette[] = [
  // free — safe, print-friendly
  { id: "graphite", name: "Graphite", accent: "#1F2933", ink: "#101828", tier: "free" },
  { id: "navy", name: "Navy", accent: "#1E3A8A", ink: "#101828", tier: "free" },
  // basic
  { id: "forest", name: "Forest", accent: "#0D7A5F", ink: "#101828", tier: "basic" },
  { id: "royal", name: "Royal", accent: "#4338CA", ink: "#101828", tier: "basic" },
  { id: "burgundy", name: "Burgundy", accent: "#9F1239", ink: "#101828", tier: "basic" },
  { id: "teal", name: "Teal", accent: "#0F766E", ink: "#101828", tier: "basic" },
  { id: "slate", name: "Slate", accent: "#475569", ink: "#101828", tier: "basic" },
  // pro
  { id: "amber", name: "Amber", accent: "#B45309", ink: "#101828", tier: "pro" },
  { id: "plum", name: "Plum", accent: "#6B21A8", ink: "#101828", tier: "pro" },
  { id: "ocean", name: "Ocean", accent: "#0369A1", ink: "#101828", tier: "pro" },
  { id: "moss", name: "Moss", accent: "#3F6212", ink: "#101828", tier: "pro" },
  { id: "rose", name: "Rose", accent: "#BE185D", ink: "#101828", tier: "pro" },
  { id: "ink", name: "Ink", accent: "#0B1220", ink: "#0B1220", tier: "pro" },
  { id: "copper", name: "Copper", accent: "#9A3412", ink: "#101828", tier: "pro" },
]

// Plan id (from lib/plans.ts) -> what it unlocks. Employers get the full set:
// they are paying more and often prepare résumés on a candidate's behalf.
const RANK: Record<Tier, number> = { free: 0, basic: 1, pro: 2 }

export function tierOf(planId?: string | null): Tier {
  const p = (planId || "free").toLowerCase()
  if (p === "pro" || p.startsWith("emp_")) return "pro"
  if (p === "basic") return "basic"
  return "free"
}

export const unlocked = (need: Tier, has: Tier) => RANK[has] >= RANK[need]

export function templatesFor(has: Tier) {
  return TEMPLATES.map(t => ({ ...t, locked: !unlocked(t.tier, has) }))
}
export function palettesFor(has: Tier) {
  return PALETTES.map(p => ({ ...p, locked: !unlocked(p.tier, has) }))
}

export const COUNTS = {
  templates: TEMPLATES.length,
  palettes: PALETTES.length,
  free: TEMPLATES.filter(t => t.tier === "free").length,
  basic: TEMPLATES.filter(t => RANK[t.tier] <= 1).length,
  pro: TEMPLATES.length,
}
