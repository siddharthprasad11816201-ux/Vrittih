/* Phase 11 — publish the in-house agent CATALOG into the marketplace.
 * Idempotent (keyed by slug); re-seeding refreshes metadata but NEVER resets the
 * installs/rating counters, which accrue from real user actions. */
import { prisma } from "@/lib/prisma"
import { CATALOG } from "./catalog"

let seededAt = 0
const RESEED_TTL = 5 * 60 * 1000

export async function ensureSeeded(force = false): Promise<void> {
  if (!force && Date.now() - seededAt < RESEED_TTL) return
  for (const c of CATALOG) {
    const spec = JSON.stringify({ capId: c.capId, runField: c.runField })
    const meta = { authorId: "edurankai", kind: c.kind, name: c.name, summary: c.summary, category: c.category, status: "PUBLISHED", spec }
    await prisma.marketplaceItem.upsert({
      where: { slug: c.slug },
      // update only metadata — installs/ratingSum/ratingCount are real, keep them
      update: meta,
      create: { slug: c.slug, ...meta },
    }).catch(() => {})
  }
  seededAt = Date.now()
}
