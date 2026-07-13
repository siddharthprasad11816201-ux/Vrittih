// In-house client-side image processing via the browser Canvas API (no libraries).
// Runs before upload: decode -> cover-crop/resize to a target box -> re-encode as
// WebP (JPEG fallback). A 6 MB phone photo becomes a ~40-80 KB avatar, so uploads
// are fast and storage stays small — the actual compression, done for real.

export type ProcessedImage = { dataUrl: string; width: number; height: number; bytes: number; mime: string }

function supportsWebp(): boolean {
  try {
    const c = document.createElement("canvas")
    return c.toDataURL("image/webp").startsWith("data:image/webp")
  } catch { return false }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image.")) }
    img.src = url
  })
}

function approxBytesOfDataUrl(dataUrl: string): number {
  const i = dataUrl.indexOf(",")
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  return Math.floor(b64.length * 0.75) // base64 -> bytes
}

// Resize/crop into `box`. `cover` = fill a square (avatars/logos); otherwise fit
// within the box preserving aspect ratio (photos). Encodes under a quality search
// so the result lands under `maxBytes` when possible.
export async function processImage(
  file: File,
  opts: { box: number; mode?: "cover" | "contain"; maxBytes?: number } = { box: 512 }
): Promise<ProcessedImage> {
  const { box, mode = "cover", maxBytes = 300_000 } = opts
  const img = await loadImage(file)
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) throw new Error("That image looks empty or corrupt.")

  let cw: number, ch: number, sx = 0, sy = 0, sw = iw, sh = ih
  if (mode === "cover") {
    cw = ch = box
    const scale = Math.max(box / iw, box / ih)
    sw = box / scale; sh = box / scale
    sx = (iw - sw) / 2; sy = (ih - sh) / 2
  } else {
    const scale = Math.min(1, box / iw, box / ih)
    cw = Math.round(iw * scale); ch = Math.round(ih * scale)
  }

  const canvas = document.createElement("canvas")
  canvas.width = cw; canvas.height = ch
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not available in this browser.")
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)

  const mime = supportsWebp() ? "image/webp" : "image/jpeg"
  let q = 0.85
  let dataUrl = canvas.toDataURL(mime, q)
  // step quality down until we fit the budget (floor at 0.5 to protect quality)
  while (approxBytesOfDataUrl(dataUrl) > maxBytes && q > 0.5) {
    q -= 0.1
    dataUrl = canvas.toDataURL(mime, q)
  }
  return { dataUrl, width: cw, height: ch, bytes: approxBytesOfDataUrl(dataUrl), mime }
}

// Read any file to a data URL (used for non-image uploads like PDFs).
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error("Could not read the file."))
    r.readAsDataURL(file)
  })
}
