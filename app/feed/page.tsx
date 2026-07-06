"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import AppShell from "@/components/vrittih/AppShell"
import { IconMessage, IconTrendingUp, IconUsers } from "@/components/ui/Icons"

const ACCENT = "#534AB7"
const initials = (n?: string) => (n || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()
const timeAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return "just now"; if (m < 60) return `${m}m`; const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`
}

function Avatar({ name, avatar, size = 44 }: { name?: string; avatar?: string; size?: number }) {
  return avatar
    ? <img src={avatar} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: "#EEEDF9", color: ACCENT, display: "grid", placeItems: "center", fontWeight: 700, fontSize: size * 0.34, flexShrink: 0 }}>{initials(name)}</div>
}

export default function FeedPage() {
  const [me, setMe] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [draft, setDraft] = useState("")
  const [posting, setPosting] = useState(false)
  const [views, setViews] = useState<any>(null)
  const [open, setOpen] = useState<Record<string, any[]>>({}) // postId -> comments
  const [cInput, setCInput] = useState<Record<string, string>>({})

  async function load() {
    const [f, v] = await Promise.all([
      fetch("/api/feed").then(r => r.json()),
      fetch("/api/profile/views").then(r => r.json()),
    ])
    setPosts(f.posts || []); setViews(v)
  }
  useEffect(() => { fetch("/api/auth/me").then(r => r.json()).then(d => setMe(d.user)); load() }, [])

  async function post() {
    if (!draft.trim()) return
    setPosting(true)
    await fetch("/api/feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: draft }) })
    setDraft(""); setPosting(false); load()
  }
  async function like(id: string) {
    const d = await fetch(`/api/feed/${id}/like`, { method: "POST" }).then(r => r.json())
    setPosts(ps => ps.map(p => p.id === id ? { ...p, likedByMe: d.liked, likes: d.likes } : p))
  }
  async function toggleComments(id: string) {
    if (open[id]) { setOpen(o => { const n = { ...o }; delete n[id]; return n }); return }
    const d = await fetch(`/api/feed/${id}/comments`).then(r => r.json())
    setOpen(o => ({ ...o, [id]: d.comments || [] }))
  }
  async function addComment(id: string) {
    const text = (cInput[id] || "").trim(); if (!text) return
    await fetch(`/api/feed/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }) })
    setCInput(c => ({ ...c, [id]: "" }))
    const d = await fetch(`/api/feed/${id}/comments`).then(r => r.json())
    setOpen(o => ({ ...o, [id]: d.comments || [] }))
    setPosts(ps => ps.map(p => p.id === id ? { ...p, comments: (d.comments || []).length } : p))
  }

  return (
    <AppShell title="Feed">
      <div style={S.wrap}>
        <div style={S.main}>
          {/* Composer */}
          <div style={S.card}>
            <div style={{ display: "flex", gap: 12 }}>
              <Avatar name={me?.name} avatar={me?.avatar} />
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder="Share an update, a win, or something you're working on…" style={S.composer} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button onClick={post} disabled={posting || !draft.trim()} style={{ ...S.postBtn, opacity: draft.trim() ? 1 : .5 }}>{posting ? "Posting…" : "Post"}</button>
            </div>
          </div>

          {/* Feed */}
          {posts.length === 0 && <div style={{ ...S.card, textAlign: "center", color: "var(--v-ink-3)" }}>No posts yet — be the first to share something.</div>}
          {posts.map(p => (
            <div key={p.id} style={S.card}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Link href={`/u/${p.author.id}`}><Avatar name={p.author.name} avatar={p.author.avatar} /></Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/u/${p.author.id}`} style={S.authName}>{p.author.name}</Link>
                  {p.author.headline && <div style={S.authHead}>{p.author.headline}</div>}
                  <div style={S.time}>{timeAgo(p.createdAt)}</div>
                </div>
              </div>
              <p style={S.postBody}>{p.content}</p>
              <div style={S.actions}>
                <button onClick={() => like(p.id)} style={{ ...S.action, color: p.likedByMe ? ACCENT : "var(--v-ink-2)", fontWeight: p.likedByMe ? 700 : 500 }}>
                  <IconTrendingUp size={15} /> {p.likes > 0 ? p.likes : ""} {p.likedByMe ? "Liked" : "Like"}
                </button>
                <button onClick={() => toggleComments(p.id)} style={S.action}><IconMessage size={15} /> {p.comments > 0 ? p.comments : ""} Comment</button>
              </div>
              {open[p.id] && (
                <div style={S.comments}>
                  {open[p.id].map(c => (
                    <div key={c.id} style={{ display: "flex", gap: 10, padding: "8px 0" }}>
                      <Avatar name={c.author.name} avatar={c.author.avatar} size={32} />
                      <div style={S.commentBubble}>
                        <Link href={`/u/${c.author.id}`} style={{ ...S.authName, fontSize: 13 }}>{c.author.name}</Link>
                        <div style={{ fontSize: 13.5, color: "var(--v-ink-2)", marginTop: 2 }}>{c.content}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <input value={cInput[p.id] || ""} onChange={e => setCInput(c => ({ ...c, [p.id]: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") addComment(p.id) }} placeholder="Add a comment…" style={S.cInput} />
                    <button onClick={() => addComment(p.id)} style={S.postBtn}>Send</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right rail */}
        <aside style={S.rail}>
          <div style={S.card}>
            <div style={S.railHead}>Who viewed your profile</div>
            <div style={S.viewCount}>{views?.total ?? 0}<span style={{ fontSize: 13, fontWeight: 500, color: "var(--v-ink-3)" }}> in 90 days</span></div>
            {views?.viewers?.length ? views.viewers.map((v: any) => (
              <Link key={v.id} href={`/u/${v.id}`} style={S.viewer}>
                <Avatar name={v.name} avatar={v.avatar} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...S.authName, fontSize: 13.5 }}>{v.name}</div>
                  {v.headline && <div style={{ ...S.authHead, fontSize: 12 }}>{v.headline}</div>}
                </div>
              </Link>
            )) : <p style={{ fontSize: 13, color: "var(--v-ink-3)", padding: "6px 0" }}>No profile views yet. Post and connect to get noticed.</p>}
          </div>
          <Link href="/network" style={{ ...S.card, display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--v-ink)" }}>
            <span style={{ width: 36, height: 36, borderRadius: 9, background: "#EEEDF9", color: ACCENT, display: "grid", placeItems: "center" }}><IconUsers size={17} /></span>
            <div><div style={{ fontSize: 14, fontWeight: 650 }}>Grow your network</div><div style={{ fontSize: 12.5, color: "var(--v-ink-3)" }}>Find people to connect with</div></div>
          </Link>
        </aside>
      </div>
    </AppShell>
  )
}

const S: Record<string, any> = {
  wrap: { maxWidth: 980, margin: "0 auto", padding: "2rem", display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.25rem", alignItems: "start" },
  main: { display: "flex", flexDirection: "column", gap: "1.25rem", minWidth: 0 },
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 14, padding: "1.1rem 1.25rem" },
  composer: { flex: 1, border: "1px solid var(--v-line-2)", borderRadius: 11, padding: "10px 12px", fontSize: 14.5, resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.5, color: "var(--v-ink)" },
  postBtn: { background: ACCENT, color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  authName: { fontSize: 14.5, fontWeight: 650, color: "var(--v-ink)", textDecoration: "none" },
  authHead: { fontSize: 12.5, color: "var(--v-ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  time: { fontSize: 12, color: "var(--v-ink-3)", marginTop: 1 },
  postBody: { fontSize: 14.5, color: "var(--v-ink)", lineHeight: 1.65, margin: "12px 0 4px", whiteSpace: "pre-wrap" },
  actions: { display: "flex", gap: 6, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--v-line)" },
  action: { display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 13, color: "var(--v-ink-2)", cursor: "pointer", fontWeight: 500 },
  comments: { marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--v-line)" },
  commentBubble: { background: "var(--v-surface-2)", borderRadius: 11, padding: "8px 12px", flex: 1 },
  cInput: { flex: 1, border: "1px solid var(--v-line-2)", borderRadius: 9, padding: "8px 12px", fontSize: 13.5, outline: "none" },
  rail: { display: "flex", flexDirection: "column", gap: "1.25rem", position: "sticky", top: 76 },
  railHead: { fontSize: 14, fontWeight: 700, color: "var(--v-ink)" },
  viewCount: { fontFamily: "var(--v-serif)", fontSize: 30, fontWeight: 600, color: ACCENT, margin: "6px 0 12px" },
  viewer: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", textDecoration: "none" },
}
