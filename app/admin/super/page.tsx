"use client"
import { useEffect, useState } from "react"
import AdminShell, { AdminTopBar } from "@/components/admin/AdminShell"
import { IconLock } from "@/components/ui/Icons"

type Me = { id: string; role: string } | null
const ROLES = ["JOBSEEKER", "EMPLOYER", "ADMIN", "SUPER_ADMIN"]
const TABS = [["users", "Users"], ["broadcast", "Broadcast"], ["settings", "Settings"], ["activity", "Activity"]] as const

export default function SuperAdmin() {
  const [me, setMe] = useState<Me>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<string>("users")

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => { setMe(d.user || null); setReady(true) }).catch(() => setReady(true))
  }, [])

  if (!ready) return <AdminShell><div style={S.center}>Loading…</div></AdminShell>
  if (!me || me.role !== "SUPER_ADMIN") {
    return (
      <AdminShell>
        <div style={S.center}>
          <div style={S.lock}>
            <div style={{ color:"#534AB7", display:"flex", justifyContent:"center" }}><IconLock size={28} /></div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "10px 0 4px" }}>Super-admin only</h2>
            <p style={{ fontSize: 13, color: "#6b7280" }}>This control center requires the SUPER_ADMIN role. Your role: {me?.role || "guest"}.</p>
          </div>
        </div>
      </AdminShell>
    )
  }

  return (
    <AdminShell>
      <AdminTopBar title="Super Control" subtitle="Full platform control" right={<span style={S.badge}>SUPER ADMIN</span>} />
      <div style={S.tabBar}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...S.tab, ...(tab === key ? S.tabOn : {}) }}>{label}</button>
        ))}
      </div>
      <div style={S.body}>
        {tab === "users" && <UsersPanel meId={me.id} />}
        {tab === "broadcast" && <BroadcastPanel />}
        {tab === "settings" && <SettingsPanel />}
        {tab === "activity" && <ActivityPanel />}
      </div>
    </AdminShell>
  )
}

/* ----------------------------- Users ----------------------------- */
function UsersPanel({ meId }: { meId: string }) {
  const [users, setUsers] = useState<any[]>([])
  const [q, setQ] = useState("")
  const [role, setRole] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => { load() }, [q, role, page])

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (role) params.set("role", role)
    params.set("page", String(page))
    const d = await fetch("/api/admin/users?" + params).then(r => r.json())
    setUsers(d.users || []); setLoading(false)
  }

  async function patch(userId: string, payload: any, label: string) {
    setBusy(userId + label)
    const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, ...payload }) })
    const d = await res.json()
    setBusy(null)
    if (!res.ok) { alert(d.error || "Action failed"); return }
    load()
  }

  async function changeRole(userId: string, newRole: string) {
    if (!confirm(`Change this user's role to ${newRole}?`)) return
    patch(userId, { action: "setRole", role: newRole }, "role")
  }

  async function resetPassword(userId: string) {
    const pw = prompt("Enter a new password for this user (min 8 characters):")
    if (!pw) return
    if (pw.length < 8) { alert("Password must be at least 8 characters."); return }
    patch(userId, { action: "resetPassword", newPassword: pw }, "pw")
  }

  async function remove(userId: string) {
    if (!confirm("Permanently delete this user and all their data? This cannot be undone.")) return
    const res = await fetch("/api/admin/users", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) })
    const d = await res.json()
    if (!res.ok) { alert(d.error || "Delete failed"); return }
    load()
  }

  async function impersonate(userId: string) {
    if (!confirm("Log in as this user? You can return to your admin account from the banner.")) return
    const res = await fetch("/api/admin/impersonate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) })
    const d = await res.json()
    if (!res.ok) { alert(d.error || "Impersonation failed"); return }
    window.location.href = "/dashboard"
  }

  return (
    <>
      <div style={S.toolbar}>
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search name or email…" style={S.input} />
        <select value={role} onChange={e => { setRole(e.target.value); setPage(1) }} style={S.sel}>
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead><tr style={S.thead}>{["User", "Role", "Status", "Apps", "Controls"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} style={S.empty}>Loading…</td></tr> :
              users.map(u => {
                const self = u.id === meId
                return (
                  <tr key={u.id} style={S.tr}>
                    <td style={S.td}>
                      <div style={S.bold}>{u.name}{self && <span style={S.youTag}>you</span>}</div>
                      <div style={S.muted}>{u.email}</div>
                    </td>
                    <td style={S.td}>
                      <select value={u.role} disabled={self} onChange={e => changeRole(u.id, e.target.value)} style={S.roleSel}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td style={S.td}>
                      <div style={S.badges}>
                        <span style={{ ...S.pill, ...(u.paid ? S.pOk : S.pNo) }}>{u.paid ? "Paid" : "Unpaid"}</span>
                        <span style={{ ...S.pill, ...(u.idVerified ? S.pOk : S.pNeutral) }}>{u.idVerified ? "Verified" : "Unverified"}</span>
                        {u.banned && <span style={{ ...S.pill, ...S.pBan }}>Banned</span>}
                      </div>
                    </td>
                    <td style={S.td}><span style={S.muted}>{u._count?.applications ?? 0}</span></td>
                    <td style={S.td}>
                      <div style={S.actions}>
                        <button onClick={() => patch(u.id, { action: u.paid ? "unpay" : "markPaid" }, "paid")} disabled={busy === u.id + "paid"} style={S.btn}>{u.paid ? "Unpay" : "Mark paid"}</button>
                        <button onClick={() => patch(u.id, { action: u.idVerified ? "unverify" : "verify" }, "ver")} disabled={busy === u.id + "ver"} style={S.btn}>{u.idVerified ? "Unverify" : "Verify"}</button>
                        <button onClick={() => resetPassword(u.id)} style={S.btn}>Reset pw</button>
                        {!self && <button onClick={() => impersonate(u.id)} style={S.btnAlt}>Impersonate</button>}
                        {!self && <button onClick={() => patch(u.id, { action: u.banned ? "unban" : "ban" }, "ban")} disabled={busy === u.id + "ban"} style={u.banned ? S.btn : S.btnWarn}>{u.banned ? "Unban" : "Ban"}</button>}
                        {!self && <button onClick={() => remove(u.id)} style={S.btnDanger}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
      <div style={S.pagination}>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={S.pageBtn}>← Prev</button>
        <span style={{ fontSize: 13, color: "#6b7280" }}>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={users.length < 20} style={S.pageBtn}>Next →</button>
      </div>
    </>
  )
}

/* --------------------------- Broadcast --------------------------- */
function BroadcastPanel() {
  const [form, setForm] = useState({ title: "", body: "", link: "", role: "ALL" })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState("")

  async function send() {
    if (!form.title.trim() || !form.body.trim()) { setResult("Title and message are required."); return }
    setSending(true); setResult("")
    const res = await fetch("/api/admin/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    const d = await res.json()
    setSending(false)
    setResult(res.ok ? `Sent to ${d.sent} user${d.sent === 1 ? "" : "s"}.` : (d.error || "Failed to send"))
    if (res.ok) setForm({ title: "", body: "", link: "", role: "ALL" })
  }

  return (
    <div style={S.card}>
      <h3 style={S.cardTitle}>Broadcast a notification</h3>
      <p style={S.cardSub}>Delivers an in-app notification to every (non-banned) user, optionally filtered by role.</p>
      {result && <div style={S.notice}>{result}</div>}
      <label style={S.label}>Title</label>
      <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={S.input2} placeholder="e.g. Scheduled maintenance tonight" />
      <label style={S.label}>Message</label>
      <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} style={{ ...S.input2, minHeight: 110, resize: "vertical" }} placeholder="What do you want everyone to know?" />
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Link (optional)</label>
          <input value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} style={S.input2} placeholder="/jobs" />
        </div>
        <div style={{ width: 200 }}>
          <label style={S.label}>Audience</label>
          <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={{ ...S.input2, cursor: "pointer" }}>
            <option value="ALL">Everyone</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
      <button onClick={send} disabled={sending} style={S.saveBtn}>{sending ? "Sending…" : "Send broadcast"}</button>
    </div>
  )
}

/* ---------------------------- Settings --------------------------- */
const TOGGLES: [string, string, string][] = [
  ["maintenanceMode", "Maintenance mode", "Stored flag for putting the platform into maintenance."],
  ["signupsEnabled", "Sign-ups enabled", "When off, the registration endpoint rejects new accounts."],
  ["allowEmployerFreePost", "Employer free post", "Allow employers one free job post per verified ID."],
]
function SettingsPanel() {
  const [settings, setSettings] = useState<Record<string, string> | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(() => { fetch("/api/admin/settings").then(r => r.json()).then(d => setSettings(d.settings || {})) }, [])

  function set(key: string, value: string) { setSettings(p => ({ ...(p || {}), [key]: value })) }

  async function save() {
    if (!settings) return
    setSaving(true); setMsg("")
    const res = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings }) })
    const d = await res.json()
    setSaving(false)
    if (res.ok) { setSettings(d.settings); setMsg("Settings saved.") } else setMsg(d.error || "Failed to save")
  }

  if (!settings) return <div style={S.center}>Loading settings…</div>

  return (
    <div style={S.card}>
      <h3 style={S.cardTitle}>Platform settings</h3>
      {msg && <div style={S.notice}>{msg}</div>}
      {TOGGLES.map(([key, label, desc]) => (
        <div key={key} style={S.settingRow}>
          <div>
            <div style={S.settingLabel}>{label}</div>
            <div style={S.settingDesc}>{desc}</div>
          </div>
          <button onClick={() => set(key, settings[key] === "true" ? "false" : "true")} style={{ ...S.toggle, ...(settings[key] === "true" ? S.toggleOn : {}) }}>
            <span style={{ ...S.knob, ...(settings[key] === "true" ? S.knobOn : {}) }} />
          </button>
        </div>
      ))}
      <div style={S.settingRow}>
        <div><div style={S.settingLabel}>Joining fee</div><div style={S.settingDesc}>One-time membership fee shown across the platform.</div></div>
        <input value={settings.joiningFee ?? ""} onChange={e => set("joiningFee", e.target.value)} style={S.smallInput} />
      </div>
      <div style={S.settingRow}>
        <div><div style={S.settingLabel}>Currency</div><div style={S.settingDesc}>Currency code used for the fee and revenue.</div></div>
        <input value={settings.currency ?? ""} onChange={e => set("currency", e.target.value)} style={S.smallInput} />
      </div>
      <button onClick={save} disabled={saving} style={S.saveBtn}>{saving ? "Saving…" : "Save settings"}</button>
    </div>
  )
}

/* ---------------------------- Activity --------------------------- */
function ActivityPanel() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { fetch("/api/admin/activity").then(r => r.json()).then(setData) }, [])
  if (!data) return <div style={S.center}>Loading activity…</div>

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
      <div style={S.card}>
        <h3 style={S.cardTitle}>Admin activity log</h3>
        {(data.logs?.length ?? 0) === 0 ? <p style={S.muted}>No admin actions recorded yet.</p> :
          <div style={S.logList}>
            {data.logs.map((l: any) => (
              <div key={l.id} style={S.logRow}>
                <span style={S.logAction}>{l.action}</span>
                <span style={S.muted}>{l.user?.name || "—"} · {new Date(l.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                {l.meta && <span style={S.logMeta}>{l.meta}</span>}
              </div>
            ))}
          </div>}
      </div>
      <div style={S.card}>
        <h3 style={S.cardTitle}>Recent login attempts</h3>
        {(data.logins?.length ?? 0) === 0 ? <p style={S.muted}>No login attempts.</p> :
          <div style={S.logList}>
            {data.logins.map((a: any) => (
              <div key={a.id} style={S.logRow}>
                <span style={{ ...S.pill, ...(a.success ? S.pOk : S.pBan) }}>{a.success ? "success" : "failed"}</span>
                <span style={S.muted}>{a.email} · {new Date(a.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
            ))}
          </div>}
      </div>
    </div>
  )
}

const S: Record<string, any> = {
  center: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", fontSize: 14, color: "#9ca3af" },
  lock: { textAlign: "center" as const, background: "#fff", border: "0.5px solid rgba(0,0,0,.08)", borderRadius: 16, padding: "2.5rem 3rem" },
  badge: { background: "#534AB7", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", padding: "5px 12px", borderRadius: 999 },
  tabBar: { display: "flex", gap: 4, padding: "0 2rem", background: "#fff", borderBottom: "0.5px solid rgba(0,0,0,.07)" },
  tab: { background: "none", border: "none", padding: "12px 16px", fontSize: 13, color: "#7B7B8F", cursor: "pointer", borderBottom: "2px solid transparent", marginBottom: -1 },
  tabOn: { color: "#534AB7", fontWeight: 600, borderBottom: "2px solid #534AB7" },
  body: { padding: "1.5rem 2rem" },
  toolbar: { display: "flex", gap: 10, marginBottom: 12 },
  input: { flex: 1, maxWidth: 320, border: "0.5px solid rgba(0,0,0,.13)", borderRadius: 8, padding: "7px 12px", fontSize: 13, outline: "none" },
  sel: { border: "0.5px solid rgba(0,0,0,.13)", borderRadius: 8, padding: "7px 10px", fontSize: 13, background: "#fff", cursor: "pointer" },
  tableWrap: { background: "#fff", border: "0.5px solid rgba(0,0,0,.08)", borderRadius: 12, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  thead: { background: "#F9F9FC" },
  th: { padding: "10px 14px", textAlign: "left" as const, fontSize: 11, color: "#9ca3af", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: ".05em", borderBottom: "0.5px solid rgba(0,0,0,.07)" },
  tr: { borderBottom: "0.5px solid rgba(0,0,0,.04)" },
  td: { padding: "11px 14px", verticalAlign: "top" as const },
  bold: { fontSize: 13, fontWeight: 500, color: "#0A0A0F" },
  youTag: { marginLeft: 6, fontSize: 10, background: "#EEF2FF", color: "#4338CA", padding: "1px 6px", borderRadius: 999, fontWeight: 600 },
  muted: { fontSize: 12, color: "#6b7280" },
  roleSel: { border: "0.5px solid rgba(0,0,0,.13)", borderRadius: 7, padding: "4px 6px", fontSize: 12, background: "#fff", cursor: "pointer" },
  badges: { display: "flex", flexDirection: "column" as const, gap: 4, alignItems: "flex-start" },
  pill: { fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999 },
  pOk: { background: "#ECFDF5", color: "#047857" },
  pNo: { background: "#FEF2F2", color: "#B91C1C" },
  pNeutral: { background: "#F3F4F6", color: "#6b7280" },
  pBan: { background: "#FEE2E2", color: "#991B1B" },
  actions: { display: "flex", gap: 6, flexWrap: "wrap" as const, maxWidth: 360 },
  btn: { background: "#F3F0FF", color: "#443AA3", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 500 },
  btnAlt: { background: "#0F0A1E", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 500 },
  btnWarn: { background: "#FEF3C7", color: "#92400E", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 500 },
  btnDanger: { background: "none", border: "0.5px solid rgba(220,38,38,.3)", color: "#DC2626", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" },
  empty: { padding: "2rem", textAlign: "center" as const, color: "#9ca3af" },
  pagination: { display: "flex", alignItems: "center", gap: 12, padding: "1rem 0" },
  pageBtn: { background: "#fff", border: "0.5px solid rgba(0,0,0,.13)", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", color: "#3D3D4E" },
  card: { background: "#fff", border: "0.5px solid rgba(0,0,0,.08)", borderRadius: 14, padding: "1.5rem", maxWidth: 720 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: "#0A0A0F", marginBottom: 6 },
  cardSub: { fontSize: 13, color: "#7B7B8F", marginBottom: 16 },
  notice: { background: "#EFF4FF", border: "0.5px solid #C7D2FE", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#3730A3", marginBottom: 14 },
  label: { display: "block", fontSize: 12, fontWeight: 500, color: "#7B7B8F", margin: "10px 0 5px" },
  input2: { width: "100%", border: "0.5px solid rgba(0,0,0,.13)", borderRadius: 8, padding: "8px 11px", fontSize: 13, color: "#0A0A0F", outline: "none", fontFamily: "inherit" },
  saveBtn: { background: "#534AB7", color: "#fff", border: "none", padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", marginTop: 16 },
  settingRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "0.5px solid rgba(0,0,0,.06)" },
  settingLabel: { fontSize: 14, fontWeight: 500, color: "#0A0A0F" },
  settingDesc: { fontSize: 12, color: "#9ca3af", marginTop: 2, maxWidth: 420 },
  toggle: { width: 44, height: 26, borderRadius: 999, border: "none", background: "#D1D5DB", position: "relative" as const, cursor: "pointer", flexShrink: 0, transition: "background .15s" },
  toggleOn: { background: "#534AB7" },
  knob: { position: "absolute" as const, top: 3, left: 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "transform .15s" },
  knobOn: { transform: "translateX(18px)" },
  smallInput: { width: 120, border: "0.5px solid rgba(0,0,0,.13)", borderRadius: 8, padding: "7px 11px", fontSize: 13, outline: "none", textAlign: "right" as const },
  logList: { display: "flex", flexDirection: "column" as const, gap: 10 },
  logRow: { display: "flex", flexDirection: "column" as const, gap: 3, paddingBottom: 10, borderBottom: "0.5px solid rgba(0,0,0,.05)" },
  logAction: { fontSize: 13, fontWeight: 600, color: "#0A0A0F" },
  logMeta: { fontSize: 11, color: "#9ca3af", fontFamily: "ui-monospace,Menlo,monospace", wordBreak: "break-all" as const },
}
