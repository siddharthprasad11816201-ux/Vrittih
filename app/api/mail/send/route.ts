import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { toEmail, subject, body } = await req.json()
    if (!toEmail || !subject || !body) return NextResponse.json({ error: "All fields required" }, { status: 400 })
    const recipient = await prisma.user.findUnique({ where: { email: toEmail } })
    if (!recipient) return NextResponse.json({ error: "Recipient not found on this platform" }, { status: 404 })
    if (recipient.id === payload.userId) return NextResponse.json({ error: "Cannot send mail to yourself" }, { status: 400 })
    const mail = await prisma.mail.create({
      data: { fromId: payload.userId, toId: recipient.id, subject, body },
      include: { from: { select:{ name:true } }, to: { select:{ name:true } } },
    })
    await prisma.notification.create({
      data: {
        userId: recipient.id,
        title: `New mail from ${mail.from.name}`,
        body: subject,
        link: "/mail",
      },
    })
    return NextResponse.json({ success: true, mail }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}