import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"

export async function GET(req: NextRequest) {
  try {
    const admin = requireAdmin(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    const [logs, logins] = await Promise.all([
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" }, take: 60,
        include: { user: { select: { name: true, email: true, role: true } } },
      }),
      prisma.loginAttempt.findMany({
        orderBy: { createdAt: "desc" }, take: 30,
      }),
    ])
    return NextResponse.json({ logs, logins })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
