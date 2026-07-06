import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { summary } from "@/lib/analytics"

export const dynamic = "force-dynamic"

// Aggregated analytics summary (signed-in users; full detail for admins).
export async function GET(req: NextRequest) {
  const token = req.cookies.get("er_token")?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const days = Math.min(parseInt(new URL(req.url).searchParams.get("days") || "30"), 365)
  return NextResponse.json(await summary(days))
}
