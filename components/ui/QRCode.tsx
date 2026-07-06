"use client"
import { useMemo } from "react"
import { generateQR } from "@/lib/qrcode"

// Renders a scannable QR code using the in-house generator. No third-party libs.
export default function QRCode({ value, size = 220, level = "M", className }: {
  value: string
  size?: number
  level?: "L" | "M"
  className?: string
}) {
  const { path, total } = useMemo(() => {
    let matrix: boolean[][]
    try { matrix = generateQR(value, level) } catch { return { path: "", total: 0 } }
    const n = matrix.length
    const margin = 4
    let p = ""
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (matrix[r][c]) p += `M${c + margin} ${r + margin}h1v1h-1z`
    }
    return { path: p, total: n + margin * 2 }
  }, [value, level])

  if (!total) return null
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR code"
      style={{ borderRadius: 8, background: "#fff" }}
    >
      <rect width={total} height={total} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}
