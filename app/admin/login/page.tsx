"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { IconEye, IconEyeOff, IconShield, IconCheck } from "@/components/ui/Icons"

/* Dedicated admin sign-in. Uses the same /api/auth/login (so 2FA/face are
 * honoured), then confirms the account actually holds an admin role before
 * entering the panel — a non-admin gets a clear message instead of a locked
 * screen. Signing in here overwrites any existing (e.g. jobseeker) session. */

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"]

export default function AdminLoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [ok, setOk] = useState(false)
  const [current, setCurrent] = useState<{ name?: string; role?: string } | null>(null)

  // If already signed in: as admin → straight into the panel; otherwise show who.
  useEffect(() => {
    fetch("/api/auth/me").then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.user) {
        if (ADMIN_ROLES.includes(d.user.role)) router.replace("/admin")
        else setCurrent({ name: d.user.name, role: d.user.role })
      }
    }).catch(() => {})
  }, [router])

  async function submit(e: any) {
    e.preventDefault()
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Invalid credentials"); setLoading(false); return }
      // Second factors: hand off to the shared flows, returning to /admin after.
      if (data.requiresFaceVerify && data.userId) { router.push(`/verify/face-login?uid=${data.userId}&next=/admin`); return }
      if (data.requires2FA && data.userId) { router.push(`/verify/2fa?uid=${data.userId}&next=/admin${data.method === "totp" ? "&method=totp" : ""}`); return }

      // Confirm the signed-in account is actually an admin before entering.
      const me = await fetch("/api/auth/me").then(r => (r.ok ? r.json() : null)).catch(() => null)
      const role = me?.user?.role
      if (!ADMIN_ROLES.includes(role)) {
        setError(`This account isn't an admin (role: ${role || "unknown"}). Use an admin account.`)
        setLoading(false); return
      }
      setOk(true)
      setTimeout(() => router.push("/admin"), 500)
    } catch {
      setError("Network error. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="al-wrap">
      <div className="al-card">
        <div className="al-mark"><IconShield size={22} /></div>
        <h1 className="al-h1">Admin sign in</h1>
        <p className="al-sub">Vrittih control panel</p>

        {current && (
          <div className="al-note">You're currently signed in as <b>{current.name || "a user"}</b> ({current.role}). Signing in below will switch to that admin account.</div>
        )}
        {error && <div className="al-err">{error}</div>}

        <form onSubmit={submit}>
          <div className="al-fg">
            <label className="al-label">Email</label>
            <input type="email" className="al-input" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="admin@vrittih.online" required autoFocus />
          </div>
          <div className="al-fg">
            <label className="al-label">Password</label>
            <div style={{ position: "relative" }}>
              <input type={showPass ? "text" : "password"} className="al-input" style={{ paddingRight: 44 }}
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Your password" required />
              <button type="button" className="al-eye" onClick={() => setShowPass(p => !p)} aria-label={showPass ? "Hide password" : "Show password"}>
                {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading || ok} className={"al-btn" + (ok ? " ok" : "")}>
            {ok ? <IconCheck size={18} /> : loading ? "Signing in…" : "Sign in to admin"}
          </button>
        </form>

        <p className="al-foot"><Link href="/" className="al-link">← Back to platform</Link></p>
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  )
}

const CSS = `
.al-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
  background:radial-gradient(900px 500px at 50% -10%, rgba(100,149,237,.18), transparent 60%), #0B1126;
  font-family:var(--font-sans),Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.al-card{width:100%;max-width:400px;background:#fff;border-radius:20px;padding:34px 30px;box-shadow:0 24px 60px -20px rgba(0,0,0,.5)}
.al-mark{width:48px;height:48px;border-radius:13px;background:linear-gradient(135deg,#6495ED,#334EAC);color:#fff;display:grid;place-items:center;margin:0 auto 14px}
.al-h1{font-size:22px;font-weight:600;color:#0B1126;text-align:center;margin:0;letter-spacing:-.02em}
.al-sub{font-size:13.5px;color:#94A3B8;text-align:center;margin:4px 0 20px}
.al-note{font-size:12.5px;line-height:1.55;color:#475569;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:11px;padding:10px 13px;margin-bottom:14px}
.al-err{font-size:13px;color:#B42318;background:#FEF3F2;border:1px solid #FECACA;border-radius:11px;padding:10px 13px;margin-bottom:14px}
.al-fg{margin-bottom:14px}
.al-label{display:block;font-size:12.5px;font-weight:500;color:#475569;margin-bottom:6px}
.al-input{width:100%;box-sizing:border-box;border:1px solid #D8DEE7;border-radius:11px;padding:11px 14px;font-size:14px;color:#0B1126;outline:none}
.al-input:focus{border-color:#6495ED}
.al-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#94A3B8;cursor:pointer;padding:4px}
.al-btn{width:100%;margin-top:6px;background:#6495ED;color:#fff;border:none;border-radius:12px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
.al-btn:hover{background:#4d7fe0}
.al-btn:disabled{opacity:.6;cursor:not-allowed}
.al-btn.ok{background:#16A34A}
.al-foot{text-align:center;margin:18px 0 0;font-size:13px}
.al-link{color:#6495ED;text-decoration:none;font-weight:500}
`
