import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { createNotification } from "@/lib/notify"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { recipientId } = await req.json()
    if (!recipientId) return NextResponse.json({ error: "Recipient required" }, { status: 400 })
    if (recipientId === payload.userId) return NextResponse.json({ error: "Cannot connect with yourself" }, { status: 400 })
    const existing = await prisma.connection.findFirst({
      where: {
        OR: [
          { userId: payload.userId, connectedId: recipientId },
          { userId: recipientId, connectedId: payload.userId },
        ],
      },
    })
    if (existing) return NextResponse.json({ error: "Connection already exists" }, { status: 409 })
    const connection = await prisma.connection.create({
      data: { userId: payload.userId, connectedId: recipientId, status: "PENDING" },
    })
    const sender = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } })
    await createNotification({
      userId: recipientId,
      title: "New connection request",
      body: `${sender?.name} wants to connect with you`,
      link: "/network",
      sendEmail: false,
    })
    return NextResponse.json({ success: true, connection }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}