import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { computeAccountHealth } from "@/lib/account/health"
import { accountSections, describeIdentity } from "@/lib/account/sections"

export const dynamic = "force-dynamic"

/* Phase 1 · Module 5 — Account Center overview. Real identity summary + account
 * health computed from actual profile fields, real skill/experience/education
 * counts, and real security state. No fabricated metrics. */

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ authenticated: false }, { status: 401 })

  const [user, skills, experience, education, passkeys, idv] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true, name: true, email: true, avatar: true, headline: true, bio: true,
        location: true, phone: true, createdAt: true, plan: true,
        twoFactorEnabled: true, twoFactorSecret: true, faceVector: true,
        faceVectorUpdatedAt: true, idVerified: true, idType: true, openToWork: true,
      },
    }),
    prisma.userSkill.count({ where: { userId: ctx.userId } }),
    prisma.experience.count({ where: { userId: ctx.userId } }),
    prisma.education.count({ where: { userId: ctx.userId } }),
    prisma.webAuthnCredential.count({ where: { userId: ctx.userId } }),
    prisma.identityVerification.findUnique({ where: { userId: ctx.userId }, select: { verifiedAt: true, idType: true } }).catch(() => null),
  ])
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 })

  const security = {
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorMethod: user.twoFactorEnabled ? (user.twoFactorSecret?.startsWith("totp:") ? "authenticator" : "email") : null,
    passkeys,
    faceEnrolled: !!user.faceVector,
    faceUpdatedAt: user.faceVectorUpdatedAt,
    idVerified: user.idVerified,
    idType: user.idType || idv?.idType || null,
  }

  const health = computeAccountHealth({
    profile: { name: user.name, headline: user.headline, bio: user.bio, location: user.location, avatar: user.avatar, phone: user.phone },
    counts: { skills, experience, education },
    security: { twoFactorEnabled: security.twoFactorEnabled, passkeys, faceEnrolled: security.faceEnrolled, idVerified: security.idVerified },
  })

  const caps = Array.from(ctx.capabilities)
  return NextResponse.json({
    authenticated: true,
    identity: {
      id: user.id, name: user.name, email: user.email, avatar: user.avatar,
      headline: user.headline, bio: user.bio, location: user.location, phone: user.phone,
      plan: user.plan, memberSince: user.createdAt, openToWork: user.openToWork,
      ...describeIdentity(ctx.capabilities),
    },
    counts: { skills, experience, education },
    security,
    health,
    sections: accountSections(ctx.capabilities),
    capabilities: caps,
  })
}
