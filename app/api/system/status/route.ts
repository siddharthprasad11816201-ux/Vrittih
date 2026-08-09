import { NextRequest, NextResponse } from "next/server"
import { getSetting } from "@/lib/settings"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"

/* Public platform status. `blocked` is true only when maintenance mode is on AND
 * the caller is not a platform admin — the shared AppShell reads this to route
 * non-admins to /maintenance while admins keep full access to switch it back off. */
export async function GET(req: NextRequest) {
  const maintenance = await getSetting("maintenanceMode").then(v => v === "true").catch(() => false)
  let isAdmin = false
  if (maintenance) {
    const token = req.cookies.get("er_token")?.value
    if (token) {
      const p = verifyToken(token)
      if (p && (p.role === "ADMIN" || p.role === "SUPER_ADMIN")) isAdmin = true
    }
  }
  return NextResponse.json({ maintenance, blocked: maintenance && !isAdmin })
}
