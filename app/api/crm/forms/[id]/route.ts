import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { ensureWorkspace, canWrite } from "@/lib/workspace"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

async function owned(req: NextRequest, id: string) {
  const payload = auth(req)
  if (!payload) return { error: "Not authenticated", status: 401 as const }
  const ctx = await ensureWorkspace(payload.userId)
  const form = await prisma.form.findUnique({ where: { id } })
  if (!form || form.workspaceId !== ctx.workspaceId || form.deletedAt) return { error: "Form not found", status: 404 as const }
  return { payload, ctx, form }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await owned(req, params.id)
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })
  const submissions = await prisma.formSubmission.findMany({
    where: { formId: params.id }, orderBy: { submittedAt: "desc" }, take: 100,
    select: { id: true, data: true, contactId: true, submittedAt: true },
  })
  return NextResponse.json({
    form: { ...r.form, fields: JSON.parse(r.form.fields), settings: JSON.parse(r.form.settings) },
    submissions: submissions.map((s) => ({ ...s, data: JSON.parse(s.data) })),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await owned(req, params.id)
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })
  if (!canWrite(r.ctx.role)) return NextResponse.json({ error: "Viewers cannot edit forms" }, { status: 403 })

  const body = await req.json()
  const data: any = {}
  if (typeof body.name === "string") data.name = body.name.trim() || "Untitled form"
  if (Array.isArray(body.fields)) data.fields = JSON.stringify(body.fields.slice(0, 40))
  if (body.settings && typeof body.settings === "object") data.settings = JSON.stringify(body.settings)
  if (typeof body.isLive === "boolean") data.isLive = body.isLive

  const updated = await prisma.form.update({ where: { id: params.id }, data })
  return NextResponse.json({ success: true, form: { ...updated, fields: JSON.parse(updated.fields), settings: JSON.parse(updated.settings) } })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await owned(req, params.id)
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })
  if (!canWrite(r.ctx.role)) return NextResponse.json({ error: "Viewers cannot delete forms" }, { status: 403 })
  await prisma.form.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
  return NextResponse.json({ success: true })
}
