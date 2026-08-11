/**
 * Sandbox entry point. Resolves the configured provider and runs a validated request.
 *
 * SANDBOX_PROVIDER selects the runner:
 *   (unset) | "disabled"  -> refuses to execute (safe default)
 *   "docker"              -> isolated container per execution
 *
 * An unknown value resolves to `disabled` rather than guessing: silently picking a weaker
 * runner is exactly the sort of "fake fallback" that makes a sandbox worthless.
 */
import { disabledProvider } from "./providers/disabled"
import { dockerProvider } from "./providers/docker"
import { validate } from "./policy"
import type { ExecutionRequest, ExecutionResult, SandboxProvider } from "./types"

export * from "./types"
export { validate, clampLimits, capOutput, outputMatches, summarizeTests } from "./policy"

const REGISTRY: Record<string, SandboxProvider> = {
  disabled: disabledProvider,
  docker: dockerProvider,
}

export function resolveProvider(): SandboxProvider {
  const name = (process.env.SANDBOX_PROVIDER || "disabled").toLowerCase()
  return REGISTRY[name] || disabledProvider
}

/** Register an additional runner (e.g. a hosted execution service) at boot. */
export function registerProvider(name: string, provider: SandboxProvider) {
  REGISTRY[name.toLowerCase()] = provider
}

/**
 * Validate then execute. Never throws for a bad request or an unavailable runner — both
 * are reported as explicit statuses so callers can distinguish "your code failed" from
 * "we could not run your code", which are very different things for a candidate.
 */
export async function runCode(req: ExecutionRequest): Promise<ExecutionResult> {
  const v = validate(req)
  if (!v.ok) {
    return {
      status: "rejected", exitCode: null, stdout: "", stderr: "", truncated: false,
      durationMs: 0, provider: "none", message: v.message,
    }
  }
  const provider = resolveProvider()
  if (!(await provider.isAvailable())) {
    const res = await disabledProvider.execute(req, v.limits)
    return {
      ...res,
      message: provider.name === "disabled"
        ? res.message
        : `The '${provider.name}' runner is configured but not reachable, so nothing was executed.`,
    }
  }
  return provider.execute(req, v.limits)
}

/** Health/status for admin UIs — reports the truth, including when execution is off. */
export async function sandboxStatus(): Promise<{ provider: string; available: boolean; languages: string[] }> {
  const provider = resolveProvider()
  const { LANGUAGES } = await import("./types")
  return {
    provider: provider.name,
    available: await provider.isAvailable(),
    languages: Object.keys(LANGUAGES),
  }
}
