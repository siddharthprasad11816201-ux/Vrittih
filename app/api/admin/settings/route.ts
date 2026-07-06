import { NextRequest, NextResponse } from "next/server"
import { requireAdmin, requireSuperAdmin, logAction } from "@/lib/admin"
import { getSettings, setSetting, SETTING_DEFAULTS, type SettingKey } from "@/lib/settings"

export async function GET(req: NextRequest) {
  try {
    const admin = requireAdmin(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    return NextResponse.json({ settings: await getSettings() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = requireSuperAdmin(req)
    if (!admin) return NextResponse.json({ error: "Super-admin privileges required" }, { status: 403 })
    const body = await req.json()
    // Accept either { key, value } or { settings: { key: value, ... } }
    const updates: Record<string, unknown> = body.settings ?? (body.key ? { [body.key]: body.value } : {})
    const known = Object.keys(SETTING_DEFAULTS)
    const applied: string[] = []
    for (const [key, value] of Object.entries(updates)) {
      if (!known.includes(key)) continue
      await setSetting(key as SettingKey, String(value))
      applied.push(key)
    }
    await logAction(admin.userId, "settings.update", { keys: applied }, req)
    return NextResponse.json({ success: true, settings: await getSettings() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
