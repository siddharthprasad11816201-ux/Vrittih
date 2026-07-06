import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { consumeChallenge, verifyRegistration, rpFromRequest } from "@/lib/webauthn"

export const dynamic = "force-dynamic"

// Step 2 of enrolling: verify the authenticator's attestation and store the credential.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const { attestationObject, clientDataJSON, name } = await req.json()
    if (!attestationObject || !clientDataJSON) {
      return NextResponse.json({ error: "attestationObject and clientDataJSON required" }, { status: 400 })
    }

    const expectedChallenge = await consumeChallenge(`reg_${payload.userId}`)
    if (!expectedChallenge) return NextResponse.json({ error: "Challenge expired — restart setup" }, { status: 400 })

    const { rpId, origin } = rpFromRequest(req.headers.get("origin"), req.headers.get("host"))
    const result = verifyRegistration({
      attestationObjectB64: attestationObject,
      clientDataJSONB64: clientDataJSON,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRpId: rpId,
    })

    const existing = await prisma.webAuthnCredential.findUnique({ where: { credentialId: result.credentialId } })
    if (existing) return NextResponse.json({ error: "This authenticator is already registered" }, { status: 409 })

    const cred = await prisma.webAuthnCredential.create({
      data: {
        userId: payload.userId,
        credentialId: result.credentialId,
        publicKey: JSON.stringify(result.publicKeyJwk),
        alg: result.publicKeyAlg,
        counter: result.counter,
        name: typeof name === "string" && name.trim() ? name.trim().slice(0, 60) : "Passkey",
      },
      select: { id: true, name: true, createdAt: true },
    })

    return NextResponse.json({ success: true, credential: cred })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
