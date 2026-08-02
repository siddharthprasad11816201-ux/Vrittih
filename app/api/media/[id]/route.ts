import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"

// Serve a stored asset's bytes with the right content-type.
// - Public assets (avatar/logo/photo/cover): the random-cuid URL is the access
//   capability; cacheable forever (a new upload gets a new id).
// - PRIVATE assets (career_doc = ICIRE analysis documents): owner-only. We verify
//   the er_token and match ownerId, return 404 otherwise (never confirm existence),
//   and forbid shared/CDN caching.
// - resume/document (shared with recruiters via capability URL): kept accessible,
//   but marked private so shared/CDN caches don't retain the PII.
const PRIVATE = new Set(["career_doc"])
const SENSITIVE = new Set(["resume", "document"])

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: params.id },
    select: { data: true, mime: true, size: true, filename: true, kind: true, ownerId: true },
  })
  if (!asset) return new NextResponse("Not found", { status: 404 })

  if (PRIVATE.has(asset.kind)) {
    const t = req.cookies.get("er_token")?.value
    const p = t ? verifyToken(t) : null
    if (!p || p.userId !== asset.ownerId) return new NextResponse("Not found", { status: 404 })
  }

  const body = Buffer.isBuffer(asset.data) ? asset.data : Buffer.from(asset.data as any)
  const headers: Record<string, string> = {
    "Content-Type": asset.mime || "application/octet-stream",
    "Content-Length": String(asset.size || body.length),
    "Cache-Control": PRIVATE.has(asset.kind)
      ? "private, no-store"
      : SENSITIVE.has(asset.kind)
        ? "private, max-age=0, must-revalidate"
        : "public, max-age=31536000, immutable",
  }
  // documents open inline but keep a sensible download name
  if ((asset.kind === "resume" || asset.kind === "career_doc" || asset.kind === "document") && asset.filename) {
    headers["Content-Disposition"] = `inline; filename="${asset.filename.replace(/[^\w.\-]+/g, "_")}"`
  }
  return new NextResponse(body, { status: 200, headers })
}
