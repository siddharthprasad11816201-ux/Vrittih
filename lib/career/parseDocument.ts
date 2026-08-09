/* ICIRE §1 — universal document understanding: in-house text extraction from
 * PDF, DOCX and plain/HTML files. NO third-party libraries — only Node built-ins
 * (Buffer + zlib for the deflate used by PDF FlateDecode streams and the DOCX
 * ZIP container). SERVER ONLY (imports node:zlib).
 *
 * The PDF engine is structure-aware: it indexes indirect objects (including those
 * packed into PDF 1.5+ object streams), links each page to its content + font
 * resources, and — critically — applies each font's /ToUnicode CMap when decoding
 * text-showing operators. Without that, subsetted / CID (Type0) fonts (what most
 * modern résumé exporters use) decode to glyph-id gibberish. It also honours TJ
 * kerning (inserting spaces so words don't run together). Image-only scans still
 * surface a warning rather than garbage. */
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

/** Collapse whitespace, drop control chars, keep line structure. Uses charCode
 * checks (no literal control bytes in source). */
function sanitize(s: string): string {
  let cleaned = ""
  for (let i = 0; i < s.length; i++) {
    const cc = s.charCodeAt(i)
    if (cc === 9 || cc === 10 || cc === 13) { cleaned += s[i]; continue } // tab / LF / CR
    if (cc < 32) continue                                                  // other control chars
    if (cc === 0x00a0 || cc === 0x2007 || cc === 0x202f) { cleaned += " "; continue } // NBSP variants
    cleaned += s[i]
  }
  return cleaned
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]*\n[^\S\n]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n").map((l) => l.trim()).join("\n")
    .trim()
}

// ===========================================================================
// PDF — structure-aware engine (objects + object streams + ToUnicode + TJ)
// ===========================================================================

type PdfObj = { dict: string; stream: Buffer | null }
type PdfFont = { twoByte: boolean; cmap: Map<number, string> | null }

function parsePdf(buf: Buffer): { text: string; warnings: string[] } {
  try {
    const s = buf.toString("latin1")
    const objs = indexObjects(s)
    if (objs.size) {
      const fonts = collectFonts(objs)
      const pages = collectPages(objs)
      let out = ""
      for (const pg of pages) {
        const resolve = (name: string): PdfFont | null => { const fo = pg.fontMap.get(name); return fo != null ? fonts.get(fo) || null : null }
        for (const cnum of pg.contentNums) {
          const o = objs.get(cnum)
          if (!o || !o.stream) continue
          const content = decodeStream(o.dict, o.stream).toString("latin1")
          out += extractPageText(content, resolve) + "\n"
        }
      }
      if (out.replace(/\s/g, "").length >= 40) return { text: out, warnings: [] }
    }
  } catch { /* fall through to the lenient scanner */ }
  return parsePdfFallback(buf)
}

/** Index `N G obj … endobj` bodies, then expand PDF 1.5+ object streams. */
function indexObjects(s: string): Map<number, PdfObj> {
  const objs = new Map<number, PdfObj>()
  const re = /(\d+)\s+\d+\s+obj\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const num = +m[1]
    const start = m.index + m[0].length
    const endIdx = s.indexOf("endobj", start)
    if (endIdx < 0) break
    const body = s.slice(start, endIdx)
    const sm = body.match(/stream\r?\n/)
    if (sm && sm.index !== undefined) {
      const dataStart = sm.index + sm[0].length
      const se = body.indexOf("endstream", dataStart)
      const raw = body.slice(dataStart, se >= 0 ? se : undefined).replace(/\r?\n$/, "")
      objs.set(num, { dict: body.slice(0, sm.index), stream: Buffer.from(raw, "latin1") })
    } else {
      objs.set(num, { dict: body, stream: null })
    }
    re.lastIndex = endIdx + 6
  }
  for (const [, o] of [...objs]) {
    if (o.stream && /\/Type\s*\/ObjStm/.test(o.dict)) { try { expandObjStm(o, objs) } catch { /* skip */ } }
  }
  return objs
}

function expandObjStm(o: PdfObj, objs: Map<number, PdfObj>) {
  const N = +(o.dict.match(/\/N\s+(\d+)/)?.[1] || 0)
  const First = +(o.dict.match(/\/First\s+(\d+)/)?.[1] || 0)
  if (!N || !First || !o.stream) return
  const dec = decodeStream(o.dict, o.stream).toString("latin1")
  const header = dec.slice(0, First).trim().split(/\s+/).map(Number)
  for (let k = 0; k < N; k++) {
    const onum = header[2 * k]
    const offA = header[2 * k + 1]
    const offB = k + 1 < N ? header[2 * (k + 1) + 1] : undefined
    if (onum == null || offA == null) continue
    const body = dec.slice(First + offA, offB != null ? First + offB : undefined)
    if (!objs.has(onum)) objs.set(onum, { dict: body, stream: null })
  }
}

function decodeStream(dict: string, raw: Buffer): Buffer {
  if (/\/(DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode)/.test(dict)) return Buffer.alloc(0)
  if (/\/FlateDecode/.test(dict)) {
    try { return zlib.inflateSync(raw) } catch { try { return zlib.inflateRawSync(raw) } catch { return Buffer.alloc(0) } }
  }
  return raw
}

function collectFonts(objs: Map<number, PdfObj>): Map<number, PdfFont> {
  const fonts = new Map<number, PdfFont>()
  for (const [num, o] of objs) {
    if (!/\/Type\s*\/Font/.test(o.dict) && !/\/Subtype\s*\/(Type0|TrueType|Type1|Type3|MMType1|CIDFontType[02])/.test(o.dict)) continue
    let cmap: Map<number, string> | null = null
    const tu = o.dict.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/)
    if (tu) {
      const to = objs.get(+tu[1])
      if (to && to.stream) { try { cmap = parseToUnicode(decodeStream(to.dict, to.stream).toString("latin1")) } catch { /* none */ } }
    }
    const twoByte = /\/Subtype\s*\/Type0/.test(o.dict) || /\/Encoding\s*\/Identity-[HV]/.test(o.dict)
    fonts.set(num, { twoByte, cmap })
  }
  return fonts
}

/** Parse a /ToUnicode CMap: bfchar + bfrange (both range forms). Codes → string. */
function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>()
  for (const b of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of b[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) map.set(parseInt(p[1], 16), hexToStr(p[2]))
  }
  for (const b of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    // <lo> <hi> [<d0> <d1> ...]
    for (const r of b[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g)) {
      const lo = parseInt(r[1], 16)
      const dsts = [...r[3].matchAll(/<([0-9A-Fa-f]+)>/g)]
      dsts.forEach((d, k) => map.set(lo + k, hexToStr(d[1])))
    }
    // <lo> <hi> <dst>
    for (const r of b[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const lo = parseInt(r[1], 16), hi = parseInt(r[2], 16), base = parseInt(r[3], 16)
      for (let c = lo; c <= hi && c - lo < 65536; c++) map.set(c, String.fromCharCode(base + (c - lo)))
    }
  }
  return map
}

/** UTF-16BE hex → JS string (handles multi-unit / surrogate pairs). */
function hexToStr(hex: string): string {
  if (hex.length % 4) hex = hex.padEnd(hex.length + (4 - (hex.length % 4)), "0")
  let out = ""
  for (let k = 0; k < hex.length; k += 4) out += String.fromCharCode(parseInt(hex.substr(k, 4), 16))
  return out
}

type PdfPage = { contentNums: number[]; fontMap: Map<string, number> }

function collectPages(objs: Map<number, PdfObj>): PdfPage[] {
  const pages: PdfPage[] = []
  for (const [, o] of objs) {
    if (!/\/Type\s*\/Page\b/.test(o.dict) || /\/Type\s*\/Pages\b/.test(o.dict)) continue
    let contentNums: number[] = []
    const cm = o.dict.match(/\/Contents\s+(\d+)\s+\d+\s+R/)
    if (cm) contentNums = [+cm[1]]
    else {
      const arr = o.dict.match(/\/Contents\s*\[([^\]]*)\]/)
      if (arr) contentNums = [...arr[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((x) => +x[1])
    }
    let resDict = ""
    const rr = o.dict.match(/\/Resources\s+(\d+)\s+\d+\s+R/)
    if (rr) resDict = objs.get(+rr[1])?.dict || ""
    else { const idx = o.dict.indexOf("/Resources"); resDict = idx >= 0 ? o.dict.slice(idx) : o.dict }
    const fontMap = new Map<string, number>()
    const fInline = resDict.match(/\/Font\s*<<([\s\S]*?)>>/)
    if (fInline) { for (const x of fInline[1].matchAll(/\/([^\s/<>]+)\s+(\d+)\s+\d+\s+R/g)) fontMap.set(x[1], +x[2]) }
    else {
      const fRef = resDict.match(/\/Font\s+(\d+)\s+\d+\s+R/)
      if (fRef) { const fo = objs.get(+fRef[1]); if (fo) for (const x of fo.dict.matchAll(/\/([^\s/<>]+)\s+(\d+)\s+\d+\s+R/g)) fontMap.set(x[1], +x[2]) }
    }
    if (contentNums.length) pages.push({ contentNums, fontMap })
  }
  return pages
}

/** Walk a content stream, tracking the current font (Tf) and decoding shown text
 * through that font's ToUnicode map. Inserts newlines on line-moving operators and
 * spaces on large TJ kerning adjustments. */
function extractPageText(content: string, resolve: (name: string) => PdfFont | null): string {
  let res = ""
  let font: PdfFont | null = null
  let i = 0
  const n = content.length
  while (i < n) {
    const c = content[i]
    if (c === "/") {
      let j = i + 1, name = ""
      while (j < n && !/[\s/<>\[\]()]/.test(content[j])) { name += content[j]; j++ }
      if (/^\s+[\d.+-]+\s+Tf/.test(content.slice(j, j + 48))) font = resolve(name)
      i = j; continue
    }
    if (c === "(") { const r = readLiteral(content, i + 1); res += decodeShown(r.text, font); i = r.next; continue }
    if (c === "<" && content[i + 1] !== "<") { const r = readHex(content, i + 1); res += decodeShown(r.text, font); i = r.next; continue }
    if (c === "[") { const r = readTJ(content, i + 1, font); res += r.text; i = r.next; continue }
    if (c === "T" && (content[i + 1] === "d" || content[i + 1] === "D" || content[i + 1] === "*")) { res += "\n"; i += 2; continue }
    if (c === "'" || c === '"') { res += "\n"; i++; continue }
    i++
  }
  return res
}

/** Decode a shown byte-string (latin1, each char = one byte) through the font. */
function decodeShown(bytes: string, font: PdfFont | null): string {
  if (!font || !font.cmap) return bytes // standard-encoded font: bytes ≈ characters
  const w = font.twoByte ? 2 : 1
  let out = ""
  for (let i = 0; i + w <= bytes.length; i += w) {
    let code = 0
    for (let k = 0; k < w; k++) code = (code << 8) | bytes.charCodeAt(i + k)
    out += font.cmap.get(code) ?? ""
  }
  return out
}

/** Parse a `[ (str) num (str) … ] TJ` array: decode strings, add a space when the
 * kerning adjustment is a large negative number (a word gap). */
function readTJ(s: string, i: number, font: PdfFont | null): { text: string; next: number } {
  let out = ""
  while (i < s.length && s[i] !== "]") {
    const c = s[i]
    if (c === "(") { const r = readLiteral(s, i + 1); out += decodeShown(r.text, font); i = r.next; continue }
    if (c === "<") { const r = readHex(s, i + 1); out += decodeShown(r.text, font); i = r.next; continue }
    if (c === "-" || (c >= "0" && c <= "9")) {
      let j = i, num = ""
      while (j < s.length && /[-\d.]/.test(s[j])) { num += s[j]; j++ }
      if (parseFloat(num) < -100) out += " "
      i = j; continue
    }
    i++
  }
  return { text: out, next: i + 1 }
}

/** Lenient fallback: scan every stream for text operators (no CMap). Handles PDFs
 * the structured pass can't index; standard-encoded fonts still come out readable. */
function parsePdfFallback(buf: Buffer): { text: string; warnings: string[] } {
  const warnings: string[] = []
  const s = buf.toString("latin1")
  let out = "", streams = 0, decoded = 0
  const re = /stream\r?\n/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    streams++
    const dictStart = s.lastIndexOf("<<", m.index)
    const dict = dictStart >= 0 ? s.slice(dictStart, m.index) : ""
    const dataStart = m.index + m[0].length
    const end = s.indexOf("endstream", dataStart)
    if (end < 0) continue
    const chunk = s.slice(dataStart, end).replace(/\r?\n$/, "")
    if (/\/(DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode|LZWDecode)/.test(dict)) continue
    if (/\/(Image|XObject)\b/.test(dict) && !/FlateDecode/.test(dict)) continue
    let bytes = Buffer.from(chunk, "latin1")
    if (/\/FlateDecode/.test(dict)) { try { bytes = zlib.inflateSync(bytes) } catch { try { bytes = zlib.inflateRawSync(Buffer.from(chunk, "latin1")) } catch { continue } } }
    const content = bytes.toString("latin1")
    if (!/(\)\s*T[jJ])|(>\s*T[jJ])|BT/.test(content)) continue
    const t = extractPageText(content, () => null)
    if (t.trim()) { out += t + "\n"; decoded++ }
    re.lastIndex = end + 9
  }
  if (streams > 0 && decoded === 0) warnings.push("Found PDF streams but no extractable text layer (possibly a scanned/image PDF).")
  return { text: out, warnings }
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

// ===========================================================================
// DOCX (ZIP container -> word/document.xml)
// ===========================================================================

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
      if (buf.readUInt32LE(localOff) !== 0x04034b50) return null
      const lNameLen = buf.readUInt16LE(localOff + 26)
      const lExtraLen = buf.readUInt16LE(localOff + 28)
      const dataStart = localOff + 30 + lNameLen + lExtraLen
      const rawEntry = buf.subarray(dataStart, dataStart + compSize)
      try { return method === 8 ? zlib.inflateRawSync(rawEntry) : Buffer.from(rawEntry) } catch { return null }
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  return null
}

// ===========================================================================
// HTML
// ===========================================================================

function stripHtml(s: string): string {
  return s
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br)\b[^>]*>/gi, "\n")
    .replace(/<br\b[^>]*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
}
