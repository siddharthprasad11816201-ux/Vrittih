// Vrittih background-job worker process.
// Drives the in-house queue by ticking the internal drain endpoint on an
// interval. Handler execution happens inside Next (full lib/prisma access).
// Run:  npm run dev:worker   (alongside `npm run dev`)
require("./_shared").loadEnv()

const BASE = process.env.APP_URL || "http://localhost:3000"
const SECRET = process.env.WORKER_SECRET || ""
const INTERVAL = Number(process.env.WORKER_INTERVAL_MS || 3000)

async function tick() {
  try {
    const res = await fetch(BASE + "/api/internal/jobs/tick", {
      method: "POST",
      headers: SECRET ? { "x-worker-secret": SECRET } : {},
    })
    if (!res.ok) { console.error(`[WORKER] tick ${res.status}`); return }
    const d = await res.json()
    if (d.processed > 0) console.log(`[WORKER] processed ${d.processed}`, d.stats)
  } catch (e) {
    console.error("[WORKER] tick error:", e.message)
  }
}

console.log(`[WORKER] Vrittih worker running — ticking ${BASE} every ${INTERVAL}ms`)
tick()
setInterval(tick, INTERVAL)
