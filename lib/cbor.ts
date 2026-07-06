/**
 * Vrittih in-house CBOR (RFC 8949) decoder.
 *
 * Implements the subset needed to parse WebAuthn attestation objects and
 * COSE public keys: unsigned/negative integers, byte strings, text strings,
 * arrays, and maps. Zero third-party libraries.
 */

export type CborValue = number | Buffer | string | CborValue[] | CborMap
export type CborMap = Map<number | string, CborValue>

class Reader {
  constructor(public buf: Buffer, public pos = 0) {}
  u8() { const v = this.buf[this.pos]; this.pos += 1; return v }
  u16() { const v = this.buf.readUInt16BE(this.pos); this.pos += 2; return v }
  u32() { const v = this.buf.readUInt32BE(this.pos); this.pos += 4; return v }
  u64() {
    const hi = this.buf.readUInt32BE(this.pos)
    const lo = this.buf.readUInt32BE(this.pos + 4)
    this.pos += 8
    return hi * 0x100000000 + lo
  }
  bytes(n: number) { const v = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return Buffer.from(v) }
}

function readLength(r: Reader, info: number): number {
  if (info < 24) return info
  if (info === 24) return r.u8()
  if (info === 25) return r.u16()
  if (info === 26) return r.u32()
  if (info === 27) return r.u64()
  throw new Error("CBOR: indefinite lengths not supported")
}

function decodeItem(r: Reader): CborValue {
  const initial = r.u8()
  const major = initial >> 5
  const info = initial & 0x1f
  switch (major) {
    case 0: return readLength(r, info)                       // unsigned int
    case 1: return -1 - readLength(r, info)                  // negative int
    case 2: return r.bytes(readLength(r, info))              // byte string
    case 3: return r.bytes(readLength(r, info)).toString("utf8") // text string
    case 4: {                                                // array
      const len = readLength(r, info)
      const out: CborValue[] = []
      for (let i = 0; i < len; i++) out.push(decodeItem(r))
      return out
    }
    case 5: {                                                // map
      const len = readLength(r, info)
      const out: CborMap = new Map()
      for (let i = 0; i < len; i++) {
        const key = decodeItem(r)
        if (typeof key !== "number" && typeof key !== "string") throw new Error("CBOR: unsupported map key type")
        out.set(key, decodeItem(r))
      }
      return out
    }
    case 7: {                                                // simple values we may meet
      if (info === 20) return 0 // false → 0 (not used in our paths)
      if (info === 21) return 1 // true → 1
      if (info === 22) return 0 // null → 0
      throw new Error("CBOR: unsupported simple/float value")
    }
    default:
      throw new Error(`CBOR: unsupported major type ${major}`)
  }
}

/** Decode the first CBOR item in the buffer; returns the value and bytes consumed. */
export function cborDecodeFirst(buf: Buffer): { value: CborValue; bytesRead: number } {
  const r = new Reader(buf)
  const value = decodeItem(r)
  return { value, bytesRead: r.pos }
}

/** Decode a buffer expected to contain exactly one CBOR item. */
export function cborDecode(buf: Buffer): CborValue {
  return cborDecodeFirst(buf).value
}
