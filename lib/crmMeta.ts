export const STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const
export type Stage = (typeof STAGES)[number]

export const STAGE_META: Record<string, { label: string; color: string; bg: string }> = {
  LEAD:      { label: "Lead",      color: "#4B5563", bg: "#F3F4F6" },
  QUALIFIED: { label: "Qualified", color: "#1D4ED8", bg: "#EFF4FF" },
  PROPOSAL:  { label: "Proposal",  color: "#B45309", bg: "#FFF7ED" },
  WON:       { label: "Won",       color: "#047857", bg: "#ECFDF5" },
  LOST:      { label: "Lost",      color: "#B91C1C", bg: "#FEF2F2" },
}

export function formatMoney(value: number, currency = "CHF"): string {
  if (!value) return "—"
  const n = value >= 1000 ? value.toLocaleString("en-CH") : String(value)
  return `${n} ${currency}`
}

export const initials = (first?: string, last?: string) =>
  `${(first || "?")[0] || ""}${(last || "")[0] || ""}`.toUpperCase()

const AVATAR_COLORS = ["#534AB7", "#0891B2", "#059669", "#B45309", "#DB2777", "#4F46E5"]
export const avatarColor = (seed: string) =>
  AVATAR_COLORS[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]
