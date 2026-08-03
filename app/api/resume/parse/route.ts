import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { extractText } from "@/lib/career/parseDocument"
import { parseResume } from "@/lib/resume/parse"

export const runtime = "nodejs"          // needs node built-ins (zlib) for PDF/DOCX
export const dynamic = "force-dynamic"

/* In-house résumé parser endpoint. Upload a résumé (PDF/DOCX/HTML/TXT); we extract
 * the text (lib/career/parseDocument) and structure it (lib/resume/parse) into
 * profile fields — no third-party service, no LLM. Nothing is stored here; the
 * parsed fields are returned for the user to review and apply on the client. */
export async function POST(req: NextRequest) {
  const token = req.cookies.get("er_token")?.value
  if (!token || !verifyToken(token)) return NextResponse.json({ error: "Please sign in." }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a résumé file." }, { status: 400 })
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "That file is over 8 MB — please upload a smaller résumé." }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const ext = extractText(buf, file.name, file.type)
  if (ext.text.replace(/\s/g, "").length < 20) {
    return NextResponse.json({ ok: false, error: ext.warnings[0] || "We couldn't read any text from that file. If it's a scanned image, upload a text-based PDF or DOCX." }, { status: 422 })
  }
  const parsed = parseResume(ext.text)
  return NextResponse.json({ ok: true, parsed, format: ext.format, warnings: ext.warnings })
}
