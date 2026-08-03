/* Phase 1 · Module 6 — the policy engine. Fail-closed capability checks used by
 * every server route/widget/agent. `can` for a single capability; `authorize`
 * for all/any sets. Unknown or missing => denied. */
import { isCapabilityKey } from "@/lib/capability/catalog"

export function can(caps: Set<string> | string[] | undefined | null, capability: string): boolean {
  if (!caps || !capability) return false
  const set = caps instanceof Set ? caps : new Set(caps)
  return set.has(capability)
}

/** Require all (default) or any of the given capabilities. Fail-closed. */
export function authorize(caps: Set<string> | string[] | undefined | null, required: string | string[], mode: "all" | "any" = "all"): boolean {
  const need = Array.isArray(required) ? required : [required]
  if (!need.length) return false
  const set = caps instanceof Set ? caps : new Set(caps || [])
  return mode === "any" ? need.some((c) => set.has(c)) : need.every((c) => set.has(c))
}

/** Validate a capability requirement references real catalog keys (dev guard). */
export function assertKnown(required: string | string[]): void {
  const need = Array.isArray(required) ? required : [required]
  const unknown = need.filter((c) => !isCapabilityKey(c))
  if (unknown.length) console.warn("[capability] unknown capability key(s):", unknown.join(", "))
}
