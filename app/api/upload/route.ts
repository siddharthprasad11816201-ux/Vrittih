import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { isMediaKind, validateUpload, parseDataUrl, type MediaKind } from "@/lib/media"

export const dynamic = "force-dynamic"

// Store an uploaded asset in the database (portable + serverless-safe) and point
// the user's avatar / résumé at a stable /api/media/:id URL.
// Accepts either multipart form-data { file, type } or JSON { kind, dataUrl,
// filename, width, height } — the latter is what the client sends after resizing
// an image in-canvas.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })

    let kind: string, mime: string, buffer: Buffer, filename: string | null = null
    let width: number | null = null, height: number | null = null

    const ct = req.headers.get("content-type") || ""
    if (ct.includes("application/json")) {
      const body = await req.json()
      kind = body.kind || body.type
      const parsed = parseDataUrl(body.dataUrl || "")
      if (!parsed) return NextResponse.json({ error: "Invalid file data" }, { status: 400 })
      mime = parsed.mime; buffer = parsed.buffer
      filename = body.filename || null
      width = Number.isFinite(body.width) ? Math.round(body.width) : null
      height = Number.isFinite(body.height) ? Math.round(body.height) : null
    } else {
      const form = await req.formData()
      const file = form.get("file") as File | null
      kind = String(form.get("type") || form.get("kind") || "")
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
      mime = file.type; buffer = Buffer.from(await file.arrayBuffer()); filename = file.name
    }

    if (!isMediaKind(kind)) return NextResponse.json({ error: "Unknown upload type" }, { status: 400 })
    const err = validateUpload(kind as MediaKind, mime, buffer.length)
    if (err) return NextResponse.json({ error: err }, { status: 400 })

    const asset = await prisma.mediaAsset.create({
      data: { ownerId: payload.userId, kind, mime, size: buffer.length, width, height, filename, data: buffer },
      select: { id: true },
    })
    const url = `/api/media/${asset.id}`

    if (kind === "avatar" || kind === "logo") {
      await prisma.user.update({ where: { id: payload.userId }, data: { avatar: url } })
    } else if (kind === "resume") {
      await prisma.user.update({ where: { id: payload.userId }, data: { resumeUrl: url } })
    }

    return NextResponse.json({ success: true, id: asset.id, url, size: buffer.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 })
  }
}
