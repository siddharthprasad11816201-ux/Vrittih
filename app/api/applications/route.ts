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
    const { jobId, coverLetter } = await req.json()
    if (!jobId) return NextResponse.json({ error: "Job ID required" }, { status: 400 })
    const existing = await prisma.application.findFirst({ where:{ userId:payload.userId, jobId } })
    if (existing) return NextResponse.json({ error: "Already applied" }, { status: 409 })
    const job = await prisma.job.findUnique({ where:{ id:jobId }, include:{ postedBy:{ select:{ id:true,name:true } } } })
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
    const application = await prisma.application.create({
      data: { userId:payload.userId, jobId, coverLetter, status:"APPLIED", timeline:{ create:{ status:"APPLIED", note:"Application submitted" } } }
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