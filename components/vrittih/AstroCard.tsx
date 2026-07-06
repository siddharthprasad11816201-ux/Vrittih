"use client"
import Link from "next/link"
import { analyze, careerFit, ELEMENT_COLOR } from "@/lib/astrology"
import { IconStar, IconArrowRight, IconCheckCircle, IconTarget } from "@/components/ui/Icons"

export default function AstroCard({ birthDate, experience = [], self = false }: {
  birthDate?: string | null
  experience?: { title?: string }[]
  self?: boolean
}) {
  const a = analyze(birthDate)

  if (!a) {
    if (!self) return null
    return (
      <section style={S.card}>
        <div style={S.head}><span style={S.headIc}><IconStar size={16} /></span><h2 style={S.title}>Astrological & career analysis</h2></div>
        <p style={S.empty}>Add your date of birth to unlock your in-house Vedic reading — sun sign, guna balance, Ayurvedic constitution, numerology and career guidance tuned to your experience.</p>
        <Link href="/profile/edit" style={S.cta}>Add date of birth <IconArrowRight size={14} /></Link>
      </section>
    )
  }

  const { sign, guna, dosha, lifePath } = a
  const fit = careerFit(a, experience)
  const eColor = ELEMENT_COLOR[sign.element]
  const bars: [string, number][] = [["Sattva", guna.sattva], ["Rajas", guna.rajas], ["Tamas", guna.tamas]]

  return (
    <section style={S.card}>
      <style>{`@media (max-width:560px){ .acg2{ grid-template-columns:1fr !important; } }`}</style>
      <div style={S.head}>
        <span style={{ ...S.headIc, background: `${eColor}18`, color: eColor }}><IconStar size={16} /></span>
        <div style={{ flex: 1 }}>
          <h2 style={S.title}>Astrological & career analysis</h2>
          <p style={S.sub}>In-house Vedic + numerology reading · not a substitute for professional advice</p>
        </div>
      </div>

      {/* sign banner */}
      <div style={{ ...S.banner, background: `linear-gradient(135deg, ${eColor}14, transparent)` }}>
        <div>
          <div style={S.signName}>{sign.name}</div>
          <div style={S.signMeta}>{sign.dates} · {sign.rulingPlanet}</div>
        </div>
        <div style={S.badges}>
          <span style={{ ...S.badge, background: `${eColor}1A`, color: eColor }}>{sign.element}</span>
          <span style={S.badge}>{sign.modality}</span>
          <span style={S.badge}>{sign.polarity}</span>
        </div>
      </div>
      <p style={S.overview}>{sign.overview}</p>

      {/* guna balance */}
      <div style={S.block}>
        <div style={S.blockLabel}>Guna balance · <b style={{ color: "var(--brand-700)" }}>{guna.dominant}-led</b></div>
        <div style={S.bars}>
          {bars.map(([name, val]) => (
            <div key={name} style={S.barRow}>
              <span style={S.barName}>{name}</span>
              <div style={S.barTrack}><div style={{ ...S.barFill, width: `${val}%`, background: name === guna.dominant ? "var(--brand-600)" : "var(--brand-200)" }} /></div>
              <span style={S.barVal}>{val}%</span>
            </div>
          ))}
        </div>
        <p style={S.note}>{guna.summary}</p>
      </div>

      {/* dosha / body */}
      <div style={S.grid2} className="acg2">
        <div style={S.mini}>
          <div style={S.miniLabel}>Ayurvedic constitution</div>
          <div style={S.miniValue}>{dosha.name}</div>
          <p style={S.miniText}>{dosha.body}</p>
          <p style={S.miniText}><b>Work energy:</b> {dosha.energy}</p>
          <p style={S.miniText}><b>Keep in balance:</b> {dosha.balance}</p>
        </div>
        {lifePath && (
          <div style={S.mini}>
            <div style={S.miniLabel}>Numerology life path</div>
            <div style={S.miniValue}>{lifePath.number} · {lifePath.title}</div>
            <p style={S.miniText}>{lifePath.summary}</p>
            <div style={S.lucky}>Lucky day <b>{sign.luckyDay}</b> · numbers <b>{sign.luckyNumbers.join(", ")}</b></div>
          </div>
        )}
      </div>

      {/* career fit — blends chart + experience */}
      <div style={{ ...S.block, background: "var(--brand-100)", borderColor: "transparent", padding: "16px 18px", borderRadius: 14 }}>
        <div style={S.blockLabel}><IconTarget size={14} /> &nbsp;Best-fit career direction <span style={S.synergy}>{fit.synergy}</span></div>
        <p style={{ ...S.note, color: "var(--v-ink)", fontWeight: 600, marginTop: 8 }}>{fit.headline}</p>
        <p style={S.note}>{fit.note}</p>
        <div style={S.roles}>
          {fit.recommended.map(r => (
            <Link key={r} href={`/jobs?q=${encodeURIComponent(r)}`} style={S.roleChip}>{r}</Link>
          ))}
        </div>
      </div>

      {/* strengths + matches */}
      <div style={S.grid2} className="acg2">
        <div>
          <div style={S.blockLabel}>Professional strengths</div>
          <ul style={S.list}>{sign.strengths.map(s => <li key={s} style={S.li}><IconCheckCircle size={13} /> {s}</li>)}</ul>
        </div>
        <div>
          <div style={S.blockLabel}>Grows best with</div>
          <ul style={S.list}>{sign.growthAreas.map(s => <li key={s} style={S.liMuted}>· {s}</li>)}</ul>
          <div style={{ ...S.blockLabel, marginTop: 12 }}>Works well with</div>
          <div style={S.matches}>{sign.bestMatches.map(m => <span key={m} style={S.matchChip}>{m}</span>)}</div>
        </div>
      </div>
    </section>
  )
}

const S: Record<string, any> = {
  card: { background: "var(--v-surface)", border: "1px solid var(--v-line)", borderRadius: 16, padding: "1.4rem 1.5rem", boxShadow: "var(--v-shadow-sm)" },
  head: { display: "flex", alignItems: "center", gap: 11, marginBottom: 16 },
  headIc: { width: 34, height: 34, borderRadius: 10, background: "var(--brand-100)", color: "var(--brand-600)", display: "grid", placeItems: "center", flexShrink: 0 },
  title: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--v-ink)", letterSpacing: "-.01em" },
  sub: { fontSize: 11.5, color: "var(--v-ink-3)", marginTop: 2 },
  empty: { fontSize: 14, color: "var(--v-ink-2)", lineHeight: 1.6, margin: "4px 0 16px" },
  cta: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand-600)", color: "#fff", padding: "9px 16px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, textDecoration: "none" },
  banner: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 16px", borderRadius: 13, marginBottom: 12 },
  signName: { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--v-ink)", letterSpacing: "-.02em" },
  signMeta: { fontSize: 12.5, color: "var(--v-ink-3)", marginTop: 2, fontFamily: "var(--font-mono)" },
  badges: { display: "flex", gap: 6, flexWrap: "wrap" },
  badge: { fontSize: 11.5, fontWeight: 600, padding: "4px 11px", borderRadius: 999, background: "var(--v-surface-2)", color: "var(--v-ink-2)" },
  overview: { fontSize: 14, color: "var(--v-ink-2)", lineHeight: 1.6, marginBottom: 18 },
  block: { border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 },
  blockLabel: { display: "flex", alignItems: "center", fontSize: 12.5, fontWeight: 700, color: "var(--v-ink)", letterSpacing: ".01em" },
  bars: { display: "flex", flexDirection: "column", gap: 8, margin: "12px 0" },
  barRow: { display: "flex", alignItems: "center", gap: 10 },
  barName: { fontSize: 12.5, color: "var(--v-ink-2)", width: 52, flexShrink: 0 },
  barTrack: { flex: 1, height: 8, background: "var(--v-surface-2)", borderRadius: 5, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 5, transition: "width .5s var(--v-ease)" },
  barVal: { fontSize: 12, fontWeight: 700, color: "var(--v-ink-2)", width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  note: { fontSize: 13, color: "var(--v-ink-2)", lineHeight: 1.6, marginTop: 6 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 },
  mini: { border: "1px solid var(--v-line)", borderRadius: 14, padding: "14px 16px" },
  miniLabel: { fontSize: 11.5, fontWeight: 700, color: "var(--v-ink-3)", textTransform: "uppercase", letterSpacing: ".04em" },
  miniValue: { fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--brand-700)", margin: "6px 0 8px" },
  miniText: { fontSize: 12.5, color: "var(--v-ink-2)", lineHeight: 1.55, marginBottom: 5 },
  lucky: { fontSize: 12, color: "var(--v-ink-3)", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--v-line)" },
  synergy: { marginLeft: "auto", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--brand-700)", background: "var(--v-surface)", padding: "3px 9px", borderRadius: 999 },
  roles: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 },
  roleChip: { display: "inline-flex", alignItems: "center", background: "var(--v-surface)", border: "1px solid var(--brand-200)", color: "var(--brand-700)", padding: "6px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, textDecoration: "none" },
  list: { listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 6 },
  li: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--v-ink-2)" },
  liMuted: { fontSize: 13, color: "var(--v-ink-3)", lineHeight: 1.5 },
  matches: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  matchChip: { fontSize: 12, fontWeight: 600, color: "var(--v-ink-2)", background: "var(--v-surface-2)", padding: "5px 11px", borderRadius: 999 },
}
