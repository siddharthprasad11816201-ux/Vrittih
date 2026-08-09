import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Candidate results for a single test — visible to the test's owner
// (Test.createdById) or a platform admin only. Scoped strictly to this test so
// one owner can never read another's attempts.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await resolveContext(req)
    if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const test = await (prisma as any).test.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, passingScore: true, createdById: true }
    })
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 })
    const isOwner = test.createdById === ctx.userId
    if (!isOwner && !ctx.has("admin.access")) {
      return NextResponse.json({ error: "You do not have access to this test's results" }, { status: 403 })
    }
    const attempts = await (prisma as any).testAttempt.findMany({
      where: { testId: params.id },
      orderBy: { completedAt: "desc" },
      select: {
        id: true,
        score: true,
        passed: true,
        status: true,
        completedAt: true,
        tabSwitches: true,
        user: { select: { name: true, email: true } }
      }
    })
    return NextResponse.json({
      test: { id: test.id, title: test.title, passingScore: test.passingScore },
      attempts
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
