import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { runCode, sandboxStatus, LANGUAGES } from "@/lib/sandbox"
import { rateLimit } from "@/lib/ratelimit/store"
import { reserveQuota } from "@/lib/quota/reserve"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
// Compiling and running code is slow; give it room but stay under platform limits.
export const maxDuration = 60

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

// What can be run, and whether execution is actually available right now. The UI reads the
// language list from here rather than hard-coding it.
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const status = await sandboxStatus()
  return NextResponse.json({
    ...status,
    languageDetails: Object.values(LANGUAGES).map((l) => ({ id: l.id, label: l.label })),
  })
}

// Execute untrusted candidate code in an isolated runner.
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  // Execution is expensive and abusable: throttle before doing any work.
  const rl = await rateLimit("assessment_answer", payload.userId, { scope: "sandbox" })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many runs. Please wait a moment." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } })
  }

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }

  // Reserve quota BEFORE running, release if the run never happened, so a crash cannot
  // silently consume the caller's budget.
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, role: true, plan: true } })
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 401 })
  const reservation = await reserveQuota(user, "ai_calls_per_month")
  if (!reservation.verdict.allowed) {
    return NextResponse.json({ error: "You have reached your plan limit for this month.", quota: reservation.verdict }, { status: 402 })
  }

  try {
    const result = await runCode({
      language: body?.language,
      source: body?.source,
      stdin: body?.stdin,
      // Hidden test cases may only come from the server-side problem definition, never from
      // the client — otherwise a candidate could submit tests their own code passes.
      tests: Array.isArray(body?.tests) ? body.tests.map((t: any) => ({ ...t, hidden: false })) : undefined,
      limits: body?.limits,
    })

    // A rejected request or an unavailable runner did no work — give the budget back.
    if (result.status === "rejected" || result.status === "unavailable") {
      await reservation.release()
      return NextResponse.json(result, { status: result.status === "rejected" ? 400 : 503 })
    }
    await reservation.commit()
    return NextResponse.json(result)
  } catch (err: any) {
    await reservation.release()
    // Never report a failure as a successful run.
    return NextResponse.json({ error: "Execution failed.", detail: String(err?.message || err) }, { status: 500 })
  }
}
