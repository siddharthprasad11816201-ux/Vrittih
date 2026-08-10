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
