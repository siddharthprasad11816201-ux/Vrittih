import { prisma } from "@/lib/prisma"
import type { AnalyzeInput } from "@/lib/career/engine"

const monthsBetween = (a: Date, b: Date) => Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
const yearsSince = (d: Date) => Math.max(0, (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25))

/** Assemble an ICIRE AnalyzeInput from an applicant's stored profile + documents. */
export async function inputFromUser(userId: string): Promise<AnalyzeInput> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { education: true, experience: true, skills: { include: { skill: true } } },
  })
  const docs = await prisma.careerDocument.findMany({ where: { userId }, select: { rawText: true }, take: 25 })
  return {
    name: user?.name,
    headline: user?.headline || undefined,
    bio: user?.bio || undefined,
    skills: (user?.skills || []).map((s: any) => s.skill?.name).filter(Boolean),
    experiences: (user?.experience || []).map((e: any) => {
      const end = e.endDate ? new Date(e.endDate) : new Date()
      return { title: e.title, company: e.company, description: e.description || undefined, months: monthsBetween(new Date(e.startDate), end), ageYears: Math.round(yearsSince(end)) }
    }),
    education: (user?.education || []).map((e: any) => ({ school: e.school, degree: e.degree, field: e.field })),
    documents: docs.map((d) => ({ kind: "document" as const, text: d.rawText })),
  }
}

/** Assemble the raw material for a résumé/ATS critique (§14): the applicant's
 * headline, summary, and their experience/project bullets (one per line). */
export async function resumeFromUser(userId: string): Promise<{ bullets: string[]; bio?: string; headline?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { experience: true },
  })
  const docs = await prisma.careerDocument.findMany({ where: { userId }, select: { rawText: true }, take: 25 })
  const splitBullets = (t?: string | null) =>
    (t || "").split(/\r?\n|(?<=[.!?])\s+(?=[A-Z])|[•▪◦·]\s*/).map((s) => s.replace(/^[\s\-*•▪◦·]+/, "").trim()).filter((s) => s.length > 12)
  const bullets = [
    ...(user?.experience || []).flatMap((e: any) => splitBullets(e.description)),
    ...docs.flatMap((d) => splitBullets(d.rawText)),
  ]
  return { bullets, bio: user?.bio || undefined, headline: user?.headline || undefined }
}
