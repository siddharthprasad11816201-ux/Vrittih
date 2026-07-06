import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { createNotification } from "@/lib/notify"

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { connectionId, action } = await req.json()
    if (!connectionId || !["ACCEPTED","REJECTED"].includes(action)) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    const connection = await prisma.connection.findFirst({
      where: { id: connectionId, connectedId: payload.userId, status: "PENDING" },
    })
    if (!connection) return NextResponse.json({ error: "Request not found" }, { status: 404 })
    const updated = await prisma.connection.update({
      where: { id: connectionId },
      data: { status: action },
    })
    if (action === "ACCEPTED") {
      const acceptor = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } })
      await createNotification({
        userId: connection.userId,
        title: "Connection accepted",
        body: `${acceptor?.name} accepted your connection request`,
        link: "/network",
        sendEmail: false,
      })
    }
    return NextResponse.json({ success: true, connection: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}