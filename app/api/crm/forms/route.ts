import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { ensureWorkspace, canWrite } from "@/lib/workspace"

export const dynamic = "force-dynamic"
const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "form"
  return `${base}-${randomBytes(3).toString("hex")}`
}

export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { workspaceId } = await ensureWorkspace(payload.userId)
  const forms = await prisma.form.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, name: true, isLive: true, createdAt: true, _count: { select: { submissions: true } } },
  })
  return NextResponse.json({ forms: forms.map((f) => ({ ...f, submissionCount: f._count.submissions })) })
}

export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { workspaceId, role } = await ensureWorkspace(payload.userId)
  if (!canWrite(role)) return NextResponse.json({ error: "Viewers cannot create forms" }, { status: 403 })

  const { name } = await req.json()
  const formName = String(name || "").trim() || "Untitled form"
  const defaultFields = [
    { id: randomBytes(4).toString("hex"), type: "text", label: "Full name", required: true },
    { id: randomBytes(4).toString("hex"), type: "email", label: "Email", required: true },
    { id: randomBytes(4).toString("hex"), type: "phone", label: "Phone", required: false },
  ]
  const form = await prisma.form.create({
    data: {
      workspaceId, createdById: payload.userId, name: formName, slug: slugify(formName),
      fields: JSON.stringify(defaultFields),
      settings: JSON.stringify({ successMessage: "Thanks! We'll be in touch shortly." }),
    },
  })
  return NextResponse.json({ success: true, form }, { status: 201 })
}
