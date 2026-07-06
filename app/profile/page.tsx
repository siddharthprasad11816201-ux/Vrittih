"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import {
  IconMapPin, IconShield, IconGlobe, IconPlus, IconTrash, IconEdit, IconBriefcase,
  IconClipboard, IconMail, IconPhone, IconCheckCircle, IconArrowRight,
} from "@/components/ui/Icons"

const ACCENT = "#534AB7"

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  const [aboutEdit, setAboutEdit] = useState(false)
  const [about, setAbout] = useState("")
  const [showExp, setShowExp] = useState(false)
  const [exp, setExp] = useState<any>({ company: "", title: "", location: "", startDate: "", endDate: "", description: "" })
  const [showEdu, setShowEdu] = useState(false)
  const [edu, setEdu] = useState<any>({ school: "", degree: "", field: "", startYear: "", endYear: "" })
  const [skill, setSkill] = useState("")

  async function load() {
    const d = await fetch("/api/profile").then(r => r.json())
    setUser(d.user); setAbout(d.user?.bio || ""); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function patch(fields: any) {
    await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) })
    await load()
  }
  async function addExp() {
    if (!exp.company.trim() || !exp.title.trim() || !exp.startDate) return
    await fetch("/api/profile/experience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(exp) })
    setExp({ company: "", title: "", location: "", startDate: "", endDate: "", description: "" }); setShowExp(false); load()
  }
  async function delExp(id: string) { await fetch("/api/profile/experience", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); load() }
  async function addEdu() {
    if (!edu.school.trim() || !edu.degree.trim() || !edu.startYear) return
    await fetch("/api/profile/education", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edu) })
    setEdu({ school: "", degree: "", field: "", startYear: "", endYear: "" }); setShowEdu(false); load()
  }
  async function delEdu(id: string) { await fetch("/api/profile/education", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); load() }
  async function addSkill() {
    const n = skill.trim(); if (!n) return
    await fetch("/api/profile/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }) })
    setSkill(""); load()
  }
  async function delSkill(skillId: string) { await fetch("/api/profile/skills", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skillId }) }); load() }

  if (loading) return <AppShell title="Profile"><div style={S.loading}>Loading…</div></AppShell>
  if (!user) return <AppShell title="Profile"><div style={S.loading}>Not signed in. <Link href="/login">Sign in</Link></div></AppShell>

  const initials = (user.name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
  const p = user.profile || {}
  const links = [
    p.website && { icon: <IconGlobe size={15} />, href: p.website, label: "Website" },
    p.linkedin && { icon: <IconArrowRight size={15} />, href: p.linkedin, label: "LinkedIn" },
    p.github && { icon: <IconArrowRight size={15} />, href: p.github, label: "GitHub" },
    p.twitter && { icon: <IconArrowRight size={15} />, href: p.twitter, label: "X" },
  ].filter(Boolean) as any[]

  const strength = [user.headline, user.bio, user.location, user.experience?.length, user.education?.length, user.skills?.length, user.idVerified].filter(Boolean).length
  const pct = Math.round((strength / 7) * 100)
  const memberSince = user.createdAt ? new Date(user.createdAt).getFullYear() : ""
  const range = (a: string, b?: string) => {
    const f = (x: string) => new Date(x).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    const months = Math.max(1, Math.round(((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
    const dur = months >= 12 ? `${Math.floor(months / 12)} yr${months % 12 ? ` ${months % 12} mo` : ""}` : `${months} mo`
    return `${f(a)} – ${b ? f(b) : "Present"} · ${dur}`
  }

  return (
    <AppShell title="Profile">
      <div style={S.page}>
        {/* Header */}
        <section style={S.card}>
          <div style={S.cover} />
          <div style={S.headBody}>
            {user.avatar ? <img src={user.avatar} alt={user.name} style={S.avatarImg} /> : <div style={S.avatar}>{initials}</div>}
            <div style={S.headRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h1 style={S.name}>{user.name}</h1>
                  {user.idVerified && <span style={S.verified}><IconCheckCircle size={13} /> Verified</span>}
                </div>
                {user.headline && <p style={S.headline}>{user.headline}</p>}
                <div style={S.metaRow}>
                  {user.location && <span style={S.meta}><IconMapPin size={13} /> {user.location}</span>}
                  {memberSince && <span style={S.meta}>Member since {memberSince}</span>}
                  <span style={S.meta}>{user.role === "EMPLOYER" ? "Employer" : "Job seeker"}</span>
                </div>
                {links.length > 0 && (
                  <div style={S.linksRow}>
                    {links.map((l, i) => <a key={i} href={l.href} target="_blank" rel="noreferrer" style={S.link}>{l.icon} {l.label}</a>)}
                  </div>
                )}
              </div>
              <button onClick={() => { setForm({ name: user.name, headline: user.headline || "", location: user.location || "", phone: user.phone || "", avatar: user.avatar || "", website: p.website || "", linkedin: p.linkedin || "", github: p.github || "", twitter: p.twitter || "" }); setEditing(true) }} style={S.editBtn}><IconEdit size={15} /> Edit</button>
            </div>
          </div>
        </section>

        {/* Strength */}
        {pct < 100 && (
          <section style={S.card}>
            <div style={S.between}><h2 style={S.h2}>Profile strength</h2><span style={{ color: ACCENT, fontWeight: 700, fontSize: 14 }}>{pct}%</span></div>
            <div style={S.bar}><div style={{ ...S.barFill, width: `${pct}%` }} /></div>
            <p style={S.hint}>A complete profile is seen by far more employers — add the missing pieces below.</p>
          </section>
        )}

        {/* About */}
        <section style={S.card}>
          <div style={S.between}><h2 style={S.h2}>About</h2>
            {!aboutEdit && <button onClick={() => { setAbout(user.bio || ""); setAboutEdit(true) }} style={S.linkBtn}><IconEdit size={13} /> Edit</button>}
          </div>
          {aboutEdit ? (
            <div style={{ padding: "10px 1.5rem 1.5rem" }}>
              <textarea value={about} onChange={e => setAbout(e.target.value)} rows={5} style={S.textarea} placeholder="Write a professional summary — your strengths, what you do, what you're looking for." />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={async () => { await patch({ bio: about }); setAboutEdit(false) }} style={S.primary}>Save</button>
                <button onClick={() => setAboutEdit(false)} style={S.ghost}>Cancel</button>
              </div>
            </div>
          ) : user.bio ? <p style={S.body}>{user.bio}</p> : <p style={S.empty}>Add a summary so employers understand your strengths at a glance.</p>}
        </section>

        {/* Experience */}
        <section style={S.card}>
          <div style={S.between}><h2 style={S.h2}>Experience</h2><button onClick={() => setShowExp(v => !v)} style={S.linkBtn}><IconPlus size={14} /> Add</button></div>
          {showExp && (
            <div style={S.form}>
              <div style={S.row2}><input placeholder="Title *" value={exp.title} onChange={e => setExp({ ...exp, title: e.target.value })} style={S.input} /><input placeholder="Company *" value={exp.company} onChange={e => setExp({ ...exp, company: e.target.value })} style={S.input} /></div>
              <input placeholder="Location" value={exp.location} onChange={e => setExp({ ...exp, location: e.target.value })} style={S.input} />
              <div style={S.row2}><label style={S.lbl}>Start<input type="date" value={exp.startDate} onChange={e => setExp({ ...exp, startDate: e.target.value })} style={S.input} /></label><label style={S.lbl}>End (blank = present)<input type="date" value={exp.endDate} onChange={e => setExp({ ...exp, endDate: e.target.value })} style={S.input} /></label></div>
              <textarea placeholder="Description" value={exp.description} onChange={e => setExp({ ...exp, description: e.target.value })} rows={3} style={S.textarea} />
              <div style={{ display: "flex", gap: 8 }}><button onClick={addExp} style={S.primary}>Add experience</button><button onClick={() => setShowExp(false)} style={S.ghost}>Cancel</button></div>
            </div>
          )}
          {user.experience?.length ? user.experience.map((e: any) => (
            <div key={e.id} style={S.item}>
              <div style={S.logo}><IconBriefcase size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={S.itemTitle}>{e.title}</div>
                <div style={S.itemSub}>{e.company}{e.location ? ` · ${e.location}` : ""}</div>
                <div style={S.itemDate}>{range(e.startDate, e.endDate)}</div>
                {e.description && <p style={S.itemBody}>{e.description}</p>}
              </div>
              <button onClick={() => delExp(e.id)} style={S.del} title="Remove"><IconTrash size={14} /></button>
            </div>
          )) : !showExp && <p style={S.empty}>No experience yet — add your roles to show your track record.</p>}
        </section>

        {/* Education */}
        <section style={S.card}>
          <div style={S.between}><h2 style={S.h2}>Education</h2><button onClick={() => setShowEdu(v => !v)} style={S.linkBtn}><IconPlus size={14} /> Add</button></div>
          {showEdu && (
            <div style={S.form}>
              <input placeholder="School *" value={edu.school} onChange={e => setEdu({ ...edu, school: e.target.value })} style={S.input} />
              <div style={S.row2}><input placeholder="Degree *" value={edu.degree} onChange={e => setEdu({ ...edu, degree: e.target.value })} style={S.input} /><input placeholder="Field of study" value={edu.field} onChange={e => setEdu({ ...edu, field: e.target.value })} style={S.input} /></div>
              <div style={S.row2}><input placeholder="Start year *" value={edu.startYear} onChange={e => setEdu({ ...edu, startYear: e.target.value.replace(/\D/g, "").slice(0, 4) })} style={S.input} /><input placeholder="End year" value={edu.endYear} onChange={e => setEdu({ ...edu, endYear: e.target.value.replace(/\D/g, "").slice(0, 4) })} style={S.input} /></div>
              <div style={{ display: "flex", gap: 8 }}><button onClick={addEdu} style={S.primary}>Add education</button><button onClick={() => setShowEdu(false)} style={S.ghost}>Cancel</button></div>
            </div>
          )}
          {user.education?.length ? user.education.map((e: any) => (
            <div key={e.id} style={S.item}>
              <div style={S.logo}><IconClipboard size={18} /></div>
              <div style={{ flex: 1 }}>
                <div style={S.itemTitle}>{e.school}</div>
                <div style={S.itemSub}>{[e.degree, e.field].filter(Boolean).join(", ")}</div>
                <div style={S.itemDate}>{e.startYear} – {e.endYear || "Present"}</div>
              </div>
              <button onClick={() => delEdu(e.id)} style={S.del} title="Remove"><IconTrash size={14} /></button>
            </div>
          )) : !showEdu && <p style={S.empty}>Add your degrees and certifications.</p>}
        </section>

        {/* Skills */}
        <section style={S.card}>
          <div style={S.between}><h2 style={S.h2}>Skills</h2></div>
          <div style={{ padding: "12px 1.5rem 1.5rem" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={skill} onChange={e => setSkill(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addSkill() }} placeholder="Add a skill and press Enter" style={{ ...S.input, flex: 1 }} />
              <button onClick={addSkill} style={S.primary}>Add</button>
            </div>
            {user.skills?.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {user.skills.map((s: any) => (
                  <span key={s.skill.id} style={S.chip}>{s.skill.name}<button onClick={() => delSkill(s.skill.id)} style={S.chipX} title="Remove">×</button></span>
                ))}
              </div>
            ) : <p style={{ fontSize: 13.5, color: "var(--v-ink-3)" }}>Add skills — these directly drive your job match scores.</p>}
          </div>
        </section>

        {/* Contact */}
        <section style={S.card}>
          <div style={S.between}><h2 style={S.h2}>Contact</h2></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0 1.5rem" }}>
            <div style={S.contactRow}><IconMail size={15} /> {user.email}</div>
            {user.phone && <div style={S.contactRow}><IconPhone size={15} /> {user.phone}</div>}
            {links.map((l, i) => <a key={i} href={l.href} target="_blank" rel="noreferrer" style={{ ...S.contactRow, color: ACCENT, textDecoration: "none" }}>{l.icon} {l.href}</a>)}
          </div>
        </section>
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={S.overlay} onClick={() => setEditing(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <h2 style={{ ...S.h2, marginBottom: 16 }}>Edit profile</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[["name", "Full name"], ["headline", "Headline (e.g. Senior Engineer)"], ["location", "Location"], ["phone", "Phone"], ["avatar", "Avatar image URL"], ["website", "Website"], ["linkedin", "LinkedIn URL"], ["github", "GitHub URL"], ["twitter", "X / Twitter URL"]].map(([k, label]) => (
                <div key={k}><label style={S.mLbl}>{label}</label><input value={form[k] || ""} onChange={e => setForm({ ...form, [k]: e.target.value })} style={S.input} /></div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button onClick={async () => { await patch(form); setEditing(false) }} style={S.primary}>Save changes</button>
              <button onClick={() => setEditing(false)} style={S.ghost}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

const S: Record<string, any> = {
  loading: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "var(--v-ink-3)", fontSize: 14 },
  page: { maxWidth: 780, margin: "0 auto", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, overflow: "hidden" },
  cover: { height: 96, background: "linear-gradient(120deg,#534AB7,#6E64D6 55%,#8A7FE8)" },
  headBody: { padding: "0 1.75rem 1.5rem" },
  avatar: { width: 108, height: 108, borderRadius: "50%", background: "#EEEDF9", color: ACCENT, border: "4px solid #fff", marginTop: -54, display: "grid", placeItems: "center", fontSize: 36, fontWeight: 700, fontFamily: "var(--v-serif)" },
  avatarImg: { width: 108, height: 108, borderRadius: "50%", objectFit: "cover", border: "4px solid #fff", marginTop: -54 },
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginTop: 12 },
  name: { fontFamily: "var(--v-serif)", fontSize: 28, fontWeight: 600, color: "var(--v-ink)", letterSpacing: "-.02em" },
  verified: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "#047857", background: "#ECFDF5", padding: "3px 9px", borderRadius: 999 },
  headline: { fontSize: 15.5, color: "var(--v-ink-2)", marginTop: 4 },
  metaRow: { display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 },
  meta: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--v-ink-3)" },
  linksRow: { display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 },
  link: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: ACCENT, textDecoration: "none", fontWeight: 500 },
  editBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-surface)", border: "1px solid var(--v-line-2)", color: "var(--v-ink)", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0 },
  between: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem 0" },
  h2: { fontSize: 16.5, fontWeight: 700, color: "var(--v-ink)", letterSpacing: "-.01em" },
  bar: { height: 8, background: "#F1F0F5", borderRadius: 5, margin: "12px 1.5rem 0", overflow: "hidden" },
  barFill: { height: 8, background: "linear-gradient(90deg,#534AB7,#8A7FE8)", borderRadius: 5, transition: "width .5s ease" },
  hint: { fontSize: 12.5, color: "var(--v-ink-3)", padding: "8px 1.5rem 1.25rem" },
  body: { fontSize: 14.5, color: "var(--v-ink-2)", lineHeight: 1.7, padding: "10px 1.5rem 1.5rem", whiteSpace: "pre-wrap" },
  empty: { fontSize: 13.5, color: "var(--v-ink-3)", padding: "10px 1.5rem 1.5rem" },
  linkBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  item: { display: "flex", gap: 14, padding: "1rem 1.5rem", borderTop: "1px solid var(--v-line)", alignItems: "flex-start" },
  logo: { width: 44, height: 44, borderRadius: 10, background: "#EEEDF9", color: ACCENT, display: "grid", placeItems: "center", flexShrink: 0 },
  itemTitle: { fontSize: 15, fontWeight: 650, color: "var(--v-ink)" },
  itemSub: { fontSize: 13.5, color: "var(--v-ink-2)", marginTop: 1 },
  itemDate: { fontSize: 12.5, color: "var(--v-ink-3)", marginTop: 2 },
  itemBody: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, marginTop: 8, whiteSpace: "pre-wrap" },
  del: { background: "none", border: "none", color: "#B91C1C", cursor: "pointer", padding: 6, flexShrink: 0 },
  form: { display: "flex", flexDirection: "column", gap: 10, padding: "1rem 1.5rem", borderTop: "1px solid var(--v-line)", background: "#FAFAFC" },
  row2: { display: "flex", gap: 10 },
  lbl: { flex: 1, fontSize: 12, color: "var(--v-ink-3)", display: "flex", flexDirection: "column", gap: 4 },
  input: { width: "100%", border: "1px solid var(--v-line-2)", borderRadius: 9, padding: "10px 12px", fontSize: 14, color: "var(--v-ink)", outline: "none", background: "#fff", fontFamily: "inherit" },
  textarea: { width: "100%", border: "1px solid var(--v-line-2)", borderRadius: 9, padding: "10px 12px", fontSize: 14, color: "var(--v-ink)", outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box" },
  primary: { background: ACCENT, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  ghost: { background: "none", border: "1px solid var(--v-line-2)", color: "var(--v-ink-2)", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 500, cursor: "pointer" },
  chip: { display: "inline-flex", alignItems: "center", gap: 6, background: "#EEEDF9", color: "#3F369E", padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 500 },
  chipX: { background: "none", border: "none", color: "#8079C4", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: 0 },
  contactRow: { display: "flex", alignItems: "center", gap: 9, fontSize: 14, color: "var(--v-ink-2)", padding: "0 1.5rem" },
  overlay: { position: "fixed", inset: 0, background: "rgba(20,15,40,.4)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "6vh", overflowY: "auto" },
  modal: { width: "100%", maxWidth: 480, background: "var(--v-surface)", borderRadius: 16, padding: "1.75rem", margin: "0 1rem 3rem", boxShadow: "0 24px 70px rgba(20,15,40,.3)" },
  mLbl: { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--v-ink-2)", marginBottom: 5 },
}
