import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"

/* Ultra-light auth check for public/marketing pages: verifies the JWT only — NO
 * database query — so high-traffic pages (the landing) can show "Dashboard" vs
 * "Sign in" without adding connection-pool load. */
export async function GET(req: NextRequest) {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  return NextResponse.json({ authenticated: !!p, role: p?.role || null })
}
