import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { inputFromUser } from "@/lib/career/fromUser"
import { careerDirection } from "@/lib/career/direction"

export const dynamic = "force-dynamic"

/* ICIRE — evidence-based career direction for the signed-in applicant. Computed
 * in-house from their REAL skills + experience (no astrology, no LLM). Replaces the
 * birth-chart "best-fit career direction" as the primary career signal. */
export async function GET(req: NextRequest) {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const direction = careerDirection(await inputFromUser(p.userId))
    return NextResponse.json({ direction })
  } catch (e: any) {
    return NextResponse.json({ error: "temporary" }, { status: 503 })
  }
}
