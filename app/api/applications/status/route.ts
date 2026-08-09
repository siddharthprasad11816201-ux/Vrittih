import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { createNotification } from "@/lib/notify"
import { emit } from "@/lib/webhooks"
import { emit as emitEvent } from "@/lib/aios"   // AIOS event bus — drives Phase 13 automation

const STATUS_MESSAGES: Record<string,{title:string,body:string,sendEmail:boolean}> = {
  REVIEWED:    { title:"Application under review", body:"Your application is being reviewed by the employer.", sendEmail:false },
  SHORTLISTED: { title:"You have been shortlisted", body:"Great news — you have been shortlisted for this role.", sendEmail:true },
  INTERVIEW:   { title:"Interview scheduled", body:"An interview has been scheduled for you. Check your dashboard for details.", sendEmail:true },
  ASSESSMENT:  { title:"Assessment invitation", body:"You have been invited to complete an assessment for this role.", sendEmail:true },
  OFFERED:     { title:"Job offer received", body:"Congratulations — you have received a job offer.", sendEmail:true },
  HIRED:       { title:"You are hired", body:"Congratulations — you have been officially hired.", sendEmail:true },
  REJECTED:    { title:"Application update", body:"Thank you for applying. The employer has moved forward with other candidates.", sendEmail:false },
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { applicationId, status, note, interview } = await req.json()
    if (!applicationId || !status) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    // Only the employer who owns the job (or an admin) may move an application.
    const existing = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, userId: true, job: { select: { postedById: true, title: true } } },
    })
    if (!existing) return NextResponse.json({ error: "Application not found" }, { status: 404 })
    const isOwner = existing.job.postedById === payload.userId
    const isAdmin = payload.role === "ADMIN" || payload.role === "SUPER_ADMIN"
    if (!isOwner && !isAdmin) return NextResponse.json({ error: "You can only manage applications to your own jobs." }, { status: 403 })

    const application = await prisma.application.update({
      where: { id: applicationId },
      data: {
        status,
        updatedAt: new Date(),
        interview: interview ? new Date(interview) : undefined,
        timeline: { create: { status, note: note || STATUS_MESSAGES[status]?.body || "" } },
      },
      include: { user: true, job: true },
    })

    // Real-time sync to the employer's webhooks. Never blocks the response.
    await emit(existing.job.postedById, "application.updated", {
      applicationId: application.id, jobId: application.jobId, jobTitle: application.job.title,
      status: application.status, applicant: { name: application.user?.name || null },
    })
    // AIOS event → Phase 13 automation rules (fire-and-forget, like ai.executed).
    emitEvent("application.status_changed", {
      applicationId: application.id, jobId: application.jobId, jobTitle: application.job.title,
      status: application.status, applicant: { name: application.user?.name || null },
    }, { actorId: payload.userId, subjectId: application.userId }).catch(() => {})

    const msg = STATUS_MESSAGES[status]
    if (msg) {
      await createNotification({
        userId: application.userId,
        title: `${msg.title} — ${application.job.title}`,
        body: `${msg.body}${note ? ` Note: ${note}` : ""}`,
        link: "/dashboard/applications",
        sendEmail: msg.sendEmail,
      })
    }

    // Notify employer when someone applies
    return NextResponse.json({ success: true, application })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}