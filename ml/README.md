# Coach `transformer` brain — train your own model, in-house

Train a **small text classifier from scratch on your own data** with PyTorch, on your own
machine, and use it as the coach's intent brain. No pretrained weights, no external model,
no cloud — PyTorch is the only third-party dependency, and the weights are learned from
`lib/career/intentData.ts`.

> A true 7B-from-scratch LLM is cluster-scale (hundreds of GPU-days, ~100+ GB VRAM,
> ~140B tokens) and not feasible on one machine. This is the realistic in-house model: a
> compact Transformer classifier that trains in seconds and runs on CPU or one GPU. It
> classifies **intent only** — the coach still extracts slots and composes every answer
> in-house, so the model can never fabricate advice.

## Train

```bash
npm run ml:export           # lib/career/intentData.ts -> ml/data/intents.json
pip install torch
python ml/train_intent.py   # -> ml/model/model.pt  (uses CUDA if present, else CPU)
```

Grow it by adding real, anonymised phrasings to `lib/career/intentData.ts` and re-running.

## Serve + enable

```bash
python ml/serve_intent.py   # POST /classify on 127.0.0.1:8077
```

Then set the app env and restart:

```
COACH_BRAIN=transformer
TRANSFORMER_URL=http://localhost:8077/classify
TRANSFORMER_TIMEOUT_MS=3000        # optional (default 3000)
TRANSFORMER_MIN_CONFIDENCE=0.5     # optional (default 0.5) — below this, defer to in-house
```

If the server is down / slow / returns an invalid intent, OR the prediction is below the
confidence floor, the coach silently falls back to the in-house brain — it never hard-
depends on the model, and never trusts a low-confidence (possibly confidently-wrong)
classification.

### One command for both (dev)

```bash
npm run dev:coach-transformer
```

Starts the classifier server + Next dev with the env above wired, and tears both down on
Ctrl-C. (Train the model first — see above.)

## Files
- `train_intent.py` — from-scratch Transformer (embedding + 2 encoder layers + masked
  mean-pool + linear head), trained on the intent set.
- `serve_intent.py` — stdlib HTTP server + PyTorch inference (`/classify`).
- `data/intents.json`, `model/model.pt` — generated (git-ignored below).

---

# Bigger model — Mistral (generative), on your GPU

A true 7B **from scratch** is not feasible on one machine (cluster-scale). The realistic
path is to **run — and optionally fine-tune — an open model** on your GPU.

**0. Check your hardware:** `npm run gpu:check` (prints GPU + VRAM + what fits).

**Low VRAM (≈4 GB)?** A 7B won't fit. Use a small model in one command:
```bash
ollama pull qwen2.5:1.5b-instruct     # ~2 GB VRAM (or MINI_MODEL=llama3.2:3b)
npm run dev:coach-mini                 # selfhost + grounded narration, wired to the app
```
Falls back to the in-house brain if Ollama isn't up. Your from-scratch classifier
(`npm run dev:coach-transformer`) is also an excellent fit for low VRAM.

**1. Run Mistral locally** (Ollama exposes an OpenAI-compatible endpoint):

```bash
ollama run mistral            # or: ollama pull mistral
# endpoint: http://localhost:11434/v1/chat/completions
```

**2a. Use it for intent** (classification): `COACH_BRAIN=selfhost`,
`COACH_LLM_URL=http://localhost:11434/v1/chat/completions`, `COACH_LLM_MODEL=mistral`.

**2b. Use it to *generate* answers** (grounded): `COACH_NARRATE=on` (plus the two vars
above). The model rewrites the coach's in-house answer in a warmer voice, but a hard
guardrail rejects any rewrite that introduces a number/currency not in the real data — so
it can rephrase, never fabricate. Cards/figures always come from the engine.

**3. Fine-tune Mistral on your data (QLoRA)** — adapt an open model (not from scratch):

```bash
npm run ml:sft                # build ml/data/sft.jsonl (seed — grow with real Q&A)
pip install torch transformers peft bitsandbytes datasets accelerate trl
python ml/finetune_qlora.py --base mistralai/Mistral-7B-Instruct-v0.3   # -> ml/model/lora/
```

**4. Serve your fine-tuned model** (no external stack needed):

```bash
python ml/serve_lora.py        # loads base + ml/model/lora/, OpenAI-compatible on :8078
```
```
COACH_BRAIN=selfhost
COACH_NARRATE=on
COACH_LLM_URL=http://localhost:8078/v1/chat/completions
```
Now the coach is driven by **your own fine-tuned model** — grounded (it can't invent
numbers) and falling back to in-house if the server is down. Serves the base model if no
adapter exists yet. (vLLM/llama.cpp/TGI also work if you prefer.) ~12–16 GB+ VRAM for a
7B QLoRA; use a smaller base on less (see `gpu:check`).
