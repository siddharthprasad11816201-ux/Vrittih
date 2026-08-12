/**
 * Candidate resolution — the ONE funnel every intake source goes through.
 *
 * EduRankAI signups, LinkedIn/Indeed/AICTE imports, CSV uploads, referrals, the Partner API
 * and manual recruiter entry all call resolveCandidate(). That is what stops the platform
 * from accumulating one record per source for the same human (§52).
 *
 * Merges are deliberately conservative: only a verified strong identifier above the
 * auto-merge bar merges without a person. Everything else becomes a review task, because
 * a wrong merge fuses two strangers' hiring histories.
 */
import { prisma } from "@/lib/prisma"
import { normalizeIdentity, normalizeEmail, type IdentityKind } from "./identity"
import {
  compareCandidates, planMerge, AUTO_MERGE_THRESHOLD,
  type CandidateRecord, type Identity, type MatchResult,
} from "./match"

export * from "./identity"
export * from "./match"

export interface IntakeIdentity { kind: IdentityKind; value: string; verified?: boolean }

export interface IntakeInput {
  name: string
  identities: IntakeIdentity[]
  location?: string | null
  currentEmployer?: string | null
  headline?: string | null
  userId?: string | null
  /** Attribution — preserved forever, even after a merge (§54). */
  source: string
  campaign?: string | null
  externalId?: string | null
  referrerId?: string | null
  tracking?: Record<string, string> | null
}

export interface ResolveResult {
  candidateId: string
  created: boolean
  /** An existing record was matched with certainty and reused. */
  matched: boolean
  /** Ambiguous pairs a human must decide on — never auto-merged. */
  review: { candidateId: string; match: MatchResult }[]
}

/** Normalize the incoming identifiers, dropping anything unusable. */
function cleanIdentities(list: IntakeIdentity[]): Identity[] {
  const out: Identity[] = []
  const seen = new Set<string>()
  for (const i of list || []) {
    const value = normalizeIdentity(i.kind, i.value)
    if (!value) continue
    const key = `${i.kind}:${value}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ kind: i.kind, value, verified: !!i.verified })
  }
  return out
}

function toRecord(row: any): CandidateRecord {
  return {
    id: row.id,
    name: row.displayName,
    location: row.location,
    currentEmployer: row.currentEmployer,
    identities: (row.identities || []).map((i: any) => ({ kind: i.kind, value: i.value, verified: i.verified })),
  }
}

/** Follow a merge chain to the surviving record. */
async function resolveSurvivor(id: string, depth = 0): Promise<string> {
  if (depth > 10) return id     // defensive: never loop on a corrupt chain
  const row = await (prisma as any).candidate.findUnique({ where: { id }, select: { mergedIntoId: true } })
  return row?.mergedIntoId ? resolveSurvivor(row.mergedIntoId, depth + 1) : id
}

/**
 * Find or create the candidate for an intake event.
 *
 * Order matters: an exact identity hit is authoritative and cheap, so it is tried first.
 * Only when nothing matches exactly do we score against a narrowed pool.
 */
export async function resolveCandidate(input: IntakeInput): Promise<ResolveResult> {
  const identities = cleanIdentities(input.identities)
  const name = String(input.name || "").trim().slice(0, 160) || "Unknown candidate"

  // 1. Exact hit on a normalized identifier — the same mailbox/phone is the same person.
  let existingId: string | null = null
  if (identities.length) {
    const hit = await (prisma as any).candidateIdentity.findFirst({
      where: { OR: identities.map((i) => ({ kind: i.kind, value: i.value })) },
      select: { candidateId: true },
    })
    if (hit) existingId = await resolveSurvivor(hit.candidateId)
  }
  // An account is a strong link on its own.
  if (!existingId && input.userId) {
    const byUser = await (prisma as any).candidate.findUnique({ where: { userId: input.userId }, select: { id: true } })
    if (byUser) existingId = byUser.id
  }

  if (existingId) {
    await attachIdentities(existingId, identities)
    await recordSource(existingId, input)
    await backfillProfile(existingId, input)
    return { candidateId: existingId, created: false, matched: true, review: [] }
  }

  // 2. No exact hit — look for probable duplicates in a NARROWED pool (never a full scan).
  const review: { candidateId: string; match: MatchResult }[] = []
  const pool = await candidatePool(name, identities)
  const subject: CandidateRecord = { id: "new", name, identities, location: input.location, currentEmployer: input.currentEmployer }

  let autoMergeTarget: string | null = null
  for (const row of pool) {
    const m = compareCandidates(subject, toRecord(row))
    if (m.verdict === "SAME" && m.confidence >= AUTO_MERGE_THRESHOLD) { autoMergeTarget = row.id; break }
    if (m.verdict === "REVIEW") review.push({ candidateId: row.id, match: m })
  }

  if (autoMergeTarget) {
    const survivor = await resolveSurvivor(autoMergeTarget)
    await attachIdentities(survivor, identities)
    await recordSource(survivor, input)
    await backfillProfile(survivor, input)
    return { candidateId: survivor, created: false, matched: true, review }
  }

  // 3. Genuinely new. Ambiguous pairs are returned for human review rather than merged.
  const primaryEmail = identities.find((i) => i.kind === "email")?.value
    ?? normalizeEmail(input.identities.find((i) => i.kind === "email")?.value || "")
    ?? null

  const created = await (prisma as any).candidate.create({
    data: {
      displayName: name,
      primaryEmail,
      location: input.location ?? null,
      currentEmployer: input.currentEmployer ?? null,
      headline: input.headline ?? null,
      userId: input.userId ?? null,
    },
    select: { id: true },
  })
  await attachIdentities(created.id, identities)
  await recordSource(created.id, input)
  return { candidateId: created.id, created: true, matched: false, review }
}

/**
 * Narrow the comparison pool. Scanning every candidate would not scale, so we only fetch
 * rows sharing an identifier value or a name token — a superset of anything that could
 * plausibly score above the review threshold.
 */
async function candidatePool(name: string, identities: Identity[]): Promise<any[]> {
  const tokens = name.toLowerCase().split(/\s+/).filter((t) => t.length >= 3).slice(0, 4)
  const where: any = { OR: [] as any[] }
  if (identities.length) where.OR.push({ identities: { some: { OR: identities.map((i) => ({ value: i.value })) } } })
  for (const t of tokens) where.OR.push({ displayName: { contains: t } })
  if (!where.OR.length) return []
  return (prisma as any).candidate.findMany({
    where: { AND: [where, { mergedIntoId: null }] },
    include: { identities: true },
    take: 50,
  })
}

/** Attach identifiers, ignoring ones already claimed (the unique index is the arbiter). */
async function attachIdentities(candidateId: string, identities: Identity[]) {
  for (const i of identities) {
    await (prisma as any).candidateIdentity.upsert({
      where: { kind_value: { kind: i.kind, value: i.value } },
      create: { candidateId, kind: i.kind, value: i.value, verified: !!i.verified },
      // Verification only ever ratchets UP — a later unverified sighting must not
      // downgrade an identifier we already proved.
      update: i.verified ? { verified: true } : {},
    }).catch(() => {})
  }
}

/** Record attribution. Never overwritten: the FIRST touch from a source is the truth. */
async function recordSource(candidateId: string, input: IntakeInput) {
  const externalId = input.externalId ? String(input.externalId).slice(0, 200) : null
  try {
    if (externalId) {
      await (prisma as any).candidateSource.upsert({
        where: { source_externalId: { source: input.source, externalId } },
        create: {
          candidateId, source: input.source, campaign: input.campaign ?? null, externalId,
          referrerId: input.referrerId ?? null,
          trackingJson: input.tracking ? JSON.stringify(input.tracking) : null,
        },
        update: {},
      })
      return
    }
    const dup = await (prisma as any).candidateSource.findFirst({
      where: { candidateId, source: input.source, campaign: input.campaign ?? null },
      select: { id: true },
    })
    if (dup) return
    await (prisma as any).candidateSource.create({
      data: {
        candidateId, source: input.source, campaign: input.campaign ?? null, externalId: null,
        referrerId: input.referrerId ?? null,
        trackingJson: input.tracking ? JSON.stringify(input.tracking) : null,
      },
    })
  } catch { /* attribution must never break intake */ }
}

/** Fill in blanks only — a later, thinner source must not erase richer existing data. */
async function backfillProfile(candidateId: string, input: IntakeInput) {
  const cur = await (prisma as any).candidate.findUnique({
    where: { id: candidateId },
    select: { location: true, currentEmployer: true, headline: true, primaryEmail: true, userId: true },
  })
  if (!cur) return
  const data: any = {}
  if (!cur.location && input.location) data.location = input.location
  if (!cur.currentEmployer && input.currentEmployer) data.currentEmployer = input.currentEmployer
  if (!cur.headline && input.headline) data.headline = input.headline
  if (!cur.userId && input.userId) data.userId = input.userId
  if (!cur.primaryEmail) {
    const email = normalizeEmail(input.identities.find((i) => i.kind === "email")?.value || "")
    if (email) data.primaryEmail = email
  }
  if (Object.keys(data).length) await (prisma as any).candidate.update({ where: { id: candidateId }, data }).catch(() => {})
}

/**
 * Execute a merge. Records survive (never deleted) so existing links keep resolving, and
 * the move is logged with its evidence so it can be reverted.
 */
export async function mergeCandidates(opts: {
  survivorId: string
  mergedId: string
  confidence: number
  evidence: any[]
  decidedById?: string | null
  automatic?: boolean
}): Promise<{ ok: true; mergeId: string } | { ok: false; error: string }> {
  if (opts.survivorId === opts.mergedId) return { ok: false, error: "Cannot merge a candidate into itself." }

  const [survivor, merged] = await Promise.all([
    (prisma as any).candidate.findUnique({ where: { id: opts.survivorId }, include: { identities: true, sources: true } }),
    (prisma as any).candidate.findUnique({ where: { id: opts.mergedId }, include: { identities: true, sources: true } }),
  ])
  if (!survivor || !merged) return { ok: false, error: "Candidate not found." }
  if (survivor.mergedIntoId || merged.mergedIntoId) return { ok: false, error: "One of these records was already merged." }

  const plan = planMerge(
    { id: survivor.id, createdAt: survivor.createdAt, identities: survivor.identities, sourceCount: survivor.sources.length },
    { id: merged.id, createdAt: merged.createdAt, identities: merged.identities, sourceCount: merged.sources.length },
  )
  // Honour the caller's chosen survivor, but keep the plan's warnings.
  const survivorId = opts.survivorId
  const mergedId = opts.mergedId

  const movedIdentityIds: string[] = []
  for (const i of merged.identities) {
    const clash = await (prisma as any).candidateIdentity.findUnique({ where: { kind_value: { kind: i.kind, value: i.value } }, select: { id: true, candidateId: true } })
    if (clash && clash.candidateId === survivorId) continue     // survivor already has it
    await (prisma as any).candidateIdentity.update({ where: { id: i.id }, data: { candidateId: survivorId } }).catch(() => {})
    movedIdentityIds.push(i.id)
  }
  // Attribution is MOVED, never dropped (§54).
  const movedSourceIds = merged.sources.map((s: any) => s.id)
  await (prisma as any).candidateSource.updateMany({ where: { candidateId: mergedId }, data: { candidateId: survivorId } }).catch(() => {})

  const apps = await prisma.application.findMany({ where: { candidateId: mergedId }, select: { id: true } })
  await prisma.application.updateMany({ where: { candidateId: mergedId }, data: { candidateId: survivorId } })

  await (prisma as any).candidate.update({ where: { id: mergedId }, data: { mergedIntoId: survivorId } })

  const log = await (prisma as any).candidateMerge.create({
    data: {
      survivorId, mergedId,
      confidence: opts.confidence,
      evidenceJson: JSON.stringify(opts.evidence ?? []),
      movedJson: JSON.stringify({ identityIds: movedIdentityIds, sourceIds: movedSourceIds, applicationIds: apps.map((a) => a.id), warnings: plan.warnings }),
      decidedById: opts.decidedById ?? null,
      automatic: !!opts.automatic,
    },
    select: { id: true },
  })
  return { ok: true, mergeId: log.id }
}

/** Undo a merge using the recorded move list. A wrong merge must not be permanent. */
export async function revertMerge(mergeId: string, byUserId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const log = await (prisma as any).candidateMerge.findUnique({ where: { id: mergeId } })
  if (!log) return { ok: false, error: "Merge not found." }
  if (log.revertedAt) return { ok: false, error: "This merge was already reverted." }

  let moved: any = {}
  try { moved = JSON.parse(log.movedJson || "{}") } catch { moved = {} }

  if (Array.isArray(moved.identityIds) && moved.identityIds.length) {
    await (prisma as any).candidateIdentity.updateMany({ where: { id: { in: moved.identityIds } }, data: { candidateId: log.mergedId } })
  }
  if (Array.isArray(moved.sourceIds) && moved.sourceIds.length) {
    await (prisma as any).candidateSource.updateMany({ where: { id: { in: moved.sourceIds } }, data: { candidateId: log.mergedId } })
  }
  if (Array.isArray(moved.applicationIds) && moved.applicationIds.length) {
    await prisma.application.updateMany({ where: { id: { in: moved.applicationIds } }, data: { candidateId: log.mergedId } })
  }
  await (prisma as any).candidate.update({ where: { id: log.mergedId }, data: { mergedIntoId: null } })
  await (prisma as any).candidateMerge.update({ where: { id: mergeId }, data: { revertedAt: new Date(), revertedById: byUserId } })
  return { ok: true }
}
