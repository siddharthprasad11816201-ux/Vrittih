import { NextRequest, NextResponse } from "next/server"
import { resolveContext } from "@/lib/capability/context"
import { composeWorkspace } from "@/lib/workspace/composer"
import { WIDGET_SPECS, WIDGET_BY_ID } from "@/lib/workspace/widgets"
import { getMemory, setMemory } from "@/lib/memory/store"

export const dynamic = "force-dynamic"

/* Phase 1 · Module 7 — the composed workspace for the current subject. No
 * hardcoded dashboard: widgets are capability-filtered (Module 6), ordered by the
 * saved layout, and each provider returns REAL data (fail-safe per widget). */

export async function GET(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ authenticated: false, widgets: [] }, { status: 401 })

  const mem = await getMemory("user", ctx.userId, { kind: "workspace" })
  const layout = (mem.find((m) => m.key === "layout")?.value as any) || null

  const specs = composeWorkspace(WIDGET_SPECS, ctx.capabilities, layout)
  const shared: Record<string, any> = {}
  const widgets = await Promise.all(specs.map(async (s) => {
    const def = WIDGET_BY_ID.get(s.id)!
    try {
      const data = await def.provider({ subjectId: ctx.userId!, shared })
      return { id: s.id, title: s.title, description: s.description, size: s.size, group: s.group, data }
    } catch {
      return { id: s.id, title: s.title, description: s.description, size: s.size, group: s.group, data: null, unavailable: true }
    }
  }))
  return NextResponse.json({ authenticated: true, widgets })
}

export async function POST(req: NextRequest) {
  const ctx = await resolveContext(req)
  if (!ctx.userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const layout = { hidden: Array.isArray(body?.hidden) ? body.hidden.slice(0, 50).map(String) : [], order: Array.isArray(body?.order) ? body.order.slice(0, 50).map(String) : [] }
  await setMemory("user", ctx.userId, "workspace", "layout", layout, { source: "user", verified: true })
  return NextResponse.json({ ok: true, layout })
}
