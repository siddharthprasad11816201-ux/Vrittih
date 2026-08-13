"use client"
import ResourceTable from "@/components/admin/ResourceTable"

export default function AdminCompanies() {
  return (
    <ResourceTable
      config={{
        title: "Companies",
        subtitle: "Edit, verify, archive or remove company pages.",
        endpoint: "/api/admin/companies",
        listKey: "companies",
        idParam: "companyId",
        archivable: true,
        searchPlaceholder: "Search by name or slug…",
        columns: [
          { label: "Name", render: (c: any) => (
            <span>
              <strong>{c.name}</strong>
              {c.verified && <span style={{ marginLeft: 6, fontSize: 11, color: "#065F46" }}>verified</span>}
              {c.archived && <span style={{ marginLeft: 6, fontSize: 11, color: "#9A3412" }}>archived</span>}
            </span>
          ) },
          { label: "Slug", render: (c: any) => <code style={{ fontSize: 12 }}>{c.slug}</code> },
          { label: "Industry", render: (c: any) => c.industry || "—" },
          { label: "Followers", render: (c: any) => c._count?.followers ?? 0, width: "100px" },
        ],
        editFields: [
          { key: "name", label: "Name" },
          { key: "slug", label: "Slug (public URL)" },
          { key: "tagline", label: "Tagline" },
          { key: "website", label: "Website" },
          { key: "industry", label: "Industry" },
          { key: "headquarters", label: "Headquarters" },
          { key: "size", label: "Size band" },
          { key: "about", label: "About", type: "textarea" },
          { key: "verified", label: "Verified", type: "checkbox" },
        ],
        // Jobs reference a company by NAME, not a foreign key, so they survive deletion.
        deleteWarning: (c: any) =>
          `Permanently delete the company page "${c.name}"?\n\nIts ${c._count?.followers ?? 0} follower(s) are removed. Job postings that name this company stay published and must be archived separately.\n\nArchive instead if you only want to hide it.`,
      }}
    />
  )
}
