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

/** Assemble the raw material for a résumé/ATS critique (§14) and auto-enhance
 * (§15): the applicant's headline, summary, experience/project bullets (one per
 * line), and their total years of experience. */
export async function resumeFromUser(userId: string): Promise<{ bullets: string[]; bio?: string; headline?: string; years: number }> {
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
  const months = (user?.experience || []).reduce((sum: number, e: any) => sum + monthsBetween(new Date(e.startDate), e.endDate ? new Date(e.endDate) : new Date()), 0)
  return { bullets, bio: user?.bio || undefined, headline: user?.headline || undefined, years: Math.round(months / 12) }
}

/** Rebuild an AnalyzeInput from an Application.snapshot (§21 calibration) — the
 * candidate exactly as they were when they applied. Defensive: snapshots vary. */
export function inputFromSnapshot(snapshot?: string | null): AnalyzeInput {
  let s: any = {}
  try { s = JSON.parse(snapshot || "{}") } catch { s = {} }
  const exps = Array.isArray(s.experience) ? s.experience : []
  return {
    name: s.name, headline: s.headline || undefined, bio: s.bio || s.summary || undefined,
    skills: (Array.isArray(s.skills) ? s.skills : []).map((x: any) => (typeof x === "string" ? x : x?.name)).filter(Boolean),
    experiences: exps.map((e: any) => {
      const start = e.startDate ? new Date(e.startDate) : null
      const end = e.endDate ? new Date(e.endDate) : new Date()
      const months = start ? monthsBetween(start, end) : undefined
      return { title: e.title || "", company: e.company || "", description: e.description || undefined, months, ageYears: start ? Math.round(yearsSince(end)) : undefined }
    }),
    education: (Array.isArray(s.education) ? s.education : []).map((e: any) => ({ school: e.school || "", degree: e.degree || "", field: e.field })),
    documents: [],
  }
}
