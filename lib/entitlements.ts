// Feature gating by plan. Some capabilities are deliberately not shown to most
// users. Video interviews / conferencing is enterprise-only for now — the max
// employer tier (Scale) — and is hidden entirely from applicants and lower tiers.
//
// Admins always have access (for support and testing). Keep this the single
// source of truth; both the UI (hide) and the API (enforce) read it.

export type Feature = "interviews"

type UserLike = { role?: string | null; plan?: string | null } | null | undefined

// Feature -> plan ids that unlock it. "Scale" (emp_scale) is the large-org tier.
export const FEATURE_PLANS: Record<Feature, string[]> = {
  interviews: ["emp_scale"],
}

export const FEATURE_LABEL: Record<Feature, string> = {
  interviews: "Video interviews",
}

// The plan a feature upgrades toward, for the upgrade prompt.
export const FEATURE_UPGRADE: Record<Feature, { plan: string; name: string }> = {
  interviews: { plan: "emp_scale", name: "Scale" },
}

export function hasFeature(user: UserLike, f: Feature): boolean {
  if (!user) return false
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true
  return !!user.plan && FEATURE_PLANS[f].includes(user.plan)
}
