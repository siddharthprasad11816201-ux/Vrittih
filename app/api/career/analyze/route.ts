import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer, type AnalyzeInput } from "@/lib/career/engine"
import { refreshCareer } from "@/lib/career/refresh"

export const dynamic = "force-dynamic"

/* ICIRE — (re)compute the applicant's Career Intelligence profile (§20 continuous
 * learning: call this after any new upload). In-house, no LLM.
 * POST body:
 *   {}            -> analyze the logged-in user's data and PERSIST the profile
 *   { input }     -> analyze the given AnalyzeInput and return it WITHOUT persisting
 *                    (self-analysis / preview) */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const body = await req.json().catch(() => ({}))

  // Preview / self-analysis mode — analyze provided text, do not persist.
  if (body.input && typeof body.input === "object") {
    return NextResponse.json({ ok: true, persisted: false, analysis: analyzeCareer(body.input as AnalyzeInput) })
  }

  const analysis = await refreshCareer(p.userId, "manual")
  return NextResponse.json({ ok: true, persisted: true, analysis })
}
