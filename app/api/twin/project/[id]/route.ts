import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { computeProjectTwin } from "@/lib/twin/compute"

export const dynamic = "force-dynamic"

/* GET /api/twin/project/[id] — the live project twin snapshot (owner/employer only). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const twin = await computeProjectTwin(params.id, ctx.userId)
  if (!twin) return NextResponse.json({ error: "Project not found or not yours." }, { status: 404 })
  return NextResponse.json(twin)
}
