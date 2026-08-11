/**
 * End-to-end proof of the social/trust features against the REAL local database:
 * reactions, reposts, hashtags, mutual blocking, reports + moderation, endorsements.
 * Creates only rows it tags, and always cleans up.
 *
 *   node scripts/test-social-e2e.mjs
 */
import { PrismaClient } from "@prisma/client"
import fs from "node:fs"; import os from "node:os"; import path from "node:path"
import { fileURLToPath } from "node:url"; import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "social-e2e-"))
function load(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8")
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText
  const f = path.join(tmp, rel.replace(/[\/]/g, "__").replace(/\.ts$/, ".cjs")); fs.writeFileSync(f, out); return require(f)
}
const soc = load("lib/social/engage.ts")

const prisma = new PrismaClient()
const TAG = "social-e2e-" + Date.now()
let pass = 0, fail = 0
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  " + d}`); c ? pass++ : fail++ }
const userIds = []

try {
  const alice = await prisma.user.create({ data: { name: "Alice", email: `${TAG}-a@t.local`, password: "x", role: "JOBSEEKER" } })
  const bob = await prisma.user.create({ data: { name: "Bob", email: `${TAG}-b@t.local`, password: "x", role: "JOBSEEKER" } })
  const mallory = await prisma.user.create({ data: { name: "Mallory", email: `${TAG}-m@t.local`, password: "x", role: "JOBSEEKER" } })
  userIds.push(alice.id, bob.id, mallory.id)

  // ---- posts + hashtags ----
  const tags = soc.parseHashtags("Shipping our #NodeJS matcher today #Hiring")
  const post = await prisma.post.create({
    data: {
      authorId: alice.id, content: "Shipping our #NodeJS matcher today #Hiring",
      hashtags: { create: await Promise.all(tags.map(async (tag) => ({ hashtagId: (await prisma.hashtag.upsert({ where: { tag }, create: { tag }, update: {} })).id }))) },
    },
    include: { hashtags: { include: { hashtag: true } } },
  })
  ok("post indexes its hashtags", post.hashtags.map((h) => h.hashtag.tag).sort().join(",") === "hiring,nodejs", JSON.stringify(post.hashtags.map((h) => h.hashtag.tag)))

  const byTag = await prisma.post.findMany({ where: { hashtags: { some: { hashtag: { tag: "nodejs" } } } } })
  ok("topic query finds the post by tag", byTag.some((p) => p.id === post.id))

  // ---- reactions: one per user, switchable ----
  await prisma.postLike.create({ data: { postId: post.id, userId: bob.id, reaction: "celebrate" } })
  await prisma.postLike.update({ where: { postId_userId: { postId: post.id, userId: bob.id } }, data: { reaction: "insightful" } })
  const rows = await prisma.postLike.findMany({ where: { postId: post.id }, select: { reaction: true } })
  const t = soc.tallyReactions(rows)
  ok("switching reaction does not double-count", t.total === 1 && t.byType.insightful === 1 && t.byType.celebrate === 0, JSON.stringify(t))

  // ---- repost ----
  const repost = await prisma.post.create({ data: { authorId: bob.id, content: "Great work!", repostOfId: post.id } })
  const withCounts = await prisma.post.findUnique({ where: { id: post.id }, include: { _count: { select: { reposts: true } } } })
  ok("original counts its reposts", withCounts._count.reposts === 1, String(withCounts._count.reposts))
  const hydrated = await prisma.post.findUnique({ where: { id: repost.id }, include: { repostOf: true } })
  ok("repost resolves the original content", hydrated.repostOf?.id === post.id)

  // ---- blocking is mutual in the feed query ----
  await prisma.userBlock.create({ data: { blockerId: mallory.id, blockedId: alice.id } })
  const blocks = await prisma.userBlock.findMany({ where: { OR: [{ blockerId: alice.id }, { blockedId: alice.id }] } })
  const hidden = soc.hiddenUserIds(blocks, alice.id)
  ok("alice hides mallory even though MALLORY did the blocking", hidden.has(mallory.id), JSON.stringify([...hidden]))
  const visible = await prisma.post.findMany({ where: { authorId: { notIn: [...hidden] }, id: post.id } })
  ok("alice's own post still visible to herself", visible.length === 1)

  // ---- reports + moderation ----
  await prisma.report.create({ data: { reporterId: bob.id, targetType: "post", targetId: post.id, reason: "spam" } })
  let dup = false
  try { await prisma.report.create({ data: { reporterId: bob.id, targetType: "post", targetId: post.id, reason: "scam" } }) } catch { dup = true }
  ok("duplicate report by the same user is prevented by the unique constraint", dup)
  const open = await prisma.report.findMany({ where: { status: "OPEN", targetId: post.id } })
  ok("report lands in the OPEN queue", open.length === 1, String(open.length))
  await prisma.report.update({ where: { id: open[0].id }, data: { status: "RESOLVED", resolvedById: mallory.id, resolvedAt: new Date(), resolution: "reviewed" } })
  const stillOpen = await prisma.report.count({ where: { status: "OPEN", targetId: post.id } })
  ok("resolving removes it from the OPEN queue", stillOpen === 0)

  // ---- endorsements ----
  const skill = await prisma.skill.upsert({ where: { name: "Node.js" }, create: { name: "Node.js" }, update: {} })
  await prisma.userSkill.create({ data: { userId: alice.id, skillId: skill.id } })
  await prisma.connection.create({ data: { userId: bob.id, connectedId: alice.id, status: "ACCEPTED" } })
  await prisma.skillEndorsement.create({ data: { userId: alice.id, skill: "Node.js", endorserId: bob.id } })
  let dupE = false
  try { await prisma.skillEndorsement.create({ data: { userId: alice.id, skill: "Node.js", endorserId: bob.id } }) } catch { dupE = true }
  ok("the same person cannot endorse the same skill twice", dupE)
  const count = await prisma.skillEndorsement.count({ where: { userId: alice.id, skill: "Node.js" } })
  ok("endorsement recorded once with a bounded weight", count === 1 && soc.endorsementWeight(count) === 0.25, `count=${count}`)
} catch (e) {
  console.error("ERROR:", e.message); fail++
} finally {
  try {
    for (const id of userIds) {
      await prisma.skillEndorsement.deleteMany({ where: { OR: [{ userId: id }, { endorserId: id }] } }).catch(() => {})
      await prisma.report.deleteMany({ where: { reporterId: id } }).catch(() => {})
      await prisma.userBlock.deleteMany({ where: { OR: [{ blockerId: id }, { blockedId: id }] } }).catch(() => {})
      await prisma.connection.deleteMany({ where: { OR: [{ userId: id }, { connectedId: id }] } }).catch(() => {})
      await prisma.post.deleteMany({ where: { authorId: id } }).catch(() => {})
      await prisma.user.delete({ where: { id } }).catch(() => {})
    }
    await prisma.hashtag.deleteMany({ where: { tag: { in: ["nodejs", "hiring"] }, posts: { none: {} } } }).catch(() => {})
  } catch {}
  await prisma.$disconnect()
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
