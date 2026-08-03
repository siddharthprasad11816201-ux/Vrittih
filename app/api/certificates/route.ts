import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resolveContext } from "@/lib/capability/context"
import { newSerial, newVerificationCode, certStatus, CERT_KINDS } from "@/lib/certificate"
import { SITE } from "@/lib/site"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const shape = (c: any) => ({
  id: c.id, title: c.title, kind: c.kind, serial: c.serial, verificationCode: c.verificationCode,
  issuerName: c.issuerName, skills: c.skills, issuedAt: c.issuedAt, expiresAt: c.expiresAt,
  status: certStatus(c), verifyUrl: `${SITE.replace(/\/$/, "")}/verify/cert/${c.verificationCode}`,
})

// The signed-in user's earned certificates.
export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const certs = await prisma.certificate.findMany({ where: { userId: ctx.userId }, orderBy: { issuedAt: "desc" } })
  return NextResponse.json({ certificates: certs.map(shape) })
}

// Issue a certificate — employers (jobs.post) or admins only.
export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (!(ctx.has("jobs.post") || ctx.has("admin.access"))) {
    return NextResponse.json({ error: "Only employers or admins can issue certificates." }, { status: 403 })
  }
  const b = await req.json().catch(() => ({}))
  const title = String(b?.title || "").trim()
  if (title.length < 3) return NextResponse.json({ error: "A certificate title is required." }, { status: 400 })
  const kind = (CERT_KINDS as readonly string[]).includes(b?.kind) ? b.kind : "internship"

  const recipient = b?.userId
    ? await prisma.user.findUnique({ where: { id: String(b.userId) }, select: { id: true } })
    : b?.email
      ? await prisma.user.findUnique({ where: { email: String(b.email).toLowerCase().trim() }, select: { id: true } })
      : null
  if (!recipient) return NextResponse.json({ error: "No Vrittih user found for that email — the recipient needs an account first." }, { status: 404 })

  const cert = await prisma.certificate.create({
    data: {
      userId: recipient.id, issuedById: ctx.userId, title, kind,
      serial: newSerial(), verificationCode: newVerificationCode(),
      issuerName: ctx.user?.name || "Vrittih",
      skills: b?.skills ? String(b.skills).slice(0, 300) : null,
      note: b?.note ? String(b.note).slice(0, 500) : null,
      expiresAt: b?.expiresAt ? new Date(b.expiresAt) : null,
    },
  })
  return NextResponse.json({ certificate: shape(cert) })
}
