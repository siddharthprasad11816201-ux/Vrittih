/* First careful ingest of the edurankai feed into PRODUCTION, with dedup.
 *
 * The 437 roles already on the board (sourceKey=null, applyUrl .../apply?role=<slug>)
 * are matched to the feed by slug and UPDATED in place (ids + any applications
 * preserved) — never duplicated. New roles are created; roles no longer in the
 * feed are deactivated. Mirrors lib/ingest.ts semantics, but idempotent so it is
 * safe to re-run. Dry-run by default; pass --commit to write.
 */
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"

const COMMIT = process.argv.includes("--commit")
const FEED = "https://www.edurankai.in/api/jobs-feed"
const KEY = "edurankai"
const prisma = new PrismaClient()

const TYPES = ["FULLTIME", "PARTTIME", "INTERNSHIP", "CONTRACT", "FREELANCE"]
const normType = (t) => { const s = (t || "").toUpperCase().replace(/[^A-Z]/g, ""); return TYPES.includes(s) ? s : "FULLTIME" }
const slugFromApply = (u) => { const m = /[?&]role=([^&#]+)/.exec(u || ""); return m ? decodeURIComponent(m[1]) : null }
const toDate = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d }

async function employerId() {
  const email = `source+${KEY}@vrittih.online`
  const ex = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (ex) return ex.id
  if (!COMMIT) return "(would create employer " + email + ")"
  const u = await prisma.user.create({
    data: {
      name: "EduRankAI", email,
      password: await bcrypt.hash(randomBytes(24).toString("hex"), 10),
      role: "EMPLOYER", paid: true, paidAt: new Date(), idVerified: true,
      source: "ingest", headline: "India · Official listings", profile: { create: {} },
    }, select: { id: true },
  })
  return u.id
}

function feedData(j, emp) {
  const closesAt = toDate(j.closesAt)
  const closed = !!(closesAt && closesAt.getTime() < Date.now())
  return {
    title: String(j.title).slice(0, 200),
    description: String(j.description || j.title),
    company: String(j.company || "EduRankAI"),
    govBody: String(j.company || "EduRankAI"),
    industry: j.industry || "Education",
    location: j.location || "India",
    type: normType(j.type),
    salary: j.salary ? String(j.salary).slice(0, 120) : null,
    remote: !!j.remote,
    govUrl: null,
    applyUrl: j.applyUrl || null,
    closesAt,
    active: !closed,
    postedById: emp,
  }
}

try {
  // 1) Feed
  const res = await fetch(FEED, { headers: { accept: "application/json" }, redirect: "follow" })
  const body = await res.json()
  const rawJobs = Array.isArray(body?.jobs) ? body.jobs : []
  const feed = new Map()
  for (const j of rawJobs) if (j?.externalId && j?.title && j?.applyUrl) if (!feed.has(j.externalId)) feed.set(String(j.externalId), j)
  console.log(`feed: HTTP ${res.status}, ${rawJobs.length} listings, ${feed.size} valid unique`)
  if (feed.size === 0) throw new Error("empty/invalid feed — aborting")

  // 2) Existing edurankai jobs (idempotent: already-backfilled OR original null import)
  const existing = await prisma.job.findMany({
    where: { OR: [{ sourceKey: KEY }, { AND: [{ sourceKey: null }, { applyUrl: { contains: "edurankai", mode: "insensitive" } }] }] },
    select: { id: true, sourceKey: true, externalId: true, applyUrl: true, active: true },
  })
  const bySlug = new Map(); const dups = []; const unmatched = []
  for (const j of existing) {
    const slug = j.sourceKey === KEY ? j.externalId : slugFromApply(j.applyUrl)
    if (!slug) { unmatched.push(j); continue }
    if (bySlug.has(slug)) dups.push({ j, slug }); else bySlug.set(slug, j)
  }

  const feedSlugs = new Set(feed.keys())
  const toUpdate = [...bySlug.keys()].filter((s) => feedSlugs.has(s))
  const toCreate = [...feedSlugs].filter((s) => !bySlug.has(s))
  const toCloseNotInFeed = [...bySlug.keys()].filter((s) => !feedSlugs.has(s))
  const closedInFeed = [...feed.values()].filter((j) => { const d = toDate(j.closesAt); return d && d.getTime() < Date.now() }).length

  console.log(`\nexisting matched: ${bySlug.size}  dups: ${dups.length}  unmatched: ${unmatched.length}`)
  console.log(`PLAN → update ${toUpdate.length}  create ${toCreate.length}  close(not-in-feed) ${toCloseNotInFeed.length}  deactivate dups ${dups.length}  deactivate unmatched ${unmatched.length}`)
  console.log(`feed roles flagged already-closed (imported inactive): ${closedInFeed}`)
  console.log(`expected active edurankai jobs after run: ${feed.size - closedInFeed}`)

  if (!COMMIT) { console.log("\nDRY RUN — no changes written. Re-run with --commit to apply."); await prisma.$disconnect(); process.exit(0) }

  // 3) Commit
  const emp = await employerId()
  console.log(`\nemployer: ${emp}`)
  let created = 0, updated = 0, closed = 0
  for (const slug of feedSlugs) {
    const data = feedData(feed.get(slug), emp)
    const prim = bySlug.get(slug)
    if (prim) { await prisma.job.update({ where: { id: prim.id }, data: { ...data, sourceKey: KEY, externalId: slug } }); updated++ }
    else { await prisma.job.create({ data: { ...data, sourceKey: KEY, externalId: slug } }); created++ }
    if ((created + updated) % 100 === 0) process.stdout.write(`  ...${created + updated}\r`)
  }
  for (const slug of toCloseNotInFeed) {
    const prim = bySlug.get(slug)
    await prisma.job.update({ where: { id: prim.id }, data: { sourceKey: KEY, externalId: slug, active: false } }); closed++
  }
  for (const { j, slug } of dups) {
    await prisma.job.update({ where: { id: j.id }, data: { sourceKey: KEY, externalId: `${slug}::${j.id}`, active: false } }); closed++
  }
  for (const j of unmatched) { await prisma.job.update({ where: { id: j.id }, data: { active: false } }); closed++ }

  await prisma.jobSource.upsert({
    where: { key: KEY },
    update: { name: "EduRankAI", homepage: "https://www.edurankai.in/careers", kind: "partner", region: "India", feedUrl: FEED, active: true, lastRunAt: new Date(), lastOk: true, lastMessage: `${created} new, ${updated} updated, ${closed} closed`, found: feed.size, imported: created + updated },
    create: { key: KEY, name: "EduRankAI", homepage: "https://www.edurankai.in/careers", kind: "partner", region: "India", feedUrl: FEED, active: true, lastRunAt: new Date(), lastOk: true, lastMessage: `${created} new, ${updated} updated, ${closed} closed`, found: feed.size, imported: created + updated },
  })

  const activeNow = await prisma.job.count({ where: { sourceKey: KEY, active: true } })
  const totalNow = await prisma.job.count({ where: { sourceKey: KEY } })
  const leftoverNull = await prisma.job.count({ where: { sourceKey: null, applyUrl: { contains: "edurankai", mode: "insensitive" } } })
  console.log(`\nDONE  created=${created} updated=${updated} closed=${closed}`)
  console.log(`VERIFY  edurankai active=${activeNow}  total=${totalNow}  leftover-null-dupes=${leftoverNull}`)
} finally {
  await prisma.$disconnect()
}
