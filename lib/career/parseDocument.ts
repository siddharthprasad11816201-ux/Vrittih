/* ICIRE §1 — universal document understanding: in-house text extraction from
 * PDF, DOCX and plain/HTML files. NO third-party libraries — only Node built-ins
 * (Buffer + zlib for the deflate used by PDF FlateDecode streams and the DOCX
 * ZIP container). SERVER ONLY (imports node:zlib). Not every PDF/encoding is
 * recoverable (image-only scans, CID/Type0 fonts) — those surface a warning
 * rather than garbage. */
import zlib from "zlib"

export type Extraction = { text: string; format: "pdf" | "docx" | "html" | "text" | "unknown"; warnings: string[] }

const MAX = 200_000 // cap stored text

export function extractText(buf: Buffer, filename = "", mime = ""): Extraction {
  const head = buf.subarray(0, 5).toString("latin1")
  const ext = (filename.split(".").pop() || "").toLowerCase()
  if (head.startsWith("%PDF") || mime.includes("pdf") || ext === "pdf") return finalize(parsePdf(buf), "pdf")
  if ((buf[0] === 0x50 && buf[1] === 0x4b) || ext === "docx" || mime.includes("wordprocessing")) return finalize(parseDocx(buf), "docx")
  const text = buf.toString("utf8")
  if (/<html|<body|<div|<p[\s>]/i.test(text) || ext === "html" || mime.includes("html")) return finalize({ text: stripHtml(text), warnings: [] }, "html")
  return finalize({ text, warnings: [] }, "text")
}

function finalize(r: { text: string; warnings: string[] }, format: Extraction["format"]): Extraction {
  let text = sanitize(r.text)
  const warnings = [...r.warnings]
  if (text.length > MAX) { text = text.slice(0, MAX); warnings.push("Document truncated to 200k characters.") }
  if (text.replace(/\s/g, "").length < 20) warnings.push("Little or no text could be extracted — the file may be image-only or use an unsupported encoding.")
  return { text, format, warnings }
}

/** Collapse whitespace, drop control chars, keep line structure. */
function sanitize(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[\u00A0\u2007\u202F]/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]*\n[^\S\n]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n").map((l) => l.trim()).join("\n")
    .trim()
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

function parsePdf(buf: Buffer): { text: string; warnings: string[] } {
  const warnings: string[] = []
  const s = buf.toString("latin1")
  let out = ""
  let streams = 0, decoded = 0
  const re = /stream\r?\n/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    streams++
    const dictStart = s.lastIndexOf("<<", m.index)
    const dict = dictStart >= 0 ? s.slice(dictStart, m.index) : ""
    const dataStart = m.index + m[0].length
    const end = s.indexOf("endstream", dataStart)
    if (end < 0) continue
    let chunk = s.slice(dataStart, end).replace(/\r?\n$/, "")
    // Skip images and unsupported filters — we only want text content streams.
    if (/\/(DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|LZWDecode)/.test(dict)) continue
    if (/\/(Image|XObject)\b/.test(dict) && !/FlateDecode/.test(dict)) continue
    let bytes = Buffer.from(chunk, "latin1")
    if (/\/FlateDecode/.test(dict)) {
      try { bytes = zlib.inflateSync(bytes) }
      catch { try { bytes = zlib.inflateRawSync(Buffer.from(chunk, "latin1")) } catch { continue } }
    }
    let content = bytes.toString("latin1")
    // Object streams (/Type /ObjStm) and content both hold text operators; only
    // pull from things that actually contain text-showing operators.
    if (!/(\)\s*T[jJ])|(>\s*T[jJ])|BT/.test(content)) continue
    const t = extractContentText(content)
    if (t.trim()) { out += t + "\n"; decoded++ }
    re.lastIndex = end + 9
  }
  if (streams > 0 && decoded === 0) warnings.push("Found PDF streams but no extractable text layer (possibly a scanned/image PDF).")
  return { text: out, warnings }
}

/** Pull text from a PDF content stream's text-showing operators. */
function extractContentText(content: string): string {
  let res = ""
  let i = 0
  const n = content.length
  while (i < n) {
    const c = content[i]
    if (c === "(") { const r = readLiteral(content, i + 1); res += r.text; i = r.next; continue }
    if (c === "<" && content[i + 1] !== "<") { const r = readHex(content, i + 1); res += r.text; i = r.next; continue }
    if (c === "T" && (content[i + 1] === "d" || content[i + 1] === "D" || content[i + 1] === "*")) { res += "\n"; i += 2; continue }
    if (c === "'" || c === '"') { res += "\n"; i++; continue }
    i++
  }
  return res
}

function readLiteral(s: string, i: number): { text: string; next: number } {
  let depth = 1, out = ""
  while (i < s.length) {
    const c = s[i]
    if (c === "\\") {
      const nx = s[i + 1]
      if (nx === "n") { out += "\n"; i += 2; continue }
      if (nx === "r") { out += "\r"; i += 2; continue }
      if (nx === "t") { out += "\t"; i += 2; continue }
      if (nx === "b") { out += "\b"; i += 2; continue }
      if (nx === "f") { out += "\f"; i += 2; continue }
      if (nx === "(" || nx === ")" || nx === "\\") { out += nx; i += 2; continue }
      if (nx >= "0" && nx <= "7") { let oct = nx; i += 2; for (let k = 0; k < 2 && s[i] >= "0" && s[i] <= "7"; k++) { oct += s[i]; i++ } out += String.fromCharCode(parseInt(oct, 8)); continue }
      if (nx === "\n") { i += 2; continue }
      if (nx === "\r") { i += (s[i + 2] === "\n") ? 3 : 2; continue }
      out += nx ?? ""; i += 2; continue
    }
    if (c === "(") { depth++; out += c; i++; continue }
    if (c === ")") { depth--; if (depth === 0) { i++; break } out += c; i++; continue }
    out += c; i++
  }
  return { text: out, next: i }
}

function readHex(s: string, i: number): { text: string; next: number } {
  let hex = ""
  while (i < s.length && s[i] !== ">") { if (/[0-9A-Fa-f]/.test(s[i])) hex += s[i]; i++ }
  i++ // skip '>'
  if (hex.length % 2) hex += "0"
  let out = ""
  for (let k = 0; k < hex.length; k += 2) out += String.fromCharCode(parseInt(hex.substr(k, 2), 16))
  return { text: out, next: i }
}

// ---------------------------------------------------------------------------
// DOCX (ZIP container -> word/document.xml)
// ---------------------------------------------------------------------------

function parseDocx(buf: Buffer): { text: string; warnings: string[] } {
  const xml = zipRead(buf, "word/document.xml")
  if (!xml) return { text: "", warnings: ["Could not read word/document.xml — the file may not be a Word .docx."] }
  const s = xml.toString("utf8")
  const text = s
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  return { text, warnings: [] }
}

/** Read one entry from a ZIP via its central directory (robust to data
 * descriptors). Returns the inflated bytes or null. */
function zipRead(buf: Buffer, name: string): Buffer | null {
  // Locate End Of Central Directory (0x06054b50), scanning from the end.
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return null
  let off = buf.readUInt32LE(eocd + 16)
  const count = buf.readUInt16LE(eocd + 10)
  for (let e = 0; e < count && off + 46 <= buf.length; e++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const entryName = buf.toString("utf8", off + 46, off + 46 + nameLen)
    if (entryName === name) {
      // Re-read the local header for the true data offset.
      if (buf.readUInt32LE(localOff) !== 0x04034b50) return null
      const lNameLen = buf.readUInt16LE(localOff + 26)
      const lExtraLen = buf.readUInt16LE(localOff + 28)
      const dataStart = localOff + 30 + lNameLen + lExtraLen
      const raw = buf.subarray(dataStart, dataStart + compSize)
      try { return method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw) }
      catch { return null }
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  return null
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function stripHtml(s: string): string {
  return s
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br)\b[^>]*>/gi, "\n")
    .replace(/<br\b[^>]*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
}
