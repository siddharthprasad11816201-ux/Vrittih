import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { validateUpload } from "@/lib/media"
import { extractText } from "@/lib/career/parseDocument"
import { refreshCareer } from "@/lib/career/refresh"

export const dynamic = "force-dynamic"

/* ICIRE §1 — universal document understanding. Upload a résumé/transcript/etc;
 * we extract its text IN-HOUSE (no third-party parser) and store it as a
 * CareerDocument, then refresh the applicant's Career Intelligence profile so the
 * new evidence immediately powers matching/roadmaps (§20). */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }
const KINDS = ["resume", "transcript", "certificate", "cover_letter", "portfolio", "other"]

export async function GET(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const docs = await prisma.careerDocument.findMany({
    where: { userId: p.userId },
    select: { id: true, kind: true, title: true, rawText: true, parsed: true, createdAt: true, mediaId: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({
    documents: docs.map((d) => ({
      id: d.id, kind: d.kind, title: d.title, createdAt: d.createdAt, mediaId: d.mediaId,
      chars: d.rawText.length, parsed: safeJson(d.parsed),
    })),
  })
}

export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    let kind = String(form.get("kind") || "resume")
    if (!KINDS.includes(kind)) kind = "other"
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    // Résumé MIME rules cover PDF/DOC/DOCX; also allow text/html for pasted docs.
    const okText = file.type.startsWith("text/") || file.type === "" || file.type.includes("html")
    const err = okText ? (buffer.length > 8_000_000 ? "File too large — max 8 MB." : null) : validateUpload("resume", file.type, buffer.length)
    if (err) return NextResponse.json({ error: err }, { status: 400 })

    const extraction = extractText(buffer, file.name, file.type)
    if (extraction.text.replace(/\s/g, "").length < 20) {
      return NextResponse.json({ error: "We couldn't read any text from that file. If it's a scanned image, paste the text instead.", warnings: extraction.warnings }, { status: 422 })
    }

    // Keep the original file too, so the user can download exactly what they sent.
    // Private kind: these are the user's analysis inputs, never shared with
    // recruiters — /api/media/[id] serves career_doc bytes to the owner only.
    const asset = await prisma.mediaAsset.create({
      data: { ownerId: p.userId, kind: "career_doc", mime: file.type || "application/octet-stream", size: buffer.length, filename: file.name, data: buffer },
      select: { id: true },
    })
    const doc = await prisma.careerDocument.create({
      data: {
        userId: p.userId, kind, title: file.name, mediaId: asset.id, rawText: extraction.text,
        parsed: JSON.stringify({ format: extraction.format, warnings: extraction.warnings, chars: extraction.text.length }),
      },
      select: { id: true, kind: true, title: true, createdAt: true },
    })

    // Refresh the profile so the upload immediately affects analysis.
    let reanalyzed = false
    try { await refreshCareer(p.userId, "document"); reanalyzed = true } catch {}

    return NextResponse.json({
      ok: true, reanalyzed,
      document: { ...doc, chars: extraction.text.length, mediaId: asset.id },
      extraction: { format: extraction.format, chars: extraction.text.length, warnings: extraction.warnings },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Upload failed" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  // Ownership check — never let a user delete another user's document (IDOR).
  const doc = await prisma.careerDocument.findUnique({ where: { id }, select: { userId: true, mediaId: true } })
  if (!doc || doc.userId !== p.userId) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await prisma.careerDocument.delete({ where: { id } })
  if (doc.mediaId) await prisma.mediaAsset.deleteMany({ where: { id: doc.mediaId, ownerId: p.userId } })
  try { await refreshCareer(p.userId, "document") } catch {}
  return NextResponse.json({ ok: true })
}

function safeJson(s: string) { try { return JSON.parse(s) } catch { return {} } }
