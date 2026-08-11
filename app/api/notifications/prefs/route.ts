import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { NOTIFICATION_CATEGORIES, CATEGORY_DEFAULTS, normalizeCategory, resolveDelivery } from "@/lib/notify"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

// Every category with the caller's effective setting (stored row, else the default).
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const rows = await (prisma as any).notificationPref.findMany({ where: { userId: payload.userId } })
  const byCat = Object.fromEntries(rows.map((r: any) => [r.category, r]))
  return NextResponse.json({
    categories: NOTIFICATION_CATEGORIES.map((category) => {
      const stored = byCat[category]
      const eff = resolveDelivery(category, stored)
      return {
        category,
        inApp: eff.inApp,
        email: stored ? stored.email : CATEGORY_DEFAULTS[category].email,
        // "general" carries account-critical messages and cannot be turned off in-app.
        locked: category === "general",
        customized: !!stored,
      }
    }),
  })
}

// Update one category's preferences.
export async function PATCH(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const body = await req.json()
    const category = normalizeCategory(body?.category)
    if (body?.category && category !== body.category) {
      return NextResponse.json({ error: "Unknown category" }, { status: 400 })
    }
    const inApp = category === "general" ? true : body?.inApp !== false
    const email = body?.email === true
    await (prisma as any).notificationPref.upsert({
      where: { userId_category: { userId: payload.userId, category } },
      create: { userId: payload.userId, category, inApp, email },
      update: { inApp, email },
    })
    return NextResponse.json({ ok: true, category, inApp, email })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
