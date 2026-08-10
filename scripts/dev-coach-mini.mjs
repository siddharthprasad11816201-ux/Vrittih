/* One command for the coach on a low-VRAM (≈4GB) machine: a SMALL model served by Ollama
 * for grounded generation, wired to the Next dev app. No Python server, no 7B.
 *
 *   ollama pull qwen2.5:1.5b-instruct     # once (≈1GB download, ~2GB VRAM)
 *   npm run dev:coach-mini
 *
 * Env: COACH_BRAIN=selfhost (intent via the model), COACH_NARRATE=on (grounded rephrase).
 * Override the model with MINI_MODEL, e.g. MINI_MODEL=llama3.2:3b. If Ollama isn't up, the
 * coach transparently uses its in-house brain until it is — the app still runs. */
import { spawn, execSync } from "child_process"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const isWin = process.platform === "win32"
const MODEL = process.env.MINI_MODEL || "qwen2.5:1.5b-instruct"
const URL = process.env.COACH_LLM_URL || "http://localhost:11434/v1/chat/completions"

// Probe Ollama so the user gets a clear heads-up (non-fatal — selfhost falls back).
const tagsUrl = URL.replace(/\/v1\/.*$/, "/api/tags")
try {
  const r = await fetch(tagsUrl, { signal: AbortSignal.timeout(1500) })
  if (r.ok) {
    const j = await r.json().catch(() => ({}))
    const has = (j.models || []).some((m) => String(m.name || "").split(":")[0] === MODEL.split(":")[0])
    console.log(`Ollama is up.${has ? ` Using ${MODEL}.` : ` Model ${MODEL} not pulled yet — run: ollama pull ${MODEL}`}`)
  } else throw 0
} catch {
  console.log(`Ollama not reachable at ${tagsUrl} — the coach will use its in-house brain until it's up.\n  Start it:  ollama serve   (then)  ollama pull ${MODEL}`)
}

console.log(`Launching Next dev with COACH_BRAIN=selfhost + COACH_NARRATE=on + ${MODEL} …`)
const p = spawn(isWin ? "npm.cmd" : "npm", ["run", "dev"], {
  cwd: ROOT,
  env: { ...process.env, COACH_BRAIN: "selfhost", COACH_NARRATE: "on", COACH_LLM_URL: URL, COACH_LLM_MODEL: MODEL },
  stdio: "inherit",
  shell: isWin,
})
process.on("SIGINT", () => { try { if (isWin) execSync(`taskkill /pid ${p.pid} /T /F`, { stdio: "ignore" }); else process.kill(p.pid) } catch {}; process.exit(0) })
p.on("exit", (c) => process.exit(c || 0))
