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
    return NextResponse.json({ success: true, verified: challengeCompleted === true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}