import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { createNotification } from "@/lib/notify"
import { emit } from "@/lib/webhooks"
import { isTrialCapped, TRIAL_APPLICATION_CAP } from "@/lib/trial"
import { inputFromUser } from "@/lib/career/fromUser"

export const dynamic = "force-dynamic"

/* ICAE — multi-company batch apply.
 * Applies to several related roles at once, reusing the candidate's profile snapshot
 * (+ an optional shared cover letter). Per-job semantics are IDENTICAL to single
 * apply. Jobs whose employer form needs documents / screening answers / an assessment
 * are never auto-submitted with blanks — they are reported `needs_manual` with a link
 * to the full flow. The 7-day trial cap is enforced across the whole batch. Nothing is
 * submitted without the user having selected and confirmed it. */

const MAX_BATCH = 40

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })

    const body = await req.json()
    const jobIds: string[] = Array.isArray(body.jobIds) ? Array.from(new Set<string>(body.jobIds.map((x: any) => String(x)))).slice(0, MAX_BATCH) : []
    const coverLetter: string = String(body.coverLetter || "").slice(0, 8000)
    if (!jobIds.length) return NextResponse.json({ error: "Select at least one role to apply to." }, { status: 400 })

    const [appUser, existingApps, jobs] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true, email: true, headline: true, paid: true, plan: true, trialEndsAt: true } }),
      prisma.application.findMany({ where: { userId: payload.userId }, select: { jobId: true } }),
      prisma.job.findMany({ where: { id: { in: jobIds }, active: true }, include: { form: true, postedBy: { select: { id: true, name: true } } } }),
    ])
    const appliedSet = new Set(existingApps.map(a => a.jobId))
    const jobById = new Map(jobs.map(j => [j.id, j]))

    // Trial cap accounting across the batch.
    const capped = isTrialCapped(appUser)
    let remainingSlots = capped ? Math.max(0, TRIAL_APPLICATION_CAP - existingApps.length) : Infinity

    // Build a frozen profile snapshot once (the candidate's current profile).
    let snapshot: any = null
    try {
      const input = await inputFromUser(payload.userId)
      snapshot = {
        name: input.name || appUser?.name || "", headline: input.headline || appUser?.headline || "",
        email: appUser?.email || "", bio: input.bio || "",
        skills: input.skills || [], experience: input.experiences || [], education: input.education || [],
      }
    } catch { snapshot = { name: appUser?.name || "", email: appUser?.email || "" } }
    const snapshotStr = JSON.stringify(snapshot).slice(0, 40000)

    const parse = (s?: string | null) => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : [] } catch { return [] } }
    const results: { jobId: string; title?: string; company?: string; status: string; reason?: string }[] = []

    for (const jobId of jobIds) {
      const job = jobById.get(jobId)
      if (!job) { results.push({ jobId, status: "error", reason: "Role no longer available." }); continue }
      const meta = { jobId, title: job.title, company: job.company }
      if (appliedSet.has(jobId)) { results.push({ ...meta, status: "already_applied" }); continue }

      // Employer-specific requirements a generic batch can't satisfy → manual flow.
      const reqQuestions = parse(job.form?.questions).filter((q: any) => q?.required)
      const reqDocs = parse(job.form?.documents).filter((d: any) => d?.required)
      const needsCover = job.form?.coverLetter === "required" && !coverLetter.trim()
      const needsTest = !!(job.form?.testRequired && job.form?.testId)
      if (reqQuestions.length || reqDocs.length || needsTest || needsCover) {
        const bits = [
          reqDocs.length ? "documents" : "", reqQuestions.length ? "screening questions" : "",
          needsTest ? "an assessment" : "", needsCover ? "a cover letter" : "",
        ].filter(Boolean)
        results.push({ ...meta, status: "needs_manual", reason: `This employer requires ${bits.join(", ")}. Apply individually.` })
        continue
      }

      if (remainingSlots <= 0) { results.push({ ...meta, status: "capped", reason: `Free-trial limit of ${TRIAL_APPLICATION_CAP} applications reached.` }); continue }

      try {
        const application = await prisma.application.create({
          data: {
            userId: payload.userId, jobId, coverLetter: coverLetter || null, status: "APPLIED",
            snapshot: snapshotStr, source: "batch",
            timeline: { create: { status: "APPLIED", note: "Application submitted (batch)" } },
          },
        })
        appliedSet.add(jobId)
        remainingSlots--
        results.push({ ...meta, status: "applied" })
        // Notifications + webhook — best-effort, never fail the batch.
        await createNotification({ userId: payload.userId, title: `Application submitted — ${job.title}`, body: `Your application to ${job.company} has been submitted.`, link: "/dashboard/applications", sendEmail: false }).catch(() => {})
        await createNotification({ userId: job.postedById, title: `New application — ${job.title}`, body: `${appUser?.name} has applied for ${job.title}.`, link: "/dashboard/recruiter", sendEmail: false }).catch(() => {})
        await emit(job.postedById, "application.created", { applicationId: application.id, jobId, jobTitle: job.title, status: "APPLIED", appliedAt: application.appliedAt, applicant: { name: appUser?.name || null } }).catch(() => {})
      } catch (e: any) {
        results.push({ ...meta, status: "error", reason: "Could not submit — try individually." })
      }
    }

    const summary = results.reduce((acc: Record<string, number>, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc }, {})
    return NextResponse.json({ success: true, results, summary })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
