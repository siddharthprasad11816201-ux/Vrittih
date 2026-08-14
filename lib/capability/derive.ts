/* Phase 1 · Module 6 — derive the capability set a subject HOLDS from EVIDENCE.
 * Evidence = authentication, account plan (lib/entitlements), ownership/context,
 * and (as one signal only) the admin flag. Downstream code checks capabilities,
 * never role — this function is the ONLY place role/plan are read for authz. */
import { hasFeature, isEmployer, type Feature } from "@/lib/entitlements"

export type SubjectEvidence = { id?: string | null; role?: string | null; plan?: string | null } | null | undefined

const FEATURE_CAP: [Feature, string][] = [
  ["hrms", "hrms.view"], ["payroll", "payroll.view"], ["tasks", "tasks.view"],
  ["crm", "crm.view"], ["mail", "mail.send"], ["interviews", "interviews.host"], ["api", "api.keys"],
  ["network", "network.access"],   // professional networking — advanced tiers
  ["career_advanced", "career.advanced"],
  ["learning_advanced", "learning.advanced"],
  ["research", "research.access"],
  ["advanced_ai", "advanced.ai"],
]

/** Compute the capability keys a subject holds. Pure + deterministic. */
export function deriveCapabilities(user: SubjectEvidence): Set<string> {
  const caps = new Set<string>()
  if (!user || !user.id) return caps // anonymous: no capabilities (fail-closed)

  // Authenticated baseline — every signed-in subject.
  for (const k of ["platform.access", "workspace.view", "dashboard.compose", "account.manage", "security.manage", "ai.execute", "jobs.browse", "jobs.apply", "jobs.save", "career.coach", "career.intelligence", "resume.build"]) caps.add(k)

  // Employer/company evidence.
  if (isEmployer(user)) for (const k of ["jobs.post", "candidates.view", "pipeline.manage", "company.manage"]) caps.add(k)

  // Plan-gated features (entitlements is the evidence source).
  for (const [f, cap] of FEATURE_CAP) if (hasFeature(user, f)) caps.add(cap)

  // Administrative evidence -> administrative capabilities (still expressed as capabilities).
  const role = (user.role || "").toUpperCase()
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    for (const k of ["admin.access", "ai.ops.view", "ai.governance.review"]) caps.add(k)
    // admins can operate employer + workforce surfaces for support.
    for (const k of ["jobs.post", "candidates.view", "pipeline.manage", "company.manage", "hrms.view", "payroll.view", "tasks.view", "crm.view", "mail.send", "interviews.host", "api.keys", "career.advanced", "learning.advanced", "research.access", "advanced.ai"]) caps.add(k)
  }
  if (role === "SUPER_ADMIN") caps.add("admin.super")

  return caps
}
