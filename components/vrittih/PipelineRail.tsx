"use client"
import { IconCheck } from "@/components/ui/Icons"

/* The signature element (redesign brief §6). One horizontal stage tracker —
 * Applied → Screening → Interview → Offer → Hired — with live counts. The
 * current stage is accent-filled; stages already passed carry an accent ring;
 * upcoming stages are muted-but-legible neutral (never greyed-disabled). This is
 * the one place boldness is spent; it appears on the dashboard and is the hero of
 * the landing page (candidate and employer see the same view). Pure SVG-free CSS,
 * tabular numbers, horizontal scroll on narrow screens (no nested vertical scroll). */

export type RailStage = { label: string; count: number }

export default function PipelineRail({
  stages, currentIndex,
}: { stages: RailStage[]; currentIndex?: number }) {
  // Default "current" = the furthest stage that has anyone in it (honest: -1 when empty).
  const current = currentIndex ?? stages.reduce((acc, s, i) => (s.count > 0 ? i : acc), -1)

  return (
    <div style={S.scroll}>
      <ol style={S.rail} aria-label="Hiring pipeline">
        {stages.map((s, i) => {
          const state = i < current ? "done" : i === current ? "current" : "upcoming"
          const node = state === "current" ? S.nodeCurrent : state === "done" ? S.nodeDone : S.nodeUpcoming
          return (
            <li key={s.label} style={S.col}>
              {/* connector to previous node */}
              {i > 0 && <span aria-hidden style={{ ...S.link, background: i <= current ? "var(--v-accent)" : "var(--border)" }} />}
              <span style={{ ...S.node, ...node }}>
                {state === "done" ? <IconCheck size={14} /> : <span style={S.count}>{s.count}</span>}
              </span>
              <span style={{ ...S.label, color: state === "upcoming" ? "var(--v-ink-3)" : "var(--v-ink)" }}>{s.label}</span>
              {state !== "done" && <span style={{ ...S.sub, color: state === "current" ? "var(--v-accent)" : "var(--v-ink-3)" }}>{s.count === 1 ? "1 candidate" : `${s.count} candidates`}</span>}
              {state === "done" && <span style={{ ...S.sub, color: "var(--v-ink-3)" }}>{s.count} passed</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const S: Record<string, any> = {
  scroll: { overflowX: "auto", padding: "4px 2px 2px", WebkitOverflowScrolling: "touch" },
  rail: { display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr", minWidth: 480, listStyle: "none", margin: 0, padding: 0, gap: 0 },
  col: { position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "0 4px" },
  link: { position: "absolute", top: 17, right: "50%", width: "100%", height: 2, zIndex: 0 },
  node: { position: "relative", zIndex: 1, width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0 },
  nodeCurrent: { background: "var(--v-accent)", color: "#fff", boxShadow: "0 0 0 4px var(--v-accent-soft)" },
  nodeDone: { background: "var(--v-accent-soft)", color: "var(--v-accent)" },
  nodeUpcoming: { background: "var(--v-surface-2)", color: "var(--v-ink-3)", border: "1px solid var(--border)" },
  count: { font: "500 15px var(--font-sans)", fontVariantNumeric: "tabular-nums" },
  label: { font: "500 12.5px var(--font-sans)", marginTop: 2, textAlign: "center", whiteSpace: "nowrap" },
  sub: { font: "400 11px var(--font-sans)", whiteSpace: "nowrap" },
}
