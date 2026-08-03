import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { execute } from "@/lib/aios"

export const dynamic = "force-dynamic"

/* AIOS §4.1 — the single AI Execution Gateway endpoint. Every client-initiated AI
 * capability runs through here: auth -> execute() (capability resolution, safe-
 * evolution gate, authorization, provider, audit, event). */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function POST(req: NextRequest) {
  const p = auth(req)
  const body = await req.json().catch(() => ({}))
  const capId = String(body?.capId || "")
  if (!capId) return NextResponse.json({ error: "capId required" }, { status: 400 })
  const res = await execute(capId, { subjectId: p?.userId ?? null, input: body?.input })
  const status = res.ok ? 200 : res.status === "denied" ? 401 : res.status === "blocked" ? 403 : res.status === "error" && res.error === "Unknown or disabled capability" ? 404 : 422
  return NextResponse.json(res, { status })
}
