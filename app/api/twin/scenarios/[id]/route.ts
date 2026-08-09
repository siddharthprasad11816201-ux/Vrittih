import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"

export const dynamic = "force-dynamic"

/* DELETE /api/twin/scenarios/[id] — remove a saved scenario (owner only). */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const s = await prisma.twinScenario.findUnique({ where: { id: params.id }, select: { ownerId: true } })
  if (!s || s.ownerId !== ctx.userId) return NextResponse.json({ error: "Not your scenario." }, { status: 403 })
  await prisma.twinScenario.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
