/**
 * Vrittih in-house QR Code generator (ISO/IEC 18004).
 *
 * Byte mode, error-correction levels L and M, versions 1–16 (byte capacity up
 * to ~365 chars at level M — ample for otpauth:// URIs). Includes GF(256)
 * Reed–Solomon, all 8 data masks with penalty scoring, BCH format/version info.
 * Pure and isomorphic — no third-party libraries, runs in Node and the browser.
 */

// ---------- GF(256) arithmetic (primitive polynomial 0x11d) ----------
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]
})()
const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]])

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]                          // × x  (shift to higher degree)
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i])    // × α^i (constant term)
    }
    poly = next
  }
  return poly
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen) // length ecLen+1, monic (gen[0] = 1)
  const res = [...data, ...new Array(ecLen).fill(0)]
  for (let i = 0; i < data.length; i++) {
    const coef = res[i]
    if (coef !== 0) for (let j = 1; j < gen.length; j++) res[i + j] ^= gfMul(gen[j], coef)
  }
  return res.slice(data.length)
}

// ---------- version tables (level L index 0, M index 1) ----------
// [ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data]
const EC_BLOCKS: Record<number, [number, number, number, number, number][]> = {
  1:  [[7,1,19,0,0],   [10,1,16,0,0]],
  2:  [[10,1,34,0,0],  [16,1,28,0,0]],
  3:  [[15,1,55,0,0],  [26,1,44,0,0]],
  4:  [[20,1,80,0,0],  [18,2,32,0,0]],
  5:  [[26,1,108,0,0], [24,2,43,0,0]],
  6:  [[18,2,68,0,0],  [16,4,27,0,0]],
  7:  [[20,2,78,0,0],  [18,4,31,0,0]],
  8:  [[24,2,97,0,0],  [22,2,38,2,39]],
  9:  [[30,2,116,0,0], [22,3,36,2,37]],
  10: [[18,2,68,2,69], [26,4,43,1,44]],
  11: [[20,4,81,0,0],  [30,1,50,4,51]],
  12: [[24,2,92,2,93], [22,6,36,2,37]],
  13: [[26,4,107,0,0], [22,8,37,1,38]],
  14: [[30,3,115,1,116],[24,4,40,5,41]],
  15: [[22,5,87,1,88], [24,5,41,5,42]],
  16: [[24,5,98,1,99], [28,7,45,3,46]],
}
const ALIGN_POS: Record<number, number[]> = {
  1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42],
  9:[6,26,46],10:[6,28,50],11:[6,30,54],12:[6,32,58],13:[6,34,62],
  14:[6,26,46,66],15:[6,26,48,70],16:[6,26,50,74],
}
const REMAINDER_BITS: Record<number, number> = {
  1:0,2:7,3:7,4:7,5:7,6:7,7:0,8:0,9:0,10:0,11:0,12:0,13:0,14:3,15:3,16:3,
}

type ECLevel = "L" | "M"
const EC_INDEX: Record<ECLevel, number> = { L: 0, M: 1 }
const EC_FORMAT_BITS: Record<ECLevel, number> = { L: 0b01, M: 0b00 }

function blockInfo(version: number, level: ECLevel) {
  const [ec, g1b, g1d, g2b, g2d] = EC_BLOCKS[version][EC_INDEX[level]]
  return { ecPerBlock: ec, g1Blocks: g1b, g1Data: g1d, g2Blocks: g2b, g2Data: g2d, totalData: g1b * g1d + g2b * g2d }
}

function pickVersion(byteLen: number, level: ECLevel): number {
  for (let v = 1; v <= 16; v++) {
    // header = mode(4) + count(8 for v1-9, 16 for v10-40) bits
    const countBits = v <= 9 ? 8 : 16
    const capacityBytes = blockInfo(v, level).totalData - Math.ceil((4 + countBits) / 8)
    if (byteLen <= capacityBytes) return v
  }
  throw new Error("QR: data too long for supported versions (1–16)")
}

// ---------- bit buffer ----------
class BitBuffer {
  bits: number[] = []
  put(value: number, len: number) { for (let i = len - 1; i >= 0; i--) this.bits.push((value >>> i) & 1) }
  get length() { return this.bits.length }
}

function encodeData(text: string, version: number, level: ECLevel): number[] {
  const bytes = Array.from(new TextEncoder().encode(text))
  const info = blockInfo(version, level)
  const buf = new BitBuffer()
  buf.put(0b0100, 4)                       // byte mode
  buf.put(bytes.length, version <= 9 ? 8 : 16)
  for (const b of bytes) buf.put(b, 8)
  const capacityBits = info.totalData * 8
  // terminator
  for (let i = 0; i < 4 && buf.length < capacityBits; i++) buf.bits.push(0)
  // byte align
  while (buf.length % 8 !== 0) buf.bits.push(0)
  // pad
  const padBytes = [0xec, 0x11]
  let p = 0
  while (buf.length < capacityBits) { buf.put(padBytes[p % 2], 8); p++ }
  // to codewords
  const codewords: number[] = []
  for (let i = 0; i < buf.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j++) byte = (byte << 1) | buf.bits[i + j]
    codewords.push(byte)
  }
  return codewords
}

function interleave(codewords: number[], version: number, level: ECLevel): number[] {
  const info = blockInfo(version, level)
  const blocks: { data: number[]; ec: number[] }[] = []
  let pos = 0
  for (let i = 0; i < info.g1Blocks; i++) {
    const data = codewords.slice(pos, pos + info.g1Data); pos += info.g1Data
    blocks.push({ data, ec: rsEncode(data, info.ecPerBlock) })
  }
  for (let i = 0; i < info.g2Blocks; i++) {
    const data = codewords.slice(pos, pos + info.g2Data); pos += info.g2Data
    blocks.push({ data, ec: rsEncode(data, info.ecPerBlock) })
  }
  const out: number[] = []
  const maxData = Math.max(info.g1Data, info.g2Data)
  for (let i = 0; i < maxData; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i])
  for (let i = 0; i < info.ecPerBlock; i++) for (const b of blocks) out.push(b.ec[i])
  return out
}

// ---------- matrix ----------
type Grid = (0 | 1 | null)[][]

function buildMatrix(finalCodewords: number[], version: number, level: ECLevel, forceMask?: number): { grid: boolean[][]; mask: number } {
  const size = version * 4 + 17
  const grid: Grid = Array.from({ length: size }, () => Array(size).fill(null))
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  const set = (r: number, c: number, v: 0 | 1, res = true) => { grid[r][c] = v; if (res) reserved[r][c] = true }

  const finder = (r: number, c: number) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const rr = r + i, cc = c + j
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue
      const inRing = i >= 0 && i <= 6 && j >= 0 && j <= 6
      const dark = inRing && ((i === 0 || i === 6 || j === 0 || j === 6) || (i >= 2 && i <= 4 && j >= 2 && j <= 4))
      set(rr, cc, dark ? 1 : 0)
    }
  }
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0)

  // timing
  for (let i = 8; i < size - 8; i++) { const v = (i % 2 === 0 ? 1 : 0) as 0 | 1; set(6, i, v); set(i, 6, v) }

  // alignment
  const ap = ALIGN_POS[version]
  for (const r of ap) for (const c of ap) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      const dark = Math.max(Math.abs(i), Math.abs(j)) !== 1
      set(r + i, c + j, dark ? 1 : 0)
    }
  }

  // dark module + reserve format/version areas
  set(size - 8, 8, 1)
  for (let i = 0; i < 9; i++) { if (grid[8][i] === null) reserved[8][i] = true; if (grid[i][8] === null) reserved[i][8] = true }
  for (let i = 0; i < 8; i++) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true }
  if (version >= 7) {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { reserved[i][size - 11 + j] = true; reserved[size - 11 + j][i] = true }
  }

  // data placement (zigzag)
  const bits: number[] = []
  for (const cw of finalCodewords) for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1)
  for (let i = 0; i < REMAINDER_BITS[version]; i++) bits.push(0)
  let bitIdx = 0
  let upward = true
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--
    for (let k = 0; k < size; k++) {
      const row = upward ? size - 1 - k : k
      for (const c of [col, col - 1]) {
        if (reserved[row][c] || grid[row][c] !== null) continue
        grid[row][c] = (bitIdx < bits.length ? bits[bitIdx] : 0) as 0 | 1
        bitIdx++
      }
    }
    upward = !upward
  }

  // masking
  const maskFns = [
    (r: number, c: number) => (r + c) % 2 === 0,
    (r: number, _c: number) => r % 2 === 0,
    (_r: number, c: number) => c % 3 === 0,
    (r: number, c: number) => (r + c) % 3 === 0,
    (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ]

  let best: { mask: number; grid: boolean[][]; pen: number } | null = null
  const masksToTry = forceMask === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [forceMask]
  for (const m of masksToTry) {
    const g: boolean[][] = grid.map((row) => row.map((v) => v === 1))
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && maskFns[m](r, c)) g[r][c] = !g[r][c]
    }
    applyFormatInfo(g, level, m, size)
    if (version >= 7) applyVersionInfo(g, version, size)
    const pen = penalty(g, size)
    if (!best || pen < best.pen) best = { mask: m, grid: g, pen }
  }
  return { grid: best!.grid, mask: best!.mask }
}

// ---------- format / version info (BCH) ----------
function bch(data: number, poly: number, deg: number): number {
  let d = data << deg
  const polyBits = Math.floor(Math.log2(poly)) + 1
  while (Math.floor(Math.log2(d)) + 1 >= polyBits) d ^= poly << (Math.floor(Math.log2(d)) + 1 - polyBits)
  return (data << deg) | d
}

function applyFormatInfo(g: boolean[][], level: ECLevel, mask: number, size: number) {
  const data = (EC_FORMAT_BITS[level] << 3) | mask
  const bits = (bch(data, 0b10100110111, 10) ^ 0b101010000010010) & 0x7fff
  for (let i = 0; i < 15; i++) {
    const bit = ((bits >> i) & 1) === 1
    // top-left vertical/horizontal
    if (i < 6) g[i][8] = bit
    else if (i === 6) g[7][8] = bit
    else if (i === 7) g[8][8] = bit
    else if (i === 8) g[8][7] = bit
    else g[8][14 - i] = bit
    // mirrored copies
    if (i < 8) g[8][size - 1 - i] = bit
    else g[size - 15 + i][8] = bit
  }
  g[size - 8][8] = true // dark module
}

function applyVersionInfo(g: boolean[][], version: number, size: number) {
  const bits = bch(version, 0b1111100100101, 12) & 0x3ffff
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >> i) & 1) === 1
    const r = Math.floor(i / 3)
    const c = i % 3
    g[r][size - 11 + c] = bit
    g[size - 11 + c][r] = bit
  }
}

// ---------- penalty scoring ----------
function penalty(g: boolean[][], size: number): number {
  let score = 0
  // rule 1: runs of 5+
  for (let r = 0; r < size; r++) {
    for (const dir of [0, 1]) {
      let run = 1
      for (let i = 1; i < size; i++) {
        const a = dir === 0 ? g[r][i] : g[i][r]
        const b = dir === 0 ? g[r][i - 1] : g[i - 1][r]
        if (a === b) { run++; if (run === 5) score += 3; else if (run > 5) score += 1 }
        else run = 1
      }
    }
  }
  // rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
    if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) score += 3
  }
  // rule 3: finder-like pattern
  const pat1 = [true, false, true, true, true, false, true, false, false, false, false]
  const pat2 = [false, false, false, false, true, false, true, true, true, false, true]
  for (let r = 0; r < size; r++) for (let c = 0; c <= size - 11; c++) {
    let m1h = true, m2h = true, m1v = true, m2v = true
    for (let k = 0; k < 11; k++) {
      if (g[r][c + k] !== pat1[k]) m1h = false
      if (g[r][c + k] !== pat2[k]) m2h = false
      if (g[c + k][r] !== pat1[k]) m1v = false
      if (g[c + k][r] !== pat2[k]) m2v = false
    }
    if (m1h) score += 40; if (m2h) score += 40; if (m1v) score += 40; if (m2v) score += 40
  }
  // rule 4: dark ratio
  let dark = 0
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (g[r][c]) dark++
  const ratio = (dark / (size * size)) * 100
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10
  return score
}

/** Produce a boolean module matrix (true = dark) for the given text. */
export function generateQR(text: string, level: ECLevel = "M"): boolean[][] {
  return qrDebug(text, level).matrix
}

/** Like generateQR but returns the chosen version/mask; supports forcing them (used for verification). */
export function qrDebug(text: string, level: ECLevel = "M", force?: { version?: number; mask?: number }): { matrix: boolean[][]; version: number; mask: number } {
  const bytes = new TextEncoder().encode(text).length
  const version = force?.version ?? pickVersion(bytes, level)
  const codewords = encodeData(text, version, level)
  const final = interleave(codewords, version, level)
  const { grid, mask } = buildMatrix(final, version, level, force?.mask)
  return { matrix: grid, version, mask }
}

/** Render the matrix as a self-contained SVG string. */
export function qrToSVG(text: string, opts: { level?: ECLevel; size?: number; margin?: number } = {}): string {
  const { level = "M", size = 240, margin = 4 } = opts
  const matrix = generateQR(text, level)
  const n = matrix.length
  const total = n + margin * 2
  const scale = size / total
  let path = ""
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (matrix[r][c]) path += `M${(c + margin) * scale} ${(r + margin) * scale}h${scale}v${scale}h-${scale}z`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
}
