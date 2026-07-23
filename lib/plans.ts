// Subscription catalogue. Base currency is CHF; customers pay in their own
// currency at the live rate (see lib/fx.ts). Employer tiers are modular and
// PREDICTABLE — fixed monthly price, clear limits, no runaway usage billing.

export type Plan = {
  id: string
  audience: "individual" | "employer"
  name: string
  priceCHF: number          // per month — what is actually charged today
  listPriceCHF?: number     // intended price, when a tier is temporarily open
  openNow?: boolean         // free for now; say so plainly rather than implying it is always free
  tagline: string
  popular?: boolean
  features: string[]
  cta: string
}

export const PLANS: Plan[] = [
  // ---- Individuals / applicants ----
  { id: "free", audience: "individual", name: "Free", priceCHF: 0, tagline: "Get started and explore.",
    features: ["Browse every job", "Basic profile", "5 applications / month", "Community & feed"], cta: "Start free" },
  // Basic is deliberately open (0 CHF) while the platform is being built out —
  // the owner's decision. `listPriceCHF` keeps the intended price visible so the
  // page can say "free for now" honestly instead of pretending it was always free.
  { id: "basic", audience: "individual", name: "Basic", priceCHF: 0, listPriceCHF: 1, openNow: true, tagline: "Everything to land the job.",
    features: ["Apply to all jobs — unlimited", "Full profile, résumé & verification", "Live 7-stage application tracking", "Saved jobs & job alerts", "Network, messaging & interviews"], cta: "Choose Basic" },
  { id: "pro", audience: "individual", name: "Pro", priceCHF: 12, tagline: "Stand out and get hired faster.", popular: true,
    features: ["Everything in Basic", "Priority visibility to employers", "AI match insights & recommendations", "All career, research & file tools", "Astrological & career analysis", "Priority verified badge"], cta: "Go Pro" },

  // ---- Employers ----
  { id: "emp_starter", audience: "employer", name: "Starter", priceCHF: 49, tagline: "For small teams hiring now.",
    features: ["3 active job posts", "Drag-and-drop candidate pipeline", "5 HRMS employee seats", "3 mailboxes on your domain", "Interviews & assessments"], cta: "Choose Starter" },
  { id: "emp_growth", audience: "employer", name: "Growth", priceCHF: 149, tagline: "For scaling teams.", popular: true,
    features: ["15 active job posts", "25 HRMS seats — attendance, leave & payroll", "15 mailboxes on your domain", "Full HRMS + onboarding & offboarding", "Priority support"], cta: "Choose Growth" },
  { id: "emp_scale", audience: "employer", name: "Scale", priceCHF: 349, tagline: "For large organisations.",
    features: ["Unlimited job posts", "100 HRMS seats", "50 mailboxes on your domain", "SSO & dedicated onboarding", "Priority + account manager"], cta: "Choose Scale" },
]

// Predictable add-ons (fixed monthly, never metered).
export const ADDONS = [
  { id: "mailbox", name: "Extra mailbox", priceCHF: 2, unit: "/mailbox / mo" },
  { id: "seat", name: "Extra HRMS seat", priceCHF: 3, unit: "/seat / mo" },
]

export const getPlan = (id: string) => PLANS.find(p => p.id === id)
