/* ICIRE §20 — continuous learning (pure helpers, no DB). A content hash over the
 * applicant's authored input (so time passing alone doesn't churn snapshots), a
 * skill vector for snapshots, and delta/series computation for the progress view.
 * Uses only node:crypto (built-in). */
import crypto from "crypto"
import type { SkillResult, AnalyzeInput } from "./engine"

export type SkillVector = Record<string, { c: number; l: string; i: boolean }>

export function toVector(skills: SkillResult[]): SkillVector {
  const v: SkillVector = {}
  for (const s of skills) v[s.skill] = { c: Math.round(s.confidence * 1000) / 1000, l: s.level, i: s.implied }
  return v
}

/** Hash of USER-AUTHORED fields only — excludes months/ageYears so the passage of
 * time never creates a spurious snapshot. */
export function contentHash(input: AnalyzeInput): string {
  const parts = [
    (input.headline || "").trim(),
    (input.bio || "").trim(),
    [...(input.skills || [])].map((s) => s.toLowerCase().trim()).sort().join("|"),
    (input.experiences || []).map((e) => `${e.title}//${e.company}//${(e.description || "").trim()}`).sort().join("~~"),
    (input.education || []).map((e) => `${e.school}//${e.degree}//${e.field || ""}`).sort().join("~~"),
    (input.documents || []).map((d) => d.text).join("\n").slice(0, 50000),
  ]
  return crypto.createHash("sha256").update(parts.join("\n##\n")).digest("hex")
}

export type SkillDelta = { skill: string; from: number; to: number; delta: number; direction: "up" | "down" | "new" | "gone" }

export function diffVectors(prev: SkillVector, cur: SkillVector): SkillDelta[] {
  const out: SkillDelta[] = []
  const keys = new Set([...Object.keys(prev), ...Object.keys(cur)])
  for (const k of keys) {
    const from = prev[k]?.c ?? 0
    const to = cur[k]?.c ?? 0
    if (Math.abs(to - from) < 0.02 && prev[k] && cur[k]) continue
    const direction: SkillDelta["direction"] = !prev[k] ? "new" : !cur[k] ? "gone" : to > from ? "up" : "down"
    out.push({ skill: k, from: Math.round(from * 100), to: Math.round(to * 100), delta: Math.round((to - from) * 100), direction })
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

export type SeriesPoint = { at: string; avgConfidence: number; skillCount: number; explicitCount: number }

/** Momentum = change in average confidence across the recorded series. */
export function momentum(series: SeriesPoint[]): { direction: "up" | "down" | "flat"; deltaPct: number } {
  if (series.length < 2) return { direction: "flat", deltaPct: 0 }
  const d = Math.round((series[series.length - 1].avgConfidence - series[0].avgConfidence) * 100)
  return { direction: d > 1 ? "up" : d < -1 ? "down" : "flat", deltaPct: d }
}
