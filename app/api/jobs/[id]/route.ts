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
    return NextResponse.json({ job })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}