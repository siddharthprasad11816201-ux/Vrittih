/**
 * Security regression suite. Every assertion here corresponds to a REAL defect that was
 * found in this codebase and fixed — these tests exist so it cannot silently come back.
 *
 *   node scripts/test-security.mjs
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sec-"))
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_for_security_suite_only"

function load(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8")
  const out = ts.transpileModule(src, {
    // esModuleInterop mirrors the real build (next/tsconfig), so default-imports of Node
    // built-ins transpile the same way here as they do in production.
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
  }).outputText
  const f = path.join(tmp, rel.replace(/[\\/]/g, "__").replace(/\.ts$/, ".cjs"))
  fs.writeFileSync(f, out)
  return require(f)
}
let pass = 0, fail = 0
const ok = (n, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${c ? "" : "  " + d}`); c ? pass++ : fail++ }
const eq = (n, g, w) => ok(n, JSON.stringify(g) === JSON.stringify(w), `got=${JSON.stringify(g)} want=${JSON.stringify(w)}`)
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8")
// Strip comments and import lines so source assertions test CODE, not prose. Several of
// these files legitimately name the old defect (e.g. "Math.random") in a comment.
const codeOf = (p) => read(p)
  .replace(/\/\*[\s\S]*?\*\//g, "")   // block comments
  .replace(/^\s*\/\/.*$/gm, "")        // line comments
  .replace(/^\s*import .*$/gm, "")     // imports

/* ---------- 1. Step-up challenge — closes: second factor usable as the ONLY factor ---------- */
const chal = load("lib/auth/challenge.ts")
const t1 = chal.issueChallenge("user-1", "2fa_email")
ok("valid challenge verifies", chal.verifyChallenge(t1, "2fa_email").valid)
eq("challenge carries the user id", chal.verifyChallenge(t1, "2fa_email").userId, "user-1")
ok("a challenge for one stage is REJECTED for another", !chal.verifyChallenge(t1, "2fa_totp").valid)
eq("wrong-stage reason is explicit", chal.verifyChallenge(t1, "2fa_totp").reason, "wrong_stage")
ok("missing challenge rejected", !chal.verifyChallenge(null, "2fa_email").valid)
ok("garbage rejected", !chal.verifyChallenge("not-a-token", "2fa_email").valid)
ok("tampered payload rejected by the signature", !chal.verifyChallenge(
  Buffer.from(JSON.stringify({ u: "attacker", s: "2fa_email", exp: 9e9, n: "x" })).toString("base64url") + "." + t1.split(".")[1],
  "2fa_email").valid)
ok("expired challenge rejected", !chal.verifyChallenge(
  chal.issueChallenge("u", "2fa_email", new Date(Date.now() - 3600000)), "2fa_email").valid)
ok("multi-stage accept works for the face->OTP fallback",
  chal.verifyChallenge(chal.issueChallenge("u", "face"), ["2fa_email", "face"]).valid)
ok("multi-stage still rejects an unlisted stage",
  !chal.verifyChallenge(chal.issueChallenge("u", "2fa_totp"), ["2fa_email", "face"]).valid)
ok("challenge is not shaped like a session JWT (cannot be replayed as auth)", t1.split(".").length === 2)

/* ---------- 2. Secret encryption at rest — closes: plaintext DKIM private keys ---------- */
const box = load("lib/crypto/secretbox.ts")
process.env.SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
box._resetKeyCache()
const PEM = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg\n-----END PRIVATE KEY-----"
const ct = box.encryptSecret(PEM)
ok("ciphertext does not contain the plaintext", !ct.includes("MIIEvQIBADANBg") && ct.startsWith("v1."), ct.slice(0, 24))
eq("round-trips exactly", box.decryptSecret(ct), PEM)
ok("re-encrypting an encrypted value does not double-encrypt", box.decryptSecret(box.encryptSecret(ct)) === PEM)
ok("two encryptions differ (random IV)", box.encryptSecret(PEM) !== box.encryptSecret(PEM))
const tampered = ct.split(".")
tampered[3] = Buffer.from("evil-ciphertext-block").toString("base64")
let threw = false
try { box.decryptSecret(tampered.join(".")) } catch { threw = true }
ok("tampered ciphertext FAILS to decrypt (GCM integrity)", threw)
eq("legacy plaintext rows still readable", box.decryptSecret(PEM), PEM)
eq("encrypted values mask as [encrypted]", box.maskSecret(ct), "[encrypted]")
delete process.env.SECRET_ENCRYPTION_KEY
box._resetKeyCache()
eq("no key configured -> stored as-is (documented, non-breaking)", box.encryptSecret("abc"), "abc")
eq("encryptionEnabled reflects configuration", box.encryptionEnabled(), false)

/* ---------- 3. Rate-limit policy — closes: one global in-memory limit ---------- */
const pol = load("lib/ratelimit/policy.ts")
ok("auth is tightly budgeted", pol.budgetFor("auth").limit <= 10)
ok("search is generously budgeted", pol.budgetFor("search").limit >= 100)
ok("categories are not one global limit", pol.budgetFor("auth").limit !== pol.budgetFor("search").limit)
const w = pol.windowStart(new Date("2026-08-11T10:07:33Z"), 900)
ok("windows are epoch-aligned so every instance agrees", w.getTime() % (900 * 1000) === 0, w.toISOString())
eq("two times inside one window map to the same window",
  pol.windowStart(new Date("2026-08-11T10:01:00Z"), 900).toISOString(),
  pol.windowStart(new Date("2026-08-11T10:14:59Z"), 900).toISOString())
const b = { limit: 5, windowSeconds: 900 }
const st = pol.windowStart(new Date("2026-08-11T10:00:00Z"), 900)
ok("at the limit is still allowed", pol.decide(5, b, st, new Date("2026-08-11T10:00:01Z")).allowed)
ok("one over the limit is denied", !pol.decide(6, b, st, new Date("2026-08-11T10:00:01Z")).allowed)
ok("denied responses carry Retry-After", pol.rateHeaders(pol.decide(6, b, st, new Date("2026-08-11T10:00:01Z")))["Retry-After"] !== undefined)
ok("keys are namespaced per category", pol.rateKey("auth", "u1") !== pol.rateKey("register", "u1"))
ok("scope further namespaces the key", pol.rateKey("auth", "u1", "totp") !== pol.rateKey("auth", "u1", "otp"))

/* ---------- 4. Quota policy — closes: advertised-but-unenforced plan limits ---------- */
const q = load("lib/quota/limits.ts")
ok("free plan is capped", (q.capFor("free", "active_jobs") ?? 99) <= 5)
ok("a higher tier raises the cap", (q.capFor("emp_growth", "active_jobs") ?? 0) > (q.capFor("emp_starter", "active_jobs") ?? 0))
eq("top tier may be unlimited", q.capFor("emp_scale", "active_jobs"), null)
eq("unknown plan falls back to FREE", q.capFor("mystery_plan", "active_jobs"), q.FREE_CAPS.active_jobs)
eq("unknown plan never yields unlimited", q.capFor("mystery_plan", "candidates") === null, false)
eq("monthly quotas bucket by month", q.periodKey("applications_per_month", new Date("2026-08-11T00:00:00Z")), "2026-08")
eq("standing quotas use a single bucket", q.periodKey("active_jobs", new Date()), "total")
ok("at the cap allowed, one over denied",
  q.decideQuota("active_jobs", 5, 5).allowed && !q.decideQuota("active_jobs", 5, 6).allowed)
ok("unlimited never denies", q.decideQuota("active_jobs", null, 10000).allowed)

/* ---------- 5. OTP hardening — closes: brute-forceable 6-digit OTP ---------- */
const otpSrc = read("lib/auth/otp.ts")
const otpCode = codeOf("lib/auth/otp.ts")
ok("OTP uses crypto randomInt, not Math.random", otpCode.includes("randomInt") && !otpCode.includes("Math.random"))
ok("OTP codes are hashed at rest", otpCode.includes("createHash") && otpCode.includes("codeHash"))
ok("OTP comparison is constant-time", otpCode.includes("timingSafeEqual("))
ok("OTP has an attempt cap", /OTP_MAX_ATTEMPTS\s*=\s*\d+/.test(otpSrc))
ok("the attempt is counted BEFORE comparison (no free guess on crash)",
  otpCode.indexOf("increment: 1") < otpCode.indexOf("timingSafeEqual("))
ok("the dead in-process OTP store is gone", !read("lib/otpStore.ts").includes("new Map"))

/* ---------- 6. The endpoints actually enforce the fixes ---------- */
ok("otp-verify requires the post-password challenge", read("app/api/auth/otp-verify/route.ts").includes("verifyChallenge"))
ok("otp-verify no longer trusts a body userId", !/const \{ userId, otp/.test(read("app/api/auth/otp-verify/route.ts")))
ok("otp-request requires the challenge", read("app/api/auth/otp-request/route.ts").includes("verifyChallenge"))
ok("totp/verify requires the challenge", read("app/api/auth/totp/verify/route.ts").includes("verifyChallenge"))
ok("face-verify requires the challenge", read("app/api/verify/face-verify/route.ts").includes("verifyChallenge"))
ok("face-verify documents that client liveness is NOT a security control", read("app/api/verify/face-verify/route.ts").includes("CLIENT-ASSERTED"))
ok("payment test-gateway requires super admin", read("app/api/payment/test-gateway/route.ts").includes("requireSuperAdmin"))
ok("admin privilege is re-read from the DB per request", read("lib/admin.ts").includes("prisma.user.findUnique"))
ok("banned admins are rejected", read("lib/admin.ts").includes("user.banned"))
ok("admin checks are async/DB-backed", /export async function requireAdmin/.test(read("lib/admin.ts")))
ok("seed-admin has no hardcoded password", !read("prisma/seed-admin.mjs").includes("SuperAdmin@2026"))
ok("seed-admin refuses to run unattended against production", read("prisma/seed-admin.mjs").includes("Refusing to seed"))
for (const c of ["ai", "alerts", "calibrate", "discover", "ingest", "recruit-automation"]) {
  ok(`cron/${c} no longer trusts the Host header in production`,
    read(`app/api/cron/${c}/route.ts`).includes('process.env.NODE_ENV !== "production"'))
}
ok("worker tick no longer trusts the Host header in production", read("app/api/internal/jobs/tick/route.ts").includes('NODE_ENV !== "production"'))
ok("login issues a challenge instead of a bare userId", read("app/api/auth/login/route.ts").includes("issueChallenge"))
ok("login rate limiting fails CLOSED", read("app/api/auth/login/route.ts").includes("failOpen: false"))
ok("the client threads the challenge into step 2", read("app/verify/2fa/page.tsx").includes("params.get(\"ch\")"))

fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
