// One-command Vercel setup for a given scope (team/account).
//
//   node scripts/setup-vercel.mjs <scope> [--project vrittih] [--git] [--deploy]
//
// Creates/links the project, sets every production env var, optionally connects
// the GitHub repo for push-to-deploy, and optionally ships a production build.
//
// Secrets (JWT_SECRET / FACE_VECTOR_KEY / WORKER_SECRET) are generated here and
// never printed or written to disk — they go straight into Vercel's encrypted
// env store. Re-running rotates them, which signs existing sessions out.
import { execFileSync } from "child_process"
import crypto from "crypto"

const args = process.argv.slice(2)
const scope = args.find((a) => !a.startsWith("--"))
const project = (args.find((a) => a.startsWith("--project=")) || "--project=vrittih").split("=")[1]
const doGit = args.includes("--git")
const doDeploy = args.includes("--deploy")

if (!scope) {
  console.error("Usage: node scripts/setup-vercel.mjs <scope> [--project=vrittih] [--git] [--deploy]")
  console.error("  e.g. node scripts/setup-vercel.mjs vrittihonline --git --deploy")
  process.exit(1)
}

// Windows resolves `npx` only as npx.cmd, which execFileSync cannot spawn directly.
const NPX = process.platform === "win32" ? "npx.cmd" : "npx"
const vercel = (a, opts = {}) =>
  execFileSync(NPX, ["vercel", ...a, "--scope", scope], {
    encoding: "utf8", stdio: opts.stdio || "pipe", input: opts.input,
    shell: process.platform === "win32",
  })

// Values that are safe to keep in source: they are public identifiers or the
// caller's own infrastructure, not secrets that grant account access.
const PUBLIC_ENV = {
  NODE_ENV: "production",
  ACTIVE_PAYMENT_GATEWAY: "razorpay",
  NEXT_PUBLIC_SUPABASE_URL: "https://jhczcauwevatfpdtteyg.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_yvSpk5_iFMNPr6GSKVwnsg_I1m5XU-n",
  SUPERADMIN_EMAIL: "superadmin@vrittih.online",
  SUPERADMIN_NAME: "Super Admin",
}

// DATABASE_URL must come from the environment — never hard-code a live DB password.
const DATABASE_URL = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL
if (!DATABASE_URL || !/^postgres/.test(DATABASE_URL)) {
  console.error("✗ Set DATABASE_URL_PROD to the Postgres connection string first, e.g.")
  console.error('  $env:DATABASE_URL_PROD="postgresql://…@…pooler.supabase.com:5432/postgres"')
  process.exit(1)
}

const SECRETS = {
  JWT_SECRET: crypto.randomBytes(48).toString("hex"),
  FACE_VECTOR_KEY: crypto.randomBytes(32).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 32).padEnd(32, "x"),
  WORKER_SECRET: crypto.randomBytes(24).toString("hex"),
}

console.log(`\n▸ scope: ${scope}   project: ${project}`)

// 1. link (creates the project if missing)
try {
  vercel(["link", "--yes", "--project", project])
  console.log("✔ project linked")
} catch (e) {
  console.error("✗ link failed:", String(e.stdout || e.message).split("\n").slice(-3).join(" ").trim())
  process.exit(1)
}

// 2. env vars
const all = { DATABASE_URL, ...SECRETS, ...PUBLIC_ENV }
let ok = 0
for (const [k, v] of Object.entries(all)) {
  try {
    vercel(["env", "add", k, "production", "--force"], { input: v })
    console.log(`  ✔ ${k}`)
    ok++
  } catch {
    console.log(`  ✗ ${k}`)
  }
}
console.log(`✔ ${ok}/${Object.keys(all).length} env vars set`)

// 3. git connect -> push-to-deploy
if (doGit) {
  try {
    vercel(["git", "connect", "--yes"])
    console.log("✔ GitHub repo connected (pushes to main will auto-deploy)")
  } catch (e) {
    console.log("• git connect skipped:", String(e.stdout || e.message).split("\n").slice(-2).join(" ").trim().slice(0, 160))
  }
}

// 4. deploy
if (doDeploy) {
  console.log("\n▸ deploying to production…")
  try {
    const out = vercel(["deploy", "--prod", "--yes"])
    const url = (out.match(/https:\/\/[^\s"]+\.vercel\.app/) || [])[0]
    console.log("✔ deployed:", url || out.trim().split("\n").pop())
  } catch (e) {
    console.error("✗ deploy failed:", String(e.stdout || e.message).split("\n").slice(-6).join("\n"))
    process.exit(1)
  }
}

console.log(`\nDone. Verify:  https://${project}.vercel.app/api/stats`)
