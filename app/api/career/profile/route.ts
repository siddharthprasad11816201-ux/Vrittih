import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"

/* Read the stored Career Intelligence profile (knowledge graph + summary +
 * skill proficiencies). Returns { computed:false } if it hasn't been built yet. */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }
const parse = (s: string | null | undefined, fb: any) => { try { return s ? JSON.parse(s) : fb } catch { return fb } }

export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const profile = await prisma.careerProfile.findUnique({ where: { userId: p.userId } })
  if (!profile) return NextResponse.json({ computed: false })
  const skills = await prisma.skillProficiency.findMany({ where: { userId: p.userId }, orderBy: { confidence: "desc" } })
  return NextResponse.json({
    computed: true,
    computedAt: profile.computedAt,
    graph: parse(profile.graph, { nodes: [], edges: [] }),
    summary: parse(profile.summary, {}),
    skills: skills.map((s) => ({ skill: s.skill, category: s.category, confidence: s.confidence, level: s.level, implied: s.implied, scores: parse(s.scores, {}), evidence: parse(s.evidence, {}) })),
  })
}
