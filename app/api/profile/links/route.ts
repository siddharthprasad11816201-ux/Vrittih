import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { PLATFORM_BY_KEY, normalizeUrl, makeToken, verifyOwnership } from "@/lib/social/verify"

export const runtime = "nodejs"          // needs dns + fetch for verification
export const dynamic = "force-dynamic"

function uid(req: NextRequest): string | null {
  const t = req.cookies.get("er_token")?.value
  return t ? verifyToken(t)?.userId ?? null : null
}
const shape = (l: any) => ({ id: l.id, platform: l.platform, url: l.url, verified: l.verified, verifyToken: l.verifyToken, verifiedAt: l.verifiedAt })

// List the signed-in user's professional links.
export async function GET(req: NextRequest) {
  const id = uid(req); if (!id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const links = await prisma.socialLink.findMany({ where: { userId: id }, orderBy: { createdAt: "asc" } })
  return NextResponse.json({ links: links.map(shape) })
}

// Add a link (issues a verification token; starts unverified).
export async function POST(req: NextRequest) {
  const id = uid(req); if (!id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { platform, url } = await req.json().catch(() => ({}))
  const p = PLATFORM_BY_KEY.get(String(platform || ""))
  if (!p) return NextResponse.json({ error: "Choose a valid platform." }, { status: 400 })
  let normalized: string
  try { normalized = normalizeUrl(String(url || "")) } catch (e: any) { return NextResponse.json({ error: e.message || "Invalid URL." }, { status: 400 }) }
  if (p.host && !p.host.test(new URL(normalized).hostname)) {
    return NextResponse.json({ error: `That doesn't look like a ${p.label} URL.` }, { status: 400 })
  }
  const existing = await prisma.socialLink.findFirst({ where: { userId: id, platform: p.key, url: normalized } })
  if (existing) return NextResponse.json({ error: "You've already added that link." }, { status: 409 })
  const link = await prisma.socialLink.create({ data: { userId: id, platform: p.key, url: normalized, verifyToken: makeToken() } })
  return NextResponse.json({ link: shape(link) })
}

// Verify ownership: fetch the page and check the token is present.
export async function PATCH(req: NextRequest) {
  const id = uid(req); if (!id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { id: linkId } = await req.json().catch(() => ({}))
  const link = await prisma.socialLink.findUnique({ where: { id: String(linkId || "") } })
  if (!link || link.userId !== id) return NextResponse.json({ error: "Link not found." }, { status: 404 })

  const r = await verifyOwnership(link.url, link.verifyToken)
  const updated = await prisma.socialLink.update({
    where: { id: link.id },
    data: { verified: r.verified, verifiedAt: r.verified ? new Date() : link.verifiedAt, lastCheckedAt: new Date() },
  })
  return NextResponse.json({ link: shape(updated), verified: r.verified, reason: r.reason })
}

export async function DELETE(req: NextRequest) {
  const id = uid(req); if (!id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { id: linkId } = await req.json().catch(() => ({}))
  const link = await prisma.socialLink.findUnique({ where: { id: String(linkId || "") } })
  if (!link || link.userId !== id) return NextResponse.json({ error: "Link not found." }, { status: 404 })
  await prisma.socialLink.delete({ where: { id: link.id } })
  return NextResponse.json({ ok: true })
}
