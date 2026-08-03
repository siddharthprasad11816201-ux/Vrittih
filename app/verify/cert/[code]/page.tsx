import { prisma } from "@/lib/prisma"
import { certStatus } from "@/lib/certificate"

export const dynamic = "force-dynamic"
export const metadata = { title: "Verify certificate · Vrittih" }

/* Public certificate verification — anyone with the code can confirm a credential.
 * No auth. Shows recipient, issuer, status (valid / revoked / expired). */
export default async function CertVerifyPage({ params }: { params: { code: string } }) {
  const cert = await prisma.certificate.findUnique({
    where: { verificationCode: params.code },
    include: { user: { select: { name: true } } },
  }).catch(() => null)
  if (cert) await prisma.certificate.update({ where: { id: cert.id }, data: { verifyCount: { increment: 1 } } }).catch(() => {})

  const status = cert ? certStatus(cert) : null
  const tone = status === "valid" ? { bg: "#E7F8EE", fg: "#127A43", label: "Valid" }
    : status === "revoked" ? { bg: "#FDECEC", fg: "#B42318", label: "Revoked" }
    : status === "expired" ? { bg: "#FEF3E2", fg: "#8A5300", label: "Expired" } : null
  const fmt = (d: any) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—"

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.brand}><span style={S.mark}>V</span> Vrittih</div>
        {!cert || !tone ? (
          <>
            <h1 style={S.h1}>Certificate not found</h1>
            <p style={S.sub}>This verification code doesn’t match any certificate. Check the link and try again.</p>
          </>
        ) : (
          <>
            <div style={S.topRow}>
              <span style={S.eyebrow}>Certificate of {cert.kind}</span>
              <span style={{ ...S.badge, background: tone.bg, color: tone.fg }}>{tone.label}</span>
            </div>
            <h1 style={S.h1}>{cert.title}</h1>
            <p style={S.awarded}>Awarded to <b>{cert.user?.name || "—"}</b></p>
            <div style={S.grid}>
              <Field k="Issued by" v={cert.issuerName} />
              <Field k="Issued on" v={fmt(cert.issuedAt)} />
              <Field k="Serial" v={cert.serial} mono />
              <Field k="Expires" v={cert.expiresAt ? fmt(cert.expiresAt) : "No expiry"} />
            </div>
            {cert.skills && (
              <div style={{ marginTop: 16 }}>
                <div style={S.k}>Skills</div>
                <div style={S.chips}>{cert.skills.split(",").map((s, i) => <span key={i} style={S.chip}>{s.trim()}</span>)}</div>
              </div>
            )}
            {cert.note && <p style={S.note}>{cert.note}</p>}
            <p style={S.footer}>{status === "valid" ? "This is a genuine certificate issued through Vrittih." : status === "revoked" ? `This certificate has been revoked${cert.revokedReason ? `: ${cert.revokedReason}` : "."}` : "This certificate has passed its expiry date."}</p>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div><div style={S.k}>{k}</div><div style={{ ...S.v, ...(mono ? { fontFamily: "var(--font-mono, monospace)", fontSize: 13 } : {}) }}>{v}</div></div>
}

const S: Record<string, any> = {
  page: { minHeight: "100vh", background: "#F4F7FE", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "clamp(24px,6vw,64px) 20px", fontFamily: "var(--font-sans), Inter, sans-serif", color: "#17181C" },
  card: { width: "100%", maxWidth: 560, background: "#fff", border: "1px solid #E6E8EC", borderRadius: 18, padding: "clamp(22px,4vw,34px)", boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 20px 44px -30px rgba(51,78,172,.3)" },
  brand: { display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-display, Inter)", fontSize: 16, fontWeight: 600, color: "#17181C", marginBottom: 18 },
  mark: { width: 26, height: 26, borderRadius: 8, background: "#4F63D2", color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 600 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 },
  eyebrow: { fontSize: 11.5, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "#64748B" },
  badge: { fontSize: 12, fontWeight: 600, padding: "3px 11px", borderRadius: 999 },
  h1: { fontFamily: "var(--font-display, Inter)", fontSize: 26, fontWeight: 600, letterSpacing: "-.02em", margin: "2px 0 0" },
  awarded: { fontSize: 15, color: "#334155", marginTop: 10 },
  sub: { fontSize: 14.5, color: "#64748B", lineHeight: 1.6, marginTop: 8 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 20, paddingTop: 18, borderTop: "1px solid #EDF0F4" },
  k: { fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", color: "#94A3B8" },
  v: { fontSize: 14, color: "#17181C", marginTop: 3, fontWeight: 500 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: { fontSize: 12.5, color: "#3E4CB8", background: "#ECEFFC", borderRadius: 999, padding: "4px 11px" },
  note: { fontSize: 13.5, color: "#475569", lineHeight: 1.6, marginTop: 16, fontStyle: "normal" },
  footer: { fontSize: 12.5, color: "#94A3B8", marginTop: 20, paddingTop: 16, borderTop: "1px solid #EDF0F4" },
}
