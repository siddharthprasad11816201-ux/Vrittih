// Runs the three dev processes together: Next (3000), chat WS (3001), signal (3002).
// Dependency-free — uses Node's child_process. Ctrl+C stops all of them (whole tree).
import { spawn, execSync } from "node:child_process"

const isWin = process.platform === "win32"
const procs = [
  { name: "next  ", color: "\x1b[36m", command: "npx next dev" },
  { name: "chat  ", color: "\x1b[35m", command: "node server/chat.js" },
  { name: "signal", color: "\x1b[33m", command: "node server/signal.js" },
  { name: "worker", color: "\x1b[32m", command: "node server/worker.js" },
]

const children = procs.map(({ name, color, command }) => {
  // shell:true so `npx` resolves to npx.cmd on Windows (spawn can't exec .cmd directly).
  // detached on POSIX so the child becomes a group leader we can signal as a group.
  const child = spawn(command, { stdio: ["ignore", "pipe", "pipe"], shell: true, detached: !isWin })
  const tag = `${color}[${name}]\x1b[0m `
  const pipe = (stream) => stream.on("data", (d) =>
    d.toString().split("\n").filter(Boolean).forEach((line) => process.stdout.write(tag + line + "\n")))
  pipe(child.stdout)
  pipe(child.stderr)
  child.on("exit", (code) => {
    process.stdout.write(tag + `exited with code ${code}\n`)
    shutdown()
  })
  return child
})

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) {
    if (!c.pid) continue
    try {
      // Kill the whole tree — shell:true means c.pid is a wrapper; its real child must die too.
      if (isWin) execSync(`taskkill /pid ${c.pid} /T /F`, { stdio: "ignore" })
      else process.kill(-c.pid, "SIGTERM")
    } catch {}
  }
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
