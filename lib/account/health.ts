/* Phase 1 · Module 5 — Account Health (pure). Computes profile completion, a
 * security score, verification status, and recommended actions from REAL account
 * signals (no fabricated metrics). Unit-testable; the API supplies real data.
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md (Module 5). */

export type HealthInput = {
  profile: { name?: string | null; headline?: string | null; bio?: string | null; location?: string | null; avatar?: string | null; phone?: string | null }
  counts: { skills: number; experience: number; education: number }
  security: { twoFactorEnabled: boolean; passkeys: number; faceEnrolled: boolean; idVerified: boolean }
}
export type Recommendation = { key: string; label: string; section: string }
export type AccountHealth = {
  profileCompletion: number
  securityScore: number
  securityLevel: "strong" | "fair" | "weak"
  verification: { idVerified: boolean; faceEnrolled: boolean; twoFactor: boolean }
  missing: string[]
  recommended: Recommendation[]
}

const PROFILE_FIELDS: { key: string; label: string; has: (i: HealthInput) => boolean }[] = [
  { key: "name", label: "Full name", has: (i) => !!(i.profile.name && i.profile.name.trim()) },
  { key: "headline", label: "Headline", has: (i) => !!i.profile.headline },
  { key: "bio", label: "Summary", has: (i) => !!(i.profile.bio && i.profile.bio.length >= 40) },
  { key: "location", label: "Location", has: (i) => !!i.profile.location },
  { key: "avatar", label: "Profile photo", has: (i) => !!i.profile.avatar },
  { key: "skills", label: "Skills", has: (i) => i.counts.skills > 0 },
  { key: "experience", label: "Experience", has: (i) => i.counts.experience > 0 },
  { key: "education", label: "Education", has: (i) => i.counts.education > 0 },
]

export function computeAccountHealth(input: HealthInput): AccountHealth {
  const done = PROFILE_FIELDS.filter((f) => f.has(input))
  const profileCompletion = Math.round((done.length / PROFILE_FIELDS.length) * 100)
  const missing = PROFILE_FIELDS.filter((f) => !f.has(input)).map((f) => f.label)

  const s = input.security
  // Password is required at signup (baseline). Each factor adds real strength.
  let securityScore = 25
  if (s.twoFactorEnabled) securityScore += 30
  if (s.passkeys > 0) securityScore += 25
  if (s.faceEnrolled) securityScore += 10
  if (s.idVerified) securityScore += 10
  securityScore = Math.min(100, securityScore)
  const securityLevel: AccountHealth["securityLevel"] = securityScore >= 70 ? "strong" : securityScore >= 45 ? "fair" : "weak"

  const recommended: Recommendation[] = []
  if (!s.twoFactorEnabled) recommended.push({ key: "2fa", label: "Turn on two-factor authentication", section: "security" })
  if (s.passkeys === 0) recommended.push({ key: "passkey", label: "Add a passkey for passwordless sign-in", section: "security" })
  if (!s.faceEnrolled) recommended.push({ key: "face", label: "Set up biometric (face) sign-in", section: "security" })
  if (!s.idVerified) recommended.push({ key: "id", label: "Verify your identity document", section: "security" })
  if (profileCompletion < 100) recommended.push({ key: "profile", label: `Complete your profile (${missing.slice(0, 2).join(", ")}${missing.length > 2 ? "…" : ""})`, section: "personal" })

  return {
    profileCompletion, securityScore, securityLevel,
    verification: { idVerified: s.idVerified, faceEnrolled: s.faceEnrolled, twoFactor: s.twoFactorEnabled },
    missing, recommended,
  }
}
