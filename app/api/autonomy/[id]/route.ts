import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"

export const dynamic = "force-dynamic"

/* DELETE /api/autonomy/[id] — owner removes a plan. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const p = await prisma.autonomousPlan.findUnique({ where: { id: params.id }, select: { ownerId: true } })
  if (!p || p.ownerId !== ctx.userId) return NextResponse.json({ error: "Not your plan." }, { status: 403 })
  await prisma.autonomousPlan.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
