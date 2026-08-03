"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
import { registerPasskey, webauthnSupported } from "@/lib/webauthn-client"
import {
  IconShield, IconScan, IconUser, IconKey, IconActivity, IconCheckCircle,
  IconBriefcase, IconGlobe, IconBell, IconSettings, IconMessage,
} from "@/components/ui/Icons"

/* Phase 1 · Module 5 — the Enterprise Identity & Account Center.
 * One sectioned subsystem (config-driven, capability-gated) for identity,
 * security, activity, privacy and preferences. Biometric face recognition lives
 * as a feature INSIDE Security — the shell no longer dives straight into the face
 * wizard. Every figure shown is real (see /api/account/overview + /activity). */

type Overview = {
  identity: any; counts: any; security: any; health: any
  sections: { id: string; label: string; group: string; description: string }[]
  capabilities: string[]
}
type Activity = { currentSession: any; logins: any[]; audit: any[]; sessionStore: any }

const GROUPS = ["Account", "Security", "Preferences", "Developer", "Support"] as const
const SEC_ICON: Record<string, any> = {
  overview: <IconActivity size={17} />, personal: <IconUser size={17} />,
  professional: <IconBriefcase size={17} />, organization: <IconGlobe size={17} />,
  security: <IconShield size={17} />, activity: <IconScan size={17} />,
  privacy: <IconKey size={17} />, preferences: <IconSettings size={17} />,
  developer: <IconKey size={17} />, support: <IconMessage size={17} />,
}
const scoreColor = (n: number) => (n >= 70 ? "#16A34A" : n >= 45 ? "#B45309" : "#DC2626")
const fmtDate = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—")
const fmtDT = (d: string | Date | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—")

export default function AccountCenterPage() {
  const router = useRouter()
  const [ov, setOv] = useState<Overview | null>(null)
  const [act, setAct] = useState<Activity | null>(null)
  const [section, setSection] = useState("overview")
  const [state, setState] = useState<"loading" | "anon" | "ready">("loading")
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [passkeys, setPasskeys] = useState<any[]>([])
  const [pkName, setPkName] = useState("")
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })

  const flash = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3200) }

  useEffect(() => {
    // Deep-link support: /account?section=security (client-only, no Suspense needed).
    const s = new URLSearchParams(window.location.search).get("section")
    if (s) setSection(s)
    fetch("/api/account/overview").then((r) => { if (r.status === 401) { setState("anon"); return null } return r.json() })
      .then((d) => { if (d?.authenticated) { setOv(d); setState("ready") } }).catch(() => setState("anon"))
    fetch("/api/account/activity").then((r) => (r.ok ? r.json() : null)).then((d) => d?.authenticated && setAct(d)).catch(() => {})
  }, [])

  const loadPasskeys = () => fetch("/api/auth/webauthn/credentials").then((r) => r.json()).then((d) => setPasskeys(d.credentials || [])).catch(() => {})
  useEffect(() => { if (section === "security") loadPasskeys() }, [section])

  async function addPasskey() {
    setBusy(true)
    try {
      const r = await registerPasskey(pkName.trim() || undefined)
      if (r.success) { setPkName(""); flash("Passkey added"); loadPasskeys(); refreshSecurity() }
      else flash(r.error || "Could not add passkey", false)
    } finally { setBusy(false) }
  }
  async function removePasskey(id: string) {
    const d = await fetch("/api/auth/webauthn/credentials", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then((r) => r.json()).catch(() => ({}))
    if (d.success) { flash("Passkey removed"); loadPasskeys(); refreshSecurity() } else flash(d.error || "Failed", false)
  }
  async function changePassword(e: any) {
    e.preventDefault()
    if (pw.newPassword.length < 8) return flash("New password must be at least 8 characters", false)
    if (pw.newPassword !== pw.confirmPassword) return flash("Passwords do not match", false)
    setBusy(true)
    try {
      const d = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "changePassword", currentPassword: pw.currentPassword, newPassword: pw.newPassword }) }).then((r) => r.json())
      if (d.success) { flash("Password changed"); setPw({ currentPassword: "", newPassword: "", confirmPassword: "" }) }
      else flash(d.error || "Failed", false)
    } finally { setBusy(false) }
  }
  const refreshSecurity = () => fetch("/api/account/overview").then((r) => r.json()).then((d) => d?.authenticated && setOv(d)).catch(() => {})
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    router.push("/login")
  }

  if (state === "loading") return <AppShell title="Account"><div style={S.dim}>Loading your account…</div></AppShell>
  if (state === "anon") return (
    <AppShell title="Account"><div style={S.centerCard}><h1 style={S.h1}>Account Center</h1><p style={S.muted}>Sign in to manage your identity, security and privacy.</p><Link href="/login?next=/account" style={S.cta}>Sign in</Link></div></AppShell>
  )

  const o = ov!
  const grouped = GROUPS.map((g) => ({ group: g, items: o.sections.filter((s) => s.group === g) })).filter((g) => g.items.length)
  const go = (s: string) => { setSection(s); window.history.replaceState(null, "", `/account?section=${s}`) }

  return (
    <AppShell title="Account">
      <div style={S.wrap}>
        <div style={S.grid} className="rl-2col">
          {/* Section rail */}
          <aside style={S.rail}>
            <div style={S.railHead}><span style={S.railAvatar}>{(o.identity.name || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}</span>
              <div style={{ minWidth: 0 }}><div style={S.railName}>{o.identity.name}</div><div style={S.railType}>{o.identity.type}</div></div>
            </div>
            {grouped.map((g) => (
              <div key={g.group} style={{ marginBottom: 6 }}>
                <div style={S.railGroup}>{g.group}</div>
                {g.items.map((s) => (
                  <button key={s.id} onClick={() => go(s.id)} style={{ ...S.railItem, ...(section === s.id ? S.railItemOn : {}) }}>
                    <span style={{ display: "inline-flex", color: section === s.id ? "#2F6BE0" : "#94A3B8" }}>{SEC_ICON[s.id]}</span>{s.label}
                  </button>
                ))}
              </div>
            ))}
          </aside>

          {/* Panel */}
          <main style={S.panel}>
            {msg && <div style={{ ...S.msg, ...(msg.ok ? S.msgOk : S.msgErr) }}>{msg.text}</div>}
            {section === "overview" && <Overview o={o} act={act} go={go} />}
            {section === "personal" && <Personal o={o} />}
            {section === "professional" && <Professional o={o} />}
            {section === "organization" && <Organization />}
            {section === "security" && <Security o={o} passkeys={passkeys} pkName={pkName} setPkName={setPkName} addPasskey={addPasskey} removePasskey={removePasskey} busy={busy} pw={pw} setPw={setPw} changePassword={changePassword} />}
            {section === "activity" && <ActivityPanel act={act} />}
            {section === "privacy" && <Privacy />}
            {section === "preferences" && <Preferences />}
            {section === "developer" && <Developer />}
            {section === "support" && <Support o={o} signOut={signOut} />}
          </main>
        </div>
      </div>
    </AppShell>
  )
}

/* ---------- sections ---------- */
function Card({ title, desc, children }: any) {
  return <div style={S.card}><div style={S.cardHead}><h3 style={S.cardTitle}>{title}</h3>{desc && <p style={S.cardDesc}>{desc}</p>}</div>{children}</div>
}
function Ring({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ ...S.ring, background: `conic-gradient(${color} ${pct * 3.6}deg, #EAEFF5 0deg)` }}>
      <div style={S.ringInner}><span style={{ font: "700 20px var(--font-sans)", color: "#1F2937" }}>{pct}</span><span style={{ font: "500 10px var(--font-sans)", color: "#94A3B8" }}>%</span></div>
    </div>
  )
}
function VBadge({ on, label }: { on: boolean; label: string }) {
  return <span style={{ ...S.vbadge, background: on ? "#ECFDF5" : "#F1F5F9", color: on ? "#047857" : "#94A3B8", borderColor: on ? "#A7F3D0" : "#E5E7EB" }}>{on ? "✓ " : "○ "}{label}</span>
}

function Overview({ o, act, go }: any) {
  const h = o.health
  return (
    <>
      <div style={S.idHeader}>
        <span style={S.idAvatar}>{o.identity.avatar ? <img src={o.identity.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : (o.identity.name || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}</span>
        <div style={{ minWidth: 0 }}>
          <h1 style={S.idName}>{o.identity.name}</h1>
          <div style={S.idSub}>{o.identity.headline || o.identity.email}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            <span style={S.typePill}>{o.identity.type}</span>
            {o.identity.traits.map((t: any) => <span key={t.key} style={S.traitPill}>{t.label}</span>)}
          </div>
        </div>
      </div>

      <div style={S.hgrid}>
        <Card title="Profile completeness" desc={h.profileCompletion === 100 ? "Your profile is complete" : `${h.missing.length} item${h.missing.length === 1 ? "" : "s"} left`}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Ring pct={h.profileCompletion} color="#6495ED" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {h.missing.length ? h.missing.map((m: string) => <span key={m} style={S.miss}>{m}</span>) : <span style={S.okText}>Everything filled in</span>}
            </div>
          </div>
        </Card>
        <Card title="Security score" desc={`Protection level: ${h.securityLevel}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Ring pct={h.securityScore} color={scoreColor(h.securityScore)} />
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <VBadge on={h.verification.twoFactor} label="Two-factor" />
              <VBadge on={o.security.passkeys > 0} label={`Passkeys (${o.security.passkeys})`} />
              <VBadge on={h.verification.faceEnrolled} label="Biometric" />
              <VBadge on={h.verification.idVerified} label="ID verified" />
            </div>
          </div>
        </Card>
      </div>

      {h.recommended.length > 0 && (
        <Card title="Recommended for you" desc="Actions that strengthen your account">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {h.recommended.map((r: any) => (
              <button key={r.key} onClick={() => go(r.section)} style={S.recRow}>
                <span style={{ display: "inline-flex", color: "#6495ED" }}><IconCheckCircle size={17} /></span>
                <span style={{ flex: 1, textAlign: "left" }}>{r.label}</span>
                <span style={S.recGo}>Open →</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {act?.currentSession && (
        <Card title="This device" desc="Your current session">
          <div style={S.sessRow}>
            <div><div style={S.sessDevice}>{act.currentSession.device}</div><div style={S.sessMeta}>{act.currentSession.ip || "IP hidden"} · signed in {fmtDT(act.currentSession.issuedAt)}</div></div>
            <span style={S.liveDot}>Active now</span>
          </div>
        </Card>
      )}
    </>
  )
}

function Personal({ o }: any) {
  const i = o.identity
  return (
    <Card title="Personal information" desc="Your contact details and how you appear across Vrittih">
      <div style={S.infoGrid}>
        <Info label="Full name" value={i.name} />
        <Info label="Email" value={i.email} />
        <Info label="Phone" value={i.phone || "Not set"} />
        <Info label="Location" value={i.location || "Not set"} />
        <Info label="Headline" value={i.headline || "Not set"} />
        <Info label="Member since" value={fmtDate(i.memberSince)} />
      </div>
      <div style={{ marginTop: 16 }}><Link href="/profile/edit" style={S.primaryBtn}>Edit profile</Link> <Link href="/profile" style={S.ghostBtn}>View public profile</Link></div>
    </Card>
  )
}

function Professional({ o }: any) {
  const c = o.counts
  return (
    <Card title="Professional" desc="Experience, skills and education that power your matches">
      <div style={S.statRow}>
        <Stat n={c.experience} l="Experience entries" /><Stat n={c.skills} l="Skills" /><Stat n={c.education} l="Education entries" />
      </div>
      <div style={{ marginTop: 4, marginBottom: 14 }}><VBadge on={o.identity.openToWork} label="Open to work" /></div>
      <div><Link href="/profile/edit" style={S.primaryBtn}>Manage experience & skills</Link> <Link href="/resume" style={S.ghostBtn}>Résumé builder</Link></div>
    </Card>
  )
}

function Organization() {
  return (
    <Card title="Organization" desc="Company, business unit and reporting">
      <p style={S.note}>Manage your company page, branding and members from the company workspace.</p>
      <Link href="/companies" style={S.primaryBtn}>Open company workspace</Link>
    </Card>
  )
}

function Security({ o, passkeys, pkName, setPkName, addPasskey, removePasskey, busy, pw, setPw, changePassword }: any) {
  const s = o.security
  return (
    <>
      <Card title="Password" desc="Change the password used for email sign-in">
        <form onSubmit={changePassword} style={{ maxWidth: 380 }}>
          <Field label="Current password"><input type="password" value={pw.currentPassword} onChange={(e) => setPw((p: any) => ({ ...p, currentPassword: e.target.value }))} style={S.input} /></Field>
          <Field label="New password"><input type="password" value={pw.newPassword} onChange={(e) => setPw((p: any) => ({ ...p, newPassword: e.target.value }))} style={S.input} placeholder="Min 8 characters" /></Field>
          <Field label="Confirm new password"><input type="password" value={pw.confirmPassword} onChange={(e) => setPw((p: any) => ({ ...p, confirmPassword: e.target.value }))} style={S.input} /></Field>
          <button type="submit" disabled={busy} style={S.primaryBtn}>{busy ? "Working…" : "Change password"}</button>
        </form>
      </Card>

      <Card title="Two-factor authentication" desc="A second factor at sign-in — authenticator app or email code">
        <div style={S.secRow}>
          <StatusDot on={s.twoFactorEnabled} />
          <div style={{ flex: 1 }}><div style={S.secLabel}>{s.twoFactorEnabled ? `Enabled · ${s.twoFactorMethod === "authenticator" ? "Authenticator app" : "Email code"}` : "Not enabled"}</div><div style={S.secSub}>Recommended for every account</div></div>
          <Link href="/settings" style={S.ghostBtn}>{s.twoFactorEnabled ? "Manage" : "Set up"}</Link>
        </div>
      </Card>

      <Card title="Passkeys" desc="Sign in with fingerprint, face unlock or device PIN — no password">
        {passkeys.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {passkeys.map((pk: any) => (
              <div key={pk.id} style={S.pkRow}>
                <div><div style={S.secLabel}>{pk.name || "Passkey"}</div><div style={S.secSub}>Added {fmtDate(pk.createdAt)}{pk.lastUsedAt ? ` · Last used ${fmtDate(pk.lastUsedAt)}` : ""}</div></div>
                <button onClick={() => removePasskey(pk.id)} style={S.dangerLink}>Remove</button>
              </div>
            ))}
          </div>
        )}
        {webauthnSupported() ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input value={pkName} onChange={(e) => setPkName(e.target.value)} style={{ ...S.input, maxWidth: 220, marginBottom: 0 }} placeholder="Name (e.g. My laptop)" />
            <button onClick={addPasskey} disabled={busy} style={S.primaryBtn}>{busy ? "Waiting for device…" : "Add passkey"}</button>
          </div>
        ) : <p style={S.note}>This browser does not support passkeys.</p>}
      </Card>

      {/* Biometric — face recognition as a feature INSIDE Security (never a shell redirect) */}
      <Card title="Biometric authentication" desc="Face recognition for sign-in, verified fully in-house">
        <div style={S.secRow}>
          <StatusDot on={s.faceEnrolled} />
          <div style={{ flex: 1 }}>
            <div style={S.secLabel}>{s.faceEnrolled ? "Face enrolled" : "Not set up"}</div>
            <div style={S.secSub}>{s.faceEnrolled ? `Updated ${fmtDate(s.faceUpdatedAt)} · encrypted vector, no image stored` : "Encrypted face vector — your photo is never stored"}</div>
          </div>
          <Link href="/verify/face-setup" style={s.faceEnrolled ? S.ghostBtn : S.primaryBtn}>{s.faceEnrolled ? "Update face" : "Set up face sign-in"}</Link>
        </div>
      </Card>

      <Card title="Identity verification" desc="Verify a government ID with liveness + face match">
        <div style={S.secRow}>
          <StatusDot on={s.idVerified} />
          <div style={{ flex: 1 }}><div style={S.secLabel}>{s.idVerified ? `Verified${s.idType ? ` · ${s.idType}` : ""}` : "Not verified"}</div><div style={S.secSub}>Unlocks trusted-applicant signals</div></div>
          <Link href="/verify/doc-verify" style={s.idVerified ? S.ghostBtn : S.primaryBtn}>{s.idVerified ? "Re-verify" : "Verify identity"}</Link>
        </div>
      </Card>
    </>
  )
}

function ActivityPanel({ act }: any) {
  if (!act) return <Card title="Sign-in & activity"><p style={S.note}>Loading activity…</p></Card>
  return (
    <>
      <Card title="This device" desc="Your current session">
        <div style={S.sessRow}>
          <div><div style={S.sessDevice}>{act.currentSession.device}</div><div style={S.sessMeta}>{act.currentSession.ip || "IP hidden"} · signed in {fmtDT(act.currentSession.issuedAt)} · expires {fmtDate(act.currentSession.expiresAt)}</div></div>
          <span style={S.liveDot}>Active now</span>
        </div>
        {!act.sessionStore?.available && <p style={{ ...S.note, marginTop: 12, marginBottom: 0 }}>Remote sign-out across all your devices is being rolled out. For now, changing your password protects your account everywhere.</p>}
      </Card>

      <Card title="Recent sign-ins" desc="The latest activity on your account">
        {act.logins.length === 0 ? <p style={S.note}>No sign-ins recorded yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {act.logins.map((l: any) => (
              <div key={l.id} style={S.logRow}>
                <span style={{ ...S.logDot, background: l.success ? "#16A34A" : "#DC2626" }} />
                <span style={{ flex: 1 }}>{l.success ? "Successful sign-in" : "Failed sign-in attempt"}</span>
                <span style={S.logMeta}>{l.ip || "—"}</span>
                <span style={S.logMeta}>{fmtDT(l.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Security audit" desc="Sensitive changes to your account">
        {act.audit.length === 0 ? <p style={S.note}>No security changes recorded yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {act.audit.map((a: any) => (
              <div key={a.id} style={S.logRow}>
                <span style={{ ...S.logDot, background: "#6495ED" }} />
                <span style={{ flex: 1 }}>{humanAction(a.action)}</span>
                <span style={S.logMeta}>{a.device}</span>
                <span style={S.logMeta}>{fmtDT(a.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}

function Privacy() {
  return (
    <Card title="Privacy & data" desc="What we store and your control over it">
      <div style={S.infoGrid}>
        <Info label="Face data" value="Encrypted vector only — no image stored" />
        <Info label="ID documents" value="Not retained after verification" />
        <Info label="Data export" value="Available on request via Support" />
      </div>
      <p style={{ ...S.note, marginTop: 14 }}>To permanently delete your account and all associated data, use the danger zone in settings.</p>
      <Link href="/settings" style={S.dangerBtnOutline}>Delete my account</Link>
    </Card>
  )
}

function Preferences() {
  return (
    <Card title="Preferences" desc="Notifications, appearance and regional settings">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <PrefRow icon={<IconBell size={17} />} label="Notifications" sub="Email and in-app alerts" href="/notifications" />
        <PrefRow icon={<IconGlobe size={17} />} label="Language & region" sub="Display language and locale" />
        <PrefRow icon={<IconSettings size={17} />} label="Appearance" sub="Theme and density" />
      </div>
      <p style={{ ...S.note, marginTop: 12, marginBottom: 0 }}>More granular preference controls are being expanded across the platform.</p>
    </Card>
  )
}

function Developer() {
  return (
    <Card title="Developer" desc="API access and integration tokens">
      <p style={S.note}>Manage API tokens, webhooks and integration access from the developer console.</p>
      <Link href="/developers" style={S.primaryBtn}>Open developer console</Link>
    </Card>
  )
}

function Support({ o, signOut }: any) {
  return (
    <Card title="Support & account" desc="Get help or sign out">
      <div style={S.infoGrid}>
        <Info label="Plan" value={o.identity.plan || "free"} />
        <Info label="Account status" value="Active" />
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="mailto:support@vrittih.online" style={S.ghostBtn}>Contact support</a>
        <button onClick={signOut} style={S.dangerBtnOutline}>Sign out</button>
      </div>
    </Card>
  )
}

/* ---------- atoms ---------- */
const Info = ({ label, value }: { label: string; value: string }) => (<div style={S.infoRow}><span style={S.infoLabel}>{label}</span><span style={S.infoVal}>{value}</span></div>)
const Stat = ({ n, l }: { n: number; l: string }) => (<div style={S.stat}><span style={S.statN}>{n}</span><span style={S.statL}>{l}</span></div>)
const Field = ({ label, children }: any) => (<div style={S.fg}><label style={S.flabel}>{label}</label>{children}</div>)
const StatusDot = ({ on }: { on: boolean }) => (<span style={{ ...S.statusDot, background: on ? "#16A34A" : "#CBD5E1" }} />)
const PrefRow = ({ icon, label, sub, href }: any) => {
  const inner = (<><span style={{ display: "inline-flex", color: "#6495ED" }}>{icon}</span><div style={{ flex: 1 }}><div style={S.secLabel}>{label}</div><div style={S.secSub}>{sub}</div></div>{href && <span style={S.recGo}>Open →</span>}</>)
  return href ? <Link href={href} style={S.prefRow}>{inner}</Link> : <div style={S.prefRow}>{inner}</div>
}
function humanAction(a: string) {
  const map: Record<string, string> = {
    "2fa.enabled": "Two-factor authentication enabled", "2fa.disabled": "Two-factor authentication disabled",
    "passkey.added": "Passkey added", "passkey.removed": "Passkey removed",
    "password.changed": "Password changed", "face.enrolled": "Face enrolled", "face.updated": "Face updated",
    "id.verified": "Identity verified", "session.signout": "Signed out",
  }
  return map[a] || a
}

const S: Record<string, any> = {
  wrap: { maxWidth: 1020, margin: "0 auto", padding: "6px 4px 48px" },
  grid: { display: "grid", gridTemplateColumns: "232px 1fr", gap: 22, alignItems: "start" },
  dim: { padding: 48, textAlign: "center", color: "#64748B", font: "400 14px var(--font-sans)" },
  centerCard: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "30px 26px", maxWidth: 460, margin: "24px auto", textAlign: "center" },
  h1: { font: "700 22px var(--font-sans)", color: "#1F2937", margin: 0 },
  muted: { font: "400 14px/1.6 var(--font-sans)", color: "#64748B", margin: "10px 0 18px" },
  cta: { display: "inline-block", background: "#6495ED", color: "#fff", borderRadius: 11, padding: "10px 20px", font: "600 13.5px var(--font-sans)", textDecoration: "none" },

  rail: { background: "#fff", border: "1px solid #ECEFF3", borderRadius: 16, padding: "14px 12px", position: "sticky", top: 88 },
  railHead: { display: "flex", alignItems: "center", gap: 10, padding: "4px 6px 14px", borderBottom: "1px solid #F1F5F9", marginBottom: 8 },
  railAvatar: { width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#6495ED,#334EAC)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", font: "600 14px var(--font-sans)", flex: "none" },
  railName: { font: "600 13.5px var(--font-sans)", color: "#1F2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  railType: { font: "400 11.5px var(--font-sans)", color: "#94A3B8" },
  railGroup: { font: "600 10.5px var(--font-sans)", letterSpacing: ".07em", color: "#94A3B8", padding: "10px 10px 4px" },
  railItem: { display: "flex", alignItems: "center", gap: 10, width: "100%", height: 38, padding: "0 10px", borderRadius: 9, border: "none", background: "none", color: "#475569", font: "500 13.5px var(--font-sans)", cursor: "pointer", textAlign: "left" },
  railItemOn: { background: "#EAF1FE", color: "#2F6BE0" },

  panel: { display: "flex", flexDirection: "column", gap: 16, minWidth: 0 },
  msg: { borderRadius: 10, padding: "10px 14px", font: "500 13px var(--font-sans)" },
  msgOk: { background: "#ECFDF5", border: "1px solid #A7F3D0", color: "#047857" },
  msgErr: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" },

  card: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "18px 20px", boxShadow: "0 1px 2px rgba(16,24,40,.04)" },
  cardHead: { marginBottom: 14 },
  cardTitle: { font: "600 15.5px var(--font-sans)", color: "#1F2937", margin: 0 },
  cardDesc: { font: "400 12.5px var(--font-sans)", color: "#94A3B8", marginTop: 3 },

  idHeader: { display: "flex", gap: 16, alignItems: "center", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "18px 20px" },
  idAvatar: { width: 62, height: 62, borderRadius: "50%", background: "linear-gradient(135deg,#6495ED,#334EAC)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", font: "600 22px var(--font-sans)", flex: "none", overflow: "hidden" },
  idName: { font: "700 20px var(--font-sans)", color: "#1F2937", margin: 0, letterSpacing: "-.01em" },
  idSub: { font: "400 13px var(--font-sans)", color: "#64748B", marginTop: 2 },
  typePill: { font: "600 11.5px var(--font-sans)", color: "#2F6BE0", background: "#EAF1FE", border: "1px solid #DCE8FD", borderRadius: 999, padding: "3px 11px" },
  traitPill: { font: "500 11.5px var(--font-sans)", color: "#64748B", background: "#F1F5F9", borderRadius: 999, padding: "3px 10px" },

  hgrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  ring: { width: 74, height: 74, borderRadius: "50%", display: "grid", placeItems: "center", flex: "none" },
  ringInner: { width: 56, height: 56, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 1, paddingTop: 14 },
  miss: { font: "500 11.5px var(--font-sans)", color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 999, padding: "3px 9px" },
  okText: { font: "400 12.5px var(--font-sans)", color: "#16A34A" },
  vbadge: { font: "500 12px var(--font-sans)", border: "1px solid", borderRadius: 999, padding: "3px 10px", width: "fit-content" },

  recRow: { display: "flex", alignItems: "center", gap: 10, background: "#F7F9FC", border: "1px solid #E9EDF2", borderRadius: 10, padding: "10px 12px", font: "500 13px var(--font-sans)", color: "#334155", cursor: "pointer", width: "100%" },
  recGo: { font: "600 12px var(--font-sans)", color: "#6495ED", flex: "none" },

  infoGrid: { display: "flex", flexDirection: "column" },
  infoRow: { display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid #F1F5F9" },
  infoLabel: { font: "400 13px var(--font-sans)", color: "#94A3B8" },
  infoVal: { font: "500 13px var(--font-sans)", color: "#1F2937", textAlign: "right" },

  statRow: { display: "flex", gap: 22, marginBottom: 10 },
  stat: { display: "flex", flexDirection: "column" },
  statN: { font: "700 24px var(--font-sans)", color: "#334EAC" },
  statL: { font: "400 12px var(--font-sans)", color: "#94A3B8" },

  secRow: { display: "flex", alignItems: "center", gap: 12 },
  secLabel: { font: "600 13.5px var(--font-sans)", color: "#1F2937" },
  secSub: { font: "400 12px var(--font-sans)", color: "#94A3B8", marginTop: 1 },
  statusDot: { width: 10, height: 10, borderRadius: "50%", flex: "none" },
  pkRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F7F9FC", border: "1px solid #E9EDF2", borderRadius: 10, padding: "10px 12px" },
  dangerLink: { background: "none", border: "none", font: "600 12.5px var(--font-sans)", color: "#B91C1C", cursor: "pointer" },

  sessRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  sessDevice: { font: "600 13.5px var(--font-sans)", color: "#1F2937" },
  sessMeta: { font: "400 12px var(--font-sans)", color: "#94A3B8", marginTop: 2 },
  liveDot: { font: "600 11.5px var(--font-sans)", color: "#047857", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 999, padding: "3px 10px", flex: "none" },

  logRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #F1F5F9", font: "400 13px var(--font-sans)", color: "#334155" },
  logDot: { width: 8, height: 8, borderRadius: "50%", flex: "none" },
  logMeta: { font: "400 11.5px var(--font-sans)", color: "#94A3B8", flex: "none" },

  prefRow: { display: "flex", alignItems: "center", gap: 12, background: "#F7F9FC", border: "1px solid #E9EDF2", borderRadius: 10, padding: "10px 12px", textDecoration: "none" },
  note: { font: "400 13px/1.6 var(--font-sans)", color: "#64748B", margin: "0 0 12px" },

  fg: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 },
  flabel: { font: "500 12px var(--font-sans)", color: "#64748B" },
  input: { border: "1px solid #D8DEE7", borderRadius: 9, padding: "9px 11px", font: "400 13px var(--font-sans)", color: "#1F2937", outline: "none", width: "100%", boxSizing: "border-box" },
  primaryBtn: { display: "inline-block", background: "#6495ED", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", font: "600 13px var(--font-sans)", cursor: "pointer", textDecoration: "none" },
  ghostBtn: { display: "inline-block", background: "#fff", color: "#334EAC", border: "1px solid #D8DEE7", borderRadius: 9, padding: "9px 16px", font: "600 13px var(--font-sans)", cursor: "pointer", textDecoration: "none" },
  dangerBtnOutline: { display: "inline-block", background: "#fff", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 9, padding: "9px 16px", font: "600 13px var(--font-sans)", cursor: "pointer", textDecoration: "none" },
}
