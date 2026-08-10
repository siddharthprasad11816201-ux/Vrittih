/* One command to run the coach on YOUR fine-tuned model: starts ml/serve_lora.py (base +
 * LoRA adapter, OpenAI-compatible on :8078) AND the Next dev app wired to it with
 * COACH_BRAIN=selfhost + COACH_NARRATE=on, tearing both down together on Ctrl-C.
 *
 *   python ml/finetune_qlora.py --base Qwen/Qwen2.5-0.5B-Instruct   # once (creates ml/model/lora)
 *   npm run dev:coach-lora
 *
 * Until serve_lora finishes loading the model, the coach uses its in-house brain, then
 * switches over automatically. Serves the BASE model if no adapter exists yet. */
import { spawn, execSync } from "child_process"
import { existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const isWin = process.platform === "win32"
const PORT = process.env.PORT_LORA || "8078"
const py = isWin ? "python" : "python3"

if (!existsSync(resolve(ROOT, "ml/model/lora"))) {
  console.warn("\n⚠  No adapter at ml/model/lora — will serve the BASE model.\n   Fine-tune first:  python ml/finetune_qlora.py --base Qwen/Qwen2.5-0.5B-Instruct\n")
}

const procs = []
let down = false
function killTree(pid) { try { if (isWin) execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" }); else process.kill(-pid, "SIGTERM") } catch {} }
function shutdown() { if (down) return; down = true; for (const p of procs) if (p.pid) killTree(p.pid); process.exit(0) }
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown)

function run(label, cmd, args, env) {
  const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: "inherit", shell: isWin, detached: !isWin })
  procs.push(p)
  p.on("exit", (c) => { console.log(`\n[${label}] exited (${c}). Shutting everything down.`); shutdown() })
  p.on("error", (e) => { console.error(`[${label}] failed to start: ${e.message}`); shutdown() })
  return p
}

console.log(`Starting fine-tuned model server (:${PORT}) + Next dev (COACH_BRAIN=selfhost, COACH_NARRATE=on) …`)
run("model", py, ["ml/serve_lora.py"], { PORT })
run("app", isWin ? "npm.cmd" : "npm", ["run", "dev"], {
  COACH_BRAIN: "selfhost",
  COACH_NARRATE: "on",
  COACH_LLM_URL: `http://localhost:${PORT}/v1/chat/completions`,
})
