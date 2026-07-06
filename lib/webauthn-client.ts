/**
 * Browser-side WebAuthn helpers — wraps the native navigator.credentials API.
 * No third-party libraries; pairs with the in-house server verification.
 */

const bufToB64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

const b64urlToBuf = (str: string): ArrayBuffer => {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}

export function webauthnSupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential
}

/** Enroll a new fingerprint/passkey for the signed-in user. */
export async function registerPasskey(name?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const optRes = await fetch("/api/auth/webauthn/register-options", { method: "POST" })
    const optData = await optRes.json()
    if (!optData.success) return { success: false, error: optData.error || "Could not start setup" }

    const o = optData.options
    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge: b64urlToBuf(o.challenge),
      rp: o.rp,
      user: {
        id: b64urlToBuf(o.user.id),
        name: o.user.name,
        displayName: o.user.displayName,
      },
      pubKeyCredParams: o.pubKeyCredParams,
      excludeCredentials: (o.excludeCredentials || []).map((c: any) => ({ type: "public-key", id: b64urlToBuf(c.id) })),
      authenticatorSelection: o.authenticatorSelection,
      attestation: o.attestation,
      timeout: o.timeout,
    }

    const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null
    if (!cred) return { success: false, error: "No credential created" }
    const att = cred.response as AuthenticatorAttestationResponse

    const verifyRes = await fetch("/api/auth/webauthn/register-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attestationObject: bufToB64url(att.attestationObject),
        clientDataJSON: bufToB64url(att.clientDataJSON),
        name,
      }),
    })
    const verifyData = await verifyRes.json()
    if (!verifyData.success) return { success: false, error: verifyData.error || "Verification failed" }
    return { success: true }
  } catch (err: any) {
    if (err?.name === "NotAllowedError") return { success: false, error: "Cancelled or not allowed" }
    return { success: false, error: err?.message || "Passkey setup failed" }
  }
}

/** Sign in with a fingerprint/passkey for the given account email. */
export async function loginWithPasskey(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const optRes = await fetch("/api/auth/webauthn/login-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    const optData = await optRes.json()
    if (!optData.success) return { success: false, error: optData.error || "No passkeys for this account" }

    const o = optData.options
    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge: b64urlToBuf(o.challenge),
      rpId: o.rpId,
      allowCredentials: (o.allowCredentials || []).map((c: any) => ({ type: "public-key", id: b64urlToBuf(c.id) })),
      userVerification: o.userVerification,
      timeout: o.timeout,
    }

    const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null
    if (!cred) return { success: false, error: "No credential returned" }
    const assertion = cred.response as AuthenticatorAssertionResponse

    const verifyRes = await fetch("/api/auth/webauthn/login-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: optData.userId,
        credentialId: cred.id,
        authenticatorData: bufToB64url(assertion.authenticatorData),
        clientDataJSON: bufToB64url(assertion.clientDataJSON),
        signature: bufToB64url(assertion.signature),
      }),
    })
    const verifyData = await verifyRes.json()
    if (!verifyData.success) return { success: false, error: verifyData.error || "Verification failed" }
    return { success: true }
  } catch (err: any) {
    if (err?.name === "NotAllowedError") return { success: false, error: "Cancelled or timed out" }
    return { success: false, error: err?.message || "Passkey sign-in failed" }
  }
}
