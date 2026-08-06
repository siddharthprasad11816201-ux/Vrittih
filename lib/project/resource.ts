/* Resource Allocation — team load + over-allocation. PURE, testable.
 *
 * Phase 5. In-house, deterministic. Aggregates open project work per assignee, flags
 * over-allocation against a capacity, and scores how balanced the distribution is.
 * Names are resolved by the caller (from Employee rows) and passed in; unknown ids
 * fall back to a short id and null assignee becomes the "Unassigned" bucket.
 */

export interface AssignTask { assigneeId?: string | null; status: string; priority?: string }

export interface Load {
  assigneeId: string | null
  name: string
  todo: number
  doing: number
  open: number        // todo + doing
  done: number
  loadPct: number     // open / capacity, capped for display at 999
  overAllocated: boolean
}

const UNASSIGNED = "__unassigned__"

/* Per-assignee load across the supplied tasks. capacity = open tasks that equal 100%. */
export function resourceLoad(tasks: AssignTask[], opts?: { capacity?: number; names?: Record<string, string> }): Load[] {
  const capacity = Math.max(1, opts?.capacity ?? 8)
  const names = opts?.names || {}
  const by = new Map<string, { todo: number; doing: number; done: number }>()
  for (const t of tasks) {
    const key = t.assigneeId || UNASSIGNED
    const e = by.get(key) || { todo: 0, doing: 0, done: 0 }
    if (t.status === "DONE") e.done++
    else if (t.status === "DOING") e.doing++
    else e.todo++
    by.set(key, e)
  }
  const out: Load[] = []
  for (const [key, e] of by) {
    const open = e.todo + e.doing
    const isUn = key === UNASSIGNED
    out.push({
      assigneeId: isUn ? null : key,
      name: isUn ? "Unassigned" : (names[key] || key.slice(0, 8)),
      todo: e.todo, doing: e.doing, open, done: e.done,
      loadPct: Math.min(999, Math.round((open / capacity) * 100)),
      overAllocated: !isUn && open > capacity,
    })
  }
  // Busiest first; Unassigned sorts to the end regardless of size.
  return out.sort((a, b) => (a.assigneeId === null ? 1 : b.assigneeId === null ? -1 : 0) || b.open - a.open)
}

export interface AllocationBalance {
  people: number            // distinct real assignees (excludes Unassigned)
  totalOpen: number
  assignedOpen: number
  unassignedOpen: number
  overAllocated: number     // people over capacity
  idle: number              // real assignees with zero open work
  maxLoadPct: number
  band: "balanced" | "uneven" | "overloaded"
}

/* Summarise how healthy the distribution is across the team. */
export function allocationBalance(loads: Load[]): AllocationBalance {
  const real = loads.filter(l => l.assigneeId !== null)
  const un = loads.find(l => l.assigneeId === null)
  const totalOpen = loads.reduce((a, l) => a + l.open, 0)
  const assignedOpen = real.reduce((a, l) => a + l.open, 0)
  const unassignedOpen = un?.open || 0
  const overAllocated = real.filter(l => l.overAllocated).length
  const idle = real.filter(l => l.open === 0).length
  const maxLoadPct = real.reduce((m, l) => Math.max(m, l.loadPct), 0)
  const unassignedShare = totalOpen ? unassignedOpen / totalOpen : 0
  const band: AllocationBalance["band"] =
    overAllocated > 0 || maxLoadPct > 150 ? "overloaded"
      : unassignedShare > 0.4 || (real.length > 1 && maxLoadPct - Math.min(...real.map(l => l.loadPct)) > 100) ? "uneven"
        : "balanced"
  return { people: real.length, totalOpen, assignedOpen, unassignedOpen, overAllocated, idle, maxLoadPct, band }
}
