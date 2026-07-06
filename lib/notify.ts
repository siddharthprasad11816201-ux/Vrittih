import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/smtp"

export interface NotifyPayload {
  userId: string
  title: string
  body: string
  link?: string
  sendEmail?: boolean
}

export async function createNotification(payload: NotifyPayload) {
  const notification = await prisma.notification.create({
    data: {
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      link: payload.link,
    },
  })

  if (payload.sendEmail) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { email: true, name: true },
      })
      if (user?.email) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vrittih.online"
        await sendMail({
          to: user.email,
          subject: payload.title,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#F8F8FC;border-radius:16px">
              <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid rgba(0,0,0,.08)">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
                  <div style="width:36px;height:36px;background:#0F6E56;border-radius:9px;display:flex;align-items:center;justify-content:center">
                    <span style="color:#fff;font-size:15px;font-weight:700">V</span>
                  </div>
                  <span style="font-size:16px;font-weight:600;color:#0A0A0F">Vrittih</span>
                </div>
                <h2 style="font-size:20px;font-weight:600;color:#0A0A0F;margin:0 0 10px">${payload.title}</h2>
                <p style="font-size:15px;color:#3D3D4E;line-height:1.65;margin:0 0 20px">${payload.body}</p>
                ${payload.link ? `<a href="${appUrl}${payload.link}" style="display:inline-block;background:#0F6E56;color:#fff;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:500;text-decoration:none">View update</a>` : ""}
                <hr style="margin:24px 0;border:none;border-top:1px solid rgba(0,0,0,.07)" />
                <p style="font-size:12px;color:#9ca3af;margin:0">You received this because you have a Vrittih account. <a href="${appUrl}/settings" style="color:#0F6E56">Manage notifications</a></p>
              </div>
            </div>
          `,
        })
      }
    } catch (err: any) {
      console.error("[EMAIL]", err?.message || err)
    }
  }

  return notification
}
