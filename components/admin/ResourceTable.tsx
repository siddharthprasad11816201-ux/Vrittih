"use client"
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react"
import AdminShell, { AdminTopBar } from "@/components/admin/AdminShell"

/**
 * One admin table, configured per resource.
 *
 * Companies, applications and candidates all need the same thing: search, an archived
 * view, edit, archive/restore and delete, with the destructive action gated. Writing that
 * three times would guarantee the three drift apart, so the behaviour lives here and each
 * page supplies only what differs.
 *
 * Capabilities come from the SERVER (`viewer` on the list response), never from a local
 * guess at the user's role, so the table can never offer an action the API would refuse.
 */

export interface FieldSpec {
  key: string
  label: string
  /** textarea for long prose; checkbox for booleans. */
  type?: "text" | "textarea" | "checkbox"
}

export interface ColumnSpec<T = any> {
  label: string
  render: (row: T) => ReactNode
  width?: string
}

export interface ResourceConfig<T = any> {
  title: string
  subtitle: string
  /** API base, e.g. "/api/admin/companies". */
  endpoint: string
  /** Key in the list response holding the rows, e.g. "companies". */
  listKey: string
  /** Body key naming this row's id, e.g. "companyId". */
  idParam: string
  columns: ColumnSpec<T>[]
  /** Fields offered in the edit modal. Omit to disable editing. */
  editFields?: FieldSpec[]
  /** Whether this resource supports archive/restore. */
  archivable?: boolean
  /** Extra confirmation text for deletion, given the row. */
  deleteWarning?: (row: T) => string
  searchPlaceholder?: string
  /**
   * Resource-specific controls rendered before the standard actions — e.g. a stage
   * selector. Kept as one extension point so the table is not forked per resource.
   */
  extraActions?: (row: T, helpers: { patch: (body: any, okMsg: string) => void; busy: boolean; viewer: Viewer }) => ReactNode
}

interface Viewer { isAdmin: boolean; canEdit: boolean; canDelete: boolean }

export default function ResourceTable<T extends { id: string; archived?: boolean }>({ config }: { config: ResourceConfig<T> }) {
  const [rows, setRows] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [viewer, setViewer] = useState<Viewer>({ isAdmin: false, canEdit: false, canDelete: false })
  const [q, setQ] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [editing, setEditing] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams()
      if (q) params.set("q", q)
      if (showArchived) params.set("includeArchived", "true")
      params.set("page", String(page))
      const d = await fetch(`${config.endpoint}?${params}`).then((r) => r.json())
      if (d.error) { setError(d.error); setRows([]); return }
      setRows(d[config.listKey] || [])
      setTotal(d.total || 0)
      setViewer(d.viewer || { isAdmin: false, canEdit: false, canDelete: false })
    } catch {
      setError("Could not reach the server.")
      setRows([])
    } finally { setLoading(false) }
  }, [q, page, showArchived, config.endpoint, config.listKey])

  useEffect(() => { load() }, [load])

  async function mutate(body: any, okMsg: string) {
    setBusy(body[config.idParam]); setNotice(""); setError("")
    try {
      const r = await fetch(config.endpoint, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "The change was refused."); return }
      setNotice(okMsg); setEditing(null); await load()
    } catch { setError("Could not reach the server.") }
    finally { setBusy(null) }
  }

  async function remove(row: T) {
    const warn = config.deleteWarning?.(row) || "Permanently delete this record? This cannot be undone."
    if (!confirm(warn)) return
    setBusy(row.id); setNotice(""); setError("")
    try {
      const r = await fetch(config.endpoint, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [config.idParam]: row.id }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error || "The deletion was refused."); return }
      // The API reports real side effects (orphaned jobs, detached applications) — surface
      // them rather than a bare success.
      setNotice(d.note || "Deleted.")
      await load()
    } catch { setError("Could not reach the server.") }
    finally { setBusy(null) }
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const body: any = { [config.idParam]: editing.id }
    for (const f of config.editFields || []) body[f.key] = editing[f.key]
    mutate(body, "Changes saved.")
  }

  return (
    <AdminShell>
      <AdminTopBar
        title={config.title}
        subtitle={config.subtitle}
        right={
          <span style={{ fontSize: 12, color: "#64748B" }}>
            {loading ? "Loading…" : `${total.toLocaleString()} total`}
          </span>
        }
      />

      <div style={S.controls}>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1) }}
          placeholder={config.searchPlaceholder || "Search…"}
          style={S.search}
        />
        {config.archivable && (
          <label style={S.check}>
            <input type="checkbox" checked={showArchived} onChange={(e) => { setShowArchived(e.target.checked); setPage(1) }} />
            Show archived
          </label>
        )}
      </div>

      {!viewer.isAdmin && !loading && (
        <div style={S.warn}>You do not have administrator access to this section.</div>
      )}
      {error && <div style={S.err}>{error}</div>}
      {notice && <div style={S.ok}>{notice}</div>}

      {loading ? (
        <div style={S.empty}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={S.empty}>Nothing to show{q ? ` for “${q}”` : ""}.</div>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                {config.columns.map((c) => (
                  <th key={c.label} style={{ ...S.th, width: c.width }}>{c.label}</th>
                ))}
                <th style={{ ...S.th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={row.archived ? S.trArchived : undefined}>
                  {config.columns.map((c) => (
                    <td key={c.label} style={S.td}>{c.render(row)}</td>
                  ))}
                  <td style={{ ...S.td, textAlign: "right", whiteSpace: "nowrap" }}>
                    {config.extraActions?.(row, {
                      patch: (body, okMsg) => mutate({ [config.idParam]: row.id, ...body }, okMsg),
                      busy: busy === row.id,
                      viewer,
                    })}
                    {config.editFields && viewer.canEdit && (
                      <button type="button" disabled={busy === row.id} onClick={() => setEditing({ ...row })} style={S.btn}>Edit</button>
                    )}
                    {config.archivable && viewer.canEdit && (
                      <button
                        type="button" disabled={busy === row.id}
                        onClick={() => mutate({ [config.idParam]: row.id, archived: !row.archived }, row.archived ? "Restored." : "Archived.")}
                        style={S.btn}
                      >{row.archived ? "Restore" : "Archive"}</button>
                    )}
                    {viewer.canDelete && (
                      <button type="button" disabled={busy === row.id} onClick={() => remove(row)} style={{ ...S.btn, ...S.danger }}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > rows.length && (
        <div style={S.pager}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={S.btn}>Previous</button>
          <span style={{ fontSize: 13, color: "#64748B" }}>Page {page}</span>
          <button type="button" disabled={rows.length === 0} onClick={() => setPage((p) => p + 1)} style={S.btn}>Next</button>
        </div>
      )}

      {editing && config.editFields && (
        <div role="dialog" aria-modal="true" aria-label={`Edit ${config.title}`} onClick={() => setEditing(null)} style={S.overlay}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={saveEdit} style={S.modal}>
            <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>Edit</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748B" }}>
              Recorded in the audit log with the previous values.
            </p>
            {config.editFields.map((f) => (
              <label key={f.key} style={S.field}>
                <span style={S.fieldLabel}>{f.label}</span>
                {f.type === "textarea" ? (
                  <textarea rows={5} value={editing[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} style={{ ...S.input, resize: "vertical" }} />
                ) : f.type === "checkbox" ? (
                  <input type="checkbox" checked={!!editing[f.key]} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.checked })} />
                ) : (
                  <input value={editing[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} style={S.input} />
                )}
              </label>
            ))}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" onClick={() => setEditing(null)} style={S.btn}>Cancel</button>
              <button type="submit" disabled={busy === editing.id} style={{ ...S.btn, ...S.primary }}>
                {busy === editing.id ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  )
}

const S: Record<string, CSSProperties> = {
  controls: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", margin: "0 0 14px" },
  search: { flex: 1, minWidth: 220, fontSize: 14, padding: "9px 12px", borderRadius: 9, border: "1px solid #E2E8F0" },
  check: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569", cursor: "pointer" },
  warn: { background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412", borderRadius: 10, padding: "10px 13px", fontSize: 13, marginBottom: 12 },
  err: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", borderRadius: 10, padding: "10px 13px", fontSize: 13, marginBottom: 12 },
  ok: { background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#065F46", borderRadius: 10, padding: "10px 13px", fontSize: 13, marginBottom: 12 },
  empty: { padding: "36px 0", textAlign: "center", color: "#94A3B8", fontSize: 14 },
  tableWrap: { overflowX: "auto", border: "1px solid #E2E8F0", borderRadius: 12, background: "#fff" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13.5 },
  th: { textAlign: "left", padding: "10px 14px", borderBottom: "1px solid #E2E8F0", color: "#475569", fontWeight: 650, whiteSpace: "nowrap" },
  td: { padding: "10px 14px", borderBottom: "1px solid #F1F5F9", color: "#0F172A", verticalAlign: "top" },
  trArchived: { background: "#FFFBEB" },
  btn: { fontSize: 13, padding: "6px 11px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#0F172A", cursor: "pointer", marginLeft: 6 },
  danger: { color: "#B91C1C", borderColor: "#FECACA", background: "#FEF2F2" },
  primary: { background: "#6495ED", color: "#fff", borderColor: "transparent", fontWeight: 600 },
  pager: { display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end", marginTop: 14 },
  overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", display: "grid", placeItems: "center", padding: 20, zIndex: 50 },
  modal: { background: "#fff", borderRadius: 16, padding: 22, width: "min(620px,100%)", maxHeight: "88vh", overflowY: "auto" },
  field: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: 600, color: "#334155" },
  input: { fontSize: 14, padding: "9px 11px", borderRadius: 9, border: "1px solid #E2E8F0", width: "100%" },
}
