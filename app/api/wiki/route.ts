import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const id = req.nextUrl.searchParams.get("id")
  if (id) {
    const page = await prisma.wikiPage.findUnique({ where: { id } })
    if (!page || page.ownerId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ page })
  }
  const pages = await prisma.wikiPage.findMany({ where: { ownerId: p.userId }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, projectId: true, updatedAt: true }, take: 300 })
  return NextResponse.json({ pages })
}

export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  // Ownership: if a project is attached, it must belong to the caller.
  if (b.projectId) {
    const pr = await prisma.project.findUnique({ where: { id: String(b.projectId) }, select: { ownerId: true } })
    if (!pr || pr.ownerId !== p.userId) return NextResponse.json({ error: "Not your project." }, { status: 403 })
  }
  if (b.id) {
    const page = await prisma.wikiPage.findUnique({ where: { id: String(b.id) }, select: { ownerId: true } })
    if (!page || page.ownerId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.wikiPage.update({ where: { id: String(b.id) }, data: { title: b.title !== undefined ? String(b.title).slice(0, 200) : undefined, contentMd: b.contentMd !== undefined ? String(b.contentMd).slice(0, 100000) : undefined, updatedById: p.userId } })
    return NextResponse.json({ success: true, id: b.id })
  }
  const title = String(b.title || "").trim()
  if (!title) return NextResponse.json({ error: "Title required." }, { status: 400 })
  const page = await prisma.wikiPage.create({ data: { ownerId: p.userId, projectId: b.projectId ? String(b.projectId) : null, title: title.slice(0, 200), contentMd: b.contentMd ? String(b.contentMd).slice(0, 100000) : "", updatedById: p.userId } })
  return NextResponse.json({ success: true, id: page.id }, { status: 201 })
}
