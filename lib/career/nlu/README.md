# Coach brain (pluggable NLU)

The AI Career Coach's language understanding is pluggable. The coach's **answers are
always composed from real profile + job data** by the in-house engine, and all
**user-facing wording (including conversational replies) is in-house** — a non-default
brain only decides *intent + slots*. So swapping brains can make understanding smarter,
but can never let the coach fabricate advice or author a reply.

Selected by the `COACH_BRAIN` env var (default: in-house).

## `inhouse` (default — keeps ALL rules)
Rules + trained Naive Bayes + slot extraction + conversational handling. No third-party
libraries, no external model, patent-clean, runs anywhere, trains in seconds
(`npm run train:semantic` for the semantic model; intent data in `intentData.ts`).

Nothing to configure — this is what ships.

## `selfhost` (opt-in — relaxes "no external model")
Routes understanding to a **local, self-hosted, OpenAI-compatible** chat endpoint you run
on your own GPU (llama.cpp server, Ollama, vLLM, …). Nothing leaves your machine; no SaaS
LLM. **Always falls back to `inhouse` on any error/timeout**, so the coach never hard-
depends on the model being up.

```
COACH_BRAIN=selfhost
COACH_LLM_URL=http://localhost:11434/v1/chat/completions   # e.g. Ollama
COACH_LLM_MODEL=llama3.1:8b                                 # optional (default "local")
COACH_LLM_KEY=...                                           # optional bearer token
COACH_LLM_TIMEOUT_MS=4000                                   # optional (default 4000)
```

Enabling this relaxes the platform's "no external model" rule **for classification only**
— the model picks intent + slots; it never writes a single user-facing word (conversational
replies and answers are always in-house). Model output that's oversized, malformed, or an
invalid intent is discarded and the request falls back to in-house.

## `transformer` (planned — relaxes "no third-party libs")
Your own small transformer trained from scratch on your data with PyTorch on your GPU.
Register it via `registerBrain("transformer", …)` in a new `transformer.ts` and set
`COACH_BRAIN=transformer`. (A true 7B-from-scratch model is cluster-scale and not feasible
on a single machine — see the honest constraints discussion. A small in-house transformer
IS feasible on one GPU.)

## Adding a brain
Implement `CoachBrain` (`understand(message) => Promise<Understanding>`), call
`registerBrain(name, factory)` at module load, and import the module for its side effect
in `app/api/career/coach/route.ts`. Always degrade to `inhouseBrain` on failure.
