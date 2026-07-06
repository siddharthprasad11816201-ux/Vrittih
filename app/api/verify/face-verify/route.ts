import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { decryptVector, euclideanDistance, MATCH_THRESHOLD, UNCERTAIN_THRESHOLD } from "@/lib/faceVector"
import { signToken } from "@/lib/jwt"
import { setAuthCookie } from "@/lib/cookies"

export async function POST(req: NextRequest) {
  try {
    const { vector, userId, livenessScore, challengePassed } = await req.json()

    if (!vector || !Array.isArray(vector) || vector.length !== 128) {
      return NextResponse.json({ error: "Invalid face vector" }, { status: 400 })
    }

    if (!challengePassed) {
      return NextResponse.json({ error: "Liveness challenge not completed" }, { status: 400 })
    }

    if (livenessScore < 0.7) {
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