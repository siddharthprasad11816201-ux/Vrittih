import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { brandByDomain, brandJobs } from "@/lib/brand"
import CareersSite from "@/components/brand/CareersSite"

/* Reached only via middleware, which rewrites a partner's custom domain to
 * /site/<host>. Runs in the Node runtime so it can resolve the tenant from the
 * DB (edge middleware can't). */
export const revalidate = 300

export async function generateMetadata({ params }: { params: { host: string } }): Promise<Metadata> {
  const b = await brandByDomain(decodeURIComponent(params.host))
  if (!b) return { title: "Careers" }
  const title = `Careers at ${b.name}`
  const description = b.tagline || `Open roles at ${b.name}. Apply now.`
  return { title, description, openGraph: { title, description }, robots: { index: true, follow: true } }
}

export default async function CustomDomainCareers({ params }: { params: { host: string } }) {
  const b = await brandByDomain(decodeURIComponent(params.host))
  if (!b) notFound()
  const jobs = await brandJobs(b.employerId)
  return <CareersSite brand={b} jobs={jobs} absolute />
}
