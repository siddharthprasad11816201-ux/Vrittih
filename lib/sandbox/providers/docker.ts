import { spawn } from "child_process"
import { mkdtemp, writeFile, rm } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { LANGUAGES, type ExecutionRequest, type ExecutionResult, type ResourceLimits, type SandboxProvider } from "../types"
import { capOutput, summarizeTests } from "../policy"

/**
 * Docker-backed runner: every execution gets a throwaway container with no network, a
 * read-only root filesystem, a non-root user, a size-capped tmpfs scratch, and CPU/memory/
 * PID caps.
 *
 * Every flag below is load-bearing:
 *   --network none                    no exfiltration, no callbacks, no package installs
 *   --read-only                       the image filesystem cannot be modified
 *   --tmpfs /work                     the ONLY writable path, size-capped
 *   --pids-limit                      stops fork bombs
 *   --memory / --memory-swap equal    OOM-kill instead of swapping the host to death
 *   --cpus                            one submission cannot starve the box
 *   --cap-drop ALL                    no privileged operations
 *   --security-opt no-new-privileges  setuid binaries cannot escalate
 *   --user 65534:65534                runs as nobody
 * Plus a wall-clock kill on the host side, because a container can outlive its entrypoint.
 */
function dockerArgs(limits: ResourceLimits, workdir: string, image: string, cmd: string): string[] {
  return [
    "run", "--rm", "-i",
    "--network", "none",
    "--read-only",
    "--tmpfs", `/work:rw,size=${limits.tmpfsMb}m,mode=1777`,
    "--pids-limit", String(limits.processes),
    "--memory", `${limits.memoryMb}m`,
    "--memory-swap", `${limits.memoryMb}m`,
    "--cpus", String(limits.cpus),
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--user", "65534:65534",
    "-v", `${workdir}:/src:ro`,
    "-w", "/work",
    image,
    "/bin/sh", "-c", `cp -r /src/. /work/ 2>/dev/null; ${cmd}`,
  ]
}

interface RawRun { code: number | null; stdout: string; stderr: string; timedOut: boolean; truncated: boolean }

function runDocker(args: string[], stdin: string, timeoutMs: number, maxOutputBytes: number): Promise<RawRun> {
  return new Promise((resolve) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] })
    let truncated = false
    let timedOut = false
    let settled = false

    // Collect chunks and join once. Stop accumulating at the cap: a program printing
    // endlessly must not exhaust the SERVER's memory just because the container is capped.
    // (Repeated Buffer.concat per chunk would also be quadratic.)
    const sink = () => ({ chunks: [] as Buffer[], len: 0 })
    const outBuf = sink()
    const errBuf = sink()
    const append = (s: { chunks: Buffer[]; len: number }, chunk: Buffer) => {
      if (s.len >= maxOutputBytes) { truncated = true; return }
      const room = maxOutputBytes - s.len
      if (chunk.length > room) {
        s.chunks.push(chunk.subarray(0, room)); s.len += room; truncated = true
      } else {
        s.chunks.push(chunk); s.len += chunk.length
      }
    }
    const text = (s: { chunks: Buffer[] }) => Buffer.concat(s.chunks).toString("utf8")
    child.stdout.on("data", (c: Buffer) => append(outBuf, c))
    child.stderr.on("data", (c: Buffer) => append(errBuf, c))

    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")   // --rm reaps the container
    }, timeoutMs)

    const finish = (code: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ code, stdout: text(outBuf), stderr: text(errBuf), timedOut, truncated })
    }
    child.on("error", (e: any) => { append(errBuf, Buffer.from(String(e?.message || e))); finish(null) })
    child.on("close", (code) => finish(code))

    try { child.stdin.write(stdin || "") } catch { /* process may already be gone */ }
    try { child.stdin.end() } catch { /* ignore */ }
  })
}

export const dockerProvider: SandboxProvider = {
  name: "docker",

  async isAvailable() {
    return new Promise<boolean>((resolve) => {
      const p = spawn("docker", ["version", "--format", "{{.Server.Version}}"], { stdio: "ignore" })
      const t = setTimeout(() => { p.kill("SIGKILL"); resolve(false) }, 5000)
      p.on("error", () => { clearTimeout(t); resolve(false) })
      p.on("close", (code) => { clearTimeout(t); resolve(code === 0) })
    })
  },

  async execute(req: ExecutionRequest, limits: ResourceLimits): Promise<ExecutionResult> {
    const spec = LANGUAGES[req.language]
    const started = Date.now()
    const dir = await mkdtemp(join(tmpdir(), "sbx-"))
    try {
      await writeFile(join(dir, spec.filename), req.source, "utf8")
      const runCmd = spec.compile ? `${spec.compile} && ${spec.run}` : spec.run

      if (!req.tests || req.tests.length === 0) {
        const r = await runDocker(dockerArgs(limits, dir, spec.image, runCmd), req.stdin || "", limits.timeoutMs, limits.maxOutputBytes)
        const stdout = capOutput(r.stdout, limits.maxOutputBytes)
        const stderr = capOutput(r.stderr, limits.maxOutputBytes)
        const status: ExecutionResult["status"] =
          r.timedOut ? "timeout"
          : r.code === 137 ? "memory_exceeded"
          : spec.compile && r.code !== 0 && /error:/i.test(r.stderr) ? "compile_error"
          : r.code !== 0 ? "runtime_error"
          : (stdout.truncated || stderr.truncated) ? "output_truncated"
          : "ok"
        return {
          status,
          exitCode: r.code,
          stdout: stdout.text,
          stderr: stderr.text,
          truncated: stdout.truncated || stderr.truncated,
          durationMs: Date.now() - started,
          provider: "docker",
        }
      }

      // Each test case runs in its OWN container, so one crashing case cannot affect another.
      const results: { stdout: string; stderr: string }[] = []
      let anyTimeout = false
      let anyTruncated = false
      let lastCode: number | null = 0
      for (const c of req.tests) {
        const r = await runDocker(dockerArgs(limits, dir, spec.image, runCmd), c.stdin || "", limits.timeoutMs, limits.maxOutputBytes)
        if (r.timedOut) anyTimeout = true
        if (r.truncated) anyTruncated = true
        lastCode = r.code
        results.push({
          stdout: capOutput(r.stdout, limits.maxOutputBytes).text,
          stderr: capOutput(r.stderr, limits.maxOutputBytes).text,
        })
      }
      const summary = summarizeTests(req.tests, results)
      return {
        status: anyTimeout ? "timeout" : "ok",
        exitCode: lastCode,
        stdout: "",
        stderr: "",
        truncated: anyTruncated,
        durationMs: Date.now() - started,
        provider: "docker",
        ...summary,
      }
    } catch (e: any) {
      // A real failure is reported as a failure — never as a passing run.
      return {
        status: "runtime_error",
        exitCode: null,
        stdout: "",
        stderr: String(e?.message || e),
        truncated: false,
        durationMs: Date.now() - started,
        provider: "docker",
        message: "The sandbox failed to run this submission.",
      }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  },
}
