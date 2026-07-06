import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { hashPassword, verifyPassword } from "@/lib/hash"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, name: true, email: true, role: true,
        phone: true, location: true, paid: true,
        twoFactorEnabled: true, idVerified: true,
        createdAt: true,
      },
    })
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ user })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const body = await req.json()
    const { action } = body

    if (action === "changePassword") {
      const { currentPassword, newPassword } = body
      if (!currentPassword || !newPassword) return NextResponse.json({ error: "Both passwords required" }, { status: 400 })
      if (newPassword.length < 8) return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 })
      const user = await prisma.user.findUnique({ where: { id: payload.userId } })
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
      const valid = await verifyPassword(currentPassword, user.password)
      if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
      const hashed = await hashPassword(newPassword)
      await prisma.user.update({ where: { id: payload.userId }, data: { password: hashed } })
      return NextResponse.json({ success: true, message: "Password changed successfully" })
    }

    if (action === "updateProfile") {
      const { name, phone, location } = body
      const user = await prisma.user.update({
        where: { id: payload.userId },
        data: { name, phone, location },
        select: { id: true, name: true, phone: true, location: true },
      })
      return NextResponse.json({ success: true, user })
    }

    if (action === "deleteAccount") {
      const { password } = body
      const user = await prisma.user.findUnique({ where: { id: payload.userId } })
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
      const valid = await verifyPassword(password, user.password)
      if (!valid) return NextResponse.json({ error: "Incorrect password" }, { status: 400 })
      await prisma.user.delete({ where: { id: payload.userId } })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}