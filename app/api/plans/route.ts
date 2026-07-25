import { NextResponse } from "next/server"
import { getPricing } from "@/lib/pricing"

export const dynamic = "force-dynamic"

// Public: the live plan catalogue with any admin price overrides applied.
// /pricing and /pay read this rather than importing the code defaults, so a
// price change in the admin panel takes effect everywhere at once.
export async function GET() {
  const { plans, addons } = await getPricing()
  return NextResponse.json({ plans, addons })
}
