/* Phase 13 — Automation rule engine. PURE + testable: no IO. Evaluates a rule's
 * conditions against an event payload and interpolates {{field}} templates. Action
 * dispatch (which does IO) lives in actions.ts. */

export type Op = "eq" | "ne" | "contains" | "gt" | "lt" | "exists" | "truthy"
export const OPS: { key: Op; label: string; needsValue: boolean }[] = [
  { key: "eq", label: "equals", needsValue: true },
  { key: "ne", label: "does not equal", needsValue: true },
  { key: "contains", label: "contains", needsValue: true },
  { key: "gt", label: "greater than", needsValue: true },
  { key: "lt", label: "less than", needsValue: true },
  { key: "exists", label: "is present", needsValue: false },
  { key: "truthy", label: "is true", needsValue: false },
]

export type Condition = { field: string; op: Op; value?: string }

/* Read a dot-path (e.g. "applicant.name") from a payload, safely. */
export function getField(payload: any, path: string): any {
  if (!path) return undefined
  return String(path).split(".").reduce((o: any, k) => (o == null ? undefined : o[k]), payload)
}

export function evalCondition(c: Condition, payload: any): boolean {
  const actual = getField(payload, c.field)
  const v = c.value
  switch (c.op) {
    case "exists": return actual !== undefined && actual !== null && actual !== ""
    case "truthy": return actual === true || actual === "true" || (typeof actual === "number" && actual !== 0)
    case "eq": return String(actual) === String(v)
    case "ne": return String(actual) !== String(v)
    case "contains": return String(actual ?? "").toLowerCase().includes(String(v ?? "").toLowerCase())
    case "gt": return Number(actual) > Number(v)
    case "lt": return Number(actual) < Number(v)
    default: return false
  }
}

/* AND semantics. No conditions = always matches (a plain trigger rule). */
export function evaluateConditions(conditions: Condition[] | null | undefined, payload: any): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return true
  return conditions.every(c => evalCondition(c, payload))
}

/* Replace {{field}} tokens in a template with values from the payload. */
export function interpolate(template: string, payload: any): string {
  return String(template ?? "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, f) => {
    const v = getField(payload, f)
    return v == null ? "" : String(v)
  })
}

export function parseConditions(json: string): Condition[] {
  try { const v = JSON.parse(json || "[]"); return Array.isArray(v) ? v : [] } catch { return [] }
}
