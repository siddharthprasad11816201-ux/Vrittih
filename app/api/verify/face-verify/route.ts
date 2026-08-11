import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { decryptVector, euclideanDistance, MATCH_THRESHOLD, UNCERTAIN_THRESHOLD } from "@/lib/faceVector"
import { signToken } from "@/lib/jwt"
import { setAuthCookie } from "@/lib/cookies"
import { recordLoginAttempt } from "@/lib/account/loginHistory"
import { verifyChallenge, challengeFrom } from "@/lib/auth/challenge"
import { rateLimit } from "@/lib/ratelimit/store"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { vector, livenessScore, challengePassed } = body

    if (!vector || !Array.isArray(vector) || vector.length !== 128) {
      return NextResponse.json({ error: "Invalid face vector" }, { status: 400 })
    }

    // The user identity comes from the signed post-password challenge, never the body:
    // face was previously a STANDALONE factor (submit a 128-float embedding for any userId
    // and receive a session), so a photo was sufficient to take over an account.
    const chal = verifyChallenge(challengeFrom(body, req), "face")
    if (!chal.valid) return NextResponse.json({ error: "Sign in with your password first." }, { status: 401 })
    const userId = chal.userId as string

    const rl = await rateLimit("auth", userId, { scope: "face", failOpen: false })
    if (!rl.allowed) return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })

    // NOTE ON LIVENESS: challengePassed/livenessScore are CLIENT-ASSERTED and trivially
    // forged, so they are treated as a UX hint only — never as a security control. Real
    // liveness needs server-side verification of a server-issued challenge (e.g. signed
    // frame sequence); until that exists, face is a SECOND factor after the password and
    // is never sufficient on its own. Keep the cheap checks to catch honest client bugs.
    if (!challengePassed) {
      return NextResponse.json({ error: "Liveness challenge not completed" }, { status: 400 })
    }
    if (typeof livenessScore === "number" && livenessScore < 0.7) {
      return NextResponse.json({ error: "Liveness check failed — please use your real face" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id:true, email:true, role:true, paid:true, faceVector:true, banned:true },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (user.banned) return NextResponse.json({ error: "Account suspended" }, { status: 403 })
    if (!user.faceVector) return NextResponse.json({ error: "No face enrolled — please set up face verification first", needsEnroll: true }, { status: 400 })

    const stored = decryptVector(user.faceVector)
    const distance = euclideanDistance(vector, stored)

    if (distance < MATCH_THRESHOLD) {
      // Strong match
      const token = signToken({ userId: user.id, email: user.email, role: user.role, paid: user.paid })
      const res = NextResponse.json({ success: true, match: true, distance, confidence: "HIGH" })
      await setAuthCookie(token)
      await recordLoginAttempt(user.id, user.email, req, true)
      return res
    }

    if (distance < UNCERTAIN_THRESHOLD) {
      // Uncertain — ask about face changes
      return NextResponse.json({
        success: false,
        match: false,
        uncertain: true,
        distance,
        confidence: "LOW",
        message: "Face partially matched — have you experienced any facial changes?",
      })
    }

    // No match
    return NextResponse.json({
      success: false,
      match: false,
      uncertain: false,
      distance,
      confidence: "NONE",
      message: "Face did not match. Please try again or use email OTP.",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}