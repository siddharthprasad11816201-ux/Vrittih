import type { ExecutionRequest, ExecutionResult, ResourceLimits, SandboxProvider } from "../types"

/**
 * The DEFAULT provider. It runs nothing.
 *
 * This is deliberate. When no isolated runner is configured the honest outcome is "we
 * cannot execute this safely" — not a fabricated pass, and certainly not a fallback to
 * in-process evaluation. Running untrusted candidate code inside the application process
 * would hand an attacker the server's filesystem, network and environment (including
 * DATABASE_URL). Node's `vm` and `worker_threads` are NOT security boundaries.
 */
export const disabledProvider: SandboxProvider = {
  name: "disabled",
  async isAvailable() { return false },
  async execute(_req: ExecutionRequest, _limits: ResourceLimits): Promise<ExecutionResult> {
    return {
      status: "unavailable",
      exitCode: null,
      stdout: "",
      stderr: "",
      truncated: false,
      durationMs: 0,
      provider: "disabled",
      message:
        "Code execution is not available: no isolated runner is configured. Set SANDBOX_PROVIDER=docker " +
        "on a host with a Docker daemon. Untrusted code is never executed in the application process.",
    }
  },
}
