import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { diffVectors, momentum, type SeriesPoint } from "@/lib/career/progress"

export const dynamic = "force-dynamic"

/* ICIRE §20 — the applicant's growth over time: average-confidence series,
 * biggest movers between the two most recent snapshots, and overall momentum.
 * Built only from real recorded snapshots — no data means no invented trend. */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const snaps = await prisma.careerSnapshot.findMany({
    where: { userId: p.userId }, orderBy: { createdAt: "asc" }, take: 24,
    select: { avgConfidence: true, skillCount: true, explicitCount: true, skillVector: true, createdAt: true, trigger: true },
  })
  const series: SeriesPoint[] = snaps.map((s) => ({
    at: s.createdAt.toISOString(), avgConfidence: Math.round(s.avgConfidence * 100) / 100, skillCount: s.skillCount, explicitCount: s.explicitCount,
  }))
  let movers: ReturnType<typeof diffVectors> = []
  if (snaps.length >= 2) {
    const prev = safe(snaps[snaps.length - 2].skillVector)
    const cur = safe(snaps[snaps.length - 1].skillVector)
    movers = diffVectors(prev, cur).slice(0, 8)
  }
  const latest = snaps[snaps.length - 1]
  return NextResponse.json({
    snapshots: snaps.length,
    series,
    movers,
    momentum: momentum(series),
    latest: latest ? { skillCount: latest.skillCount, explicitCount: latest.explicitCount, avgConfidence: Math.round(latest.avgConfidence * 100) / 100, at: latest.createdAt.toISOString() } : null,
  })
}

function safe(s: string) { try { return JSON.parse(s) } catch { return {} } }
