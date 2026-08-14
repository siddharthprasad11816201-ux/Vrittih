"use client"
import ResourceTable from "@/components/admin/ResourceTable"

const SLA_COLOR: Record<string, string> = {
  ON_TRACK: "#065F46", AT_RISK: "#9A3412", BREACHED: "#B91C1C", FULFILLED: "#1D4ED8", NOT_STARTED: "#64748B",
}

export default function AdminGuaranteedHire() {
  return (
    <ResourceTable
      config={{
        title: "Guaranteed Hire",
        subtitle: "Premium managed engagements. Fill-or-free — every quote and deadline is audited.",
        endpoint: "/api/admin/guaranteed-hire",
        listKey: "requests",
        idParam: "requestId",
        archivable: false,
        searchPlaceholder: "Filter by status via the API…",
        columns: [
          { label: "Role", render: (r: any) => (
            <span><strong>{r.title}</strong><br />
              <span style={{ fontSize: 12, color: "#64748B" }}>{r.seniority || "—"} · {r.headcount} hire(s)</span>
            </span>
          ) },
          { label: "Client", render: (r: any) => (
            <span>{r.employer?.name || "—"}<br /><span style={{ fontSize: 12, color: "#64748B" }}>{r.employer?.email}</span></span>
          ) },
          { label: "Stage", render: (r: any) => <code style={{ fontSize: 12 }}>{r.status}</code>, width: "110px" },
          // The promise state is the number that matters operationally.
          { label: "Guarantee", render: (r: any) => (
            <span style={{ color: SLA_COLOR[r.sla] || "#64748B", fontWeight: 600, fontSize: 12.5 }}>
              {r.sla.replace("_", " ")}
              {r.daysRemaining != null && r.sla !== "FULFILLED" && (
                <span style={{ display: "block", fontWeight: 400, color: "#64748B" }}>
                  {r.daysRemaining >= 0 ? `${r.daysRemaining}d left` : `${Math.abs(r.daysRemaining)}d over`}
                </span>
              )}
            </span>
          ), width: "130px" },
          // A breached promise means nothing is owed — shown, not left implicit.
          { label: "Billable", render: (r: any) => (
            r.quotedCHF == null ? <span style={{ color: "#94A3B8" }}>not quoted</span>
              : <span>CHF {Number(r.billableCHF ?? 0).toLocaleString("de-CH")}
                  {r.billableCHF === 0 && r.quotedCHF > 0 && (
                    <span style={{ display: "block", fontSize: 11, color: "#B91C1C" }}>waived — guarantee missed</span>
                  )}
                </span>
          ), width: "130px" },
          { label: "Delivered", render: (r: any) => r.delivered ?? 0, width: "90px" },
        ],
        extraActions: (r: any, { patch, busy, viewer }) => {
          if (!viewer.canEdit) return null
          return (
            <>
              {!r.acceptedAt && (
                <button type="button" disabled={busy}
                  onClick={() => {
                    const v = prompt(`Agreed price in CHF (minimum 150) for "${r.title}":`, String(r.quotedCHF ?? 150))
                    if (!v) return
                    const days = prompt("Days to fill before the guarantee triggers:", String(r.guaranteeDays ?? 30))
                    if (!days) return
                    patch({ accept: true, quotedCHF: Number(v), guaranteeDays: Number(days) },
                      "Engagement accepted — terms frozen and the clock has started.")
                  }}
                  style={{ fontSize: 13, padding: "6px 11px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", cursor: "pointer", marginRight: 6 }}
                >Quote &amp; accept</button>
              )}
              {r.acceptedAt && !r.filledAt && (
                <button type="button" disabled={busy}
                  onClick={() => { if (confirm(`Mark "${r.title}" as filled? This fulfils the guarantee.`)) patch({ markFilled: true }, "Marked filled — guarantee fulfilled.") }}
                  style={{ fontSize: 13, padding: "6px 11px", borderRadius: 8, border: "1px solid #A7F3D0", background: "#ECFDF5", color: "#065F46", cursor: "pointer", marginRight: 6 }}
                >Mark filled</button>
              )}
            </>
          )
        },
      }}
    />
  )
}
