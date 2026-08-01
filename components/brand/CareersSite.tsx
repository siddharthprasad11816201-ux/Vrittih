import Link from "next/link"
import { readableOn } from "@/lib/brand"
import { initials } from "@/lib/company"
import { SITE } from "@/lib/site"

/* The white-label careers page, rendered both at /c/<slug> (relative links) and
 * on a partner's own custom domain via /site/<host> (absolute links back to the
 * Vrittih apply flow, since job detail lives on the primary origin). */

type Brand = { name: string; tagline?: string | null; about?: string | null; logoUrl?: string | null; color?: string | null }
type Job = { id: string; title: string; location: string; type: string; remote: boolean; salary?: string | null }

const TYPE_LABEL: Record<string, string> = { FULLTIME: "Full-time", PARTTIME: "Part-time", INTERNSHIP: "Internship", CONTRACT: "Contract", FREELANCE: "Freelance" }

export default function CareersSite({ brand, jobs, absolute = false }: { brand: Brand; jobs: Job[]; absolute?: boolean }) {
  const accent = brand.color || "#0F6E56"
  const onAccent = readableOn(accent)
  const jobHref = (id: string) => (absolute ? `${SITE}/jobs/${id}` : `/jobs/${id}`)

  return (
    <div style={S.page}>
      <header style={{ ...S.hero, background: accent, color: onAccent }}>
        <div style={S.heroInner}>
          <div style={S.brandRow}>
            {brand.logoUrl
              ? <img src={brand.logoUrl} alt={brand.name} style={S.logoImg} />
              : <span style={{ ...S.monogram, color: accent }}>{initials(brand.name)}</span>}
            <span style={S.brandName}>{brand.name}</span>
          </div>
          <h1 style={S.h1}>{brand.tagline || "Join our team"}</h1>
          {brand.about && <p style={{ ...S.about, color: onAccent, opacity: 0.9 }}>{brand.about}</p>}
          <div style={{ ...S.count, borderColor: onAccent, color: onAccent }}>{jobs.length} open {jobs.length === 1 ? "role" : "roles"}</div>
        </div>
      </header>

      <main style={S.main}>
        {jobs.length === 0 ? (
          <div style={S.empty}>No open roles right now — check back soon.</div>
        ) : (
          <div style={S.list}>
            {jobs.map((j) => (
              <a key={j.id} href={jobHref(j.id)} style={S.card}>
                <div style={S.cardMain}>
                  <div style={S.jobTitle}>{j.title}</div>
                  <div style={S.jobMeta}>
                    <span>{j.location}</span>
                    {j.remote && <span style={{ ...S.tag, background: accent, color: onAccent }}>Remote</span>}
                    <span style={S.dot}>·</span><span>{TYPE_LABEL[j.type] || j.type}</span>
                    {j.salary && <><span style={S.dot}>·</span><span>{j.salary}</span></>}
                  </div>
                </div>
                <span style={{ ...S.apply, color: accent }}>View &amp; apply →</span>
              </a>
            ))}
          </div>
        )}
      </main>

      <footer style={S.footer}>
        <span>Careers powered by <Link href={absolute ? `${SITE}/` : "/"} style={S.pw}>Vrittih</Link></span>
      </footer>
    </div>
  )
}

const S: Record<string, any> = {
  page: { minHeight: "100vh", background: "#FAF8F2", fontFamily: "var(--font-sans)", color: "#14201B" },
  hero: { padding: "3rem 1.5rem 3.5rem" },
  heroInner: { maxWidth: 860, margin: "0 auto" },
  brandRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 22 },
  logoImg: { height: 40, width: "auto", borderRadius: 8, background: "#fff", padding: 4 },
  monogram: { width: 40, height: 40, borderRadius: 10, background: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 16 },
  brandName: { fontSize: 18, fontWeight: 700, letterSpacing: "-.01em" },
  h1: { fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 600, letterSpacing: "-.03em", margin: "0 0 10px", lineHeight: 1.1 },
  about: { fontSize: 15.5, lineHeight: 1.6, maxWidth: 620, margin: "0 0 18px" },
  count: { display: "inline-block", border: "1px solid", borderRadius: 999, padding: "4px 14px", fontSize: 13, fontWeight: 600, opacity: 0.95 },
  main: { maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem 3rem" },
  empty: { textAlign: "center", color: "#6E7A73", fontSize: 15, padding: "3rem 0" },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  card: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "#fff", border: "1px solid #E8E3D7", borderRadius: 14, padding: "16px 20px", textDecoration: "none", color: "inherit", boxShadow: "0 1px 2px rgba(4,52,44,.04)" },
  cardMain: { minWidth: 0 },
  jobTitle: { fontSize: 16.5, fontWeight: 600, color: "#14201B" },
  jobMeta: { fontSize: 13.5, color: "#6E7A73", marginTop: 5, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" },
  tag: { fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "1px 8px" },
  dot: { color: "#C9CFC9" },
  apply: { fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" },
  footer: { borderTop: "1px solid #E8E3D7", padding: "1.5rem", textAlign: "center", fontSize: 13, color: "#7C877F" },
  pw: { color: "#0F6E56", fontWeight: 600, textDecoration: "none" },
}
