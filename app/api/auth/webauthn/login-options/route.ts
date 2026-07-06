import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { issueChallenge, rpFromRequest } from "@/lib/webauthn"

export const dynamic = "force-dynamic"

// Passkey login step 1: issue an assertion challenge for the account's credentials.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      select: { id: true, banned: true, webauthnCredentials: { select: { credentialId: true } } },
    })
    if (!user || user.webauthnCredentials.length === 0) {
      return NextResponse.json({ error: "No passkeys registered for this account" }, { status: 404 })
    }
    if (user.banned) return NextResponse.json({ error: "Account suspended" }, { status: 403 })

    const { rpId } = rpFromRequest(req.headers.get("origin"), req.headers.get("host"))
    const challenge = await issueChallenge(`auth_${user.id}`)

    return NextResponse.json({
      success: true,
      userId: user.id,
      options: {
        challenge,
        rpId,
        allowCredentials: user.webauthnCredentials.map((c) => ({ type: "public-key", id: c.credentialId })),
        userVerification: "preferred",
        timeout: 60000,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
