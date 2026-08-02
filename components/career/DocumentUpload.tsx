"use client"
import { useEffect, useRef, useState } from "react"

/* ICIRE §1 — upload résumés/transcripts; the server extracts the text in-house
 * (no third-party parser) and refreshes the applicant's Career Intelligence
 * profile. Shows what was read + honest warnings when a file can't be parsed. */

type Doc = { id: string; kind: string; title: string; createdAt: string; chars: number; parsed?: { format?: string; warnings?: string[] } }
const KINDS = [
  { v: "resume", label: "Résumé / CV" },
  { v: "transcript", label: "Transcript" },
  { v: "certificate", label: "Certificate" },
  { v: "cover_letter", label: "Cover letter" },
  { v: "portfolio", label: "Portfolio" },
  { v: "other", label: "Other" },
]

export default function DocumentUpload({ onChange }: { onChange?: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [kind, setKind] = useState("resume")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string; warnings?: string[] } | null>(null)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = () => fetch("/api/career/documents").then((r) => (r.ok ? r.json() : { documents: [] })).then((j) => setDocs(j.documents || [])).catch(() => {})
  useEffect(() => { load() }, [])

  async function upload(file: File) {
    setBusy(true); setMsg(null)
    const fd = new FormData()
    fd.append("file", file); fd.append("kind", kind)
    try {
      const res = await fetch("/api/career/documents", { method: "POST", body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg({ type: "err", text: j.error || "Upload failed.", warnings: j.warnings }); setBusy(false); return }
      setMsg({ type: "ok", text: `Read ${j.extraction.chars.toLocaleString()} characters from ${file.name} (${j.extraction.format.toUpperCase()}).${j.reanalyzed ? " Your profile was refreshed." : ""}`, warnings: j.extraction.warnings })
      await load(); onChange?.()
    } catch { setMsg({ type: "err", text: "Upload failed. Please try again." }) }
    setBusy(false)
  }

  async function remove(id: string) {
    await fetch(`/api/career/documents?id=${id}`, { method: "DELETE" })
    await load(); onChange?.()
  }

  return (
    <div style={S.wrap}>
      <div style={S.top}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={S.select}>
          {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
        </select>
      </div>

      <div
        style={{ ...S.drop, ...(drag ? S.dropActive : {}) }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f) }}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".pdf,.docx,.doc,.txt,.html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = "" }} />
        <div style={S.dropTitle}>{busy ? "Reading your document…" : "Drop a file here, or click to choose"}</div>
        <div style={S.dropSub}>PDF, Word (.docx), or text — read in-house, up to 8 MB</div>
      </div>

      {msg && (
        <div style={{ ...S.msg, ...(msg.type === "ok" ? S.msgOk : S.msgErr) }}>
          <div>{msg.text}</div>
          {msg.warnings && msg.warnings.length > 0 && <ul style={S.warnList}>{msg.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        </div>
      )}

      {docs.length > 0 && (
        <div style={S.list}>
          {docs.map((d) => (
            <div key={d.id} style={S.row}>
              <div style={S.rowMain}>
                <span style={S.fmt}>{d.parsed?.format?.toUpperCase() || d.kind}</span>
                <span style={S.name}>{d.title}</span>
                <span style={S.meta}>{d.chars.toLocaleString()} chars</span>
              </div>
              <button style={S.del} onClick={() => remove(d.id)} aria-label="Remove">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const S: Record<string, any> = {
  wrap: { display: "flex", flexDirection: "column", gap: 12 },
  top: { display: "flex", gap: 8 },
  select: { font: "500 13px var(--font-sans)", color: "#1F2937", border: "1px solid #E5E7EB", borderRadius: 9, padding: "8px 12px", background: "#fff" },
  drop: { border: "1.5px dashed #CBD5E1", borderRadius: 14, padding: "26px 18px", textAlign: "center", cursor: "pointer", background: "#F7F9FC", transition: "border-color .15s, background .15s" },
  dropActive: { borderColor: "#6495ED", background: "#EAF1FE" },
  dropTitle: { font: "600 14px var(--font-sans)", color: "#334EAC" },
  dropSub: { font: "400 12px var(--font-sans)", color: "#94A3B8", marginTop: 4 },
  msg: { borderRadius: 11, padding: "11px 14px", font: "400 12.5px/1.5 var(--font-sans)" },
  msgOk: { color: "#166534", background: "#E7F8EE", border: "1px solid #CDEFDB" },
  msgErr: { color: "#B42318", background: "#FDECEC", border: "1px solid #FAD2CE" },
  warnList: { margin: "6px 0 0", padding: "0 0 0 18px" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, border: "1px solid #E9EDF2", borderRadius: 11, padding: "10px 12px", background: "#fff" },
  rowMain: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  fmt: { font: "700 9.5px var(--font-sans)", textTransform: "uppercase", letterSpacing: ".04em", color: "#6495ED", background: "#EAF1FE", borderRadius: 5, padding: "2px 6px", flexShrink: 0 },
  name: { font: "500 13px var(--font-sans)", color: "#1F2937", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  meta: { font: "400 11.5px var(--font-sans)", color: "#94A3B8", flexShrink: 0 },
  del: { font: "600 12px var(--font-sans)", color: "#64748B", background: "none", border: "1px solid #E5E7EB", borderRadius: 8, padding: "5px 10px", cursor: "pointer", flexShrink: 0 },
}
