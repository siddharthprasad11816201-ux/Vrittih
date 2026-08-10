import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { school, degree, field, startYear, endYear } = await req.json()
    // Robust year parsing: the résumé parser often supplies only a single year (and
    // via the client as endYear with an empty startYear). Pull a 4-digit year from
    // whatever is given rather than parseInt("") -> NaN, which Prisma rejects (a
    // required Int) with a 500 the client silently swallowed.
    const intYear = (v: unknown) => { const m = String(v ?? "").match(/\b(19|20)\d{2}\b/); return m ? parseInt(m[0], 10) : null }
    const sy = intYear(startYear), ey = intYear(endYear)
    let start = sy, end = ey
    if (start == null) { start = ey; end = null } // only one year known -> treat as start
    if (start == null) return NextResponse.json({ error: "Please include a year for this education." }, { status: 400 })
    const edu = await prisma.education.create({
      data: { userId: payload.userId, school: school || "", degree: degree || "", field: field || "", startYear: start, endYear: end },
    })
    return NextResponse.json({ education: edu }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { id } = await req.json()
    await prisma.education.deleteMany({ where: { id, userId: payload.userId } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}