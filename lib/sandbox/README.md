# Code execution sandbox

Runs **untrusted candidate code** for coding assessments and interviews.

## The rule

Candidate code never runs inside the application process. Node's `vm` module is explicitly
not a security boundary (its own documentation says so), and `worker_threads` shares the
process, filesystem, network and environment — including `DATABASE_URL`. Any "sandbox"
built on those is theatre.

So execution is a **provider** interface, and a provider that cannot guarantee isolation
**refuses** rather than degrading to something weaker.

## Default: OFF

With no configuration, `SANDBOX_PROVIDER` is `disabled`: every request returns
`status: "unavailable"` with an explanation. That is the honest answer when there is
nowhere safe to run code. It is never reported as a passing or failing submission — the API
distinguishes "your code failed" (`runtime_error`) from "we could not run your code"
(`unavailable`), which matter very differently to a candidate.

An unknown `SANDBOX_PROVIDER` value also resolves to `disabled`, never to a weaker runner.

## Enabling the Docker runner

Requires a host with a Docker daemon — **this does not work on Vercel serverless**. Run the
sandbox on a separate worker/VM.

```bash
export SANDBOX_PROVIDER=docker

# Pre-pull the images so the first candidate does not pay the download cost:
docker pull python:3.12-alpine
docker pull node:22-alpine
docker pull gcc:13
docker pull eclipse-temurin:21-jdk
```

Each execution gets a fresh container with:

| Control | Flag | Why |
|---|---|---|
| No network | `--network none` | no exfiltration, no callbacks, no package installs |
| Read-only root | `--read-only` | the image cannot be modified |
| Scratch only | `--tmpfs /work` (size-capped) | the single writable path |
| Fork-bomb guard | `--pids-limit` | bounds process count |
| Memory cap | `--memory` + equal `--memory-swap` | OOM-kill instead of swapping the host to death |
| CPU cap | `--cpus` | one submission cannot starve the box |
| No capabilities | `--cap-drop ALL` | no privileged operations |
| No escalation | `--security-opt no-new-privileges` | setuid binaries cannot escalate |
| Non-root | `--user 65534:65534` | runs as `nobody` |
| Wall clock | host-side `SIGKILL` | a container can outlive its entrypoint |

Output is capped **as it streams**, so a program printing endlessly cannot exhaust the
server's memory even though the container itself is capped.

Every test case runs in its **own** container, so one crashing case cannot affect another.

## Adding a language

Add an entry to `LANGUAGES` in `types.ts` (id, label, filename, image, run, optional
compile). The API exposes the registry at `GET /api/sandbox/run`, and the UI reads it from
there — languages are never hard-coded in the frontend.

## Hidden test cases

`summarizeTests` returns pass/fail for hidden cases but strips `expected` and `actual`,
otherwise "hidden" would be meaningless. The API also forces `hidden: false` on any tests
supplied by the client: hidden cases may only come from the server-side problem definition,
or a candidate could submit tests their own code happens to pass.

## Limits

Clients may only ever request **less** than the ceilings in `policy.ts` (`MAX_LIMITS`);
requested values are clamped, never trusted.

## Adding another provider

Implement `SandboxProvider` (`isAvailable()` + `execute()`) and call `registerProvider()`.
`isAvailable()` must return `false` whenever isolation cannot be guaranteed — the caller
relies on that to refuse rather than run.
