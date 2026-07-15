import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { ingestSource } from "@/lib/ingest"
import { selfTestAdapter, setScenario } from "@/lib/sources/selftest"

export const dynamic = "force-dynamic"

// Verifies the ingestion rules end-to-end against a synthetic source, so the
// engine can be proven without scraping a live portal. Dev only — the self-test
// adapter isn't registered in production, and this route refuses to run there.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Self-test is disabled in production." }, { status: 403 })

  const key = selfTestAdapter.key
  const checks: any[] = []
  const count = (where: any) => prisma.job.count({ where: { sourceKey: key, ...where } })

  setScenario("normal")
  const first = await ingestSource(selfTestAdapter)
  checks.push({ step: "1. first import", ...first, expect: "3 created (the link-less notice is skipped)", pass: first.created === 3 && first.skipped === 1 })

  setScenario("normal")
  const again = await ingestSource(selfTestAdapter)
  const rows = await count({})
  checks.push({ step: "2. re-run identical", ...again, rows, expect: "0 created, 3 updated — dedupe, no duplicates", pass: again.created === 0 && again.updated === 3 && rows === 3 })

  const closedOnImport = await count({ externalId: "T-3", active: true })
  checks.push({ step: "3. past-deadline notice", expect: "never active", activeRows: closedOnImport, pass: closedOnImport === 0 })

  setScenario("removed")
  const removed = await ingestSource(selfTestAdapter)
  const t1 = await count({ externalId: "T-1", active: true })
  checks.push({ step: "4. listing pulled from source", ...removed, expect: "T-1 deactivated", t1Active: t1, pass: t1 === 0 })

  const before = await count({ active: true })
  setScenario("broken")
  const broke = await ingestSource(selfTestAdapter)
  const after = await count({ active: true })
  checks.push({ step: "5. source errors", error: broke.error, before, after, expect: "nothing changed — a broken fetch must not wipe live jobs", pass: before === after && !!broke.error })

  // clean up so the self-test never leaves data behind
  await prisma.job.deleteMany({ where: { sourceKey: key } })
  await prisma.jobSource.deleteMany({ where: { key } })
  await prisma.user.deleteMany({ where: { email: `source+${key}@vrittih.online` } })
  setScenario("normal")

  return NextResponse.json({ ok: checks.every((c) => c.pass), passed: checks.filter((c) => c.pass).length, total: checks.length, checks })
}
