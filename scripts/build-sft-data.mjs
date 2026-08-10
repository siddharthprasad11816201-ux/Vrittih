/* Build a starter SFT dataset (ml/data/sft.jsonl) for QLoRA fine-tuning an open model to
 * the coach's DOMAIN + VOICE, from the in-house intent phrasings. Each row pairs a real
 * user phrasing with a short, honest coaching response for that intent. This is a SEED —
 * grow it with real, anonymised (question, good-answer) pairs for meaningful gains.
 * Run: npm run ml:sft */
import { createRequire } from "module"
import { execSync } from "child_process"
import { writeFileSync, mkdirSync, mkdtempSync, existsSync, readFileSync } from "fs"
import { tmpdir } from "os"
import { fileURLToPath } from "url"
import { dirname, resolve, join } from "path"

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = mkdtempSync(join(tmpdir(), "vrittih-sft-"))
execSync(`node "${join(ROOT, "node_modules/typescript/bin/tsc")}" lib/career/intentData.ts --outDir "${OUT}" --module commonjs --target es2019 --skipLibCheck`, { cwd: ROOT, stdio: "inherit" })
const { TRAINING } = require(join(OUT, "intentData.js"))

// Short, honest, grounded-in-spirit responses per intent (the coach's voice). These teach
// domain + tone; the running coach still injects the user's REAL data at inference.
const RESP = {
  matches: "Here are your strongest live role matches, ranked by real fit against your skills — want me to open one?",
  learn: "The highest-leverage skills to learn next, based on the live roles you're closest to, are coming right up.",
  level: "Let's read your seniority from your real experience and skills, and where you sit today.",
  resume: "I'll check your résumé against exactly what a target role screens for and give concrete fixes.",
  interview: "I'll build a mock interview from a real role and your profile so you can rehearse.",
  dna: "Here's your Career DNA — strengths, working style and where your weight sits — from your own evidence.",
  path: "Let's map where you can go next from here, with the skills each step needs. Salary only where CHF is actually listed.",
  progress: "I'll show how your skills and confidence have moved over time, measured from your own history.",
  salary: "Vrittih only shows salaries employers list in CHF — never estimated — so I'll surface the ones that do.",
  help: "I read your real profile and live roles to help with best-fit jobs, what to learn, seniority, résumé, interviews and career paths.",
}

const SYS = "You are Vrittih's in-house career coach. Answer only from the user's real profile and live roles; never invent numbers or salaries."
const seen = new Set()
const rows = []
const add = (user, assistant) => {
  user = String(user || "").trim(); assistant = String(assistant || "").trim()
  const k = user.toLowerCase()
  if (!user || !assistant || seen.has(k)) return
  seen.add(k)
  rows.push({ messages: [{ role: "system", content: SYS }, { role: "user", content: user }, { role: "assistant", content: assistant }] })
}

// 1) curated seed dataset — the bulk (ml/sft_seed.jsonl: {user, assistant} per line).
//    Grow this with real, anonymised Q&A pairs (or regenerate) for a better model.
const SEED = resolve(ROOT, "ml/sft_seed.jsonl")
let seeded = 0
if (existsSync(SEED)) {
  for (const line of readFileSync(SEED, "utf8").split("\n")) {
    if (!line.trim()) continue
    try { const o = JSON.parse(line); const before = seen.size; add(o.user, o.assistant); if (seen.size > before) seeded++ } catch {}
  }
}
// 2) intent phrasings -> a short canonical response (fills any gaps).
for (const d of TRAINING) if (RESP[d.intent]) add(d.text, RESP[d.intent])

mkdirSync(resolve(ROOT, "ml/data"), { recursive: true })
const dest = resolve(ROOT, "ml/data/sft.jsonl")
writeFileSync(dest, rows.map((r) => JSON.stringify(r)).join("\n") + "\n")
console.log(`Wrote ${rows.length} SFT rows to ml/data/sft.jsonl (${seeded} from ml/sft_seed.jsonl + ${rows.length - seeded} intent phrasings).`)
