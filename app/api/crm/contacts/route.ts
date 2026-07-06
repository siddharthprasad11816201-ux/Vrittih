import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { ensureWorkspace, canWrite, logActivity } from "@/lib/workspace"
import { track } from "@/lib/analytics"
import { z } from "zod"

export const dynamic = "force-dynamic"

const STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const

function auth(req: NextRequest) {
  const token = req.cookies.get("er_token")?.value
  return token ? verifyToken(token) : null
}

const createSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  company: z.string().max(120).optional(),
  jobTitle: z.string().max(120).optional(),
  industry: z.string().max(80).optional(),
  website: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(80).optional(),
  stage: z.enum(STAGES).optional(),
  value: z.number().nonnegative().max(9_999_999_999).optional(),
  currency: z.string().max(8).optional(),
  source: z.string().max(80).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notes: z.string().max(50_000).optional(),
})

export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { workspaceId } = await ensureWorkspace(payload.userId)

  const sp = new URL(req.url).searchParams
  const q = sp.get("q")?.trim() || ""
  const stage = sp.get("stage") || ""
  const sort = sp.get("sort") || "recent"
  const take = Math.min(parseInt(sp.get("limit") || "50"), 100)

  const where: any = { workspaceId, deletedAt: null }
  if (stage && (STAGES as readonly string[]).includes(stage)) where.stage = stage
  if (q) where.OR = [
    { firstName: { contains: q } }, { lastName: { contains: q } },
    { email: { contains: q } }, { company: { contains: q } },
  ]

  const orderBy =
    sort === "name" ? [{ firstName: "asc" as const }] :
    sort === "value" ? [{ value: "desc" as const }] :
    sort === "created" ? [{ createdAt: "desc" as const }] :
    [{ lastActivityAt: "desc" as const }]

  const contacts = await prisma.contact.findMany({
    where, orderBy, take,
    select: {
      id: true, firstName: true, lastName: true, email: true, company: true, jobTitle: true,
      stage: true, value: true, currency: true, tags: true, lastActivityAt: true,
      _count: { select: { messages: true } },
    },
  })

  // pipeline totals per stage
  const grouped = await prisma.contact.groupBy({
    by: ["stage"], where: { workspaceId, deletedAt: null }, _sum: { value: true }, _count: true,
  })
  const pipeline = Object.fromEntries(grouped.map((g) => [g.stage, { count: g._count, value: g._sum.value || 0 }]))

  return NextResponse.json({
    contacts: contacts.map((c) => ({ ...c, tags: safeTags(c.tags), messageCount: c._count.messages })),
    pipeline,
  })
}

export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { workspaceId, role } = await ensureWorkspace(payload.userId)
  if (!canWrite(role)) return NextResponse.json({ error: "Viewers cannot create contacts" }, { status: 403 })

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  const data = parsed.data

  if (data.email) {
    const dup = await prisma.contact.findFirst({ where: { workspaceId, email: data.email.toLowerCase(), deletedAt: null } })
    if (dup) return NextResponse.json({ error: "A contact with that email already exists", duplicateId: dup.id }, { status: 409 })
  }

  const contact = await prisma.contact.create({
    data: {
      workspaceId, createdById: payload.userId,
      firstName: data.firstName, lastName: data.lastName,
      email: data.email ? data.email.toLowerCase() : null,
      phone: data.phone || null, company: data.company || null, jobTitle: data.jobTitle || null,
      industry: data.industry || null, website: data.website || null,
      city: data.city || null, country: data.country || null,
      stage: data.stage || "LEAD", value: data.value || 0, currency: data.currency || "CHF",
      source: data.source || null, tags: JSON.stringify(data.tags || []), notes: data.notes || null,
    },
  })
  await logActivity({ workspaceId, contactId: contact.id, actorId: payload.userId, type: "contact.created" })
  await track("contact.created", { stage: contact.stage, source: "manual" }, payload.userId)
  return NextResponse.json({ success: true, contact: { ...contact, tags: safeTags(contact.tags) } }, { status: 201 })
}

function safeTags(s: string): string[] {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] }
}
