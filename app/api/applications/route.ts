import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { createNotification } from "@/lib/notify"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { searchParams } = new URL(req.url)
    const employer = searchParams.get("employer")
    // Pagination guard: never load an unbounded result set into memory.
    const jobFilter = searchParams.get("jobId") || ""
    const take = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "200")))
    const skip = Math.max(0, parseInt(searchParams.get("skip") || "0"))

    let applications, total
    if (employer === "true") {
      const jobs = await prisma.job.findMany({ where:{ postedById:payload.userId }, select:{ id:true } })
      const jobIds = jobFilter ? [jobFilter].filter(id => jobs.some(j => j.id === id)) : jobs.map(j => j.id)
      const where = { jobId: { in: jobIds } }
      ;[applications, total] = await Promise.all([
        prisma.application.findMany({
          where,
          include: {
            user: { select:{ id:true,name:true,email:true,avatar:true,headline:true,idVerified:true } },
            job: { select:{ id:true,title:true,company:true } },
          },
          orderBy: { appliedAt: "desc" }, take, skip,
        }),
        prisma.application.count({ where }),
      ])
    } else {
      const where = { userId: payload.userId }
      ;[applications, total] = await Promise.all([
        prisma.application.findMany({
          where,
          include: {
            job: { select:{ id:true,title:true,company:true,location:true,type:true } },
            timeline: { orderBy: { createdAt: "asc" } },
          },
          orderBy: { appliedAt: "desc" }, take, skip,
        }),
        prisma.application.count({ where }),
      ])
    }
    return NextResponse.json({ applications, total })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { jobId, coverLetter, answers, documents, snapshot, resumeUrl } = await req.json()
    if (!jobId) return NextResponse.json({ error: "Job ID required" }, { status: 400 })
    const existing = await prisma.application.findFirst({ where:{ userId:payload.userId, jobId } })
    if (existing) return NextResponse.json({ error: "Already applied" }, { status: 409 })
    const job = await prisma.job.findUnique({ where:{ id:jobId }, include:{ postedBy:{ select:{ id:true,name:true } }, form:true } })
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    // Enforce the employer's requirements server-side. The client shows them, but
    // a required document or answer must not be skippable by calling the API directly.
    const parse = (s?: string | null) => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : [] } catch { return [] } }
    const reqQuestions = parse(job.form?.questions)
    const reqDocs = parse(job.form?.documents)
    const givenAnswers: any[] = Array.isArray(answers) ? answers : []
    const givenDocs: any[] = Array.isArray(documents) ? documents : []

    const missing: string[] = []
    if (job.form?.coverLetter === "required" && !String(coverLetter || "").trim()) missing.push("Cover letter")
    for (const q of reqQuestions) {
      if (!q.required) continue
      const a = givenAnswers.find(x => x && x.questionId === q.id)
      if (!a || !String(a.value ?? "").trim()) missing.push(q.label)
    }
    for (const d of reqDocs) {
      if (!d.required) continue
      const f = givenDocs.find(x => x && x.slotId === d.id && x.mediaId)
      if (!f) missing.push(d.label)
    }
    if (missing.length) {
      return NextResponse.json({ error: `Please complete: ${missing.join(", ")}`, missing }, { status: 400 })
    }

    const application = await prisma.application.create({
      data: {
        userId: payload.userId, jobId, coverLetter, status: "APPLIED",
        // Freeze what was actually sent — the candidate's live profile may change
        // later, and neither side should be arguing about which version applied.
        snapshot: snapshot ? JSON.stringify(snapshot).slice(0, 40000) : null,
        resumeUrl: resumeUrl || null,
        timeline: { create: { status: "APPLIED", note: "Application submitted" } },
        answers: givenAnswers.length ? {
          create: givenAnswers.slice(0, 30).map((a: any) => ({
            questionId: String(a.questionId || "").slice(0, 60),
            label: String(a.label || "").slice(0, 300),
            value: String(a.value ?? "").slice(0, 5000),
          })).filter((a: any) => a.questionId),
        } : undefined,
        documents: givenDocs.length ? {
          create: givenDocs.slice(0, 15).map((d: any) => ({
            slotId: String(d.slotId || "").slice(0, 60),
            label: String(d.label || "").slice(0, 200),
            mediaId: String(d.mediaId || "").slice(0, 60),
            filename: d.filename ? String(d.filename).slice(0, 200) : null,
            size: Number(d.size) || 0,
          })).filter((d: any) => d.slotId && d.mediaId),
        } : undefined,
      },
    })
    // Notify applicant
    await createNotification({
      userId: payload.userId,
      title: `Application submitted — ${job.title}`,
      body: `Your application to ${job.company} has been submitted successfully.`,
      link: "/dashboard/applications",
      sendEmail: false,
    })
    // Notify employer
    const applicant = await prisma.user.findUnique({ where:{ id:payload.userId }, select:{ name:true } })
    await createNotification({
      userId: job.postedById,
      title: `New application — ${job.title}`,
      body: `${applicant?.name} has applied for ${job.title}.`,
      link: "/dashboard/recruiter",
      sendEmail: false,
    })
    return NextResponse.json({ success:true, application }, { status:201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}