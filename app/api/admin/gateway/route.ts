import { NextRequest, NextResponse } from "next/server"

const gateways = [
  { name: "razorpay", label: "Razorpay", connected: true,  active: true,  testMode: false },
  { name: "stripe",   label: "Stripe",   connected: false, active: false, testMode: false },
  { name: "crypto",   label: "Crypto",   connected: false, active: false, testMode: false },
  { name: "manual",   label: "Manual",   connected: true,  active: false, testMode: false },
]

export async function GET() {
  return NextResponse.json({ gateways })
}

export async function POST(req: NextRequest) {
  const { action, gateway } = await req.json()
  return NextResponse.json({ success: true, action, gateway })
}
