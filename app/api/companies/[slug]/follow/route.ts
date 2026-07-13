import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"

// POST /api/companies/:slug/follow -> toggle follow for the current user.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const token = req.cookies.get("er_token")?.value
  const uid = token ? verifyToken(token)?.userId : null
  if (!uid) return NextResponse.json({ error: "Sign in to follow companies." }, { status: 401 })

  const company = await prisma.company.findUnique({ where: { slug: params.slug }, select: { id: true } })
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 })

  const existing = await prisma.companyFollow.findUnique({ where: { userId_companyId: { userId: uid, companyId: company.id } } })
  if (existing) await prisma.companyFollow.delete({ where: { id: existing.id } })
  else await prisma.companyFollow.create({ data: { userId: uid, companyId: company.id } })

  const followers = await prisma.companyFollow.count({ where: { companyId: company.id } })
  return NextResponse.json({ following: !existing, followers })
}
