"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { IconEye, IconEyeOff, IconBriefcase, IconUsers } from "@/components/ui/Icons"

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "JOBSEEKER" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPass, setShowPass] = useState(false)

  const rules = [
    { ok: form.password.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Z]/.test(form.password), label: "One uppercase letter" },
    { ok: /[0-9]/.test(form.password), label: "One number" },
    { ok: /[^A-Za-z0-9]/.test(form.password), label: "One special character" },
  ]

  async function submit(e: any) {
    e.preventDefault()
    const failed = rules.find(r => !r.ok)
    if (failed) { setError(failed.label + " is required in your password"); return }
    setLoading(true); setError("")
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      const issues = data.issues as Record<string, string[]> | undefined
      const first = issues && Object.values(issues).flat()[0]
      setError(first || data.error || "Registration failed")
      return
    }
    router.push("/pay")
  }

  const roles: [string, string, string, any][] = [
    ["JOBSEEKER", "Job seeker", "Looking for work", <IconUsers key="a" size={17} />],
    ["EMPLOYER", "Employer", "Hiring talent", <IconBriefcase key="b" size={17} />],
  ]

  return (
    <div className="va-card">
      <h1 className="va-h1">Create your account</h1>
      <p className="va-sub">Join Vrittih for a one-time fee of 1 CHF</p>

      {error && <div className="va-err">{error}</div>}

      <form onSubmit={submit}>
        <div className="va-fg">
          <label className="va-label">Full name</label>
          <input className="va-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Your full name" required autoFocus />
        </div>
        <div className="va-fg">
          <label className="va-label">Email</label>
          <input type="email" className="va-input" value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@email.com" required />
        </div>
        <div className="va-fg">
          <label className="va-label">Password</label>
          <div style={{ position: "relative" }}>
            <input type={showPass ? "text" : "password"} className="va-input" style={{ paddingRight: 44 }}
              value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="Create a strong password" required />
            <button type="button" className="va-eye" onClick={() => setShowPass(p => !p)}
              aria-label={showPass ? "Hide password" : "Show password"}>
              {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>
          {form.password.length > 0 && (
            <div style={SR.rules}>
              {rules.map(r => (
                <span key={r.label} style={{ ...SR.rule, color: r.ok ? "var(--v-green)" : "var(--v-ink-3)" }}>
                  <span style={{ ...SR.dot, background: r.ok ? "var(--v-green)" : "transparent", borderColor: r.ok ? "var(--v-green)" : "var(--v-line-2)" }} />
                  {r.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="va-fg">
          <label className="va-label">I am a</label>
          <div style={SR.roleRow}>
            {roles.map(([val, label, desc, icon]) => {
              const on = form.role === val
              return (
                <button key={val} type="button" onClick={() => setForm(p => ({ ...p, role: val }))}
                  style={{ ...SR.role, ...(on ? SR.roleOn : {}) }}>
                  <span style={{ ...SR.roleIc, ...(on ? SR.roleIcOn : {}) }}>{icon}</span>
                  <span style={SR.roleLabel}>{label}</span>
                  <span style={SR.roleDesc}>{desc}</span>
                </button>
              )
            })}
          </div>
        </div>
        <button type="submit" disabled={loading} className="va-btn">{loading ? "Creating account…" : "Continue to payment"}</button>
      </form>

      <p className="va-foot">Already have an account? <Link href="/login" className="va-link">Sign in</Link></p>
    </div>
  )
}

const SR: Record<string, any> = {
  rules: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginTop: 10 },
  rule: { display: "flex", alignItems: "center", gap: 7, fontSize: 12, transition: "color .15s" },
  dot: { width: 11, height: 11, borderRadius: "50%", border: "1.5px solid var(--v-line-2)", flexShrink: 0, transition: "all .15s" },
  roleRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  role: { display: "flex", flexDirection: "column" as const, alignItems: "flex-start", gap: 4, background: "var(--v-surface)", border: "1.5px solid var(--v-line-2)", borderRadius: 12, padding: "13px 14px", cursor: "pointer", textAlign: "left" as const, transition: "all .15s" },
  roleOn: { borderColor: "var(--v-accent)", background: "var(--v-accent-soft)" },
  roleIc: { width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--v-surface-2)", color: "var(--v-ink-2)", marginBottom: 4, transition: "all .15s" },
  roleIcOn: { background: "var(--v-accent)", color: "#fff" },
  roleLabel: { fontSize: 13.5, fontWeight: 600, color: "var(--v-ink)" },
  roleDesc: { fontSize: 11.5, color: "var(--v-ink-3)" },
}
