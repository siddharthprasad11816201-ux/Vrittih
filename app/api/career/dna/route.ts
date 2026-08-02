import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer } from "@/lib/career/engine"
import { computeCareerDNA } from "@/lib/career/dna"
import { inputFromUser } from "@/lib/career/fromUser"

export const dynamic = "force-dynamic"

/* ICIRE §6 — the logged-in applicant's Career DNA: archetype, explainable
 * dimension meters, category lean and a template narrative — all from real
 * evidence, no LLM. */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const input = await inputFromUser(p.userId)
  const analysis = analyzeCareer(input)
  const experienceMonths = (input.experiences || []).reduce((n, e) => n + (e.months || 0), 0)
  const roleTitles = (input.experiences || []).map((e) => e.title).filter(Boolean)
  const dna = computeCareerDNA(analysis, { experienceMonths, roleTitles })
  return NextResponse.json({ dna })
}
