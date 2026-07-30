import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { SITE, abs } from "@/lib/site"
import { slugify } from "@/lib/company"
import JobDetailClient from "./JobDetailClient"

export const dynamic = "force-dynamic"

// Server component: it renders the interactive client UI, but first emits the
// per-job <title>/description (generateMetadata) and Google JobPosting structured
// data server-side — which is what actually lands a listing in Google's jobs
// experience. The visible body stays client-rendered; the JSON-LD does not.

async function getJob(id: string) {
  return prisma.job.findUnique({
    where: { id },
    select: {
      id: true, title: true, description: true, company: true, industry: true,
      location: true, type: true, salary: true, remote: true, createdAt: true,
      updatedAt: true, closesAt: true, sourceKey: true, applyUrl: true, govBody: true,
    },
  }).catch(() => null)
}

function clean(s: string, n = 300) {
  return (s || "").replace(/\s+/g, " ").trim().slice(0, n)
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const job = await getJob(params.id)
  if (!job) return { title: "Job not found", robots: { index: false } }
  const title = `${job.title} at ${job.company}`
  const loc = job.remote ? "Remote" : job.location
  const description = clean(job.description || `${job.title} at ${job.company}${loc ? ` · ${loc}` : ""}. Apply on Vrittih.`, 155)
  const url = abs(`/jobs/${job.id}`)
  return {
    title,
    description,
    alternates: { canonical: `/jobs/${job.id}` },
    openGraph: { title: `${title} · Vrittih`, description, url, type: "article" },
    twitter: { card: "summary", title: `${title} · Vrittih`, description },
    robots: { index: true, follow: true },
  }
}

// FULLTIME etc. -> schema.org employmentType tokens
const EMP: Record<string, string> = {
  FULLTIME: "FULL_TIME", PARTTIME: "PART_TIME", CONTRACT: "CONTRACTOR",
  INTERNSHIP: "INTERN", FREELANCE: "CONTRACTOR", TEMPORARY: "TEMPORARY",
}

// "Guwahati, India" -> { addressLocality:"Guwahati", addressCountry:"India" }
function place(location: string) {
  const parts = (location || "").split(",").map((s) => s.trim()).filter(Boolean)
  const country = parts.length > 1 ? parts[parts.length - 1] : "India"
  const locality = parts.length > 1 ? parts.slice(0, -1).join(", ") : parts[0] || undefined
  return { "@type": "Place", address: { "@type": "PostalAddress", ...(locality ? { addressLocality: locality } : {}), addressCountry: country } }
}

function jobPostingLd(job: NonNullable<Awaited<ReturnType<typeof getJob>>>) {
  const remote = job.remote || /remote|virtual|anywhere/i.test(job.location || "")
  const ld: Record<string, any> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: `<p>${clean(job.description || job.title, 4000).replace(/</g, "&lt;")}</p>`,
    datePosted: new Date(job.createdAt).toISOString(),
    employmentType: EMP[job.type] || "OTHER",
    hiringOrganization: { "@type": "Organization", name: job.company, sameAs: abs(`/companies/${slugify(job.company)}`) },
    identifier: { "@type": "PropertyValue", name: job.company, value: job.id },
    industry: job.industry || undefined,
    url: abs(`/jobs/${job.id}`),
    directApply: !job.sourceKey && !job.applyUrl, // true only when applying happens on Vrittih
  }
  if (job.closesAt) ld.validThrough = new Date(job.closesAt).toISOString()
  if (remote) {
    ld.jobLocationType = "TELECOMMUTE"
    ld.applicantLocationRequirements = { "@type": "Country", name: place(job.location).address.addressCountry }
  } else {
    ld.jobLocation = place(job.location)
  }
  // Salary is free text on our side; structured baseSalary is omitted rather than
  // guessed, because invalid salary markup is flagged by Search Console.
  return ld
}

export default async function JobPage({ params }: { params: { id: string } }) {
  const job = await getJob(params.id)
  return (
    <>
      {job && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingLd(job)) }}
        />
      )}
      <JobDetailClient params={params} />
    </>
  )
}
