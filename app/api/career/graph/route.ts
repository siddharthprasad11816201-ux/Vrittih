import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { inputFromUser } from "@/lib/career/fromUser"
import { buildCandidateGraph } from "@/lib/talent/candidateGraph"

export const dynamic = "force-dynamic"

/* ICIRE §15 — the signed-in applicant's knowledge graph: skills, companies, schools,
 * and evidence-backed edges (possesses / worked_at / studied_at / demonstrated_at) plus
 * related_to edges from the self-trained semantic model. In-house, deterministic. */
export async function GET(req: NextRequest) {
  const t = req.cookies.get("er_token")?.value
  const p = t ? verifyToken(t) : null
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const input = await inputFromUser(p.userId)
    const graph = buildCandidateGraph({
      name: input.name,
      skills: input.skills || [],
      experiences: (input.experiences || []).map((e) => ({ title: e.title, company: e.company, description: e.description })),
      education: (input.education || []).map((e) => ({ school: e.school, degree: e.degree })),
    })
    return NextResponse.json({ graph })
  } catch {
    return NextResponse.json({ error: "temporary" }, { status: 503 })
  }
}
