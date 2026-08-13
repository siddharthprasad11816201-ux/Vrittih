import { NextRequest, NextResponse } from "next/server"
import { hashLookupToken, isHashedToken } from "@/lib/crypto/storedSecret"
import crypto from "crypto"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { SITE } from "@/lib/site"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/* The subscribable calendar feed URL for the signed-in user. Subscribing (in
 * Google/Outlook/Apple) keeps interviews in sync automatically — the token in the
 * URL is the secret (calendar apps can't send cookies), so treat it like a key. */

/**
 * Issue (or rotate) the feed token.
 *
 * The token is stored HASHED, so the plaintext can be shown exactly ONCE — the same rule
 * the webhook signing secret already follows. Returns null when a feed already exists and
 * we therefore cannot re-display it; the caller offers rotation instead.
 */
async function tokenFor(userId: string, rotate = false): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { calendarToken: true } })
  if (u?.calendarToken && !rotate) {
    // A legacy plaintext token can still be shown; a hashed one cannot be recovered.
    return isHashedToken(u.calendarToken) ? null : u.calendarToken
  }
  const token = crypto.randomBytes(24).toString("base64url")
  await prisma.user.update({ where: { id: userId }, data: { calendarToken: hashLookupToken(token) } })
  return token
}
const urls = (token: string) => {
  const feed = `${SITE.replace(/\/$/, "")}/api/calendar/${token}`
  return { token, feedUrl: feed, webcalUrl: feed.replace(/^https?:\/\//, "webcal://") }
}

export async function GET(req: NextRequest) {
  const p = (() => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null })()
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const token = await tokenFor(p.userId)
  // A hashed token cannot be re-displayed. Say so plainly and offer rotation, rather than
  // showing a broken URL or silently minting a new one the user did not ask for.
  if (!token) {
    return NextResponse.json({
      token: null, feedUrl: null, webcalUrl: null, existing: true,
      note: "A calendar feed already exists. Its address is stored hashed and cannot be shown again — rotate to get a new one (the old subscription will stop working).",
    })
  }
  return NextResponse.json(urls(token))
}

// Rotate the feed token (invalidates any previously shared subscribe URL).
export async function POST(req: NextRequest) {
  const p = (() => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null })()
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const token = await tokenFor(p.userId, true)
  if (!token) return NextResponse.json({ error: "Could not rotate the calendar token." }, { status: 500 })
  return NextResponse.json({ ...urls(token), note: "Save this address now — it is shown only once." })
}
