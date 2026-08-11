import { prisma } from "@/lib/prisma"
import { sendMail } from "@/lib/smtp"

/* Notification categories a user can tune. "general" is the catch-all and is always
 * delivered in-app, so a critical message can never be silenced by preferences. */
export const NOTIFICATION_CATEGORIES = [
  "general", "job_alert", "application", "message", "connection", "endorsement", "assessment", "moderation",
] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export function normalizeCategory(v: any): NotificationCategory {
  return (NOTIFICATION_CATEGORIES as readonly string[]).includes(v) ? (v as NotificationCategory) : "general"
}

/** Category defaults, used when the user has no explicit preference row. */
export const CATEGORY_DEFAULTS: Record<NotificationCategory, { inApp: boolean; email: boolean }> = {
  general:     { inApp: true,  email: false },
  job_alert:   { inApp: true,  email: true  },
  application: { inApp: true,  email: true  },
  message:     { inApp: true,  email: false },
  connection:  { inApp: true,  email: false },
  endorsement: { inApp: true,  email: false },
  assessment:  { inApp: true,  email: false },
  moderation:  { inApp: true,  email: false },
}

/**
 * Resolve delivery for a category given a (possibly absent) stored preference. PURE.
 *
 * IMPORTANT semantics, chosen so adding preferences cannot silently break existing sends:
 *  - inApp: falls back to the category default when the user has no preference row.
 *  - emailAllowed: an ABSENT preference means "allowed". The caller passing sendEmail
 *    already decided the message warrants an email; preferences only ever act as an
 *    explicit OPT-OUT. (CATEGORY_DEFAULTS.email describes what a fresh preferences UI
 *    should show as checked — it never suppresses a caller-requested email.)
 *  - "general" is never fully silenced in-app: it carries account-critical messages.
 */
export function resolveDelivery(
  category: NotificationCategory,
  pref: { inApp: boolean; email: boolean } | null | undefined,
): { inApp: boolean; emailAllowed: boolean } {
  const def = CATEGORY_DEFAULTS[category] ?? CATEGORY_DEFAULTS.general
  if (!pref) return { inApp: def.inApp, emailAllowed: true }
  return { inApp: category === "general" ? true : pref.inApp, emailAllowed: pref.email }
}

export interface NotifyPayload {
  userId: string
  title: string
  body: string
  link?: string
  sendEmail?: boolean
  type?: string
}

export async function createNotification(payload: NotifyPayload) {
  const category = normalizeCategory(payload.type)

  // Consult the user preference before writing/emailing. A failure to read prefs must not
  // lose the notification, so it falls back to the category default.
  let pref: { inApp: boolean; email: boolean } | null = null
  try {
    pref = await (prisma as any).notificationPref.findUnique({
      where: { userId_category: { userId: payload.userId, category } },
      select: { inApp: true, email: true },
    })
  } catch { pref = null }
  const delivery = resolveDelivery(category, pref)

  const notification = delivery.inApp
    ? await prisma.notification.create({
        data: {
          userId: payload.userId,
          title: payload.title,
          body: payload.body,
          link: payload.link,
          type: category,
        },
      })
    : null

  // Email when the caller asked for it AND the user has not explicitly opted out.
  if (payload.sendEmail && delivery.emailAllowed) {
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
