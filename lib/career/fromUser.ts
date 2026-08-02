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
