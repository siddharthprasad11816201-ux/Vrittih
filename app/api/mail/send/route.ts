import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { featureGate } from "@/lib/guard"
import { sendSignedEmail } from "@/lib/mailer"

export async function POST(req: NextRequest) {
  const gate = await featureGate(req, "mail"); if (gate instanceof NextResponse) return gate
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { toEmail, subject, body, fromDomain, fromLocalPart } = await req.json()
    if (!toEmail || !subject || !body) return NextResponse.json({ error: "All fields required" }, { status: 400 })

    const recipient = await prisma.user.findUnique({ where: { email: toEmail } })
    const wantsExternal = !!fromDomain

    // Internal delivery: the recipient is a platform user and the sender is not
    // explicitly sending from one of their verified domains → an in-app Mail row.
    if (recipient && !wantsExternal) {
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
      return NextResponse.json({ success: true, delivery: "internal", mail }, { status: 201 })
    }

    // External delivery: the recipient is off-platform, or the sender opted to
    // send from their verified domain. Sign with the domain's DKIM key and hand
    // the raw message to the SMTP relay — success is only reported if a real
    // send actually ran (see lib/mailer.sendSignedEmail).
    const sender = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true, email: true } })
    if (!sender) return NextResponse.json({ error: "Invalid session" }, { status: 401 })

    const domainRecord = fromDomain
      ? await prisma.emailDomain.findUnique({ where: { domain: String(fromDomain).toLowerCase().trim() } })
      : await prisma.emailDomain.findFirst({ where: { userId: payload.userId, verified: true }, orderBy: { createdAt: "desc" } })

    if (!domainRecord || domainRecord.userId !== payload.userId) {
      return NextResponse.json({ error: `${toEmail} is not on this platform. To email external recipients, add and verify a sending domain in Settings → Email domains.` }, { status: 400 })
    }
    if (!domainRecord.verified) {
      return NextResponse.json({ error: `Domain ${domainRecord.domain} is not verified yet — publish its DNS records and verify it before sending from it.` }, { status: 400 })
    }

    const localPart = String(fromLocalPart || sender.email.split("@")[0] || "no-reply").toLowerCase().replace(/[^a-z0-9._-]/g, "") || "no-reply"

    try {
      const result = await sendSignedEmail(payload.userId, {
        fromName: sender.name || domainRecord.domain,
        fromLocalPart: localPart,
        domain: domainRecord.domain,
        toEmail,
        subject,
        body,
      })
      if (!result.delivered) return NextResponse.json({ error: `The mail server did not accept the message: ${result.detail}` }, { status: 502 })
      return NextResponse.json({ success: true, delivery: "external", dkim: result.dkim, from: result.fromAddress, to: toEmail }, { status: 201 })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 502 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
