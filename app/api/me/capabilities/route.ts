import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"

export const dynamic = "force-dynamic"

/* Phase 1 · Module 6 — the subject's capability set for the current request. The
 * frontend (Navigation Composer, Dashboard/Widget Composer) gates purely on these
 * capabilities — never on role. `persona` is a display hint derived from
 * capabilities, not an authorization signal. */
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  const caps = [...ctx.capabilities]
  const persona = !ctx.userId ? "guest" : ctx.has("admin.access") ? "admin" : ctx.has("jobs.post") ? "employer" : "seeker"
  return NextResponse.json({
    authenticated: !!ctx.userId,
    identity: ctx.user ? { id: ctx.user.id, name: ctx.user.name } : null,
    persona,
    capabilities: caps,
  })
}
