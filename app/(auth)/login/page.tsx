"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { IconEye, IconEyeOff, IconScan, IconCheck } from "@/components/ui/Icons"
import { loginWithPasskey, webauthnSupported } from "@/lib/webauthn-client"

export default function LoginPage() {
  const router = useRouter()
  const supported = typeof window !== "undefined" && webauthnSupported()
  const [form, setForm] = useState({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [pwOpen, setPwOpen] = useState(!supported)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [ok, setOk] = useState(false)

  const succeed = (uid?: string, extra?: string) => {
    setOk(true)
    setTimeout(() => router.push(extra || "/dashboard"), 550)
  }

  async function passkeySignIn() {
    if (!form.email) { setError("Enter your email first, then use your passkey"); return }
    setPasskeyLoading(true); setError("")
    const r = await loginWithPasskey(form.email)
    setPasskeyLoading(false)
    if (r.success) succeed()
    else setError(r.error || "Passkey sign-in failed")
  }

  async function submit(e: any) {
    e.preventDefault()
    if (!pwOpen) { setPwOpen(true); return }
    setLoading(true); setError("")
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error || "Invalid credentials"); return }
    if (data.requiresFaceVerify && data.userId) { router.push(`/verify/face-login?uid=${data.userId}`); return }
    if (data.requires2FA && data.userId) {
      router.push(`/verify/2fa?uid=${data.userId}${data.method === "totp" ? "&method=totp" : ""}`); return
    }
    succeed()
  }

  return (
    <div className="va-card">
      <h1 className="va-h1">Sign in</h1>
      <p className="va-sub">Welcome back to Vrittih</p>

      {error && <div className="va-err">{error}</div>}

      <form onSubmit={submit}>
        <div className="va-fg">
          <label className="va-label">Email</label>
          <input type="email" className="va-input" value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="you@email.com" required autoFocus />
        </div>

        {supported && (
          <>
            <button type="button" onClick={passkeySignIn} disabled={passkeyLoading || ok} className="va-passkey">
              <IconScan size={17} /> {passkeyLoading ? "Waiting for your device…" : "Continue with passkey"}
            </button>
            {!pwOpen && (
              <button type="button" className="va-toggle" onClick={() => setPwOpen(true)}>
                or sign in with a password
              </button>
            )}
          </>
        )}

        <div className={"va-collapse" + (pwOpen ? " open" : "")}>
          <div>
            <div className="va-fg" style={{ marginTop: supported ? 15 : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label className="va-label">Password</label>
                <Link href="/register" className="va-forgot">Forgot password?</Link>
              </div>
              <div style={{ position: "relative" }}>
                <input type={showPass ? "text" : "password"} className="va-input" style={{ paddingRight: 44 }}
                  value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Your password" />
                <button type="button" className="va-eye" onClick={() => setShowPass(p => !p)}
                  aria-label={showPass ? "Hide password" : "Show password"}>
                  {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {(pwOpen || ok) && (
          <button type="submit" disabled={loading || ok} className={"va-btn" + (ok ? " ok" : "")} style={{ marginTop: supported ? 12 : 4 }}>
            {ok ? <IconCheck size={18} /> : loading ? "Signing in…" : "Sign in"}
          </button>
        )}
      </form>

      <p className="va-foot">No account? <Link href="/register" className="va-link">Join for 1 CHF</Link></p>
    </div>
  )
}
