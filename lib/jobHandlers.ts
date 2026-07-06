/**
 * Registers all background-job handlers. Imported (for side effects) by the
 * worker-tick route so handlers exist wherever the queue is drained.
 */
import { prisma } from "@/lib/prisma"
import { registerHandler } from "@/lib/jobs"

let registered = false
export function ensureHandlers() {
  if (registered) return
  registered = true

  // Create a single in-app notification.
  registerHandler("notification.create", async (p: { userId: string; title: string; body?: string; link?: string }) => {
    if (!p?.userId || !p?.title) throw new Error("notification.create requires userId + title")
    const n = await prisma.notification.create({ data: { userId: p.userId, title: p.title, body: p.body || "", link: p.link || null } })
    return { notificationId: n.id }
  })

  // Fan-out a notification to many users (e.g. admin broadcast).
  registerHandler("notification.broadcast", async (p: { userIds: string[]; title: string; body?: string; link?: string }) => {
    const ids = Array.isArray(p?.userIds) ? p.userIds : []
    if (!ids.length || !p?.title) throw new Error("notification.broadcast requires userIds + title")
    await prisma.notification.createMany({ data: ids.map((userId) => ({ userId, title: p.title, body: p.body || "", link: p.link || null })) })
    return { count: ids.length }
  })

  // Send an email via the in-house SMTP client (best-effort; retried by the queue on failure).
  registerHandler("email.send", async (p: { to: string; subject: string; html?: string; text?: string }) => {
    if (!p?.to || !p?.subject) throw new Error("email.send requires to + subject")
    const { sendMail } = await import("@/lib/smtp")
    const res = await sendMail({ to: p.to, subject: p.subject, html: p.html, text: p.text })
    if (!res) throw new Error("SMTP relay not configured")
    return { code: res.code }
  })

  // Internal self-test handlers (used by health checks + the queue E2E test).
  registerHandler("_selftest.ok", async (p: any) => ({ echoed: p ?? null }))
  registerHandler("_selftest.fail", async () => { throw new Error("intentional test failure") })
}
