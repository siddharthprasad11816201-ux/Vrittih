import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"

export const dynamic = "force-dynamic"

/* POST /api/marketplace/[slug]/install — toggle install for the caller. The installs
 * counter tracks real installs (adjusted here, never fabricated). */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const item = await prisma.marketplaceItem.findUnique({ where: { slug: params.slug }, select: { id: true, installs: true } })
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

  const existing = await prisma.marketplaceInstall.findUnique({ where: { itemId_userId: { itemId: item.id, userId: ctx.userId } }, select: { id: true } })
  if (existing) {
    await prisma.marketplaceInstall.delete({ where: { id: existing.id } })
    await prisma.marketplaceItem.update({ where: { id: item.id }, data: { installs: { decrement: 1 } } })
    return NextResponse.json({ success: true, installed: false, installs: Math.max(0, item.installs - 1) })
  }
  await prisma.marketplaceInstall.create({ data: { itemId: item.id, userId: ctx.userId } })
  await prisma.marketplaceItem.update({ where: { id: item.id }, data: { installs: { increment: 1 } } })
  return NextResponse.json({ success: true, installed: true, installs: item.installs + 1 })
}
