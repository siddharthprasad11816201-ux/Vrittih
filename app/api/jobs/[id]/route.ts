import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        postedBy: { select: { id: true, name: true, headline: true } },
        skills: { include: { skill: true } },
        _count: { select: { applications: true } },
      },
    })
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

    // Aggregated listings (sourceKey set) belong to a company that hasn't
    // registered here — we cannot receive applications on their behalf, so the
    // page must send the candidate to the original posting. Attach the source so
    // the UI can attribute it and link back.
    const source = job.sourceKey
      ? await prisma.jobSource.findUnique({
          where: { key: job.sourceKey },
          select: { key: true, name: true, homepage: true, kind: true },
        })
      : null

    return NextResponse.json({ job: { ...job, source, aggregated: !!job.sourceKey } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}