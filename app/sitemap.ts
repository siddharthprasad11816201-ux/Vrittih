import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { SITE } from "@/lib/site"

export const dynamic = "force-dynamic"
export const revalidate = 3600 // regenerate hourly

// Every active job + every company + the key public pages. This is how Google
// discovers all ~3,000 listings rather than only whatever it stumbles onto via
// links. A sitemap holds up to 50,000 URLs; we are well under that.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/jobs`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE}/companies`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
  ]

  let jobs: MetadataRoute.Sitemap = []
  let companies: MetadataRoute.Sitemap = []
  try {
    const [jobRows, companyRows] = await Promise.all([
      prisma.job.findMany({
        where: { active: true },
        select: { id: true, updatedAt: true },
        orderBy: { createdAt: "desc" },
        take: 45000,
      }),
      prisma.company.findMany({ select: { slug: true, updatedAt: true }, take: 5000 }),
    ])
    jobs = jobRows.map((j) => ({
      url: `${SITE}/jobs/${j.id}`,
      lastModified: j.updatedAt || now,
      changeFrequency: "weekly",
      priority: 0.8,
    }))
    companies = companyRows.map((c) => ({
      url: `${SITE}/companies/${c.slug}`,
      lastModified: c.updatedAt || now,
      changeFrequency: "weekly",
      priority: 0.6,
    }))
  } catch {
    // A DB hiccup must not 500 the sitemap — serve the static pages at minimum.
  }

  return [...staticPages, ...companies, ...jobs]
}
