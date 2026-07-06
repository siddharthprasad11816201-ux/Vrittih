import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { consumeChallenge, verifyAssertion, rpFromRequest } from "@/lib/webauthn"
import { signToken } from "@/lib/jwt"
import { setAuthCookie } from "@/lib/cookies"

export const dynamic = "force-dynamic"

// Passkey login step 2: verify the assertion signature and issue a session.
export async function POST(req: NextRequest) {
  try {
    const { userId, credentialId, authenticatorData, clientDataJSON, signature } = await req.json()
    if (!userId || !credentialId || !authenticatorData || !clientDataJSON || !signature) {
      return NextResponse.json({ error: "Missing assertion fields" }, { status: 400 })
    }

    const expectedChallenge = await consumeChallenge(`auth_${userId}`)
    if (!expectedChallenge) return NextResponse.json({ error: "Challenge expired — try again" }, { status: 400 })

    const cred = await prisma.webAuthnCredential.findUnique({ where: { credentialId } })
    if (!cred || cred.userId !== userId) {
      return NextResponse.json({ error: "Unknown credential" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, paid: true, banned: true },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (user.banned) return NextResponse.json({ error: "Account suspended" }, { status: 403 })

    const { rpId, origin } = rpFromRequest(req.headers.get("origin"), req.headers.get("host"))
    const { counter } = verifyAssertion({
      authenticatorDataB64: authenticatorData,
      clientDataJSONB64: clientDataJSON,
      signatureB64: signature,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRpId: rpId,
      publicKeyJwk: JSON.parse(cred.publicKey),
      publicKeyAlg: cred.alg,
      storedCounter: cred.counter,
    })

    await prisma.webAuthnCredential.update({
      where: { id: cred.id },
      data: { counter, lastUsedAt: new Date() },
    })

    const token = signToken({ userId: user.id, email: user.email, role: user.role, paid: user.paid })
    const res = NextResponse.json({ success: true, user: { id: user.id, name: user.name, role: user.role, paid: user.paid } })
    await setAuthCookie(token)
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}
