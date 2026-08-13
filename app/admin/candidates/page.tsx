"use client"
import ResourceTable from "@/components/admin/ResourceTable"

export default function AdminCandidates() {
  return (
    <ResourceTable
      config={{
        title: "Candidates",
        subtitle: "The candidate master — one record per person, however many sources they came from.",
        endpoint: "/api/admin/candidates",
        listKey: "candidates",
        idParam: "candidateId",
        archivable: true,
        searchPlaceholder: "Search by name or email…",
        columns: [
          { label: "Name", render: (c: any) => (
            <span>
              <strong>{c.displayName}</strong>
              {c.archived && <span style={{ marginLeft: 6, fontSize: 11, color: "#9A3412" }}>archived</span>}
            </span>
          ) },
          { label: "Email", render: (c: any) => c.primaryEmail || "—" },
          { label: "Identifiers", render: (c: any) => (c.identities || []).map((i: any) => i.kind).join(", ") || "—" },
          // Attribution is preserved across merges, so this shows every channel they arrived from.
          { label: "Sources", render: (c: any) => (c.sources || []).map((s: any) => s.source).join(", ") || "—" },
          { label: "Applications", render: (c: any) => c._count?.applications ?? 0, width: "110px" },
        ],
        editFields: [
          { key: "displayName", label: "Name" },
          { key: "headline", label: "Headline" },
          { key: "currentEmployer", label: "Current employer" },
          { key: "location", label: "Location" },
        ],
        deleteWarning: (c: any) =>
          `Permanently delete the candidate record for "${c.displayName}"?\n\nTheir identifiers and source attribution are removed. Their ${c._count?.applications ?? 0} application(s) are DETACHED, not deleted — those belong to the employer's hiring record.\n\nArchive instead if you only want to hide them.`,
      }}
    />
  )
}
