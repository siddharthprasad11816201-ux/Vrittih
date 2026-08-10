/* Print this machine's GPU + VRAM so we can pick a model that fits.  Run: npm run gpu:check */
import { execSync } from "child_process"

const tryCmd = (c) => { try { return execSync(c, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() } catch { return null } }
const py = process.platform === "win32" ? "python" : "python3"

const smi = tryCmd("nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader")
console.log(smi ? `NVIDIA GPU(s):\n  ${smi.split("\n").join("\n  ")}` : "nvidia-smi not found — no NVIDIA GPU, or drivers not on PATH.")

const t = tryCmd(`${py} -c "import torch;print(torch.__version__, torch.cuda.is_available(), (torch.cuda.get_device_name(0) if torch.cuda.is_available() else '-'), (round(torch.cuda.get_device_properties(0).total_memory/1e9,1) if torch.cuda.is_available() else 0))"`)
let vram = 0
if (t) { const p = t.split(" "); vram = parseFloat(p[p.length - 1]) || 0; console.log(`torch ${p[0]} · cuda ${p[1]} · ${p.slice(2, -1).join(" ")} · ${vram} GB VRAM`) }
else console.log("(torch not importable — pip install torch to read VRAM)")

console.log("\nRecommendation:")
if (vram >= 22) console.log("  Run a 7–8B (Mistral 7B / Llama 3.1 8B) AND QLoRA fine-tune it. Full plan.")
else if (vram >= 11) console.log("  Run a 4-bit 7B fine; light QLoRA fine-tune with small batch/seq works.")
else if (vram >= 6) console.log("  Run a quantized 3–4B (or a slow 4-bit 7B). Fine-tuning a 7B won't fit — LoRA a ~3B instead.")
else if (vram > 0) console.log("  Low VRAM — use a small quantized model, or run the coach's in-house/from-scratch brain (no GPU needed).")
else console.log("  No CUDA VRAM detected — use the in-house or from-scratch-transformer brain (CPU).")
