import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })

    const isEmployer = ["EMPLOYER","ADMIN","SUPER_ADMIN"].includes(payload.role)

    if (isEmployer) {
      const jobs = await prisma.job.findMany({
        where: { postedById: payload.userId },
        include: {
          applications: {
            select: { id:true, status:true, appliedAt:true }
          },
          _count: { select: { applications:true } }
        }
      })

      const allApps = jobs.flatMap(j => j.applications)
      const appIds = allApps.map(a => a.id)
      const statusCounts: Record<string,number> = {}
      allApps.forEach(a => { statusCounts[a.status] = (statusCounts[a.status]||0)+1 })

      // Applications over last 30 days
      const now = Date.now()
      const days30 = Array.from({length:30},(_,i)=>{
        const d = new Date(now - (29-i)*86400000)
        return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"})
      })
      const appsByDay = days30.map(day => ({
        day,
        count: allApps.filter(a => {
          const d = new Date(a.appliedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})
          return d === day
        }).length
      }))

      // Funnel — derived from the StatusEvent timeline ("ever reached" a stage),
      // never a lossy current-status snapshot (a HIRED app is no longer OFFERED, so
      // snapshots undercount every upper stage). Mirrors lib/intelligence/health.ts
      // and /api/recruitment/analytics. ASSESSMENT/INTERVIEWING count as interview.
      const INTERVIEW_SET = ["INTERVIEW", "INTERVIEWING", "ASSESSMENT"]
      const OFFER_SET = ["OFFERED", "OFFER", "ACCEPTED"]
      const everReached = async (statuses: string[]) => appIds.length
        ? (await prisma.statusEvent.findMany({ where: { status: { in: statuses }, applicationId: { in: appIds } }, distinct: ["applicationId"], select: { applicationId: true }, take: 50000 }).catch(() => [] as any[])).length
        : 0
      const [reachedReviewed, reachedShortlisted, reachedInterview, reachedOffer, reachedHired] = await Promise.all([
        everReached(["REVIEWED", "SCREENING"]),
        everReached(["SHORTLISTED"]),
        everReached(INTERVIEW_SET),
        everReached(OFFER_SET),
        everReached(["HIRED"]),
      ])
      const funnel = [
        { stage:"Applied", count: allApps.length },
        { stage:"Reviewed", count: reachedReviewed },
        { stage:"Shortlisted", count: reachedShortlisted },
        { stage:"Interview", count: reachedInterview },
        { stage:"Offered", count: reachedOffer },
        { stage:"Hired", count: reachedHired },
      ]
      const reached = { interview: reachedInterview, offer: reachedOffer, hired: reachedHired }

      return NextResponse.json({ isEmployer:true, jobs, funnel, appsByDay, statusCounts, reached, totalApps: allApps.length })
    } else {
      const apps = await prisma.application.findMany({
        where: { userId: payload.userId },
        include: { job: { select:{ title:true,company:true,industry:true } } },
        orderBy: { appliedAt: "desc" }
      })

      const statusCounts: Record<string,number> = {}
      apps.forEach(a => { statusCounts[a.status] = (statusCounts[a.status]||0)+1 })

      const byIndustry: Record<string,number> = {}
      apps.forEach(a => { const ind = a.job?.industry||"Other"; byIndustry[ind]=(byIndustry[ind]||0)+1 })

      // Response rate
      const responded = apps.filter(a => a.status !== "APPLIED").length
      const responseRate = apps.length > 0 ? Math.round((responded/apps.length)*100) : 0

      // Activity last 30 days
      const now = Date.now()
      const appsByDay = Array.from({length:30},(_,i)=>{
        const d = new Date(now-(29-i)*86400000)
        const day = d.toLocaleDateString("en-IN",{day:"numeric",month:"short"})
        return { day, count: apps.filter(a=>new Date(a.appliedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})===day).length }
      })

      return NextResponse.json({ isEmployer:false, apps, statusCounts, byIndustry, responseRate, appsByDay, total: apps.length })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}