import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { encryptVector, decryptVector, euclideanDistance } from "@/lib/faceVector"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })

    const body = await req.json()
    const { vector, imageBase64, isUpdate, changeReason } = body

    if (!vector || !Array.isArray(vector) || vector.length !== 128) {
      return NextResponse.json({ error: "Invalid face vector — must be 128 dimensions" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // If updating — archive old vector
    if (isUpdate && user.faceVector) {
      await (prisma as any).faceVectorHistory.create({
        data: {
          userId: payload.userId,
          vector: user.faceVector,
          reason: changeReason || "User requested update",
        },
      })
    }

    // Save profile picture if provided
    let avatarUrl = user.avatar
    if (imageBase64) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "")
      const buffer = Buffer.from(base64Data, "base64")
      const dir = path.join(process.cwd(), "public", "uploads", "avatars")
      await mkdir(dir, { recursive: true })
      const filename = `${payload.userId}_face_${Date.now()}.jpg`
      await writeFile(path.join(dir, filename), buffer)
      avatarUrl = `/uploads/avatars/${filename}`
    }

    const encrypted = encryptVector(vector)
    await prisma.user.update({
      where: { id: payload.userId },
      data: {
        faceVector: encrypted,
        faceVectorUpdatedAt: new Date(),
        avatar: avatarUrl,
        faceChangeReported: isUpdate && changeReason ? true : false,
        faceChangeReason: changeReason || null,
        faceChangeDate: isUpdate ? new Date() : null,
      },
    })

    return NextResponse.json({ success: true, avatarUrl })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}