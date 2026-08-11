/**
 * DEPRECATED — the process-local limiter that used to live here has been removed.
 *
 * It kept counters in a Map, which on serverless meant every instance had its own budget:
 * an attacker only had to land on different lambdas to multiply their allowance. Rate
 * limiting now lives in lib/ratelimit/store.ts, backed by a shared DB counter.
 *
 * This file re-exports the real implementation so any missed import keeps working, and
 * the old sync helpers are intentionally NOT provided — a sync signature cannot be
 * correct against a shared store, and silently degrading would reintroduce the hole.
 *
 *   OLD:  const rl = checkRateLimit(`login:email:${em}`)
 *   NEW:  const rl = await rateLimit("auth", em, { failOpen: false })
 */
export { rateLimit, clearRateLimit, sweepRateLimits, clientIp } from "./ratelimit/store"
export * from "./ratelimit/policy"
