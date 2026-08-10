import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("er_token")?.value
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    const { company, title, location, startDate, endDate, description } = await req.json()
    // Tolerant date parsing: the résumé parser yields things like "Jan 2022", a bare
    // "2021", or "Present" for a current role. new Date("Present") is an Invalid Date
    // whose toISOString() throws (500, silently swallowed by the client). Treat
    // present/current/blank as "no end date" (null) and normalise year-only to Jan 1.
    const parseDate = (v: unknown) => {
      const s = String(v ?? "").trim()
      if (!s || /present|current|now|ongoing|to date/i.test(s)) return null
      const d = new Date(/^\d{4}$/.test(s) ? `${s}-01-01` : s)
      return isNaN(d.getTime()) ? null : d
    }
    const sd = parseDate(startDate)
    if (!sd) return NextResponse.json({ error: "Please include a valid start date." }, { status: 400 })
    const exp = await prisma.experience.create({
      data: { userId: payload.userId, company: company || "", title: title || "", location: location || "", startDate: sd, endDate: parseDate(endDate), description: description || "" },
    })
    return NextResponse.json({ experience: exp }, { status: 201 })
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
    await prisma.experience.deleteMany({ where: { id, userId: payload.userId } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}