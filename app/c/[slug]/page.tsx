import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { brandBySlug, brandJobs } from "@/lib/brand"
import CareersSite from "@/components/brand/CareersSite"

export const revalidate = 300 // ISR: fast, cached, still fresh

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const b = await brandBySlug(params.slug)
  if (!b) return { title: "Careers" }
  const title = `Careers at ${b.name}`
  const description = b.tagline || `Open roles at ${b.name}. Apply now.`
  return { title, description, openGraph: { title, description }, robots: { index: true, follow: true } }
}

export default async function BrandCareers({ params }: { params: { slug: string } }) {
  const b = await brandBySlug(params.slug)
  if (!b) notFound()
  const jobs = await brandJobs(b.employerId)
  return <CareersSite brand={b} jobs={jobs} />
}
