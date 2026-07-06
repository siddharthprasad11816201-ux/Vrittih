import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireSuperAdmin, logAction } from "@/lib/admin"
import { signToken, verifyToken } from "@/lib/jwt"

const TOKEN = "er_token"
const ADMIN_TOKEN = "er_admin_token"
const WEEK = 60 * 60 * 24 * 7

function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: WEEK,
  }
}

/** Start impersonating a user: stash the super-admin token, swap in the target's token. */
export async function POST(req: NextRequest) {
  try {
    const admin = requireSuperAdmin(req)
    if (!admin) return NextResponse.json({ error: "Super-admin privileges required" }, { status: 403 })
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    if (userId === admin.userId) return NextResponse.json({ error: "You are already this user" }, { status: 400 })

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, paid: true, name: true },
    })
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const currentToken = req.cookies.get(TOKEN)?.value!
    const targetToken = signToken({ userId: target.id, email: target.email, role: target.role, paid: target.paid })

    await logAction(admin.userId, "user.impersonate", { userId }, req)

    const res = NextResponse.json({ success: true, user: { id: target.id, name: target.name, role: target.role } })
    res.cookies.set(ADMIN_TOKEN, currentToken, cookieOpts())
    res.cookies.set(TOKEN, targetToken, cookieOpts())
    // Readable (non-httpOnly) marker so the UI can show a "return to admin" banner.
    res.cookies.set("er_impersonating", target.name || "user", { ...cookieOpts(), httpOnly: false })
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/** Stop impersonating: restore the stashed super-admin token. */
export async function DELETE(req: NextRequest) {
  try {
    const adminToken = req.cookies.get(ADMIN_TOKEN)?.value
    if (!adminToken) return NextResponse.json({ error: "Not impersonating" }, { status: 400 })
    const payload = verifyToken(adminToken)
    if (!payload || payload.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Invalid impersonation session" }, { status: 403 })
    }
    const res = NextResponse.json({ success: true })
    res.cookies.set(TOKEN, adminToken, cookieOpts())
    res.cookies.delete(ADMIN_TOKEN)
    res.cookies.delete("er_impersonating")
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
