"use client"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import CompanyLogo from "@/components/vrittih/CompanyLogo"
import { IconSearch, IconMapPin, IconUsers, IconBriefcase, IconCheck } from "@/components/ui/Icons"

type Company = {
  slug: string; name: string; tagline?: string; industry?: string; headquarters?: string
  size?: string; logoUrl?: string | null; verified: boolean; followers: number; openRoles: number
}

export default function CompaniesPage() {
  const [q, setQ] = useState("")
  const [sort, setSort] = useState("followers")
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ companies: Company[]; total: number; pages: number }>({ companies: [], total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/companies?q=${encodeURIComponent(q)}&sort=${sort}&page=${page}`)
    if (r.ok) setData(await r.json())
    setLoading(false)
  }, [q, sort, page])

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t) }, [load, q])
  useEffect(() => { setPage(1) }, [q, sort])

  async function toggleFollow(slug: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    const r = await fetch(`/api/companies/${slug}/follow`, { method: "POST" })
    if (r.ok) { const d = await r.json(); setFollowing((f) => ({ ...f, [slug]: d.following })) }
    else if (r.status === 401) window.location.href = "/login"
  }

  return (
    <AppShell title="Companies">
      <div style={S.wrap}>
        <div style={S.head}>
          <div>
            <h1 style={S.h1}>Explore companies</h1>
            <p style={S.sub}>{data.total.toLocaleString()} companies hiring on Vrittih</p>
          </div>
        </div>

        <div style={S.controls}>
          <div style={S.searchBox}>
            <IconSearch size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies, industries…" style={S.searchInput} />
          </div>
          <div style={S.sortRow}>
            {[["followers", "Popular"], ["name", "A–Z"], ["new", "Newest"]].map(([k, label]) => (
              <button key={k} onClick={() => setSort(k)} style={{ ...S.sortBtn, ...(sort === k ? S.sortOn : {}) }}>{label}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={S.grid}>{Array.from({ length: 9 }).map((_, i) => <div key={i} style={S.skeleton} className="v-skeleton" />)}</div>
        ) : data.companies.length === 0 ? (
          <div style={S.empty}>No companies match “{q}”.</div>
        ) : (
          <div style={S.grid}>
            {data.companies.map((c) => {
              const isF = following[c.slug] ?? false
              return (
                <Link key={c.slug} href={`/companies/${c.slug}`} style={S.card} className="v-card-hover">
                  <div style={S.cardTop}>
                    <CompanyLogo name={c.name} logoUrl={c.logoUrl} size={52} />
                    <button onClick={(e) => toggleFollow(c.slug, e)} style={{ ...S.followBtn, ...(isF ? S.followingBtn : {}) }}>
                      {isF ? "Following" : "Follow"}
                    </button>
                  </div>
                  <div style={S.name}>
                    {c.name}
                    {c.verified && <span style={S.verified} title="Verified"><IconCheck size={11} /></span>}
                  </div>
                  <div style={S.tagline}>{c.tagline || `${c.industry || "Company"}`}</div>
                  <div style={S.meta}>
                    {c.headquarters && <span style={S.metaItem}><IconMapPin size={13} />{c.headquarters}</span>}
                    {c.size && <span style={S.metaItem}><IconUsers size={13} />{c.size}</span>}
                  </div>
                  <div style={S.roles}><IconBriefcase size={13} />{c.openRoles.toLocaleString()} open {c.openRoles === 1 ? "role" : "roles"} · {c.followers.toLocaleString()} {c.followers === 1 ? "follower" : "followers"}</div>
                </Link>
              )
            })}
          </div>
        )}

        {data.pages > 1 && (
          <div style={S.pager}>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ ...S.pageBtn, ...(page <= 1 ? S.pageDisabled : {}) }}>← Prev</button>
            <span style={S.pageInfo}>Page {page} of {data.pages}</span>
            <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} style={{ ...S.pageBtn, ...(page >= data.pages ? S.pageDisabled : {}) }}>Next →</button>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .v-card-hover{transition:box-shadow .16s,transform .16s,border-color .16s;}
        .v-card-hover:hover{box-shadow:0 10px 30px rgba(20,15,40,.10);transform:translateY(-2px);border-color:var(--v-accent);}
      ` }} />
    </AppShell>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 1080, margin: "0 auto", padding: "6px 4px 40px" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 },
  h1: { fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--v-ink)", margin: 0, letterSpacing: "-.02em" },
  sub: { fontSize: 13.5, color: "var(--v-ink-3)", marginTop: 4 },
  controls: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  searchBox: { display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 240, background: "var(--v-surface)", border: "1px solid var(--v-line-2)", borderRadius: 11, padding: "10px 14px", color: "var(--v-ink-3)" },
  searchInput: { flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14.5, color: "var(--v-ink)" },
  sortRow: { display: "flex", gap: 4, background: "var(--v-surface-2)", padding: 4, borderRadius: 10 },
  sortBtn: { padding: "7px 13px", borderRadius: 7, border: "none", background: "none", fontSize: 13, fontWeight: 500, color: "var(--v-ink-2)", cursor: "pointer" },
  sortOn: { background: "var(--v-surface)", color: "var(--v-ink)", boxShadow: "0 1px 3px rgba(20,15,40,.08)" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
  card: { display: "block", background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: 18, textDecoration: "none", minWidth: 0 },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  followBtn: { padding: "6px 14px", borderRadius: 999, border: "1px solid var(--v-accent)", background: "transparent", color: "var(--v-accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  followingBtn: { background: "var(--v-accent)", color: "#fff" },
  name: { display: "flex", alignItems: "center", gap: 6, fontSize: 16.5, fontWeight: 600, color: "var(--v-ink)", letterSpacing: "-.01em" },
  verified: { display: "inline-grid", placeItems: "center", width: 16, height: 16, borderRadius: "50%", background: "var(--v-accent)", color: "#fff" },
  tagline: { fontSize: 13, color: "var(--v-ink-2)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  meta: { display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 },
  metaItem: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--v-ink-3)" },
  roles: { display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--v-accent)", fontWeight: 500, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--v-line)" },
  skeleton: { height: 176, borderRadius: 14 },
  empty: { padding: "60px 20px", textAlign: "center", color: "var(--v-ink-3)", fontSize: 15 },
  pager: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 28 },
  pageBtn: { padding: "9px 16px", borderRadius: 9, border: "1px solid var(--v-line-2)", background: "var(--v-surface)", color: "var(--v-ink)", fontSize: 13.5, fontWeight: 500, cursor: "pointer" },
  pageDisabled: { opacity: 0.4, cursor: "not-allowed" },
  pageInfo: { fontSize: 13, color: "var(--v-ink-3)" },
}
