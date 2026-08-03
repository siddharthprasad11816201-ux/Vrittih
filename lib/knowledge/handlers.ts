/* AIOS §23 — knowledge event handlers. When jobs change, (re)index them into the
 * semantic index incrementally. Registered once via registerKnowledgeHandlers()
 * from the AIOS bootstrap so the event bus fans job.* events here. */
import { on } from "@/lib/aios/events"
import { indexJob } from "@/lib/knowledge/pipeline"

let registered = false
export function registerKnowledgeHandlers() {
  if (registered) return
  registered = true
  on("job.created", async (p) => { if (p?.jobId) await indexJob(String(p.jobId)) })
  on("job.updated", async (p) => { if (p?.jobId) await indexJob(String(p.jobId)) })
}
