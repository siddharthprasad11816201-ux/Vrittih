import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"

export async function GET(req: NextRequest) {
  try {
    const admin = requireAdmin(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    const [
      totalUsers, paidUsers, totalJobs, activeJobs,
      totalApplications, totalMessages, recentUsers, recentJobs
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { paid: true } }),
      prisma.job.count(),
      prisma.job.count({ where: { active: true } }),
      prisma.application.count(),
      prisma.message.count(),
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id:true,name:true,email:true,role:true,paid:true,createdAt:true } }),
      prisma.job.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { postedBy:{ select:{ name:true } }, _count:{ select:{ applications:true } } } }),
    ])
    const revenue = paidUsers * 1
    return NextResponse.json({ totalUsers, paidUsers, totalJobs, activeJobs, totalApplications, totalMessages, revenue, recentUsers, recentJobs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}