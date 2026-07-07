import Link from "next/link"

export const metadata = { title: "Vrittih — Developer API" }

export default function DevelopersPage() {
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <Link href="/" style={S.brand}>Vrittih<span style={{ color: "#0F6E56" }}>.online</span> / Developers</Link>
        <h1 style={S.h1}>Jobs API</h1>
        <p style={S.lead}>Connect your company's systems to Vrittih and post jobs programmatically. Your company account is created automatically when we issue your key — nothing to set up.</p>

        <h2 style={S.h2}>Authentication</h2>
        <p style={S.p}>Every request sends your key as a bearer token. Ask a Vrittih admin to issue one (it's shown only once).</p>
        <pre style={S.code}>Authorization: Bearer vk_live_xxxxxxxxxxxxxxxxxxxxxxxx</pre>

        <h2 style={S.h2}>Post jobs</h2>
        <p style={S.p}><b>POST</b> <code style={S.inline}>/api/v1/jobs</code> — send one job, an array, or <code style={S.inline}>{"{ jobs: [...] }"}</code>. Only <code style={S.inline}>title</code> is required; everything else has sensible defaults.</p>
        <pre style={S.code}>{`curl -X POST https://vrittih.online/api/v1/jobs \\
  -H "Authorization: Bearer vk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Senior Backend Engineer",
    "description": "Build our core platform…",
    "industry": "Technology",
    "location": "Zurich, Switzerland",
    "type": "FULLTIME",
    "salary": "120,000 CHF",
    "remote": true
  }'`}</pre>
        <p style={S.p}>Response:</p>
        <pre style={S.code}>{`{ "ok": true, "created": 1,
  "jobs": [{ "id": "…", "title": "Senior Backend Engineer" }],
  "errors": [] }`}</pre>

        <h2 style={S.h2}>List your jobs</h2>
        <p style={S.p}><b>GET</b> <code style={S.inline}>/api/v1/jobs</code> — returns your company's postings with live applicant counts.</p>

        <h2 style={S.h2}>Fields</h2>
        <table style={S.table}><tbody>
          {[["title", "required — the role title"], ["description", "full job description"], ["company", "defaults to your company name"], ["industry", "e.g. Technology, Finance, Healthcare"], ["location", "city, country, or \"Remote\""], ["type", "FULLTIME · PARTTIME · INTERNSHIP · CONTRACT · FREELANCE"], ["salary", "free text, e.g. \"120,000 CHF\""], ["remote", "true / false"], ["active", "true (default) / false to unpublish"]].map(([k, v]) => (
            <tr key={k}><td style={S.tdK}><code style={S.inline}>{k}</code></td><td style={S.tdV}>{v}</td></tr>
          ))}
        </tbody></table>

        <p style={S.foot}>Posted jobs go live immediately on the Vrittih job board, ranked to candidates by fit, with the full applicant pipeline and HRMS available in your dashboard. Need a key? Contact your Vrittih admin.</p>
      </div>
    </div>
  )
}

const S: Record<string, any> = {
  page: { minHeight: "100vh", background: "#FAF8F2", fontFamily: "var(--font-sans)", color: "#14201B", padding: "2.5rem 1.5rem 5rem" },
  wrap: { maxWidth: 760, margin: "0 auto" },
  brand: { fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "#04342C", textDecoration: "none" },
  h1: { fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 600, letterSpacing: "-.03em", color: "#04342C", margin: "18px 0 10px" },
  lead: { fontSize: 16, color: "#4A5750", lineHeight: 1.6, marginBottom: 30 },
  h2: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "#04342C", margin: "30px 0 10px" },
  p: { fontSize: 14.5, color: "#2c3a33", lineHeight: 1.65, marginBottom: 10 },
  inline: { fontFamily: "var(--font-mono)", fontSize: 13, background: "#E1F5EE", color: "#0B6B45", padding: "2px 6px", borderRadius: 5 },
  code: { background: "#04342C", color: "#EAF3EE", borderRadius: 12, padding: "16px 18px", fontSize: 12.5, fontFamily: "var(--font-mono)", overflowX: "auto", lineHeight: 1.6, margin: "6px 0 8px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5, marginTop: 8 },
  tdK: { padding: "8px 12px 8px 0", verticalAlign: "top", whiteSpace: "nowrap", borderBottom: "1px solid #E8E3D7" },
  tdV: { padding: "8px 0", color: "#4A5750", borderBottom: "1px solid #E8E3D7" },
  foot: { fontSize: 13.5, color: "#7C877F", lineHeight: 1.6, marginTop: 30, paddingTop: 18, borderTop: "1px solid #E8E3D7" },
}
