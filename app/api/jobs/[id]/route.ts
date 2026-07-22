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

    // A listing is "aggregated" only if it was ingested from a registered external
    // JobSource — i.e. the employer has no account here, so we genuinely cannot
    // receive the application and must send the candidate to the original posting.
    //
    // sourceKey alone is NOT sufficient: seed imports also set it (purely to make
    // re-imports idempotent) for companies that ARE native employers here. Keying
    // off sourceKey wrongly marked every natively-posted role as external and hid
    // the apply button on them. Only a matching JobSource row means aggregated.
    const source = job.sourceKey
      ? await prisma.jobSource.findUnique({
          where: { key: job.sourceKey },
          select: { key: true, name: true, homepage: true, kind: true },
        })
      : null

    return NextResponse.json({ job: { ...job, source, aggregated: !!source } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}