"use client"
import Link from "next/link"
import { analyze, careerFit } from "@/lib/astrology"
import { IconStar, IconLock, IconArrowRight } from "@/components/ui/Icons"

/* "Astrological best job for you" — an in-house Vedic career reading on the
 * applicant home board. Locked behind the paid Basic plan: free users see a
 * teaser + unlock CTA; paid users see their best-fit roles. Uses lib/astrology
 * (deterministic, in-house — no external service). */

export default function AstroJobCard({ paid, birthDate, birthTime, experience = [] }: {
  paid: boolean
  birthDate?: string | null
  birthTime?: string | null
  experience?: { title?: string }[]
}) {
  const a = analyze(birthDate, birthTime)
  async function startTrial() {
    const d = await fetch("/api/trial/start", { method: "POST" }).then(r => r.json()).catch(() => null)
    if (d?.ok) location.reload()
    else if (d?.used) alert("You've already used your free trial — upgrade to Basic to unlock this.")
  }

  // Locked (not paid) — teaser + unlock. Show the sun sign as a hook, blur the pick.
  if (!paid) {
    return (
      <section style={S.card}>
        <div style={S.head}><span style={S.ic}><IconStar size={15} /></span><h2 style={S.title}>Your astrological best‑fit career</h2></div>
        <div style={S.lockWrap}>
          <div style={S.blur} aria-hidden="true">
            <div style={S.blurLine} /><div style={{ ...S.blurLine, width: "72%" }} />
            <div style={S.blurChips}>{["———", "————", "———"].map((t, i) => <span key={i} style={S.blurChip}>{t}</span>)}</div>
          </div>
          <div style={S.lockOver}>
            <span style={S.lockIc}><IconLock size={18} /></span>
            <div style={S.lockTitle}>{a ? `Your ${a.sign.name} career reading is ready` : "Unlock your best‑fit career reading"}</div>
            <p style={S.lockSub}>A precise, in‑house reading of your psychophysical nature, tuned to your experience — the roles that genuinely fit you. Included with <b>Basic</b>.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <button onClick={startTrial} style={S.unlock}>Start 7‑day free trial</button>
              <Link href="/pay" style={S.unlockGhost}>See plans</Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // Paid but no birth date — prompt to add it.
  if (!a) {
    return (
      <section style={S.card}>
        <div style={S.head}><span style={S.ic}><IconStar size={15} /></span><h2 style={S.title}>Your astrological best‑fit career</h2></div>
        <p style={S.empty}>Add your date of birth to unlock your best‑fit roles from your Vedic chart.</p>
        <Link href="/profile/edit" style={S.unlock}>Add date of birth <IconArrowRight size={14} /></Link>
      </section>
    )
  }

  const fit = careerFit(a, experience)
  return (
    <section style={S.card}>
      <div style={S.head}>
        <span style={S.ic}><IconStar size={15} /></span>
        <div style={{ flex: 1 }}>
          <h2 style={S.title}>Your astrological best‑fit career</h2>
          <p style={S.metaLine}>{a.sign.name} · {a.sign.element} · {fit.synergy} synergy</p>
        </div>
      </div>
      <p style={S.headline}>{fit.headline}</p>
      <p style={S.note}>{fit.note}</p>
      {a.psychophysical && (
        <div style={S.pp}>
          <div style={S.ppRow}>{a.psychophysical.temperament}</div>
          {a.psychophysical.disposition && <div style={S.ppRow}>{a.psychophysical.disposition}</div>}
          <div style={S.ppNote}>{a.psychophysical.precisionNote}</div>
        </div>
      )}
      <div style={S.roles}>
        {fit.recommended.map((r: string) => (
          <Link key={r} href={`/jobs?q=${encodeURIComponent(r)}`} style={S.roleChip}>{r}</Link>
        ))}
      </div>
      <Link href="/career" style={S.moreLink}>Full astrological & career analysis <IconArrowRight size={13} /></Link>
    </section>
  )
}

const S: Record<string, any> = {
  card: { background: "var(--v-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 18 },
  head: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  ic: { width: 30, height: 30, borderRadius: 8, background: "var(--v-accent-soft)", color: "var(--v-accent)", display: "grid", placeItems: "center", flexShrink: 0 },
  title: { font: "500 15px var(--font-display)", color: "var(--v-ink)", margin: 0 },
  metaLine: { font: "400 12px var(--font-sans)", color: "var(--v-ink-3)", marginTop: 2 },
  headline: { font: "500 14.5px var(--font-sans)", color: "var(--v-ink)", lineHeight: 1.5 },
  note: { font: "400 13px var(--font-sans)", color: "var(--v-ink-2)", lineHeight: 1.6, marginTop: 6 },
  pp: { marginTop: 12, padding: "11px 13px", background: "var(--v-surface-2)", borderRadius: "var(--r-md)", display: "flex", flexDirection: "column", gap: 5 },
  ppRow: { font: "400 12.5px var(--font-sans)", color: "var(--v-ink-2)", lineHeight: 1.5 },
  ppNote: { font: "400 11px var(--font-sans)", color: "var(--v-ink-3)", marginTop: 2 },
  roles: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 },
  roleChip: { display: "inline-flex", alignItems: "center", background: "var(--v-surface)", border: "1px solid var(--v-accent-soft)", color: "var(--v-accent)", padding: "6px 12px", borderRadius: 999, font: "500 12.5px var(--font-sans)", textDecoration: "none" },
  moreLink: { display: "inline-flex", alignItems: "center", gap: 4, font: "500 13px var(--font-sans)", color: "var(--v-accent)", textDecoration: "none", marginTop: 12 },
  empty: { font: "400 13.5px var(--font-sans)", color: "var(--v-ink-2)", lineHeight: 1.6, margin: "0 0 12px" },
  unlock: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-accent)", color: "#fff", padding: "9px 16px", borderRadius: "var(--r-md)", font: "500 13px var(--font-sans)", textDecoration: "none", border: "none", cursor: "pointer" },
  unlockGhost: { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--v-surface)", color: "var(--v-accent)", border: "1px solid var(--border)", padding: "9px 16px", borderRadius: "var(--r-md)", font: "500 13px var(--font-sans)", textDecoration: "none" },
  lockWrap: { position: "relative", borderRadius: "var(--r-md)", overflow: "hidden" },
  blur: { filter: "blur(6px)", opacity: .5, padding: "6px 2px", userSelect: "none", pointerEvents: "none" },
  blurLine: { height: 12, width: "90%", background: "var(--v-surface-2)", borderRadius: 6, margin: "8px 0" },
  blurChips: { display: "flex", gap: 7, marginTop: 12 },
  blurChip: { padding: "6px 16px", background: "var(--v-surface-2)", borderRadius: 999, color: "transparent" },
  lockOver: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "12px 16px", background: "linear-gradient(180deg, rgba(255,255,255,.4), var(--v-surface) 70%)" },
  lockIc: { width: 34, height: 34, borderRadius: 10, background: "var(--v-accent-soft)", color: "var(--v-accent)", display: "grid", placeItems: "center", marginBottom: 8 },
  lockTitle: { font: "500 14.5px var(--font-sans)", color: "var(--v-ink)" },
  lockSub: { font: "400 12.5px var(--font-sans)", color: "var(--v-ink-2)", lineHeight: 1.55, margin: "5px 0 12px", maxWidth: "42ch" },
}
