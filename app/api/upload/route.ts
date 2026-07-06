import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const formData = await req.formData()
    const file = formData.get("file") as File
    const type = formData.get("type") as string
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    const allowed = type === "resume"
      ? ["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
      : ["image/jpeg","image/png","image/webp"]
    if (!allowed.includes(file.type)) return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 })
    const ext = file.name.split(".").pop()
    const filename = `${payload.userId}_${type}_${Date.now()}.${ext}`
    const dir = path.join(process.cwd(), "public", "uploads", type === "resume" ? "resumes" : "avatars")
    await mkdir(dir, { recursive: true })
    const bytes = await file.arrayBuffer()
    await writeFile(path.join(dir, filename), Buffer.from(bytes))
    const url = `/uploads/${type === "resume" ? "resumes" : "avatars"}/${filename}`
    const { prisma } = await import("@/lib/prisma")
    if (type === "resume") {
      await prisma.user.update({ where: { id: payload.userId }, data: { resumeUrl: url } })
    } else {
      await prisma.user.update({ where: { id: payload.userId }, data: { avatar: url } })
    }
    return NextResponse.json({ success: true, url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}