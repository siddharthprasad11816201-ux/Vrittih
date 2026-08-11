import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import crypto from "crypto"

const CHALLENGES = [
  "Blink twice slowly",
  "Turn your head slightly to the left",
  "Nod once",
  "Look up briefly then back",
  "Smile naturally",
]

// NOTE: state was a module-level Map, which is lost between serverless invocations, so
// a challenge issued by one lambda was invisible to the next. It is kept only as a UX
// prompt store; it is NOT a security control (see POST).
const pendingChallenges = new Map<string, { challenge: string; expiresAt: number }>()

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 })
    const challenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]
    const token = crypto.randomBytes(16).toString("hex")
    pendingChallenges.set(userId, { challenge, expiresAt: Date.now() + 120000 })
    return NextResponse.json({ challenge, token })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, challengeCompleted } = await req.json()
    const pending = pendingChallenges.get(userId)
    if (!pending) return NextResponse.json({ error: "No active challenge" }, { status: 400 })
    if (Date.now() > pending.expiresAt) {
      pendingChallenges.delete(userId)
      return NextResponse.json({ error: "Challenge expired" }, { status: 400 })
    }
    pendingChallenges.delete(userId)
    // HONESTY: this endpoint cannot verify liveness. It never inspects a frame or video —
    // it only sees a boolean the client chose to send. Returning that boolean as
    // "verified" would misrepresent an unverified claim as a verification, so the response
    // now states plainly that this is an unverified client assertion. Real liveness needs
    // server-side analysis of media captured against a server-issued nonce; until that
    // exists, /api/verify/face-verify treats face strictly as a SECOND factor after the
    // password and never as proof of presence.
    return NextResponse.json({
      success: true,
      verified: false,
      clientAsserted: challengeCompleted === true,
      note: "Liveness is not server-verified. This response records a client assertion only.",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}