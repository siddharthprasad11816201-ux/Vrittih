import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { registrationStatus } from "@/lib/account/registration"

export const dynamic = "force-dynamic"

/**
 * How close the caller is to being able to apply.
 *
 * Anonymous is a valid answer, not an error: the job page is public and needs to render an
 * accurate "Sign in to apply" state without a failed request.
 */
export async function GET(req: NextRequest) {
  const t = req.cookies.get("er_token")?.value
  const payload = t ? verifyToken(t) : null
  if (!payload) return NextResponse.json({ status: registrationStatus(null) })

  const u = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true, name: true, email: true, emailVerified: true, headline: true, location: true, resumeUrl: true,
      _count: { select: { skills: true, experience: true, education: true } },
    },
  })
  if (!u) return NextResponse.json({ status: registrationStatus(null) })

  return NextResponse.json({
    status: registrationStatus({
      id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified,
      headline: u.headline, location: u.location, resumeUrl: u.resumeUrl,
      skillCount: u._count.skills, experienceCount: u._count.experience, educationCount: u._count.education,
    }),
  })
}
