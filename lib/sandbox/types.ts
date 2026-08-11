/**
 * Sandboxed execution of UNTRUSTED candidate code.
 *
 * Non-negotiable rule: candidate code never runs inside the application process. Node's
 * `vm` module is explicitly NOT a security boundary (the docs say so) and neither is
 * `worker_threads` — both share the process, the filesystem and the network. Anything that
 * claims otherwise is a fake sandbox.
 *
 * So execution is a PROVIDER interface. A provider that cannot guarantee isolation must
 * refuse rather than degrade, which is why the default provider is `disabled`.
 */

export type LanguageId = "python" | "javascript" | "typescript" | "c" | "cpp" | "java"

export interface LanguageSpec {
  id: LanguageId
  label: string
  /** Source file name inside the sandbox. */
  filename: string
  /** Container image used by the docker provider. */
  image: string
  /** Shell command that compiles (optional) and runs the file. */
  run: string
  compile?: string
}

/** Languages are declared here, never hard-coded in the UI — the UI reads this registry. */
export const LANGUAGES: Record<LanguageId, LanguageSpec> = {
  python:     { id: "python",     label: "Python 3",   filename: "main.py",   image: "python:3.12-alpine", run: "python3 main.py" },
  javascript: { id: "javascript", label: "JavaScript", filename: "main.js",   image: "node:22-alpine",     run: "node main.js" },
  typescript: { id: "typescript", label: "TypeScript", filename: "main.ts",   image: "node:22-alpine",     run: "node --experimental-strip-types main.ts" },
  c:          { id: "c",          label: "C",          filename: "main.c",    image: "gcc:13",             run: "./a.out", compile: "gcc -O2 -o a.out main.c" },
  cpp:        { id: "cpp",        label: "C++",        filename: "main.cpp",  image: "gcc:13",             run: "./a.out", compile: "g++ -O2 -std=c++20 -o a.out main.cpp" },
  java:       { id: "java",       label: "Java",       filename: "Main.java", image: "eclipse-temurin:21-jdk", run: "java Main.java" },
}

export function isLanguage(v: any): v is LanguageId {
  return typeof v === "string" && v in LANGUAGES
}

export interface ResourceLimits {
  /** Wall-clock limit for the whole run. */
  timeoutMs: number
  memoryMb: number
  cpus: number
  /** Bytes of stdout+stderr retained; anything beyond is truncated. */
  maxOutputBytes: number
  /** Writable scratch space. */
  tmpfsMb: number
  processes: number
}

export const DEFAULT_LIMITS: ResourceLimits = {
  timeoutMs: 10_000,
  memoryMb: 256,
  cpus: 1,
  maxOutputBytes: 64 * 1024,
  tmpfsMb: 32,
  processes: 64,
}

export interface TestCase {
  /** Hidden test cases are graded but never returned to the candidate. */
  hidden?: boolean
  stdin?: string
  expectedStdout?: string
  name?: string
}

export interface ExecutionRequest {
  language: LanguageId
  source: string
  stdin?: string
  tests?: TestCase[]
  limits?: Partial<ResourceLimits>
}

export type ExecutionStatus =
  | "ok"                 // ran to completion (exit code may still be non-zero)
  | "compile_error"
  | "runtime_error"
  | "timeout"
  | "memory_exceeded"
  | "output_truncated"
  | "unavailable"        // no isolated runner configured — NOT a failure of the code
  | "rejected"           // request violated policy (size, language, etc.)

export interface TestOutcome {
  name?: string
  hidden: boolean
  passed: boolean
  /** Omitted for hidden cases so the candidate cannot reverse-engineer them. */
  expected?: string
  actual?: string
  stderr?: string
}

export interface ExecutionResult {
  status: ExecutionStatus
  exitCode: number | null
  stdout: string
  stderr: string
  truncated: boolean
  durationMs: number
  /** Which provider actually ran it — recorded for auditability. */
  provider: string
  tests?: TestOutcome[]
  passedCount?: number
  totalCount?: number
  /** Present when status is "unavailable" or "rejected": why, in plain language. */
  message?: string
}

export interface SandboxProvider {
  readonly name: string
  /** True only when this provider can actually isolate execution right now. */
  isAvailable(): Promise<boolean>
  execute(req: ExecutionRequest, limits: ResourceLimits): Promise<ExecutionResult>
}
