import { NextRequest, NextResponse } from "next/server"
import { resolveTxt } from "dns/promises"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { dkimDnsRecord } from "@/lib/dkim"

export const dynamic = "force-dynamic"

// Verify domain ownership + DKIM publication by resolving real DNS TXT records.
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    const payload = token ? verifyToken(token) : null
    if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const { id } = await req.json()
    const d = await prisma.emailDomain.findUnique({ where: { id } })
    if (!d || d.userId !== payload.userId) return NextResponse.json({ error: "Domain not found" }, { status: 404 })

    const flat = async (host: string): Promise<string[]> => {
      try { return (await resolveTxt(host)).map((chunks) => chunks.join("")) } catch { return [] }
    }

    const ownershipTxt = await flat(`_vrittih.${d.domain}`)
    const ownershipOk = ownershipTxt.some((v) => v.includes(`vrittih-verify=${d.verifyToken}`))

    const dkimTxt = await flat(`${d.selector}._domainkey.${d.domain}`)
    const expectedP = `p=${d.dkimPublicKey}`
    const dkimOk = dkimTxt.some((v) => v.replace(/\s+/g, "").includes(expectedP.replace(/\s+/g, "")))

    if (ownershipOk && dkimOk) {
      await prisma.emailDomain.update({ where: { id }, data: { verified: true, verifiedAt: new Date() } })
      return NextResponse.json({ success: true, verified: true })
    }

    return NextResponse.json({
      success: false,
      verified: false,
      checks: {
        ownership: ownershipOk ? "found" : "missing",
        dkim: dkimOk ? "found" : "missing",
      },
      message: "DNS records not found yet. Changes can take up to 24 hours to propagate.",
      hint: { ownershipRecord: `vrittih-verify=${d.verifyToken}`, dkimRecord: dkimDnsRecord(d.dkimPublicKey) },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
