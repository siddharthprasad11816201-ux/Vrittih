/* Phase 1 · Module 6 — Capability catalog. The canonical, role-FREE units of
 * authorization for the whole platform. Every feature/nav/widget/agent references
 * a capability key here — never a role name (DDR-004). Roles/plans are only
 * EVIDENCE used by derive.ts to compute which capabilities a subject holds.
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md §9. */

export type CapabilityGroup = "platform" | "jobs" | "recruit" | "hrms" | "crm" | "career" | "workspace" | "account" | "admin" | "ai" | "dev"

export type CapabilityDef = { key: string; group: CapabilityGroup; label: string; description: string }

export const CAPABILITIES: CapabilityDef[] = [
  // platform
  { key: "platform.access", group: "platform", label: "Access platform", description: "Signed-in access to the workspace" },
  // jobs (seeker)
  { key: "jobs.browse", group: "jobs", label: "Browse jobs", description: "View and search job listings" },
  { key: "jobs.apply", group: "jobs", label: "Apply to jobs", description: "Submit applications" },
  { key: "jobs.save", group: "jobs", label: "Save jobs", description: "Bookmark listings" },
  // recruiter / employer
  { key: "jobs.post", group: "recruit", label: "Post jobs", description: "Create and manage job postings" },
  { key: "candidates.view", group: "recruit", label: "View candidates", description: "See applicants to own jobs" },
  { key: "pipeline.manage", group: "recruit", label: "Manage pipeline", description: "Move candidates through hiring stages" },
  { key: "company.manage", group: "recruit", label: "Manage company", description: "Edit the company page" },
  // HRMS / workforce ops (plan-gated)
  { key: "hrms.view", group: "hrms", label: "HRMS", description: "Human resource management" },
  { key: "payroll.view", group: "hrms", label: "Payroll", description: "Run and view payroll" },
  { key: "tasks.view", group: "hrms", label: "Tasks", description: "Assign and track work" },
  // CRM / comms (plan-gated)
  { key: "crm.view", group: "crm", label: "CRM", description: "Contacts and deal pipeline" },
  { key: "mail.send", group: "crm", label: "Mail", description: "Sending domains and mail" },
  { key: "interviews.host", group: "crm", label: "Interviews", description: "Host video interviews" },
  // career intelligence (seeker AI)
  { key: "career.coach", group: "career", label: "Career coach", description: "AI Career Coach" },
  { key: "career.intelligence", group: "career", label: "Career intelligence", description: "DNA, match, roadmap, frontier" },
  { key: "resume.build", group: "career", label: "Résumé builder", description: "Build and export résumés" },
  // workspace / dashboard framework
  { key: "workspace.view", group: "workspace", label: "Workspace", description: "The universal workspace" },
  { key: "dashboard.compose", group: "workspace", label: "Compose dashboard", description: "Arrange own dashboard widgets" },
  // account & security
  { key: "account.manage", group: "account", label: "Account center", description: "Manage own account & profile" },
  { key: "security.manage", group: "account", label: "Security center", description: "Manage 2FA, passkeys, devices, sessions" },
  // developer
  { key: "api.keys", group: "dev", label: "Developer API", description: "Issue and manage API keys" },
  // AI ops / governance
  { key: "ai.execute", group: "ai", label: "Run AI capabilities", description: "Invoke AIOS capabilities" },
  { key: "ai.ops.view", group: "ai", label: "AI operations", description: "View the AI operations dashboard" },
  { key: "ai.governance.review", group: "ai", label: "AI governance", description: "Review AI change proposals" },
  // administration
  { key: "admin.access", group: "admin", label: "Admin", description: "Administrative console" },
  { key: "admin.super", group: "admin", label: "Super admin", description: "Privileged administration" },
]

export const CAPABILITY_KEYS = new Set(CAPABILITIES.map((c) => c.key))
export function isCapabilityKey(k: string): boolean { return CAPABILITY_KEYS.has(k) }
export function capabilitiesByGroup() {
  const g: Record<string, CapabilityDef[]> = {}
  for (const c of CAPABILITIES) (g[c.group] ||= []).push(c)
  return g
}
