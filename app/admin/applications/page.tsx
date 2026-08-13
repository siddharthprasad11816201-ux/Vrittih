"use client"
import ResourceTable from "@/components/admin/ResourceTable"

// Legal onward moves per stage. This MIRRORS the server state machine
// (lib/interview/state) so the dropdown does not offer a move the API will refuse — the
// server remains the authority and re-checks every transition.
const NEXT: Record<string, string[]> = {
  APPLIED: ["SCREENING", "ASSESSMENT", "SHORTLISTED", "REJECTED"],
  SCREENING: ["ASSESSMENT", "SHORTLISTED", "INTERVIEW", "REJECTED"],
  ASSESSMENT: ["SHORTLISTED", "INTERVIEW", "REJECTED"],
  SHORTLISTED: ["INTERVIEW", "OFFERED", "REJECTED"],
  INTERVIEW: ["OFFERED", "REJECTED"],
  OFFERED: ["HIRED", "REJECTED"],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
}

export default function AdminApplications() {
  return (
    <ResourceTable
      config={{
        title: "Applications",
        subtitle: "Every application across all employers. Stage changes follow the same rules recruiters get.",
        endpoint: "/api/admin/applications",
        listKey: "applications",
        idParam: "applicationId",
        archivable: false,
        searchPlaceholder: "Filter is by stage and job — use the API for advanced queries…",
        columns: [
          { label: "Candidate", render: (a: any) => (
            <span><strong>{a.user?.name || "Unknown"}</strong><br /><span style={{ fontSize: 12, color: "#64748B" }}>{a.user?.email}</span></span>
          ) },
          { label: "Role", render: (a: any) => (
            <span>{a.job?.title || "—"}<br /><span style={{ fontSize: 12, color: "#64748B" }}>{a.job?.company}</span></span>
          ) },
          { label: "Stage", render: (a: any) => <code style={{ fontSize: 12 }}>{a.status}</code>, width: "120px" },
          { label: "Applied", render: (a: any) => new Date(a.appliedAt).toLocaleDateString(), width: "110px" },
        ],
        // A terminal application offers no moves — the machine forbids resurrecting it.
        extraActions: (a: any, { patch, busy, viewer }) => {
          const options = NEXT[a.status] || []
          if (!viewer.canEdit || options.length === 0) return null
          return (
            <select
              defaultValue=""
              disabled={busy}
              onChange={(e) => { if (e.target.value) patch({ status: e.target.value }, `Moved to ${e.target.value}.`) }}
              style={{ fontSize: 13, padding: "5px 8px", borderRadius: 8, border: "1px solid #E2E8F0", marginRight: 6 }}
            >
              <option value="">Move to…</option>
              {options.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )
        },
        deleteWarning: (a: any) =>
          `Permanently delete ${a.user?.name || "this candidate"}'s application to "${a.job?.title}"?\n\nThis also destroys their timeline, answers and uploaded documents. Use this for an erasure request — it cannot be undone.`,
      }}
    />
  )
}
