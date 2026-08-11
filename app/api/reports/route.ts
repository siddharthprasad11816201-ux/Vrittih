import { NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/lib/ratelimit/store"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { isValidReason, isValidTarget } from "@/lib/social/engage"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

// Report a post / comment / user / job / company. One open report per user per target.
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const rl = await rateLimit("report", payload.userId)
    if (!rl.allowed) return NextResponse.json({ error: "Too many reports submitted. Please wait." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })
    const body = await req.json()
    const targetType = String(body?.targetType || "")
    const targetId = String(body?.targetId || "")
    const reason = String(body?.reason || "")
    const detail = typeof body?.detail === "string" ? body.detail.trim().slice(0, 1000) : null
    if (!isValidTarget(targetType)) return NextResponse.json({ error: "Invalid target type" }, { status: 400 })
    if (!targetId) return NextResponse.json({ error: "targetId is required" }, { status: 400 })
    if (!isValidReason(reason)) return NextResponse.json({ error: "Invalid reason" }, { status: 400 })
    if (targetType === "user" && targetId === payload.userId) {
      return NextResponse.json({ error: "You cannot report yourself" }, { status: 400 })
    }

    // Re-reporting the same target is a no-op rather than an error, so the UI stays simple.
    const existing = await (prisma as any).report.findUnique({
      where: { reporterId_targetType_targetId: { reporterId: payload.userId, targetType, targetId } },
    })
    if (existing) return NextResponse.json({ ok: true, alreadyReported: true })

    await (prisma as any).report.create({
      data: { reporterId: payload.userId, targetType, targetId, reason, detail },
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
