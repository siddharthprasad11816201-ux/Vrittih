import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/workspace"
import { enqueue } from "@/lib/jobs"
import { track } from "@/lib/analytics"

export const dynamic = "force-dynamic"

// Public: submit a form. No auth. Validates required fields, stores the
// submission, and auto-creates/links a CRM contact (spec §2.5.4).
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const form = await prisma.form.findUnique({ where: { slug: params.slug } })
    if (!form || form.deletedAt || !form.isLive) return NextResponse.json({ error: "This form is not available" }, { status: 404 })

    const fields = JSON.parse(form.fields) as any[]
    const { data } = await req.json()
    const values: Record<string, any> = data || {}

    // validate required + basic types
    for (const f of fields) {
      const v = values[f.id]
      if (f.required && (v === undefined || v === null || String(v).trim() === "")) {
        return NextResponse.json({ error: `${f.label} is required`, fieldId: f.id }, { status: 400 })
      }
      if (f.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) {
        return NextResponse.json({ error: `${f.label} must be a valid email`, fieldId: f.id }, { status: 400 })
      }
    }

    // derive contact fields from the submission
    const byType = (t: string) => { const f = fields.find((x) => x.type === t); return f ? String(values[f.id] ?? "").trim() : "" }
    const nameField = fields.find((f) => f.type === "text" && /name/i.test(f.label))
    const companyField = fields.find((f) => /company|organi[sz]ation/i.test(f.label))
    const email = byType("email").toLowerCase()
    const phone = byType("phone")
    const fullName = nameField ? String(values[nameField.id] ?? "").trim() : ""
    const [firstName, ...rest] = (fullName || "Form lead").split(" ")
    const lastName = rest.join(" ") || (fullName ? "" : "Lead")

    // link or create the contact
    let contactId: string | null = null
    if (email || fullName) {
      let contact = email
        ? await prisma.contact.findFirst({ where: { workspaceId: form.workspaceId, email, deletedAt: null } })
        : null
      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            workspaceId: form.workspaceId, createdById: form.createdById,
            firstName: firstName || "Form", lastName: lastName || "Lead",
            email: email || null, phone: phone || null,
            company: companyField ? String(values[companyField.id] ?? "").trim() || null : null,
            source: `form:${form.name}`, stage: "LEAD",
          },
        })
        await logActivity({ workspaceId: form.workspaceId, contactId: contact.id, type: "contact.created", payload: { via: "form", form: form.name } })
      }
      contactId = contact.id
      await logActivity({ workspaceId: form.workspaceId, contactId, type: "form.submitted", payload: { form: form.name } })
    }

    const ipHash = createHash("sha256").update(req.headers.get("x-forwarded-for") || "anon").digest("hex").slice(0, 32)
    await prisma.formSubmission.create({
      data: { formId: form.id, workspaceId: form.workspaceId, data: JSON.stringify(values), contactId, ipHash },
    })

    // Notify the form owner asynchronously via the in-house job queue, and record analytics.
    await enqueue("notification.create", {
      userId: form.createdById,
      title: "New form submission",
      body: `${form.name} received a new response`,
      link: `/forms/builder/${form.id}`,
    })
    await track("form.submitted", { formId: form.id, contactCreated: !!contactId })

    const settings = JSON.parse(form.settings)
    return NextResponse.json({ success: true, message: settings.successMessage || "Thank you for your submission." })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
