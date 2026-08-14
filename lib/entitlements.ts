// Feature gating by plan — the SINGLE source of truth, read by both the UI (to
// hide) and the API (to enforce). Each feature maps to the employer plan ids
// that unlock it. Because every list contains only EMPLOYER plans, one check
// enforces both concerns at once:
//   • role   — job seekers are on individual plans (basic/pro) / "free", none of
//              which appear below, so hasFeature() is false for them.
//   • tier   — an employer on a lower tier isn't in the list, so it's false too.
// Admins/super-admins always pass (support + testing).
//
// Tiers (lib/plans.ts):  emp_starter (49) < emp_growth (149) < emp_scale (349, max).

export type Feature =
  | "interviews" | "hrms" | "payroll" | "tasks" | "crm" | "mail" | "api" | "network"
  // Seeker-side bundles. Basic keeps the fundamentals of landing a job; these are Pro.
  | "career_advanced" | "learning_advanced" | "research" | "advanced_ai"

type UserLike = { role?: string | null; plan?: string | null } | null | undefined

// Feature -> plan ids that unlock it. Employer features list only employer plans
// (so seekers never pass). `network` is the exception: professional networking
// (Feed, Network, Community) is an ADVANCED-tier feature available to the
// individual Pro plan and to advanced employer tiers.
export const FEATURE_PLANS: Record<Feature, string[]> = {
  // Growth and up: run-the-company operations.
  hrms: ["emp_growth", "emp_scale"],
  payroll: ["emp_growth", "emp_scale"],
  tasks: ["emp_growth", "emp_scale"],
  // Scale only (large org): CRM, custom mail, integrations, video.
  crm: ["emp_scale"],
  mail: ["emp_scale"],
  interviews: ["emp_scale"],
  api: ["emp_scale"],
  // Advanced tiers (individual Pro + advanced employer): professional networking.
  network: ["pro", "emp_growth", "emp_scale"],

  // ---- Seeker bundles ----
  // BASIC deliberately gets none of these. It covers the fundamentals it advertises:
  // find, match, apply, track, saved jobs, résumé and assessments. Everything below was
  // previously visible to every tier, which left nothing for Pro to sell.
  career_advanced: ["pro", "emp_growth", "emp_scale"],     // Career AI, managed placement, opportunity groups, projects
  learning_advanced: ["pro", "emp_growth", "emp_scale"],   // Academy, AI Tutor, mentoring, competencies, growth analytics
  research: ["pro", "emp_scale"],                          // research lifecycle + innovation/grants
  advanced_ai: ["pro", "emp_scale"],                       // marketplace, automation, digital twin, autonomous AI
}

export const FEATURE_LABEL: Record<Feature, string> = {
  career_advanced: "Career intelligence",
  learning_advanced: "Academy & mentoring",
  research: "Research & innovation",
  advanced_ai: "Advanced AI tools",
  interviews: "Video interviews",
  hrms: "HRMS",
  payroll: "Payroll",
  tasks: "Tasks",
  crm: "CRM",
  mail: "Mail & sending domains",
  api: "Developer API",
  network: "Professional networking",
}

// The plan a feature upgrades toward, for the upgrade prompt (lowest tier that unlocks it).
export const FEATURE_UPGRADE: Record<Feature, { plan: string; name: string }> = {
  career_advanced: { plan: "pro", name: "Pro" },
  learning_advanced: { plan: "pro", name: "Pro" },
  research: { plan: "pro", name: "Pro" },
  advanced_ai: { plan: "pro", name: "Pro" },
  hrms: { plan: "emp_growth", name: "Growth" },
  payroll: { plan: "emp_growth", name: "Growth" },
  tasks: { plan: "emp_growth", name: "Growth" },
  crm: { plan: "emp_scale", name: "Scale" },
  mail: { plan: "emp_scale", name: "Scale" },
  interviews: { plan: "emp_scale", name: "Scale" },
  api: { plan: "emp_scale", name: "Scale" },
  network: { plan: "pro", name: "Pro" },
}

export function hasFeature(user: UserLike, f: Feature): boolean {
  if (!user) return false
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true
  return !!user.plan && (FEATURE_PLANS[f] || []).includes(user.plan)
}

// Convenience for routes: is this a company (employer) account at all?
export function isEmployer(user: UserLike): boolean {
  return !!user && ["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(user.role || "")
}
