"use client"
import { useEffect, useRef, useState } from "react"
import AdminShell, { AdminTopBar } from "@/components/admin/AdminShell"
import { IconUpload, IconUsers, IconBriefcase, IconCheckCircle, IconFileText } from "@/components/ui/Icons"

const ACCENT = "#0F6E56"

export default function ImportPage() {
  const [employers, setEmployers] = useState<any[]>([])
  const [importedCount, setImportedCount] = useState(0)
  const [ownerId, setOwnerId] = useState("")
  const [company, setCompany] = useState("")
  const [csv, setCsv] = useState("")
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [busy, setBusy] = useState<"" | "preview" | "import">("")
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadMeta() {
    const d = await fetch("/api/admin/import").then(r => r.json())
    if (d.employers) {
      setEmployers(d.employers)
      setImportedCount(d.importedCount || 0)
      const emp = d.employers.find((e: any) => e.role === "EMPLOYER") || d.employers[0]
      if (emp && !ownerId) setOwnerId(emp.id)
    }
  }
  useEffect(() => { loadMeta() }, [])

  function onFile(e: any) {
    const f = e.target.files?.[0]; if (!f) return
    setFileName(f.name); setResult(null); setPreview(null); setError("")
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result || ""))
    reader.readAsText(f)
  }

  async function run(dryRun: boolean) {
    if (!csv.trim()) { setError("Paste CSV text or choose a .csv file first."); return }
    setBusy(dryRun ? "preview" : "import"); setError("")
    if (dryRun) setResult(null)
    try {
      const d = await fetch("/api/admin/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, ownerId, company, dryRun }),
      }).then(r => r.json())
      if (d.error) { setError(d.error); setBusy(""); return }
      if (dryRun) setPreview(d)
      else { setResult(d); setPreview(null); loadMeta() }
    } catch (e: any) { setError(e.message || "Request failed") }
    setBusy("")
  }

  const rowCount = csv ? csv.trim().split("\n").length - 1 : 0

  return (
    <AdminShell>
      <AdminTopBar title="Import candidates" subtitle="Migrate applicants from Indeed into Vrittih"
        right={<span style={S.badge}><IconUsers size={13} /> {importedCount} imported so far</span>} />
      <div style={S.body}>
        <div style={S.grid}>
          {/* LEFT: source */}
          <div style={S.card}>
            <div style={S.cardHead}><IconFileText size={16} /> Source data</div>
            <p style={S.hint}>
              Export your applicants from Indeed (Candidates → Export to CSV) and drop the file here,
              or paste the rows below. Expected columns:
              <code style={S.code}>name, email, phone, status, candidate location, relevant experience, education, job title, job location, date, interest level, source</code>
            </p>

            <div style={S.dropRow}>
              <button style={S.fileBtn} onClick={() => fileRef.current?.click()}>
                <IconUpload size={15} /> Choose .csv file
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
              {fileName && <span style={S.fileName}>{fileName}</span>}
              {rowCount > 0 && <span style={S.rowCount}>{rowCount} row{rowCount === 1 ? "" : "s"}</span>}
            </div>

            <textarea value={csv} onChange={e => { setCsv(e.target.value); setResult(null); setPreview(null) }}
              placeholder="…or paste CSV rows here (including the header line)"
              rows={9} style={S.textarea} />
          </div>

          {/* RIGHT: options */}
          <div style={S.card}>
            <div style={S.cardHead}><IconBriefcase size={16} /> Import options</div>
            <label style={S.label}>Assign positions to employer</label>
            <select value={ownerId} onChange={e => setOwnerId(e.target.value)} style={S.select}>
              {employers.map(e => <option key={e.id} value={e.id}>{e.name} · {e.email} ({e.role})</option>)}
            </select>
            <p style={S.subhint}>Imported jobs & applicants appear in this employer's pipeline.</p>

            <label style={{ ...S.label, marginTop: 16 }}>Company name (optional)</label>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Defaults to employer name" style={S.input} />

            <div style={S.actions}>
              <button onClick={() => run(true)} disabled={!!busy} style={S.ghostBtn}>
                {busy === "preview" ? "Analysing…" : "Preview"}
              </button>
              <button onClick={() => run(false)} disabled={!!busy} style={S.primaryBtn}>
                {busy === "import" ? "Importing…" : "Import now"}
              </button>
            </div>
            {error && <div style={S.err}>{error}</div>}
          </div>
        </div>

        {/* PREVIEW */}
        {preview && (
          <div style={S.card}>
            <div style={S.cardHead}>Preview — nothing saved yet</div>
            <div style={S.statRow}>
              <Stat label="Rows in file" value={preview.totalRows} />
              <Stat label="Valid rows" value={preview.valid} />
              <Stat label="Unique candidates" value={preview.uniqueCandidates} />
              <Stat label="Skipped (no email/title)" value={preview.skippedNoEmail} />
            </div>
            <div style={S.posHead}>Positions detected ({preview.positions.length})</div>
            <div style={S.posList}>
              {preview.positions.map((p: any) => (
                <div key={p.title} style={S.posItem}><span>{p.title}</span><span style={S.posCount}>{p.count}</span></div>
              ))}
            </div>
            <button onClick={() => run(false)} disabled={!!busy} style={{ ...S.primaryBtn, marginTop: 16 }}>
              {busy === "import" ? "Importing…" : `Import ${preview.uniqueCandidates} candidates`}
            </button>
          </div>
        )}

        {/* RESULT */}
        {result && (
          <div style={{ ...S.card, borderColor: "#A7F3D0", background: "#F0FDF4" }}>
            <div style={{ ...S.cardHead, color: "#047857" }}><IconCheckCircle size={17} /> Import complete</div>
            <div style={S.statRow}>
              <Stat label="Positions created" value={result.positionsCreated} sub={`${result.positionsTotal} total`} />
              <Stat label="New candidates" value={result.candidatesCreated} sub={`${result.candidatesExisting} already existed`} />
              <Stat label="Applications added" value={result.applicationsCreated} sub={`${result.applicationsSkipped} duplicates skipped`} />
              <Stat label="Owner" value={result.owner} />
            </div>
            <p style={S.subhint}>
              View them under <a href="/admin/users" style={S.link}>Users</a>, or in the employer's{" "}
              <a href="/pipeline" style={S.link}>applicant pipeline</a>.
            </p>
          </div>
        )}
      </div>
    </AdminShell>
  )
}

function Stat({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return (
    <div style={S.stat}>
      <div style={S.statValue}>{value ?? 0}</div>
      <div style={S.statLabel}>{label}</div>
      {sub && <div style={S.statSub}>{sub}</div>}
    </div>
  )
}

const S: Record<string, any> = {
  body: { padding: "2rem" },
  badge: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: ACCENT, background: "#E1F5EE", border: "1px solid #E9E4FB", padding: "5px 12px", borderRadius: 999 },
  grid: { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "1.25rem", alignItems: "start" },
  card: { background: "#fff", border: "1px solid rgba(0,0,0,.07)", borderRadius: 14, padding: "1.35rem", marginBottom: "1.25rem" },
  cardHead: { display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 700, color: "#0A0A0F", marginBottom: 12 },
  hint: { fontSize: 12.5, color: "#6b7280", lineHeight: 1.6, marginBottom: 14 },
  code: { display: "block", marginTop: 8, background: "#FAF8F2", border: "1px solid rgba(0,0,0,.06)", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#4b5563", fontFamily: "ui-monospace, monospace", lineHeight: 1.5 },
  dropRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" as const },
  fileBtn: { display: "inline-flex", alignItems: "center", gap: 7, background: "#E1F5EE", color: ACCENT, border: "1px solid #E9E4FB", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  fileName: { fontSize: 12.5, color: "#0A0A0F", fontWeight: 500 },
  rowCount: { fontSize: 12, color: "#6b7280", background: "#FAF8F2", padding: "3px 10px", borderRadius: 999 },
  textarea: { width: "100%", border: "1px solid rgba(0,0,0,.15)", borderRadius: 10, padding: "11px 13px", fontSize: 12.5, fontFamily: "ui-monospace, monospace", outline: "none", resize: "vertical" as const, lineHeight: 1.5, color: "#0A0A0F" },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#7B7B8F", marginBottom: 6 },
  select: { width: "100%", border: "1px solid rgba(0,0,0,.15)", borderRadius: 10, padding: "10px 12px", fontSize: 13, outline: "none", background: "#fff", color: "#0A0A0F" },
  input: { width: "100%", border: "1px solid rgba(0,0,0,.15)", borderRadius: 10, padding: "10px 13px", fontSize: 13.5, outline: "none" },
  subhint: { fontSize: 12, color: "#9ca3af", marginTop: 8, lineHeight: 1.5 },
  actions: { display: "flex", gap: 10, marginTop: 20 },
  ghostBtn: { flex: 1, background: "#fff", border: "1px solid rgba(0,0,0,.15)", color: "#0A0A0F", borderRadius: 10, padding: "11px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  primaryBtn: { flex: 1, background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  err: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "#B91C1C", marginTop: 12 },
  statRow: { display: "flex", flexWrap: "wrap" as const, gap: 14, marginBottom: 8 },
  stat: { flex: "1 1 150px", background: "#FAF8F2", borderRadius: 11, padding: "14px 16px" },
  statValue: { fontSize: 24, fontWeight: 700, color: "#0A0A0F", letterSpacing: "-.5px" },
  statLabel: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  statSub: { fontSize: 11, color: "#9ca3af", marginTop: 3 },
  posHead: { fontSize: 12.5, fontWeight: 600, color: "#7B7B8F", margin: "14px 0 8px" },
  posList: { display: "flex", flexDirection: "column" as const, gap: 6, maxHeight: 260, overflow: "auto" },
  posItem: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAF8F2", borderRadius: 9, padding: "9px 13px", fontSize: 13, color: "#0A0A0F" },
  posCount: { fontSize: 12, fontWeight: 700, color: ACCENT, background: "#E1F5EE", padding: "2px 10px", borderRadius: 999 },
  link: { color: ACCENT, fontWeight: 600, textDecoration: "none" },
}
