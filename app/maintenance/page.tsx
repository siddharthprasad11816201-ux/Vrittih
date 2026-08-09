import Link from "next/link"

export const metadata = { title: "Under maintenance" }

/* Shown to non-admins while the super-admin has maintenance mode on. Admins are
 * never routed here (they keep full access to switch it back off). */
export default function MaintenancePage() {
  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.badge} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <h1 style={S.h1}>We&rsquo;ll be right back</h1>
        <p style={S.p}>Vrittih is undergoing scheduled maintenance. Everything will be back shortly — thank you for your patience.</p>
        <Link href="/" style={S.link}>Try again</Link>
      </div>
    </div>
  )
}

const S: Record<string, any> = {
  page: { minHeight: "100dvh", display: "grid", placeItems: "center", background: "#F7F9FC", padding: "2rem" },
  card: { maxWidth: 440, textAlign: "center" as const, background: "#fff", border: "0.5px solid rgba(0,0,0,.08)", borderRadius: 16, padding: "2.5rem" },
  badge: { width: 56, height: 56, borderRadius: 14, background: "#EAF1FE", color: "#6495ED", display: "grid", placeItems: "center", margin: "0 auto 18px" },
  h1: { fontSize: 22, fontWeight: 700, color: "#0A0A0F", letterSpacing: "-.3px", marginBottom: 10 },
  p: { fontSize: 14, color: "#7B7B8F", lineHeight: 1.6, marginBottom: 22 },
  link: { display: "inline-block", background: "#6495ED", color: "#fff", fontSize: 14, fontWeight: 600, padding: "10px 22px", borderRadius: 10, textDecoration: "none" },
}
