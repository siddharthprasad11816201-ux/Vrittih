import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

// Public: fetch a live form's definition for the fill page. No auth.
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const form = await prisma.form.findUnique({ where: { slug: params.slug } })
  if (!form || form.deletedAt || !form.isLive) {
    return NextResponse.json({ error: "This form is not available" }, { status: 404 })
  }
  return NextResponse.json({
    form: { id: form.id, name: form.name, fields: JSON.parse(form.fields), settings: JSON.parse(form.settings) },
  })
}
