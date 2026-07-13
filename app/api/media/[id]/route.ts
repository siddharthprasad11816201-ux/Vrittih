import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Serve a stored asset's bytes with the right content-type. IDs are random cuids
// (unguessable), so the URL itself is the access capability — the same model as
// any signed/shared file link. Long immutable cache: an asset never changes (a new
// upload gets a new id), so browsers and CDNs can hold it forever.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: params.id },
    select: { data: true, mime: true, size: true, filename: true, kind: true },
  })
  if (!asset) return new NextResponse("Not found", { status: 404 })

  const body = Buffer.isBuffer(asset.data) ? asset.data : Buffer.from(asset.data as any)
  const headers: Record<string, string> = {
    "Content-Type": asset.mime || "application/octet-stream",
    "Content-Length": String(asset.size || body.length),
    "Cache-Control": "public, max-age=31536000, immutable",
  }
  // documents open inline but keep a sensible download name
  if (asset.kind === "resume" && asset.filename) {
    headers["Content-Disposition"] = `inline; filename="${asset.filename.replace(/[^\w.\-]+/g, "_")}"`
  }
  return new NextResponse(body, { status: 200, headers })
}
