import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { SITE } from "@/lib/site"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/* The subscribable calendar feed URL for the signed-in user. Subscribing (in
 * Google/Outlook/Apple) keeps interviews in sync automatically — the token in the
 * URL is the secret (calendar apps can't send cookies), so treat it like a key. */

async function tokenFor(userId: string, rotate = false): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { calendarToken: true } })
  if (u?.calendarToken && !rotate) return u.calendarToken
  const token = crypto.randomBytes(24).toString("base64url")
  await prisma.user.update({ where: { id: userId }, data: { calendarToken: token } })
  return token
}
const urls = (token: string) => {
  const feed = `${SITE.replace(/\/$/, "")}/api/calendar/${token}`
  return { token, feedUrl: feed, webcalUrl: feed.replace(/^https?:\/\//, "webcal://") }
}

export async function GET(req: NextRequest) {
  const p = (() => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null })()
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  return NextResponse.json(urls(await tokenFor(p.userId)))
}

// Rotate the feed token (invalidates any previously shared subscribe URL).
export async function POST(req: NextRequest) {
  const p = (() => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null })()
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  return NextResponse.json(urls(await tokenFor(p.userId, true)))
}
