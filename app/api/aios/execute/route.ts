import { NextRequest, NextResponse } from "next/server"
import { execute } from "@/lib/aios"
import { resolveContext } from "@/lib/capability/context"

export const dynamic = "force-dynamic"

/* AIOS §4.1 — the single AI Execution Gateway endpoint. Every client-initiated AI
 * capability runs through here: resolve identity + capabilities (Module 6) ->
 * execute() (capability resolution, safe-evolution gate, capability authorization,
 * provider, audit, event). */

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  const body = await req.json().catch(() => ({}))
  const capId = String(body?.capId || "")
  if (!capId) return NextResponse.json({ error: "capId required" }, { status: 400 })
  const res = await execute(capId, { subjectId: ctx.userId, caps: [...ctx.capabilities], input: body?.input })
  const status = res.ok ? 200 : res.status === "denied" ? 401 : res.status === "blocked" ? 403 : res.status === "error" && res.error === "Unknown or disabled capability" ? 404 : 422
  return NextResponse.json(res, { status })
}
