import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { hashId, fuzzyNameMatch, decryptVector, euclideanDistance, MATCH_THRESHOLD } from "@/lib/faceVector"
import { encryptVector } from "@/lib/faceVector"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })

    const { idType, idNumber, nameOnDoc, dobOnDoc, faceVectorFromDoc } = await req.json()

    if (!idType || !idNumber || !nameOnDoc) {
      return NextResponse.json({ error: "ID type, number, and name are required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id:true, name:true, faceVector:true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Check duplicate ID
    const idHash = hashId(idNumber)
    const existing = await (prisma as any).identityVerification.findFirst({ where: { idNumberHash: idHash } })
    if (existing && existing.userId !== payload.userId) {
      return NextResponse.json({ error: "This ID document is already registered to another account" }, { status: 409 })
    }

    // Name match
    const nameMatchScore = fuzzyNameMatch(nameOnDoc, user.name)

    // Face match (if doc has face vector)
    let faceMatchScore = 0
    if (faceVectorFromDoc && user.faceVector) {
      const storedVector = decryptVector(user.faceVector)
      const distance = euclideanDistance(faceVectorFromDoc, storedVector)
      faceMatchScore = Math.max(0, 1 - (distance / 1.0))
    }

    const namePass = nameMatchScore >= 0.5
    const facePass = faceVectorFromDoc ? faceMatchScore >= 0.5 : true

    if (!namePass) {
      return NextResponse.json({
        error: `Name on document (${nameOnDoc}) does not match your profile name (${user.name}). Please update your profile name or use a matching document.`,
        nameMatchScore,
      }, { status: 400 })
    }

    // Save verification record — NO document data
    await (prisma as any).identityVerification.upsert({
      where: { userId: payload.userId },
      update: { idType, idNumberHash: idHash, nameOnDoc, nameMatchScore, faceMatchScore, verifiedAt: new Date() },
      create: { userId: payload.userId, idType, idNumberHash: idHash, nameOnDoc, nameMatchScore, faceMatchScore },
    })

    await prisma.user.update({
      where: { id: payload.userId },
      data: { idVerified: true, idType },
    })

    return NextResponse.json({
      success: true,
      nameMatchScore,
      faceMatchScore,
      message: "Identity verified successfully",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}