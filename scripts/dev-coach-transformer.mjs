/* One command to run the coach with your own trained model: starts the local intent
 * classifier server (ml/serve_intent.py) AND the Next dev app with COACH_BRAIN=transformer,
 * and tears both down together on Ctrl-C.  Run:  npm run dev:coach-transformer
 *
 * Prereq (once):  npm run ml:export  &&  pip install torch  &&  python ml/train_intent.py */
import { spawn, execSync } from "child_process"
import { existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const isWin = process.platform === "win32"
const PORT = process.env.PORT_INTENT || "8077"

if (!existsSync(resolve(ROOT, "ml/model/model.pt"))) {
  console.error("\n✗ No trained model at ml/model/model.pt.\n  Train it first:\n    npm run ml:export\n    pip install torch\n    python ml/train_intent.py\n")
  process.exit(1)
}

const procs = []
let shuttingDown = false
function killTree(pid) {
  try {
    if (isWin) execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" })
    else process.kill(-pid, "SIGTERM")
  } catch {}
}
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  for (const p of procs) if (p.pid) killTree(p.pid)
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

function run(label, cmd, args, extraEnv) {
  const p = spawn(cmd, args, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    shell: isWin,               // resolve python / npm.cmd on Windows
    detached: !isWin,           // own process group on POSIX so we can kill the tree
  })
  procs.push(p)
  p.on("exit", (code) => { console.log(`\n[${label}] exited (${code}). Shutting everything down.`); shutdown() })
  p.on("error", (e) => { console.error(`[${label}] failed to start: ${e.message}`); shutdown() })
  return p
}

const py = isWin ? "python" : "python3"
console.log(`Starting intent classifier (:${PORT}) + Next dev with COACH_BRAIN=transformer …`)
run("model", py, ["ml/serve_intent.py"], { PORT })
run("app", isWin ? "npm.cmd" : "npm", ["run", "dev"], {
  COACH_BRAIN: "transformer",
  TRANSFORMER_URL: `http://localhost:${PORT}/classify`,
})
