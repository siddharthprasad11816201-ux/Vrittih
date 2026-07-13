"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import CompanyLogo from "@/components/vrittih/CompanyLogo"
import { IconMapPin, IconUsers, IconBriefcase, IconGlobe, IconCheck, IconBanknote } from "@/components/ui/Icons"

const TYPE_LABELS: Record<string, string> = { FULLTIME: "Full-time", PARTTIME: "Part-time", INTERNSHIP: "Internship", CONTRACT: "Contract", FREELANCE: "Freelance" }

export default function CompanyPage() {
  const slug = String(useParams().slug || "")
  const [d, setD] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  async function load() {
    const r = await fetch(`/api/companies/${slug}`)
    if (r.status === 404) { setNotFound(true); setLoading(false); return }
    const j = await r.json(); setD(j); setForm(j.company); setLoading(false)
  }
  useEffect(() => { if (slug) load() }, [slug]) // eslint-disable-line

  async function toggleFollow() {
    const r = await fetch(`/api/companies/${slug}/follow`, { method: "POST" })
    if (r.status === 401) { window.location.href = "/login"; return }
    const j = await r.json()
    setD((p: any) => ({ ...p, following: j.following, stats: { ...p.stats, followers: j.followers } }))
  }

  async function save() {
    setSaving(true)
    const r = await fetch(`/api/companies/${slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    setSaving(false)
    if (r.ok) { setEditing(false); load() }
  }

  if (loading) return <AppShell title="Company"><div style={S.wrap}><div style={{ ...S.hero, height: 180 }} className="v-skeleton" /></div></AppShell>
  if (notFound) return <AppShell title="Company"><div style={S.wrap}><div style={S.empty}>This company page doesn’t exist.<br /><Link href="/companies" style={S.backLink}>← Back to companies</Link></div></div></AppShell>

  const c = d.company, st = d.stats
  return (
    <AppShell title={c.name}>
      <div style={S.wrap}>
        <div style={S.hero}>
          <div style={S.heroBanner} />
          <div style={S.heroBody}>
            <div style={{ marginTop: -44 }}><CompanyLogo name={c.name} logoUrl={c.logoUrl} size={88} radius={20} /></div>
            <div style={S.heroMain}>
              <div style={S.titleRow}>
                <h1 style={S.h1}>{c.name}{c.verified && <span style={S.verified} title="Verified"><IconCheck size={13} /></span>}</h1>
                <div style={S.actions}>
                  {d.canEdit && <button onClick={() => setEditing((e) => !e)} style={S.editBtn}>{editing ? "Cancel" : "Edit page"}</button>}
                  <button onClick={toggleFollow} style={{ ...S.followBtn, ...(d.following ? S.followingBtn : {}) }}>{d.following ? "Following" : "Follow"}</button>
                </div>
              </div>
              {c.tagline && <p style={S.tagline}>{c.tagline}</p>}
              <div style={S.metaRow}>
                {c.industry && <span style={S.metaItem}><IconBriefcase size={14} />{c.industry}</span>}
                {c.headquarters && <span style={S.metaItem}><IconMapPin size={14} />{c.headquarters}</span>}
                {c.size && <span style={S.metaItem}><IconUsers size={14} />{c.size} employees</span>}
                {c.founded && <span style={S.metaItem}>Founded {c.founded}</span>}
                {c.website && <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" style={S.website}><IconGlobe size={14} />Website</a>}
              </div>
            </div>
          </div>
        </div>

        <div style={S.statsRow}>
          <div style={S.stat}><span style={S.statNum}>{st.openRoles.toLocaleString()}</span><span style={S.statLabel}>Open roles</span></div>
          <div style={S.stat}><span style={S.statNum}>{st.followers.toLocaleString()}</span><span style={S.statLabel}>Followers</span></div>
          <div style={S.stat}><span style={S.statNum}>{st.locations.length}</span><span style={S.statLabel}>Locations</span></div>
        </div>

        {editing && (
          <div style={S.editCard}>
            <h3 style={S.editHead}>Edit company page</h3>
            <div style={S.editGrid}>
              <Field label="Tagline"><input value={form.tagline || ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} style={S.input} maxLength={140} /></Field>
              <Field label="Industry"><input value={form.industry || ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} style={S.input} /></Field>
              <Field label="Headquarters"><input value={form.headquarters || ""} onChange={(e) => setForm({ ...form, headquarters: e.target.value })} style={S.input} /></Field>
              <Field label="Company size"><input value={form.size || ""} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="e.g. 51-200" style={S.input} /></Field>
              <Field label="Founded"><input value={form.founded || ""} onChange={(e) => setForm({ ...form, founded: e.target.value })} type="number" style={S.input} /></Field>
              <Field label="Website"><input value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" style={S.input} /></Field>
            </div>
            <Field label="About"><textarea value={form.about || ""} onChange={(e) => setForm({ ...form, about: e.target.value })} style={{ ...S.input, minHeight: 120, resize: "vertical" }} maxLength={4000} /></Field>
            <button onClick={save} disabled={saving} style={S.saveBtn}>{saving ? "Saving…" : "Save changes"}</button>
          </div>
        )}

        <div style={S.cols}>
          <div style={S.colMain}>
            <section style={S.card}>
              <h2 style={S.cardHead}>About</h2>
              <p style={S.about}>{c.about || "This company hasn’t added a description yet."}</p>
            </section>

            <section style={S.card}>
              <h2 style={S.cardHead}>Open roles <span style={S.count}>{st.openRoles.toLocaleString()}</span></h2>
              {d.roles.length === 0 ? <p style={S.about}>No open roles right now. Follow to hear when they post.</p> : (
                <div style={S.roleList}>
                  {d.roles.map((r: any) => (
                    <Link key={r.id} href={`/jobs/${r.id}`} style={S.role} className="v-role-hover">
                      <div style={{ minWidth: 0 }}>
                        <div style={S.roleTitle}>{r.title}</div>
                        <div style={S.roleMeta}>
                          <span style={S.roleMetaItem}><IconMapPin size={12} />{r.location}</span>
                          <span style={S.roleTag}>{TYPE_LABELS[r.type] || r.type}</span>
                          {r.remote && <span style={S.roleTag}>Remote</span>}
                          {r.salary && <span style={S.roleMetaItem}><IconBanknote size={12} />{r.salary}</span>}
                        </div>
                      </div>
                      <span style={S.roleArrow}>→</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside style={S.colSide}>
            <section style={S.card}>
              <h2 style={S.cardHead}>Locations</h2>
              <div style={S.chips}>
                {st.locations.length ? st.locations.map((l: string) => <span key={l} style={S.chip}><IconMapPin size={12} />{l}</span>) : <span style={S.about}>—</span>}
              </div>
            </section>
          </aside>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .v-role-hover{transition:background .14s,border-color .14s;}
        .v-role-hover:hover{background:var(--v-accent-soft);border-color:var(--v-accent) !important;}
      ` }} />
    </AppShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={S.field}><span style={S.fieldLabel}>{label}</span>{children}</label>
}

const S: Record<string, any> = {
  wrap: { maxWidth: 1000, margin: "0 auto", padding: "6px 4px 40px" },
  hero: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, overflow: "hidden" },
  heroBanner: { height: 96, background: "linear-gradient(120deg,var(--v-accent),#6E64D6)" },
  heroBody: { padding: "0 24px 22px" },
  heroMain: { marginTop: 10 },
  titleRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  h1: { display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--v-ink)", margin: 0, letterSpacing: "-.02em" },
  verified: { display: "inline-grid", placeItems: "center", width: 20, height: 20, borderRadius: "50%", background: "var(--v-accent)", color: "#fff" },
  actions: { display: "flex", gap: 8 },
  editBtn: { padding: "8px 16px", borderRadius: 999, border: "1px solid var(--v-line-2)", background: "var(--v-surface)", color: "var(--v-ink)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  followBtn: { padding: "8px 20px", borderRadius: 999, border: "1px solid var(--v-accent)", background: "transparent", color: "var(--v-accent)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  followingBtn: { background: "var(--v-accent)", color: "#fff" },
  tagline: { fontSize: 15, color: "var(--v-ink-2)", margin: "8px 0 0" },
  metaRow: { display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 },
  metaItem: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "var(--v-ink-3)" },
  website: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "var(--v-accent)", textDecoration: "none", fontWeight: 500 },
  statsRow: { display: "flex", gap: 12, margin: "16px 0" },
  stat: { flex: 1, background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 12, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 2 },
  statNum: { fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--v-ink)" },
  statLabel: { fontSize: 12.5, color: "var(--v-ink-3)" },
  editCard: { background: "var(--v-surface)", border: "1px solid var(--v-accent)", borderRadius: 14, padding: 20, marginBottom: 16 },
  editHead: { fontSize: 15, fontWeight: 600, color: "var(--v-ink)", margin: "0 0 14px" },
  editGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".04em" },
  input: { border: "1px solid var(--v-line-2)", borderRadius: 9, padding: "9px 12px", fontSize: 14, color: "var(--v-ink)", background: "var(--v-bg)", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  saveBtn: { marginTop: 14, padding: "10px 22px", borderRadius: 999, border: "none", background: "var(--v-accent)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  cols: { display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "start" },
  colMain: { display: "flex", flexDirection: "column", gap: 16, minWidth: 0 },
  colSide: { display: "flex", flexDirection: "column", gap: 16 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 20 },
  cardHead: { display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, color: "var(--v-ink)", margin: "0 0 12px", fontFamily: "var(--font-display)" },
  count: { fontSize: 13, fontWeight: 600, color: "var(--v-accent)", background: "var(--v-accent-soft)", padding: "2px 9px", borderRadius: 999 },
  about: { fontSize: 14.5, lineHeight: 1.7, color: "var(--v-ink-2)", margin: 0 },
  roleList: { display: "flex", flexDirection: "column", gap: 8 },
  role: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 15px", border: "1px solid var(--v-line)", borderRadius: 11, textDecoration: "none" },
  roleTitle: { fontSize: 14.5, fontWeight: 600, color: "var(--v-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  roleMeta: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 5 },
  roleMetaItem: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "var(--v-ink-3)" },
  roleTag: { fontSize: 11.5, fontWeight: 600, color: "var(--v-accent)", background: "var(--v-accent-soft)", padding: "2px 8px", borderRadius: 6 },
  roleArrow: { color: "var(--v-ink-3)", fontSize: 16, flexShrink: 0 },
  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--v-ink-2)", background: "var(--v-surface-2)", padding: "5px 11px", borderRadius: 999 },
  empty: { padding: "70px 20px", textAlign: "center", color: "var(--v-ink-3)", fontSize: 15, lineHeight: 2 },
  backLink: { color: "var(--v-accent)", textDecoration: "none", fontWeight: 500 },
}
