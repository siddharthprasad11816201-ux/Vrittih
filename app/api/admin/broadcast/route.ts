import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAction } from "@/lib/admin"

/** Send a notification to every user (optionally filtered by role). */
export async function POST(req: NextRequest) {
  try {
    const admin = requireAdmin(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    const { title, body, link, role } = await req.json()
    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "Title and body are required" }, { status: 400 })
    }

    const where: any = { banned: false }
    if (role && role !== "ALL") where.role = role
    const recipients = await prisma.user.findMany({ where, select: { id: true } })

    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((u) => ({
          userId: u.id,
          title: String(title).slice(0, 140),
          body: String(body).slice(0, 1000),
          link: link ? String(link).slice(0, 300) : null,
        })),
      })
    }

    await logAction(admin.userId, "broadcast.send", { role: role || "ALL", count: recipients.length }, req)
    return NextResponse.json({ success: true, sent: recipients.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
