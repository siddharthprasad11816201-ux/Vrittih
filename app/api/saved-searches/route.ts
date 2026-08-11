import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { normalizeQuery, normalizeFreq, describeQuery } from "@/lib/alerts"

export const dynamic = "force-dynamic"

const MAX_PER_USER = 25

function auth(req: NextRequest) {
  const token = req.cookies.get("er_token")?.value
  return token ? verifyToken(token) : null
}

// List the caller's saved searches.
export async function GET(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const rows = await (prisma as any).savedSearch.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({
    searches: rows.map((r: any) => {
      let query: any = {}
      try { query = JSON.parse(r.query) } catch { query = {} }
      return { id: r.id, name: r.name, query, alertFreq: r.alertFreq, lastRunAt: r.lastRunAt, createdAt: r.createdAt }
    }),
  })
}

// Create a saved search (optionally with an alert).
export async function POST(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const body = await req.json()
    const query = normalizeQuery(body?.query)
    const alertFreq = normalizeFreq(body?.alertFreq)
    const name = (typeof body?.name === "string" && body.name.trim() ? body.name.trim() : describeQuery(query)).slice(0, 80)

    const count = await (prisma as any).savedSearch.count({ where: { userId: payload.userId } })
    if (count >= MAX_PER_USER) {
      return NextResponse.json({ error: `You can save up to ${MAX_PER_USER} searches. Delete one first.` }, { status: 400 })
    }

    const row = await (prisma as any).savedSearch.create({
      data: {
        userId: payload.userId,
        name,
        query: JSON.stringify(query),
        alertFreq,
        // Start the diff cursor at "now" so the first alert only reports genuinely NEW jobs,
        // never the entire back catalogue.
        lastNotified: new Date(),
      },
    })
    return NextResponse.json({ id: row.id, name: row.name, query, alertFreq: row.alertFreq }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

// Update the alert frequency / name, or delete. Ownership is enforced in the WHERE clause.
export async function PATCH(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const body = await req.json()
    const id = String(body?.id || "")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    const data: any = {}
    if (body?.alertFreq !== undefined) data.alertFreq = normalizeFreq(body.alertFreq)
    if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 80)
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    const r = await (prisma as any).savedSearch.updateMany({ where: { id, userId: payload.userId }, data })
    if (!r.count) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const payload = auth(req)
  if (!payload) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const id = new URL(req.url).searchParams.get("id") || ""
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  const r = await (prisma as any).savedSearch.deleteMany({ where: { id, userId: payload.userId } })
  if (!r.count) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
