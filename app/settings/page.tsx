"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import AppShell from "@/components/vrittih/AppShell"
import { registerPasskey, webauthnSupported } from "@/lib/webauthn-client"
import QRCode from "@/components/ui/QRCode"

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState("account")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{text:string,ok:boolean}|null>(null)
  const [form, setForm] = useState({ name:"", phone:"", location:"" })
  const [pwForm, setPwForm] = useState({ currentPassword:"", newPassword:"", confirmPassword:"" })
  const [deletePassword, setDeletePassword] = useState("")
  const [showDelete, setShowDelete] = useState(false)
  const [totpSetup, setTotpSetup] = useState<{ secretFormatted: string; uri: string } | null>(null)
  const [totpCode, setTotpCode] = useState("")
  const [passkeys, setPasskeys] = useState<any[]>([])
  const [passkeyName, setPasskeyName] = useState("")
  const [domains, setDomains] = useState<any[]>([])
  const [newDomain, setNewDomain] = useState("")

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (!d.user) { router.push("/login"); return }
      setUser(d.user)
      setForm({ name: d.user.name||"", phone: d.user.phone||"", location: d.user.location||"" })
      setLoading(false)
    })
  }, [])

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  async function saveProfile(e: any) {
    e.preventDefault(); setSaving(true)
    const res = await fetch("/api/settings", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"updateProfile", ...form }) })
    const d = await res.json()
    setSaving(false)
    if (d.success) flash("Profile updated successfully")
    else flash(d.error || "Failed", false)
  }

  async function changePassword(e: any) {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirmPassword) { flash("Passwords do not match", false); return }
    setSaving(true)
    const res = await fetch("/api/settings", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"changePassword", currentPassword:pwForm.currentPassword, newPassword:pwForm.newPassword }) })
    const d = await res.json()
    setSaving(false)
    if (d.success) { flash("Password changed successfully"); setPwForm({ currentPassword:"", newPassword:"", confirmPassword:"" }) }
    else flash(d.error || "Failed", false)
  }

  async function deleteAccount() {
    if (!deletePassword) { flash("Enter your password to confirm", false); return }
    if (!confirm("This will permanently delete your account and all data. Are you sure?")) return
    const res = await fetch("/api/settings", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"deleteAccount", password:deletePassword }) })
    const d = await res.json()
    if (d.success) { await fetch("/api/auth/logout", { method:"POST" }); router.push("/") }
    else flash(d.error || "Failed", false)
  }

  async function startTotpSetup() {
    setSaving(true)
    const d = await fetch("/api/auth/totp/setup", { method: "POST" }).then(r => r.json())
    setSaving(false)
    if (d.success) { setTotpSetup({ secretFormatted: d.secretFormatted, uri: d.uri }); setTotpCode("") }
    else flash(d.error || "Failed to start setup", false)
  }

  async function enableTotp() {
    if (totpCode.trim().length !== 6) { flash("Enter the 6-digit code from your app", false); return }
    setSaving(true)
    const d = await fetch("/api/auth/totp/enable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: totpCode.trim() }) }).then(r => r.json())
    setSaving(false)
    if (d.success) { setUser((u: any) => ({ ...u, twoFactorEnabled: true })); setTotpSetup(null); setTotpCode(""); flash("Authenticator 2FA enabled") }
    else flash(d.error || "Incorrect code", false)
  }

  async function disableTotp() {
    if (totpCode.trim().length !== 6) { flash("Enter a current code to disable", false); return }
    setSaving(true)
    const d = await fetch("/api/auth/totp/disable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: totpCode.trim() }) }).then(r => r.json())
    setSaving(false)
    if (d.success) { setUser((u: any) => ({ ...u, twoFactorEnabled: false })); setTotpCode(""); flash("Authenticator 2FA disabled") }
    else flash(d.error || "Incorrect code", false)
  }

  async function loadPasskeys() {
    const d = await fetch("/api/auth/webauthn/credentials").then(r => r.json())
    setPasskeys(d.credentials || [])
  }
  useEffect(() => { if (tab === "security") loadPasskeys() }, [tab])

  async function addPasskey() {
    setSaving(true)
    const r = await registerPasskey(passkeyName.trim() || undefined)
    setSaving(false)
    if (r.success) { setPasskeyName(""); flash("Passkey added — you can now sign in with your fingerprint or device lock"); loadPasskeys() }
    else flash(r.error || "Failed to add passkey", false)
  }

  async function removePasskey(id: string) {
    const d = await fetch("/api/auth/webauthn/credentials", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(r => r.json())
    if (d.success) { flash("Passkey removed"); loadPasskeys() }
    else flash(d.error || "Failed", false)
  }

  async function loadDomains() {
    const d = await fetch("/api/mail/domains").then(r => r.json())
    setDomains(d.domains || [])
  }
  useEffect(() => { if (tab === "domains") loadDomains() }, [tab])

  async function addDomain() {
    if (!newDomain.trim()) return
    setSaving(true)
    const d = await fetch("/api/mail/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: newDomain.trim() }) }).then(r => r.json())
    setSaving(false)
    if (d.success) { setNewDomain(""); flash("Domain added — publish the DNS records below, then verify"); loadDomains() }
    else flash(d.error || "Failed to add domain", false)
  }

  async function verifyDomain(id: string) {
    setSaving(true)
    const d = await fetch("/api/mail/domains/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(r => r.json())
    setSaving(false)
    if (d.verified) { flash("Domain verified — you can now send DKIM-signed mail from it"); loadDomains() }
    else flash(d.message || `Not verified yet (ownership: ${d.checks?.ownership}, DKIM: ${d.checks?.dkim})`, false)
  }

  async function removeDomain(id: string) {
    const d = await fetch("/api/mail/domains", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).then(r => r.json())
    if (d.success) { flash("Domain removed"); loadDomains() }
    else flash(d.error || "Failed", false)
  }

  if (loading) return <AppShell><div style={S.loading}>Loading...</div></AppShell>

  const isEmployer = user && ["EMPLOYER", "ADMIN", "SUPER_ADMIN"].includes(user.role)
  const TABS: [string, string][] = [
    ["account","Account"], ["password","Password"], ["security","Security"],
    ...(isEmployer ? [["domains","Email domains"] as [string, string]] : []),
    ["privacy","Privacy & Data"], ["billing","Billing"],
  ]

  return (
    <AppShell>
      <div style={S.page}>
        <aside style={S.sidebar}>
          <h2 style={S.sideTitle}>Settings</h2>
          {TABS.map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)} style={{...S.tabBtn,...(tab===key?S.tabBtnOn:{})}}>
              {label}
            </button>
          ))}
        </aside>

        <main style={S.main}>
          {msg && <div style={{...S.msg,...(msg.ok?S.msgOk:S.msgErr)}}>{msg.text}</div>}

          {tab === "account" && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Account information</h3>
              <div style={S.infoGrid}>
                <div style={S.infoRow}><span style={S.infoLabel}>Email</span><span style={S.infoVal}>{user.email}</span></div>
                <div style={S.infoRow}><span style={S.infoLabel}>Role</span><span style={{...S.pill,background:"#EEEDF9",color:"#534AB7"}}>{user.role}</span></div>
                <div style={S.infoRow}><span style={S.infoLabel}>Paid</span><span style={{...S.pill,background:user.paid?"#ECFDF5":"#FEF2F2",color:user.paid?"#047857":"#B91C1C"}}>{user.paid?"Active":"Pending"}</span></div>
                <div style={S.infoRow}><span style={S.infoLabel}>ID Verified</span><span style={{...S.pill,background:user.idVerified?"#ECFDF5":"#F3F4F6",color:user.idVerified?"#047857":"#6b7280"}}>{user.idVerified?"Verified":"Not verified"}</span></div>
                <div style={S.infoRow}><span style={S.infoLabel}>Member since</span><span style={S.infoVal}>{new Date(user.createdAt).toLocaleDateString("en-IN",{year:"numeric",month:"long",day:"numeric"})}</span></div>
              </div>
              <div style={S.divider} />
              <h4 style={S.subTitle}>Edit details</h4>
              <form onSubmit={saveProfile}>
                <div style={S.row}>
                  <div style={S.fg}><label style={S.label}>Full name</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={S.input} /></div>
                  <div style={S.fg}><label style={S.label}>Phone</label><input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} style={S.input} /></div>
                </div>
                <div style={S.fg}><label style={S.label}>Location</label><input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} style={S.input} /></div>
                <button type="submit" style={S.saveBtn} disabled={saving}>{saving?"Saving...":"Save changes"}</button>
              </form>
            </div>
          )}

          {tab === "password" && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Change password</h3>
              <p style={S.hint}>Use a strong password with uppercase, numbers, and symbols.</p>
              <form onSubmit={changePassword}>
                <div style={S.fg}><label style={S.label}>Current password</label><input type="password" value={pwForm.currentPassword} onChange={e=>setPwForm(p=>({...p,currentPassword:e.target.value}))} style={S.input} placeholder="Enter current password" /></div>
                <div style={S.fg}><label style={S.label}>New password</label><input type="password" value={pwForm.newPassword} onChange={e=>setPwForm(p=>({...p,newPassword:e.target.value}))} style={S.input} placeholder="Min 8 characters" /></div>
                <div style={S.fg}><label style={S.label}>Confirm new password</label><input type="password" value={pwForm.confirmPassword} onChange={e=>setPwForm(p=>({...p,confirmPassword:e.target.value}))} style={S.input} placeholder="Repeat new password" /></div>
                <button type="submit" style={S.saveBtn} disabled={saving}>{saving?"Changing...":"Change password"}</button>
              </form>
            </div>
          )}

          {tab === "security" && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Two-factor authentication</h3>
              <p style={S.hint}>
                Protect your account with 6-digit codes from an authenticator app (Google Authenticator, Duo,
                Microsoft Authenticator, Aegis — any standard app works). Built entirely in-house — no third-party service ever sees your codes.
              </p>

              {user.twoFactorEnabled ? (
                <div>
                  <div style={{...S.msg,...S.msgOk,marginBottom:14}}>Authenticator 2FA is enabled on your account.</div>
                  <div style={S.fg}>
                    <label style={S.label}>Enter a current code to disable</label>
                    <input value={totpCode} onChange={e=>setTotpCode(e.target.value.replace(/\D/g,"").slice(0,6))} style={S.input} placeholder="123456" inputMode="numeric" />
                  </div>
                  <button onClick={disableTotp} disabled={saving} style={S.dangerBtn}>{saving?"Working...":"Disable authenticator 2FA"}</button>
                </div>
              ) : totpSetup ? (
                <div>
                  <div style={{background:"#F9F9FC",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:12,padding:"1.25rem",marginBottom:14}}>
                    <p style={{fontSize:13,fontWeight:600,color:"#0A0A0F",marginBottom:12}}>1. Scan this QR code with your authenticator app</p>
                    <div style={{display:"flex",justifyContent:"center",marginBottom:14}}>
                      <div style={{padding:10,background:"#fff",border:"0.5px solid rgba(0,0,0,.1)",borderRadius:12}}>
                        <QRCode value={totpSetup.uri} size={200} />
                      </div>
                    </div>
                    <p style={{fontSize:12.5,color:"#6b7280",marginBottom:6}}>Can&apos;t scan? Enter this setup key manually (time-based, account: your email):</p>
                    <div style={{fontFamily:"monospace",fontSize:16,letterSpacing:1,background:"#fff",border:"0.5px solid rgba(0,0,0,.1)",borderRadius:8,padding:"12px 14px",color:"#534AB7",fontWeight:700,wordBreak:"break-all" as const}}>
                      {totpSetup.secretFormatted}
                    </div>
                  </div>
                  <div style={S.fg}>
                    <label style={S.label}>2. Enter the 6-digit code your app shows</label>
                    <input value={totpCode} onChange={e=>setTotpCode(e.target.value.replace(/\D/g,"").slice(0,6))} style={S.input} placeholder="123456" inputMode="numeric" autoFocus />
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={enableTotp} disabled={saving} style={S.saveBtn}>{saving?"Verifying...":"Verify & enable"}</button>
                    <button onClick={()=>{setTotpSetup(null);setTotpCode("")}} style={S.cancelBtn}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={startTotpSetup} disabled={saving} style={S.saveBtn}>{saving?"Preparing...":"Set up authenticator app"}</button>
              )}

              <div style={S.divider} />
              <h4 style={S.subTitle}>Fingerprint & passkeys</h4>
              <p style={S.hint}>
                Sign in with your fingerprint, face unlock, or device PIN (Windows Hello, Touch ID, Android).
                Uses the device&apos;s own secure hardware — verified by our in-house engine, no third-party service.
              </p>
              {!webauthnSupported() ? (
                <p style={{fontSize:13,color:"#9ca3af"}}>Your browser does not support passkeys.</p>
              ) : (
                <>
                  {passkeys.length > 0 && (
                    <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
                      {passkeys.map(pk => (
                        <div key={pk.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#F9F9FC",border:"0.5px solid rgba(0,0,0,.07)",borderRadius:10,padding:"10px 14px"}}>
                          <div>
                            <div style={{fontSize:13.5,fontWeight:600,color:"#0A0A0F"}}>{pk.name || "Passkey"}</div>
                            <div style={{fontSize:11.5,color:"#9ca3af"}}>
                              Added {new Date(pk.createdAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
                              {pk.lastUsedAt ? ` · Last used ${new Date(pk.lastUsedAt).toLocaleDateString("en-GB",{day:"numeric",month:"short"})}` : ""}
                            </div>
                          </div>
                          <button onClick={()=>removePasskey(pk.id)} style={{background:"none",border:"none",fontSize:12.5,color:"#B91C1C",cursor:"pointer",fontWeight:600}}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <input value={passkeyName} onChange={e=>setPasskeyName(e.target.value)} style={{...S.input,maxWidth:240,marginBottom:0}} placeholder="Name (e.g. Windows Hello)" />
                    <button onClick={addPasskey} disabled={saving} style={S.saveBtn}>{saving?"Waiting for device...":"Add fingerprint / passkey"}</button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "domains" && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Email sending domains</h3>
              <p style={S.hint}>
                Send mail from your own domain (e.g. hr@your-company.com). We generate a DKIM key in-house and
                sign every message so receivers can verify it&apos;s authentically from you. Add a domain, publish the
                DNS records, then verify.
              </p>

              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:18}}>
                <input value={newDomain} onChange={e=>setNewDomain(e.target.value)} style={{...S.input,maxWidth:280,marginBottom:0}} placeholder="acme-corp.com" />
                <button onClick={addDomain} disabled={saving} style={S.saveBtn}>{saving?"Adding...":"Add domain"}</button>
              </div>

              {domains.length === 0 && <p style={{fontSize:13,color:"#9ca3af"}}>No domains added yet.</p>}

              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {domains.map(d => (
                  <div key={d.id} style={{border:"0.5px solid rgba(0,0,0,.1)",borderRadius:12,padding:"1.1rem 1.25rem"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:15,fontWeight:700,color:"#0A0A0F"}}>{d.domain}</span>
                        <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:999,background:d.verified?"#ECFDF5":"#FFFBEB",color:d.verified?"#047857":"#B45309"}}>
                          {d.verified ? "Verified" : "Pending verification"}
                        </span>
                      </div>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        {!d.verified && <button onClick={()=>verifyDomain(d.id)} disabled={saving} style={{...S.saveBtn,padding:"7px 14px"}}>{saving?"Checking DNS...":"Verify"}</button>}
                        <button onClick={()=>removeDomain(d.id)} style={{background:"none",border:"none",color:"#B91C1C",fontSize:12.5,fontWeight:600,cursor:"pointer"}}>Remove</button>
                      </div>
                    </div>

                    {!d.verified && (
                      <div style={{marginTop:14}}>
                        <p style={{fontSize:12.5,color:"#6b7280",marginBottom:8}}>Add these DNS TXT records at your domain registrar:</p>
                        <div style={{overflowX:"auto"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead>
                              <tr style={{textAlign:"left",color:"#9ca3af"}}>
                                <th style={{padding:"6px 8px",fontWeight:600}}>Type</th>
                                <th style={{padding:"6px 8px",fontWeight:600}}>Host</th>
                                <th style={{padding:"6px 8px",fontWeight:600}}>Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {d.records.map((rec: any, i: number) => (
                                <tr key={i} style={{borderTop:"0.5px solid rgba(0,0,0,.06)",verticalAlign:"top"}}>
                                  <td style={{padding:"8px",fontFamily:"monospace",color:"#0A0A0F"}}>{rec.type}</td>
                                  <td style={{padding:"8px",fontFamily:"monospace",color:"#0A0A0F",wordBreak:"break-all"}}>{rec.host}</td>
                                  <td style={{padding:"8px",fontFamily:"monospace",color:"#443AA3",wordBreak:"break-all",maxWidth:340}}>{rec.value}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p style={{fontSize:11.5,color:"#9ca3af",marginTop:8}}>DNS changes can take up to 24 hours. Click Verify once published.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "privacy" && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Privacy & Data</h3>
              <div style={S.infoGrid}>
                <div style={S.infoRow}><span style={S.infoLabel}>Face vector</span><span style={S.infoVal}>Encrypted — not stored as image</span></div>
                <div style={S.infoRow}><span style={S.infoLabel}>Documents</span><span style={S.infoVal}>No raw documents stored</span></div>
                <div style={S.infoRow}><span style={S.infoLabel}>Data export</span><span style={S.infoVal}>Contact support</span></div>
              </div>
              <div style={S.divider} />
              <h4 style={{...S.subTitle,color:"#B91C1C"}}>Danger zone</h4>
              <p style={S.hint}>Deleting your account is permanent and cannot be undone.</p>
              {!showDelete ? (
                <button onClick={() => setShowDelete(true)} style={S.dangerBtn}>Delete my account</button>
              ) : (
                <div style={S.deleteBox}>
                  <p style={{fontSize:13,color:"#B91C1C",marginBottom:10}}>Enter your password to confirm account deletion:</p>
                  <input type="password" value={deletePassword} onChange={e=>setDeletePassword(e.target.value)} style={S.input} placeholder="Your password" />
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={deleteAccount} style={S.dangerBtn}>Confirm delete</button>
                    <button onClick={() => setShowDelete(false)} style={S.cancelBtn}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "billing" && (
            <div style={S.card}>
              <h3 style={S.cardTitle}>Billing</h3>
              <div style={S.billingCard}>
                <div style={S.billingTop}>
                  <div style={S.billingPlan}>{user.paid ? "Active" : "Unpaid"}</div>
                  <div style={S.billingPrice}>1 CHF <span style={{fontSize:14,fontWeight:400,color:"rgba(255,255,255,.6)"}}>one-time</span></div>
                </div>
                <div style={S.billingFeatures}>
                  {["Full platform access","All job applications","Video interviews","Real-time chat","Community channels","Lifetime — no renewal"].map(f => (
                    <div key={f} style={S.billingFeature}>✓ {f}</div>
                  ))}
                </div>
              </div>
              {!user.paid && (
                <a href="/pay" style={S.payBtn}>Complete payment — 1 CHF</a>
              )}
              {user.paid && (
                <div style={{...S.msg,...S.msgOk,marginTop:"1rem"}}>Your account is active. No further payments required.</div>
              )}
            </div>
          )}
        </main>
      </div>
    </AppShell>
  )
}

const S: Record<string,any> = {
  page:{ display:"grid",gridTemplateColumns:"200px 1fr",gap:"1.5rem",padding:"1.5rem 2rem",maxWidth:900,margin:"0 auto" },
  loading:{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh",fontSize:14,color:"#9ca3af" },
  sidebar:{ height:"fit-content",position:"sticky" as const,top:72 },
  sideTitle:{ fontSize:16,fontWeight:600,color:"#0A0A0F",marginBottom:12,paddingBottom:10,borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  tabBtn:{ display:"block",width:"100%",background:"none",border:"none",padding:"9px 12px",borderRadius:8,fontSize:13,color:"#7B7B8F",textAlign:"left" as const,cursor:"pointer",marginBottom:2 },
  tabBtnOn:{ background:"#EEEDF9",color:"#534AB7",fontWeight:500 },
  main:{ display:"flex",flexDirection:"column" as const,gap:12 },
  msg:{ borderRadius:8,padding:"10px 14px",fontSize:13 },
  msgOk:{ background:"#ECFDF5",border:"0.5px solid #A7F3D0",color:"#047857" },
  msgErr:{ background:"#FEF2F2",border:"0.5px solid #FECACA",color:"#B91C1C" },
  card:{ background:"#fff",border:"0.5px solid rgba(0,0,0,.08)",borderRadius:14,padding:"1.5rem" },
  cardTitle:{ fontSize:16,fontWeight:600,color:"#0A0A0F",marginBottom:14,paddingBottom:10,borderBottom:"0.5px solid rgba(0,0,0,.07)" },
  subTitle:{ fontSize:14,fontWeight:600,color:"#0A0A0F",margin:"0 0 12px" },
  hint:{ fontSize:13,color:"#9ca3af",marginBottom:14 },
  infoGrid:{ display:"flex",flexDirection:"column" as const,gap:2 },
  infoRow:{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"0.5px solid rgba(0,0,0,.04)" },
  infoLabel:{ fontSize:13,color:"#9ca3af" },
  infoVal:{ fontSize:13,color:"#0A0A0F",fontWeight:500 },
  pill:{ fontSize:11,fontWeight:500,padding:"2px 10px",borderRadius:999 },
  divider:{ height:"0.5px",background:"rgba(0,0,0,.06)",margin:"1.25rem 0" },
  row:{ display:"flex",gap:12,marginBottom:12 },
  fg:{ flex:1,display:"flex",flexDirection:"column" as const,gap:5,marginBottom:12 },
  label:{ fontSize:12,fontWeight:500,color:"#7B7B8F" },
  input:{ border:"0.5px solid rgba(0,0,0,.13)",borderRadius:8,padding:"8px 11px",fontSize:13,color:"#0A0A0F",outline:"none",fontFamily:"inherit" },
  saveBtn:{ background:"#534AB7",color:"#fff",border:"none",borderRadius:8,padding:"9px 20px",fontSize:13,fontWeight:500,cursor:"pointer" },
  dangerBtn:{ background:"none",border:"0.5px solid rgba(220,38,38,.3)",color:"#DC2626",borderRadius:8,padding:"9px 18px",fontSize:13,cursor:"pointer" },
  cancelBtn:{ background:"none",border:"0.5px solid rgba(0,0,0,.1)",color:"#6b7280",borderRadius:8,padding:"9px 18px",fontSize:13,cursor:"pointer" },
  deleteBox:{ background:"#FEF2F2",border:"0.5px solid #FECACA",borderRadius:10,padding:"1rem" },
  billingCard:{ background:"linear-gradient(135deg,#0F0A1E,#1E1040)",borderRadius:14,padding:"1.5rem",marginBottom:"1rem" },
  billingTop:{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem" },
  billingPlan:{ fontSize:12,fontWeight:600,color:"rgba(255,255,255,.5)",textTransform:"uppercase" as const,letterSpacing:".08em" },
  billingPrice:{ fontSize:28,fontWeight:700,color:"#fff",letterSpacing:"-1px" },
  billingFeatures:{ display:"flex",flexDirection:"column" as const,gap:6 },
  billingFeature:{ fontSize:13,color:"rgba(255,255,255,.6)" },
  payBtn:{ display:"inline-block",background:"#534AB7",color:"#fff",padding:"10px 22px",borderRadius:9,fontSize:14,fontWeight:500,textDecoration:"none" },
}