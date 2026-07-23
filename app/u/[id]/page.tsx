"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import AstroCard from "@/components/vrittih/AstroCard"
import {
  IconMapPin, IconCheckCircle, IconGlobe, IconBriefcase, IconClipboard,
  IconMessage, IconArrowRight,
} from "@/components/ui/Icons"

const ACCENT = "#0F6E56"

export default function PublicProfilePage({ params }: { params: { id: string } }) {
  const { id } = params
  const [user, setUser] = useState<any>(null)
  const [isSelf, setIsSelf] = useState(false)
  const [state, setState] = useState<"loading" | "ok" | "gone">("loading")

  useEffect(() => {
    fetch(`/api/users/${id}`).then(r => r.json()).then(d => {
      if (d.error) { setState("gone"); return }
      setUser(d.user); setIsSelf(d.isSelf); setState("ok")
    }).catch(() => setState("gone"))
  }, [id])

  if (state === "loading") return <AppShell title="Profile"><div style={S.loading}>Loading…</div></AppShell>
  if (state === "gone") return <AppShell title="Profile"><div style={S.loading}>This profile isn’t available.</div></AppShell>

  const initials = (user.name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
  const p = user.profile || {}
  const memberSince = user.createdAt ? new Date(user.createdAt).getFullYear() : ""
  const range = (a: string, b?: string) => {
    const f = (x: string) => new Date(x).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    return `${f(a)} – ${b ? f(b) : "Present"}`
  }

  return (
    <AppShell title="Profile">
      <div style={S.page}>
        <section style={S.card}>
          <div style={S.cover} />
          <div style={S.headBody}>
            {user.avatar ? <img src={user.avatar} alt={user.name} style={S.avatarImg} /> : <div style={S.avatar}>{initials}</div>}
            <div style={S.headRow} data-wrap>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h1 style={S.name}>{user.name}</h1>
                  {user.idVerified && <span style={S.verified}><IconCheckCircle size={13} /> Verified</span>}
                  {user.openToWork && <span style={S.otw}>Open to work</span>}
                </div>
                {user.headline && <p style={S.headline}>{user.headline}</p>}
                <div style={S.metaRow}>
                  {user.location && <span style={S.meta}><IconMapPin size={13} /> {user.location}</span>}
                  {memberSince && <span style={S.meta}>Member since {memberSince}</span>}
                  <span style={S.meta}>{user.role === "EMPLOYER" ? "Employer" : "Job seeker"}</span>
                </div>
                {(p.website || p.linkedin || p.github || p.twitter) && (
                  <div style={S.linksRow}>
                    {p.website && <a href={p.website} target="_blank" rel="noreferrer" style={S.link}><IconGlobe size={15} /> Website</a>}
                    {p.linkedin && <a href={p.linkedin} target="_blank" rel="noreferrer" style={S.link}><IconArrowRight size={15} /> LinkedIn</a>}
                    {p.github && <a href={p.github} target="_blank" rel="noreferrer" style={S.link}><IconArrowRight size={15} /> GitHub</a>}
                  </div>
                )}
              </div>
              {isSelf
                ? <Link href="/profile" style={S.primary}>Edit your profile</Link>
                : <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <Link href="/messages" style={S.primary}><IconMessage size={15} /> Message</Link>
                    <Link href="/network" style={S.ghost}>Connect</Link>
                  </div>}
            </div>
          </div>
        </section>

        {user.bio && <section style={S.card}><h2 style={{ ...S.h2, padding: "1.25rem 1.5rem 0" }}>About</h2><p style={S.body}>{user.bio}</p></section>}

        {p.birthDate && <AstroCard birthDate={p.birthDate} experience={user.experience || []} />}

        {user.experience?.length > 0 && (
          <section style={S.card}>
            <h2 style={{ ...S.h2, padding: "1.25rem 1.5rem 0" }}>Experience</h2>
            {user.experience.map((e: any) => (
              <div key={e.id} style={S.item}>
                <div style={S.logo}><IconBriefcase size={18} /></div>
                <div>
                  <div style={S.itemTitle}>{e.title}</div>
                  <div style={S.itemSub}>{e.company}{e.location ? ` · ${e.location}` : ""}</div>
                  <div style={S.itemDate}>{range(e.startDate, e.endDate)}</div>
                  {e.description && <p style={S.itemBody}>{e.description}</p>}
                </div>
              </div>
            ))}
          </section>
        )}

        {user.education?.length > 0 && (
          <section style={S.card}>
            <h2 style={{ ...S.h2, padding: "1.25rem 1.5rem 0" }}>Education</h2>
            {user.education.map((e: any) => (
              <div key={e.id} style={S.item}>
                <div style={S.logo}><IconClipboard size={18} /></div>
                <div>
                  <div style={S.itemTitle}>{e.school}</div>
                  <div style={S.itemSub}>{[e.degree, e.field].filter(Boolean).join(", ")}</div>
                  <div style={S.itemDate}>{e.startYear} – {e.endYear || "Present"}</div>
                </div>
              </div>
            ))}
          </section>
        )}

        {user.skills?.length > 0 && (
          <section style={{ ...S.card, padding: "1.25rem 1.5rem" }}>
            <h2 style={{ ...S.h2, marginBottom: 12 }}>Skills</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {user.skills.map((s: any) => <span key={s.skill.id} style={S.chip}>{s.skill.name}</span>)}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  )
}

const S: Record<string, any> = {
  loading: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "var(--v-ink-3)", fontSize: 14 },
  page: { maxWidth: 780, margin: "0 auto", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.25rem" },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, overflow: "hidden" },
  cover: { height: 96, background: "linear-gradient(120deg,#0F6E56,#6E64D6 55%,#8A7FE8)" },
  headBody: { padding: "0 1.75rem 1.5rem" },
  avatar: { width: 108, height: 108, borderRadius: "50%", background: "#E1F5EE", color: ACCENT, border: "4px solid #fff", marginTop: -54, display: "grid", placeItems: "center", fontSize: 36, fontWeight: 700, fontFamily: "var(--v-serif)" },
  avatarImg: { width: 108, height: 108, borderRadius: "50%", objectFit: "cover", border: "4px solid #fff", marginTop: -54 },
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginTop: 12 },
  name: { fontFamily: "var(--v-serif)", fontSize: 28, fontWeight: 600, color: "var(--v-ink)", letterSpacing: "-.02em" },
  verified: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "#047857", background: "#ECFDF5", padding: "3px 9px", borderRadius: 999 },
  otw: { display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 600, color: "#fff", background: "var(--brand-600)", padding: "3px 10px", borderRadius: 999 },
  headline: { fontSize: 15.5, color: "var(--v-ink-2)", marginTop: 4 },
  metaRow: { display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 },
  meta: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--v-ink-3)" },
  linksRow: { display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 },
  link: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: ACCENT, textDecoration: "none", fontWeight: 500 },
  primary: { display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT, color: "#fff", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, textDecoration: "none", flexShrink: 0 },
  ghost: { display: "inline-flex", alignItems: "center", background: "var(--v-surface)", border: "1px solid var(--v-line-2)", color: "var(--v-ink)", borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, textDecoration: "none" },
  h2: { fontSize: 16.5, fontWeight: 700, color: "var(--v-ink)", letterSpacing: "-.01em" },
  body: { fontSize: 14.5, color: "var(--v-ink-2)", lineHeight: 1.7, padding: "10px 1.5rem 1.5rem", whiteSpace: "pre-wrap" },
  item: { display: "flex", gap: 14, padding: "1rem 1.5rem", borderTop: "1px solid var(--v-line)", alignItems: "flex-start" },
  logo: { width: 44, height: 44, borderRadius: 10, background: "#E1F5EE", color: ACCENT, display: "grid", placeItems: "center", flexShrink: 0 },
  itemTitle: { fontSize: 15, fontWeight: 650, color: "var(--v-ink)" },
  itemSub: { fontSize: 13.5, color: "var(--v-ink-2)", marginTop: 1 },
  itemDate: { fontSize: 12.5, color: "var(--v-ink-3)", marginTop: 2 },
  itemBody: { fontSize: 13.5, color: "var(--v-ink-2)", lineHeight: 1.6, marginTop: 8, whiteSpace: "pre-wrap" },
  chip: { background: "#E1F5EE", color: "#3F369E", padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 500 },
}
