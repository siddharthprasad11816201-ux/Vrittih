// In-house CSV parser (RFC 4180). No third-party dependency.
// Handles quoted fields, commas & newlines inside quotes, and "" escaped quotes.

export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  // Normalise line endings and strip a leading UTF-8 BOM if present.
  const s = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ }   // escaped quote
        else inQuotes = false
      } else {
        field += c
      }
    } else {
      if (c === '"') inQuotes = true
      else if (c === ",") { row.push(field); field = "" }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = "" }
      else field += c
    }
  }
  // flush trailing field/row (file may not end with newline)
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }

  // drop fully-empty rows (e.g. trailing blank line)
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ""))
}

// Parse into objects keyed by the (lower-cased, trimmed) header row.
export function parseCSVObjects(text: string): Record<string, string>[] {
  const rows = parseCSV(text)
  if (rows.length < 2) return []
  const headers = rows[0].map(h => h.trim().toLowerCase())
  return rows.slice(1).map(r => {
    const o: Record<string, string> = {}
    headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim() })
    return o
  })
}
