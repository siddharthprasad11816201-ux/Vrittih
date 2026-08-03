/* Phase 1 · Module 7 — the Workspace/Dashboard Composer (pure). Given the subject's
 * capabilities + a widget catalog + an optional saved layout, produce the ordered,
 * eligible widget list. No hardcoded dashboards: composition is capability-driven
 * and config-driven. Pure + unit-testable (no data access here).
 * See docs/ai/SELF_EVOLVING_INTELLIGENCE_ARCHITECTURE.md §9. */

export type WidgetSize = "sm" | "md" | "lg"
export type WidgetSpec = { id: string; title: string; description?: string; capability: string; size: WidgetSize; group: string; order: number }
export type Layout = { hidden?: string[]; order?: string[] } | null | undefined

/** Eligible widgets for a capability set, honoring an optional user layout
 * (hide + reorder). Fail-closed: a widget whose capability the subject lacks is
 * never returned. */
export function composeWorkspace(widgets: WidgetSpec[], caps: Set<string> | string[], layout?: Layout): WidgetSpec[] {
  const set = caps instanceof Set ? caps : new Set(caps)
  const hidden = new Set(layout?.hidden || [])
  const eligible = widgets.filter((w) => set.has(w.capability) && !hidden.has(w.id))

  const custom = layout?.order || []
  const rank = new Map(custom.map((id, i) => [id, i]))
  return eligible.slice().sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : Infinity
    const rb = rank.has(b.id) ? rank.get(b.id)! : Infinity
    if (ra !== rb) return ra - rb          // user-ordered first, in their order
    if (a.order !== b.order) return a.order - b.order // then catalog order
    return a.id.localeCompare(b.id)
  })
}
