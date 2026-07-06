import { prisma } from "@/lib/prisma"

/**
 * Platform settings live in the Setting key/value table and are edited from the
 * super-admin panel. Defaults are applied for any key not present in the DB so
 * the app always has a complete, well-typed settings object.
 */
export const SETTING_DEFAULTS = {
  maintenanceMode: "false",
  signupsEnabled: "true",
  joiningFee: "1",
  currency: "CHF",
  allowEmployerFreePost: "true",
} as const

export type SettingKey = keyof typeof SETTING_DEFAULTS

export type Settings = Record<SettingKey, string>

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany()
  const merged: Settings = { ...SETTING_DEFAULTS }
  for (const row of rows) {
    if (row.key in merged) merged[row.key as SettingKey] = row.value
  }
  return merged
}

export async function getSetting(key: SettingKey): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } })
  return row?.value ?? SETTING_DEFAULTS[key]
}

export async function isTrue(key: SettingKey): Promise<boolean> {
  return (await getSetting(key)) === "true"
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}
