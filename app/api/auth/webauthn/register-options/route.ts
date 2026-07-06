import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { issueChallenge, rpFromRequest, RP_NAME, b64url } from "@/lib/webauthn"

export const dynamic = "force-dynamic"

// Step 1 of enrolling a fingerprint/passkey: issue creation options.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, webauthnCredentials: { select: { credentialId: true } } },
    })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    const { rpId } = rpFromRequest(req.headers.get("origin"), req.headers.get("host"))
    const challenge = await issueChallenge(`reg_${user.id}`)

    return NextResponse.json({
      success: true,
      options: {
        challenge,
        rp: { name: RP_NAME, id: rpId },
        user: {
          id: b64url.encode(Buffer.from(user.id)),
          name: user.email,
          displayName: user.name,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },   // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        excludeCredentials: user.webauthnCredentials.map((c) => ({ type: "public-key", id: c.credentialId })),
        authenticatorSelection: { userVerification: "preferred", residentKey: "preferred" },
        attestation: "none",
        timeout: 60000,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
