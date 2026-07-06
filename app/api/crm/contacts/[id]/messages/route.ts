import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { ensureWorkspace, canWrite, logActivity } from "@/lib/workspace"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

async function ctxFor(req: NextRequest, contactId: string) {
  const payload = auth(req)
  if (!payload) return { error: "Not authenticated", status: 401 as const }
  const ctx = await ensureWorkspace(payload.userId)
  const contact = await prisma.contact.findUnique({ where: { id: contactId } })
  if (!contact || contact.workspaceId !== ctx.workspaceId || contact.deletedAt) return { error: "Contact not found", status: 404 as const }
  return { payload, ctx }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await ctxFor(req, params.id)
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })
  const messages = await prisma.contactMessage.findMany({ where: { contactId: params.id }, orderBy: { createdAt: "asc" }, take: 300 })
  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await ctxFor(req, params.id)
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })
  if (!canWrite(r.ctx.role)) return NextResponse.json({ error: "Viewers cannot send messages" }, { status: 403 })

  const { body, direction } = await req.json()
  const text = String(body || "").trim()
  if (!text) return NextResponse.json({ error: "Message body required" }, { status: 400 })
  if (text.length > 10_000) return NextResponse.json({ error: "Message too long" }, { status: 400 })
  const dir = direction === "in" ? "in" : "out"

  const message = await prisma.contactMessage.create({
    data: { workspaceId: r.ctx.workspaceId, contactId: params.id, senderId: dir === "out" ? r.payload.userId : null, direction: dir, body: text, status: "sent" },
  })
  await logActivity({
    workspaceId: r.ctx.workspaceId, contactId: params.id, actorId: r.payload.userId,
    type: dir === "out" ? "message.sent" : "message.received",
    payload: { preview: text.slice(0, 80) },
  })
  return NextResponse.json({ success: true, message }, { status: 201 })
}
