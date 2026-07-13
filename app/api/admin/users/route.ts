import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ci } from "@/lib/db"
import { requireAdmin, requireSuperAdmin, logAction } from "@/lib/admin"
import { hashPassword } from "@/lib/hash"

const VALID_ROLES = ["JOBSEEKER", "EMPLOYER", "ADMIN", "SUPER_ADMIN"]

export async function GET(req: NextRequest) {
  try {
    const admin = requireAdmin(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""
    const role = searchParams.get("role") || ""
    const paid = searchParams.get("paid")
    const banned = searchParams.get("banned")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = 20
    const where: any = {}
    if (q) where.OR = [{ name: ci(q) }, { email: ci(q) }]
    if (role) where.role = role
    if (paid === "true") where.paid = true
    if (paid === "false") where.paid = false
    if (banned === "true") where.banned = true
    if (banned === "false") where.banned = false
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, email: true, role: true, paid: true, paidAt: true,
          idVerified: true, banned: true, createdAt: true, location: true,
          _count: { select: { applications: true, jobs: true } },
        },
      }),
      prisma.user.count({ where }),
    ])
    return NextResponse.json({ users, total, pages: Math.ceil(total / limit) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = requireAdmin(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    const { userId, action, role, newPassword } = await req.json()
    if (!userId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    // Actions that grant/remove power or are destructive require SUPER_ADMIN.
    const superOnly = ["setRole", "ban", "unban", "resetPassword"]
    if (superOnly.includes(action) && !requireSuperAdmin(req)) {
      return NextResponse.json({ error: "Super-admin privileges required" }, { status: 403 })
    }
    // Never let an admin lock themselves out or self-escalate via these actions.
    if (userId === admin.userId && ["setRole", "ban", "unban"].includes(action)) {
      return NextResponse.json({ error: "You cannot perform this action on your own account" }, { status: 400 })
    }

    let update: any = {}
    switch (action) {
      case "verify": update = { idVerified: true }; break
      case "unverify": update = { idVerified: false }; break
      case "markPaid": update = { paid: true, paidAt: new Date() }; break
      case "unpay": update = { paid: false, paidAt: null }; break
      case "ban": update = { banned: true }; break
      case "unban": update = { banned: false }; break
      case "setRole":
        if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 })
        update = { role }; break
      case "resetPassword":
        if (!newPassword || String(newPassword).length < 8)
          return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
        update = { password: await hashPassword(String(newPassword)) }; break
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: userId }, data: update,
      select: { id: true, name: true, role: true, paid: true, idVerified: true, banned: true },
    })
    await logAction(admin.userId, `user.${action}`, { userId, role, by: admin.role }, req)
    return NextResponse.json({ success: true, user })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = requireSuperAdmin(req)
    if (!admin) return NextResponse.json({ error: "Super-admin privileges required" }, { status: 403 })
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    if (userId === admin.userId) return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 })
    await prisma.user.delete({ where: { id: userId } })
    await logAction(admin.userId, "user.delete", { userId }, req)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
