/* Export the in-house intent training set (lib/career/intentData.ts) to
 * ml/data/intents.json so the from-scratch PyTorch trainer (ml/train_intent.py) can
 * learn from it. No data leaves the repo. Run: npm run ml:export */
import { createRequire } from "module"
import { execSync } from "child_process"
import { writeFileSync, mkdirSync, mkdtempSync } from "fs"
import { tmpdir } from "os"
import { fileURLToPath } from "url"
import { dirname, resolve, join } from "path"

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = mkdtempSync(join(tmpdir(), "vrittih-intent-"))
execSync(`node "${join(ROOT, "node_modules/typescript/bin/tsc")}" lib/career/intentData.ts --outDir "${OUT}" --module commonjs --target es2019 --skipLibCheck`, { cwd: ROOT, stdio: "inherit" })
const { TRAINING } = require(join(OUT, "intentData.js"))

mkdirSync(resolve(ROOT, "ml/data"), { recursive: true })
const dest = resolve(ROOT, "ml/data/intents.json")
writeFileSync(dest, JSON.stringify(TRAINING, null, 2))
const byIntent = {}
for (const r of TRAINING) byIntent[r.intent] = (byIntent[r.intent] || 0) + 1
console.log(`Wrote ${TRAINING.length} examples across ${Object.keys(byIntent).length} intents to ml/data/intents.json`)
console.log(byIntent)
