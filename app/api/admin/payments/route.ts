import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ci } from "@/lib/db"
import { requireAdmin, requireSuperAdmin, logAction } from "@/lib/admin"
import { getSetting } from "@/lib/settings"

export async function GET(req: NextRequest) {
  try {
    const admin = requireAdmin(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = 20
    const where: any = { paid: true }
    if (q) where.OR = [{ name: ci(q) }, { email: ci(q) }]

    const [payments, paidCount, total, fee, currency] = await Promise.all([
      prisma.user.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { paidAt: "desc" },
        select: { id: true, name: true, email: true, role: true, paymentId: true, paidAt: true },
      }),
      prisma.user.count({ where: { paid: true } }),
      prisma.user.count({ where }),
      getSetting("joiningFee"),
      getSetting("currency"),
    ])

    const unitFee = Number(fee) || 0
    return NextResponse.json({
      payments, total, pages: Math.ceil(total / limit),
      revenue: paidCount * unitFee, paidCount, fee: unitFee, currency,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = requireSuperAdmin(req)
    if (!admin) return NextResponse.json({ error: "Super-admin privileges required" }, { status: 403 })
    const { userId, action } = await req.json()
    if (action !== "refund") return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    const user = await prisma.user.update({
      where: { id: userId },
      data: { paid: false, paidAt: null, paymentId: null },
      select: { id: true, name: true, paid: true },
    })
    await logAction(admin.userId, "payment.refund", { userId }, req)
    return NextResponse.json({ success: true, user })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
