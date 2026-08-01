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

export type Feature = "interviews" | "hrms" | "payroll" | "tasks" | "crm" | "mail" | "api"

type UserLike = { role?: string | null; plan?: string | null } | null | undefined

// Feature -> employer plan ids that unlock it. (Tier map set by the owner.)
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
}

export const FEATURE_LABEL: Record<Feature, string> = {
  interviews: "Video interviews",
  hrms: "HRMS",
  payroll: "Payroll",
  tasks: "Tasks",
  crm: "CRM",
  mail: "Mail & sending domains",
  api: "Developer API",
}

// The plan a feature upgrades toward, for the upgrade prompt (lowest tier that unlocks it).
export const FEATURE_UPGRADE: Record<Feature, { plan: string; name: string }> = {
  hrms: { plan: "emp_growth", name: "Growth" },
  payroll: { plan: "emp_growth", name: "Growth" },
  tasks: { plan: "emp_growth", name: "Growth" },
  crm: { plan: "emp_scale", name: "Scale" },
  mail: { plan: "emp_scale", name: "Scale" },
  interviews: { plan: "emp_scale", name: "Scale" },
  api: { plan: "emp_scale", name: "Scale" },
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
