import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAction } from "@/lib/admin"
import { recomputeCalibration } from "@/lib/career/calibrationStore"

export const dynamic = "force-dynamic"

/* ICIRE §21 — admin calibration health + manual recompute. ADMIN/SUPER_ADMIN
 * only. Shows aggregate cohort stats (k-anonymity inputs) for audit — no PII. */

export async function GET(req: NextRequest) {
  const ctx = requireAdmin(req)
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const rows = await prisma.matchCalibration.findMany({
    select: { cohort: true, sampleSize: true, jobCount: true, employerCount: true, baseAdvRate: true, computedAt: true, version: true },
    orderBy: { sampleSize: "desc" },
  })
  return NextResponse.json({
    calibrations: rows,
    weightsEnabled: process.env.CAREER_CALIBRATE_WEIGHTS === "on",
    note: "Calibration mirrors recruiter behaviour; the score-altering weight nudge is off unless CAREER_CALIBRATE_WEIGHTS=on.",
  })
}

export async function POST(req: NextRequest) {
  const ctx = requireAdmin(req)
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const summary = await recomputeCalibration()
  await logAction(ctx.userId, "career.calibration.recompute", { scanned: summary.scanned, decided: summary.decided, cohorts: summary.cohorts.length }, req)
  return NextResponse.json({ ok: true, ...summary })
}
