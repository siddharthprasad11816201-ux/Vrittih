import { prisma } from "@/lib/prisma"

/* White-label brand resolution + the jobs shown on a partner's microsite. */

export async function brandBySlug(slug: string) {
  return prisma.partnerBrand.findFirst({ where: { slug, active: true } })
}

export async function brandByDomain(host: string) {
  const h = host.toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "")
  return prisma.partnerBrand.findFirst({ where: { customDomain: h, active: true } })
}

export async function brandJobs(employerId: string) {
  return prisma.job.findMany({
    where: { postedById: employerId, active: true },
    orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, title: true, location: true, type: true, remote: true, salary: true, industry: true, createdAt: true },
  })
}

// Readable text colour (black/white) for a given hex background.
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "")
  if (!m) return "#ffffff"
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return L > 0.6 ? "#0b1f18" : "#ffffff"
}

export function validHex(v: unknown): string | null {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : null
}
