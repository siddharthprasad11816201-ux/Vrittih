import Link from "next/link"
import KeysPanel from "@/components/developers/KeysPanel"
import DomainsPanel from "@/components/developers/DomainsPanel"
import BrandPanel from "@/components/developers/BrandPanel"

export const metadata = { title: "Vrittih — Developer API" }

export default function DevelopersPage() {
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <Link href="/" style={S.brand}>Vrittih<span style={{ color: "#0F6E56" }}>.online</span> / Developers</Link>
        <h1 style={S.h1}>Jobs API</h1>
        <p style={S.lead}>Connect your company's systems to Vrittih and post jobs programmatically — then read applicants back and run HRMS from your own tools. Generate a key below and you're live in a minute.</p>

        <KeysPanel />
        <DomainsPanel />
        <BrandPanel />

        <h2 style={S.h2}>Authentication</h2>
        <p style={S.p}>Every request sends your key as a bearer token. Generate one in <b>Your API keys</b> above — it's shown only once.</p>
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

        <h2 style={S.h2}>Read applicants back</h2>
        <p style={S.p}><b>GET</b> <code style={S.inline}>/api/v1/applications</code> — pull candidates into your own ATS/HRMS. Each applicant is the snapshot they submitted, plus screening answers, documents and the status timeline. Filter with <code style={S.inline}>jobId</code>, <code style={S.inline}>status</code>, <code style={S.inline}>since</code> (ISO); page with <code style={S.inline}>limit</code> (max 200) and <code style={S.inline}>cursor</code>.</p>
        <pre style={S.code}>{`curl "https://vrittih.online/api/v1/applications?status=APPLIED&limit=50" \\
  -H "Authorization: Bearer vk_live_…"

{ "count": 1, "nextCursor": null,
  "applications": [{
    "id": "…", "jobId": "…", "jobTitle": "Backend Engineer",
    "status": "APPLIED", "appliedAt": "2026-…",
    "applicant": { "name": "Jane Candidate", "email": "…",
      "experience": [], "education": [], "skills": [] },
    "answers": [], "documents": [],
    "timeline": [{ "status": "APPLIED", "note": "Application submitted", "at": "2026-…" }]
  }] }`}</pre>

        <h2 style={S.h2}>Webhooks</h2>
        <p style={S.p}><b>POST</b> <code style={S.inline}>/api/v1/webhooks</code> — subscribe an <b>https</b> endpoint to real-time events (<code style={S.inline}>application.created</code>, <code style={S.inline}>application.updated</code>, <code style={S.inline}>job.expired</code>, or omit for all). The signing secret is returned once. We POST <code style={S.inline}>{"{ event, at, data }"}</code> and sign the raw body so you can verify it's us:</p>
        <pre style={S.code}>{`X-Vrittih-Signature: sha256=<hex HMAC-SHA256(secret, rawBody)>

// verify (Node):
const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
if (expected !== req.headers["x-vrittih-signature"]) throw new Error("bad signature")`}</pre>
        <p style={S.p}>Failed deliveries retry with exponential backoff. <b>GET</b> <code style={S.inline}>/api/v1/webhooks</code> lists your subscriptions with their last delivery status; <b>DELETE</b> with <code style={S.inline}>{"{ id }"}</code> removes one.</p>

        <h2 style={S.h2}>HRMS &amp; payroll</h2>
        <p style={S.p}>Run your whole HR operation over the API.</p>
        <p style={S.p}><b>Employees</b> — <b>GET</b>/<b>POST</b> <code style={S.inline}>/api/v1/employees</code> (add by email; links to an existing user or creates the record), <b>PATCH</b> <code style={S.inline}>/api/v1/employees/:id</code> to update details or set a salary structure via a <code style={S.inline}>compensation</code> block.</p>
        <p style={S.p}><b>Payroll</b> — <b>POST</b> <code style={S.inline}>/api/v1/payroll</code> computes a draft run for everyone with a salary structure (refuses mixed currencies); <b>PATCH</b> <code style={S.inline}>/api/v1/payroll</code> with <code style={S.inline}>{"{ runId, action }"}</code> (approve / paid / cancel); <b>GET</b> lists runs with gross/deduction/net totals.</p>
        <pre style={S.code}>{`# add an employee, set their salary, run + approve payroll
curl -X POST .../api/v1/employees -H "Authorization: Bearer vk_live_…" \\
  -d '{"email":"ravi@acme.com","name":"Ravi Kumar","department":"Engineering"}'
curl -X PATCH .../api/v1/employees/<id> -H "Authorization: Bearer vk_live_…" \\
  -d '{"compensation":{"currency":"CHF","annualCTC":120000,"components":[
        {"name":"Basic","kind":"earning","calc":"pct_ctc","value":50},
        {"name":"PF","kind":"deduction","calc":"pct_basic","value":12}]}}'
curl -X POST .../api/v1/payroll -H "Authorization: Bearer vk_live_…" -d '{"periodYear":2026,"periodMonth":8}'`}</pre>

        <h2 style={S.h2}>Tasks</h2>
        <p style={S.p}><b>GET/POST</b> <code style={S.inline}>/api/v1/tasks</code> — create and read team assignments from your own tools. A task takes <code style={S.inline}>title</code>, and optionally <code style={S.inline}>description</code>, <code style={S.inline}>priority</code> (LOW/MEDIUM/HIGH), <code style={S.inline}>status</code> (TODO/DOING/DONE), <code style={S.inline}>assigneeId</code> (one of your employees) and <code style={S.inline}>dueAt</code>. Filter with <code style={S.inline}>status</code> / <code style={S.inline}>assigneeId</code>. Also available as a board inside Vrittih at <code style={S.inline}>/tasks</code>.</p>

        <h2 style={S.h2}>Fields</h2>
        <table style={S.table}><tbody>
          {[["title", "required — the role title"], ["description", "full job description"], ["company", "defaults to your company name"], ["industry", "e.g. Technology, Finance, Healthcare"], ["location", "city, country, or \"Remote\""], ["type", "FULLTIME · PARTTIME · INTERNSHIP · CONTRACT · FREELANCE"], ["salary", "free text, e.g. \"120,000 CHF\""], ["remote", "true / false"], ["active", "true (default) / false to unpublish"]].map(([k, v]) => (
            <tr key={k}><td style={S.tdK}><code style={S.inline}>{k}</code></td><td style={S.tdV}>{v}</td></tr>
          ))}
        </tbody></table>

        <p style={S.foot}>Posted jobs go live on the Vrittih job board once your company is approved and the apply link is on a <b>verified domain</b> (see Verified domains above) — until then they're saved as <code style={S.inline}>pending</code>. Live jobs are ranked to candidates by fit, with the full applicant pipeline and HRMS in your dashboard. Generate your key in <b>Your API keys</b> at the top of this page.</p>
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
