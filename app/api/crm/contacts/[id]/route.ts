import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { ensureWorkspace, canWrite, logActivity } from "@/lib/workspace"
import { z } from "zod"

export const dynamic = "force-dynamic"

const STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }
const safeTags = (s: string): string[] => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : [] } catch { return [] } }

async function ownedContact(req: NextRequest, id: string) {
  const payload = auth(req)
  if (!payload) return { error: "Not authenticated", status: 401 as const }
  const ctx = await ensureWorkspace(payload.userId)
  const contact = await prisma.contact.findUnique({ where: { id } })
  if (!contact || contact.workspaceId !== ctx.workspaceId || contact.deletedAt) return { error: "Contact not found", status: 404 as const }
  return { payload, ctx, contact }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await ownedContact(req, params.id)
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const [activities, messages] = await Promise.all([
    prisma.activity.findMany({ where: { contactId: params.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.contactMessage.findMany({ where: { contactId: params.id }, orderBy: { createdAt: "asc" }, take: 200 }),
  ])
  return NextResponse.json({
    contact: { ...r.contact, tags: safeTags(r.contact.tags) },
    activities: activities.map((a) => ({ ...a, payload: JSON.parse(a.payload) })),
    messages,
  })
}

const patchSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  company: z.string().max(120).nullable().optional(),
  jobTitle: z.string().max(120).nullable().optional(),
  industry: z.string().max(80).nullable().optional(),
  website: z.string().max(200).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  stage: z.enum(STAGES).optional(),
  value: z.number().nonnegative().max(9_999_999_999).optional(),
  currency: z.string().max(8).optional(),
  source: z.string().max(80).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notes: z.string().max(50_000).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await ownedContact(req, params.id)
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })
  if (!canWrite(r.ctx.role)) return NextResponse.json({ error: "Viewers cannot edit contacts" }, { status: 403 })

  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  const d = parsed.data

  const data: any = { ...d }
  if (d.tags) data.tags = JSON.stringify(d.tags)
  if (d.email !== undefined) data.email = d.email ? d.email.toLowerCase() : null

  const updated = await prisma.contact.update({ where: { id: params.id }, data })

  if (d.stage && d.stage !== r.contact.stage) {
    await logActivity({ workspaceId: r.ctx.workspaceId, contactId: params.id, actorId: r.payload.userId, type: "stage.changed", payload: { from: r.contact.stage, to: d.stage } })
  } else {
    await logActivity({ workspaceId: r.ctx.workspaceId, contactId: params.id, actorId: r.payload.userId, type: "contact.updated", payload: { fields: Object.keys(d) } })
  }
  return NextResponse.json({ success: true, contact: { ...updated, tags: safeTags(updated.tags) } })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await ownedContact(req, params.id)
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })
  if (!canWrite(r.ctx.role)) return NextResponse.json({ error: "Viewers cannot delete contacts" }, { status: 403 })
  await prisma.contact.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
  return NextResponse.json({ success: true })
}
