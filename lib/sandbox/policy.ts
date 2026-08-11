/**
 * Sandbox request policy — PURE, no I/O. Validation and output shaping that must hold
 * regardless of which provider executes the code.
 */
import { DEFAULT_LIMITS, LANGUAGES, isLanguage, type ExecutionRequest, type ResourceLimits, type TestOutcome, type TestCase } from "./types"

export const MAX_SOURCE_BYTES = 256 * 1024
export const MAX_STDIN_BYTES = 64 * 1024
export const MAX_TESTS = 50

/** Hard ceilings a caller can never exceed, however generous their request. */
export const MAX_LIMITS: ResourceLimits = {
  timeoutMs: 30_000,
  memoryMb: 1024,
  cpus: 2,
  maxOutputBytes: 1024 * 1024,
  tmpfsMb: 128,
  processes: 256,
}

export type Rejection = { ok: false; message: string }
export type Accepted = { ok: true; limits: ResourceLimits }

/** Validate a request and clamp its limits. Never trusts client-supplied limits. */
export function validate(req: ExecutionRequest): Rejection | Accepted {
  if (!req || typeof req !== "object") return { ok: false, message: "Invalid request." }
  if (!isLanguage(req.language)) {
    return { ok: false, message: `Unsupported language. Supported: ${Object.keys(LANGUAGES).join(", ")}.` }
  }
  if (typeof req.source !== "string" || !req.source.trim()) {
    return { ok: false, message: "Source code is required." }
  }
  if (Buffer.byteLength(req.source, "utf8") > MAX_SOURCE_BYTES) {
    return { ok: false, message: `Source exceeds ${Math.floor(MAX_SOURCE_BYTES / 1024)} KB.` }
  }
  if (req.stdin && Buffer.byteLength(req.stdin, "utf8") > MAX_STDIN_BYTES) {
    return { ok: false, message: `stdin exceeds ${Math.floor(MAX_STDIN_BYTES / 1024)} KB.` }
  }
  if (req.tests && (!Array.isArray(req.tests) || req.tests.length > MAX_TESTS)) {
    return { ok: false, message: `At most ${MAX_TESTS} test cases per run.` }
  }
  return { ok: true, limits: clampLimits(req.limits) }
}

/** Clamp requested limits into [1, MAX]. A client can only ever ask for LESS. */
export function clampLimits(partial?: Partial<ResourceLimits>): ResourceLimits {
  const p = partial || {}
  const pick = (k: keyof ResourceLimits) => {
    const want = typeof p[k] === "number" && isFinite(p[k] as number) ? (p[k] as number) : DEFAULT_LIMITS[k]
    return Math.max(1, Math.min(MAX_LIMITS[k], Math.floor(want)))
  }
  return {
    timeoutMs: pick("timeoutMs"),
    memoryMb: pick("memoryMb"),
    cpus: pick("cpus"),
    maxOutputBytes: pick("maxOutputBytes"),
    tmpfsMb: pick("tmpfsMb"),
    processes: pick("processes"),
  }
}

/** Truncate output to the byte cap, flagging that it happened. */
export function capOutput(s: string, maxBytes: number): { text: string; truncated: boolean } {
  const buf = Buffer.from(s ?? "", "utf8")
  if (buf.length <= maxBytes) return { text: s ?? "", truncated: false }
  return { text: buf.subarray(0, maxBytes).toString("utf8") + "\n…[output truncated]", truncated: true }
}

/** Compare program output to an expectation. Trailing whitespace differences never fail. */
export function outputMatches(actual: string, expected: string): boolean {
  const norm = (s: string) => (s ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n+$/, "")
  return norm(actual) === norm(expected)
}

/**
 * Build the candidate-visible test report. Hidden cases contribute to the score but never
 * leak their expected/actual values — otherwise "hidden" would be meaningless.
 */
export function summarizeTests(
  cases: TestCase[],
  results: { stdout: string; stderr: string }[],
): { tests: TestOutcome[]; passedCount: number; totalCount: number } {
  const tests: TestOutcome[] = cases.map((c, i) => {
    const r = results[i] || { stdout: "", stderr: "" }
    const passed = c.expectedStdout === undefined ? true : outputMatches(r.stdout, c.expectedStdout)
    const hidden = !!c.hidden
    return hidden
      ? { name: c.name, hidden: true, passed }
      : { name: c.name, hidden: false, passed, expected: c.expectedStdout, actual: r.stdout, stderr: r.stderr }
  })
  return { tests, passedCount: tests.filter((t) => t.passed).length, totalCount: tests.length }
}
