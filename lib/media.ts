// Media validation + limits. Kept server-side so the API is the source of truth
// even though images are also processed client-side before upload.

export type MediaKind = "avatar" | "logo" | "resume" | "photo" | "cover"

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"]
const DOC_MIMES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]

// Per-kind rules: what's allowed and the max stored size. Images are small because
// the client resizes/re-encodes them first; résumés keep more headroom for real PDFs.
export const MEDIA_RULES: Record<MediaKind, { mimes: string[]; maxBytes: number }> = {
  avatar: { mimes: IMAGE_MIMES, maxBytes: 1_500_000 },
  logo: { mimes: IMAGE_MIMES, maxBytes: 1_500_000 },
  photo: { mimes: IMAGE_MIMES, maxBytes: 3_000_000 },
  cover: { mimes: IMAGE_MIMES, maxBytes: 3_000_000 },
  resume: { mimes: DOC_MIMES, maxBytes: 8_000_000 },
}

export function isMediaKind(k: string): k is MediaKind {
  return k === "avatar" || k === "logo" || k === "resume" || k === "photo" || k === "cover"
}

export function validateUpload(kind: MediaKind, mime: string, size: number): string | null {
  const rule = MEDIA_RULES[kind]
  if (!rule.mimes.includes(mime)) return `${mime || "This file type"} isn't allowed for ${kind}. Use ${rule.mimes.map((m) => m.split("/")[1]).join(", ")}.`
  if (size <= 0) return "The file is empty."
  if (size > rule.maxBytes) return `File too large — max ${(rule.maxBytes / 1_000_000).toFixed(1)} MB for ${kind}.`
  return null
}

// Parse a data URL ("data:image/webp;base64,…") into { mime, buffer }.
export function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(dataUrl || "")
  if (!m) return null
  const mime = m[1]
  const buffer = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]), "utf8")
  return { mime, buffer }
}
