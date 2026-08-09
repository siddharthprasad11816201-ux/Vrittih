import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { ROLE_TYPES } from "@/lib/recruitment/fulfillment"

export const dynamic = "force-dynamic"
const str = (v: any, n = 200) => String(v ?? "").slice(0, n)
const arr = (v: any): string[] => Array.isArray(v) ? v.map(x => str(x, 60)).filter(Boolean).slice(0, 40) : String(v || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 40)
const isHr = (ctx: any) => ctx.has("admin.access")   // platform staff only

/* Candidate side of managed placement: "place me as intern/full-time/contract". HR works it
 * end-to-end. Candidates see their own; HR sees the whole queue. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const scope = req.nextUrl.searchParams.get("scope")
  const where = (isHr(ctx) && scope !== "mine") ? {} : { userId: ctx.userId }
  const requests = await prisma.placementRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 })
  return NextResponse.json({ requests, isHr: isHr(ctx), roleTypes: ROLE_TYPES })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const b = await req.json()
  const desiredType = (ROLE_TYPES as readonly string[]).includes(String(b.desiredType)) ? String(b.desiredType) : "FULLTIME"
  const created = await prisma.placementRequest.create({
    data: {
      userId: ctx.userId, desiredType,
      targetRoles: JSON.stringify(arr(b.targetRoles)),
      skills: JSON.stringify(arr(b.skills)),
      location: b.location ? str(b.location, 120) : null,
      remote: !!b.remote,
      availability: b.availability ? str(b.availability, 120) : null,
      notes: b.notes ? str(b.notes, 4000) : null,
      status: "OPEN",
    },
  })
  return NextResponse.json({ success: true, id: created.id }, { status: 201 })
}
