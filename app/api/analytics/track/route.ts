import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { track } from "@/lib/analytics"

export const dynamic = "force-dynamic"

// Record a client-side analytics event. Associates the signed-in user if present.
export async function POST(req: NextRequest) {
  try {
    const { name, props } = await req.json()
    if (!name || typeof name !== "string") return NextResponse.json({ error: "name required" }, { status: 400 })
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    await track(name.slice(0, 80), (props && typeof props === "object") ? props : {}, payload?.userId)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
