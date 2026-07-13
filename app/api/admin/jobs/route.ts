import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ci } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"

export async function GET(req: NextRequest) {
  try {
    const admin = requireAdmin(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = 20
    const where: any = {}
    if (q) where.OR = [{ title:ci(q) },{ company:ci(q) }]
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where, skip:(page-1)*limit, take:limit,
        orderBy:{ createdAt:"desc" },
        include:{ postedBy:{ select:{ id:true,name:true,email:true,idVerified:true } }, _count:{ select:{ applications:true } } },
      }),
      prisma.job.count({ where }),
    ])
    return NextResponse.json({ jobs, total, pages: Math.ceil(total/limit) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = requireAdmin(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    const { jobId, active } = await req.json()
    const job = await prisma.job.update({ where:{ id:jobId }, data:{ active } })
    return NextResponse.json({ success:true, job })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = requireAdmin(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    const { jobId } = await req.json()
    await prisma.job.delete({ where:{ id:jobId } })
    return NextResponse.json({ success:true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}