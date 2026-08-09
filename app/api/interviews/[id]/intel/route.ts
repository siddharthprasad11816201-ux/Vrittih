import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { ASSESSING_ROLES } from "@/lib/interview/governance"
import { jobRequirements } from "@/lib/career/match"
import { verificationBrief } from "@/lib/talent/verifyIntel"

export const dynamic = "force-dynamic"

/* Spec §32 — Interview Verification Intelligence. Host / assessing panelist (or admin)
 * only; candidates never see this. Builds a recruiter brief for the linked candidate:
 * strongest (demonstrated) skills, listed-but-unverified claims, must-have gaps, honest
 * risk signals, and verification questions. In-house + evidence-based. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const iv = await prisma.interview.findFirst({ where: { OR: [{ id: params.id }, { roomCode: params.id }] }, include: { participants: true } })
  if (!iv) return NextResponse.json({ error: "Interview not found" }, { status: 404 })
  const isAdmin = p.role === "ADMIN" || p.role === "SUPER_ADMIN"
  const role = iv.hostId === p.userId ? "HOST" : (iv.participants || []).find((x: any) => x.userId === p.userId)?.role || null
  const canAssess = isAdmin || (role != null && ASSESSING_ROLES.includes(role.toUpperCase() as any))
  if (!canAssess) return NextResponse.json({ error: "Only an interviewer on this panel can view candidate intelligence." }, { status: 403 })

  if (!iv.applicationId) return NextResponse.json({ available: false, reason: "No application is linked to this interview — link one to generate candidate intelligence." })
  const app = await prisma.application.findUnique({
    where: { id: iv.applicationId },
    include: { job: { include: { skills: { include: { skill: true } } } } },
  })
  if (!app) return NextResponse.json({ available: false, reason: "The linked application no longer exists." })

  const [userSkills, experiences] = await Promise.all([
    prisma.userSkill.findMany({ where: { userId: app.userId }, include: { skill: true }, take: 200 }).catch(() => [] as any[]),
    prisma.experience.findMany({ where: { userId: app.userId }, take: 100 }).catch(() => [] as any[]),
  ])
  const claimed = userSkills.map((u: any) => u.skill?.name).filter(Boolean)
  const expText = experiences.map((e: any) => [e.title, e.company, e.description].filter(Boolean).join(" ")).join("\n").toLowerCase()
  const demonstrated = claimed.filter((s: string) => expText.includes(s.toLowerCase()))

  const job = app.job
  const jobSkills: string[] = job ? (job.skills || []).map((s: any) => s.skill?.name).filter(Boolean) : []
  const required = job ? jobRequirements({ title: job.title, description: job.description, industry: job.industry, skills: jobSkills }).map((r: any) => ({ skill: r.skill, must: r.must })) : []
  const seniority: "Junior" | "Mid" | "Senior" =
    /(senior|sr\.?|lead|principal|staff|head|architect|EXECUTIVE|LEAD|SENIOR)/i.test(`${iv.roleLevel || ""} ${job?.title || ""}`) ? "Senior"
      : /(intern|junior|jr\.?|trainee|graduate|entry)/i.test(job?.title || "") ? "Junior" : "Mid"

  const brief = verificationBrief({ claimed, demonstrated, required, seniority })
  return NextResponse.json({ available: true, jobTitle: job?.title || iv.title, candidateSkills: claimed.length, seniority, ...brief })
}
