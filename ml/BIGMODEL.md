# Big-model path — a fluent generative coach (needs a bigger GPU than 4 GB)

The whole pipeline (`finetune_qlora.py` → `serve_lora.py` → `npm run dev:coach-lora`)
**already scales to a 3B–7B model with no code changes** — it's gated only by VRAM. On a
4 GB laptop a 0.5B is the ceiling, and a 0.5B can't *write* coherently (use the in-house
coach, `npm run dev:coach-transformer`, there). This file is the runbook for when you have
a capable GPU.

## What each tier needs

| Model | QLoRA fine-tune (4-bit) | Inference (4-bit) | Download | Fluency |
|-------|-------------------------|-------------------|----------|---------|
| 0.5B  | ~3 GB ✅ (your laptop)   | ~1.5 GB           | ~1 GB    | poor — don't let it *write* |
| 1.5B  | ~4–5 GB                 | ~2 GB             | ~3 GB    | ok |
| 3–4B  | ~8 GB                   | ~3–4 GB           | ~6–8 GB  | good |
| 7–8B  | ~12–16 GB               | ~5–8 GB           | ~15 GB   | strong (recommended target) |

The `finetune_qlora.py` VRAM preflight enforces these — it refuses a base too big for the
GPU (override with `--force`). Run `npm run gpu:check` to see what fits.

## Steps (identical to the 0.5B flow, just a bigger `--base`)

```bash
npm run gpu:check                                   # confirm VRAM
npm run ml:sft                                      # build ml/data/sft.jsonl (already ~989 rows)
pip install torch transformers peft bitsandbytes datasets accelerate trl

# fine-tune (pick the biggest your GPU allows)
python ml/finetune_qlora.py --base mistralai/Mistral-7B-Instruct-v0.3      # ≥12 GB
#   or:  --base Qwen/Qwen2.5-3B-Instruct       (≥8 GB)
#   or:  --base meta-llama/Llama-3.1-8B-Instruct

# serve base + your LoRA adapter, OpenAI-compatible on :8078
python ml/serve_lora.py

# run the coach on it (generation ON — only worth it at 3B+)
npm run dev:coach-lora
```

`serve_lora.py` auto-detects the base from the adapter, so nothing else changes. Grounding
(`COACH_NARRATE=on`, set by the launcher) keeps every fact from your real engine — the
bigger model only makes the *phrasing* fluent, and the guardrail still rejects any invented
number/currency.

## No 4 GB GPU handy?

- **Rent a cloud GPU** (e.g. a single 24 GB card) for a few hours — the *same* commands run
  there; copy `ml/model/lora/` back and serve locally, or serve from the rental. (This does
  mean the model leaves your machine during training — a deliberate exception to "local
  only", your call.)
- Otherwise stay in-house: `npm run dev:coach-transformer` is coherent and accurate today,
  and every taxonomy/dataset improvement makes it sharper without any GPU.

## More data = better at every tier

The single best lever independent of model size: grow `ml/sft_seed.jsonl` with more real,
anonymised (question → good answer) pairs, then `npm run ml:sft` and re-fine-tune. Already
at ~933 curated pairs.
