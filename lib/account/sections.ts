/* Phase 1 · Module 5 — Account Center section registry (config-driven) + a
 * role-FREE identity descriptor. Sections are gated on capabilities (Module 6),
 * never on hardcoded roles, so any account type composes its own Account Center.
 * Adding a section = one entry here; the UI renders whatever survives the gate. */

export type AccountSection = {
  id: string
  label: string
  group: "Account" | "Security" | "Preferences" | "Developer" | "Support"
  /** Capability required to see this section; omitted = every signed-in subject. */
  cap?: string
  description: string
}

// Order is display order. `cap` keys come from lib/capability/catalog.ts.
const SECTIONS: AccountSection[] = [
  { id: "overview", label: "Overview", group: "Account", description: "Account health, identity and recommended actions" },
  { id: "personal", label: "Personal info", group: "Account", description: "Name, contact, location and profile photo" },
  { id: "professional", label: "Professional", group: "Account", description: "Headline, experience, skills and education" },
  { id: "organization", label: "Organization", group: "Account", cap: "company.manage", description: "Company, business unit and reporting" },
  { id: "security", label: "Security", group: "Security", description: "Password, two-factor, passkeys and biometric" },
  { id: "activity", label: "Sign-in & activity", group: "Security", description: "Recent sign-ins, devices and security audit" },
  { id: "privacy", label: "Privacy & data", group: "Security", description: "Data export, consent and account deletion" },
  { id: "preferences", label: "Preferences", group: "Preferences", description: "Notifications, appearance, language and region" },
  { id: "developer", label: "Developer", group: "Developer", cap: "api.keys", description: "API tokens and developer access" },
  { id: "support", label: "Support", group: "Support", description: "Help, contact and account status" },
]

/** The sections visible to a subject with the given capabilities. */
export function accountSections(caps: Set<string> | string[]): AccountSection[] {
  const set = caps instanceof Set ? caps : new Set(caps)
  return SECTIONS.filter((s) => !s.cap || set.has(s.cap))
}

export type IdentityTrait = { key: string; label: string }
export type IdentityDescriptor = { type: string; summary: string; traits: IdentityTrait[] }

/* Describe WHO the account is from evidence (capabilities) — a human-readable
 * label only. Authorization still flows through capabilities everywhere; this
 * never gates anything. New capability → new trait, no code branching by role. */
const TRAIT_MAP: { cap: string; label: string }[] = [
  { cap: "admin.super", label: "Super administrator" },
  { cap: "admin.access", label: "Administrator" },
  { cap: "jobs.post", label: "Posts jobs" },
  { cap: "company.manage", label: "Manages a company" },
  { cap: "hrms.view", label: "HRMS" },
  { cap: "payroll.view", label: "Payroll" },
  { cap: "crm.view", label: "CRM" },
  { cap: "interviews.host", label: "Hosts interviews" },
  { cap: "api.keys", label: "Developer" },
  { cap: "career.intelligence", label: "Career intelligence" },
]

export function describeIdentity(caps: Set<string> | string[]): IdentityDescriptor {
  const set = caps instanceof Set ? caps : new Set(caps)
  const traits = TRAIT_MAP.filter((t) => set.has(t.cap)).map((t) => ({ key: t.cap, label: t.label }))
  // The headline type is the most privileged evidence present — descriptive only.
  const type = set.has("admin.super") ? "Platform owner"
    : set.has("admin.access") ? "Administrator"
    : set.has("jobs.post") || set.has("company.manage") ? "Employer"
    : set.has("crm.view") ? "Operator"
    : "Professional"
  const summary = traits.length
    ? `Access derived from ${traits.length} capabilit${traits.length === 1 ? "y" : "ies"}`
    : "Standard member access"
  return { type, summary, traits }
}
