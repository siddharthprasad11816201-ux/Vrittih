import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthority, viewerCapabilities, diffRecords, auditAdmin } from "@/lib/admin/authority"
import { quoteFor, termsFor, guaranteeState, billableAmount, HIRE_STATUSES, BASE_PRICE_CHF } from "@/lib/hire/guarantee"

export const dynamic = "force-dynamic"

/**
 * Operations console for Guaranteed Hire engagements.
 *
 * These are commercial commitments with a fill-or-free promise attached, so every field
 * that affects money or the deadline is admin-controlled and audited, and the SLA state is
 * computed server-side rather than trusted from a client.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAuthority(req)
  if (!gate.ok) return gate.response

  const url = new URL(req.url)
  const status = url.searchParams.get("status") || ""
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"))
  const limit = 25
  const now = new Date()

  const where: any = { tier: "GUARANTEED" }
  if (status && (HIRE_STATUSES as readonly string[]).includes(status)) where.status = status

  const [rows, total] = await Promise.all([
    (prisma as any).talentRequest.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" },
      include: { candidates: { select: { id: true } } },
    }),
    (prisma as any).talentRequest.count({ where }),
  ])

  const employerIds = [...new Set(rows.map((r: any) => r.employerId))] as string[]
  const employers = employerIds.length
    ? await prisma.user.findMany({ where: { id: { in: employerIds } }, select: { id: true, name: true, email: true } })
    : []
  const byId = new Map(employers.map((e) => [e.id, e]))

  return NextResponse.json({
    requests: rows.map((r: any) => {
      let terms: any = null
      try { terms = r.termsSnapshot ? JSON.parse(r.termsSnapshot) : null } catch { terms = null }
      const sla = guaranteeState({
        acceptedAt: r.acceptedAt, filledAt: r.filledAt, guaranteeDays: r.guaranteeDays, status: r.status, now,
      })
      return {
        id: r.id, title: r.title, status: r.status, headcount: r.headcount, seniority: r.seniority,
        employer: byId.get(r.employerId) || { id: r.employerId },
        assignedHrId: r.assignedHrId,
        quotedCHF: r.quotedCHF, guaranteeDays: r.guaranteeDays, acceptedAt: r.acceptedAt, filledAt: r.filledAt,
        delivered: r.candidates.length,
        sla: sla.state, daysRemaining: sla.daysRemaining, deadline: sla.deadline,
        // A breached promise means nothing is owed — surface that, do not leave it implicit.
        billableCHF: billableAmount(terms, sla.state),
        outcome: r.outcome,
      }
    }),
    total, pages: Math.ceil(total / limit),
    statuses: HIRE_STATUSES, basePriceCHF: BASE_PRICE_CHF,
    viewer: await viewerCapabilities(req),
  })
}

/** Quote, assign, accept, progress or fulfil an engagement. */
export async function PATCH(req: NextRequest) {
  const gate = await requireAuthority(req)
  if (!gate.ok) return gate.response
  const auth = gate.authority
  try {
    const body = await req.json()
    const id = String(body?.requestId || "")
    if (!id) return NextResponse.json({ error: "requestId is required" }, { status: 400 })

    const before = await (prisma as any).talentRequest.findUnique({ where: { id } })
    if (!before) return NextResponse.json({ error: "Request not found" }, { status: 404 })

    const data: any = {}
    if (body.status !== undefined) {
      if (!(HIRE_STATUSES as readonly string[]).includes(String(body.status))) {
        return NextResponse.json({ error: `status must be one of: ${HIRE_STATUSES.join(", ")}.` }, { status: 400 })
      }
      data.status = String(body.status)
    }
    if (body.assignedHrId !== undefined) data.assignedHrId = body.assignedHrId ? String(body.assignedHrId) : null

    // Pricing is CHF-only and never below the advertised entry price, so a quote can never
    // contradict what the homepage promises.
    if (body.quotedCHF !== undefined) {
      const n = Number(body.quotedCHF)
      if (!Number.isFinite(n) || n < BASE_PRICE_CHF) {
        return NextResponse.json({ error: `The quote must be at least CHF ${BASE_PRICE_CHF}.` }, { status: 400 })
      }
      data.quotedCHF = Math.round(n * 100) / 100
    }
    if (body.guaranteeDays !== undefined) {
      const d = Math.floor(Number(body.guaranteeDays))
      if (!Number.isFinite(d) || d < 1 || d > 365) return NextResponse.json({ error: "guaranteeDays must be 1–365." }, { status: 400 })
      data.guaranteeDays = d
    }

    // Accepting freezes the terms and starts the clock. Both are one-way on purpose: moving
    // the deadline after a client has accepted would rewrite the deal they agreed to.
    if (body.accept === true) {
      if (before.acceptedAt) return NextResponse.json({ error: "This engagement has already been accepted." }, { status: 409 })
      const q = quoteFor({
        headcount: before.headcount, seniority: before.seniority,
        urgencyDays: data.guaranteeDays ?? before.guaranteeDays ?? 30,
        specialist: !!body.specialist,
      })
      const amount = data.quotedCHF ?? before.quotedCHF ?? q.amountCHF
      const terms = termsFor({ ...q, amountCHF: amount, guaranteeDays: data.guaranteeDays ?? before.guaranteeDays ?? q.guaranteeDays })
      data.quotedCHF = amount
      data.guaranteeDays = terms.guaranteeDays
      data.replacementDays = terms.replacementDays
      data.termsSnapshot = JSON.stringify(terms)
      data.acceptedAt = new Date()
      data.status = before.status === "OPEN" ? "IN_PROGRESS" : before.status
    }

    if (body.markFilled === true) {
      if (!before.acceptedAt) return NextResponse.json({ error: "Accept the engagement before marking it filled." }, { status: 409 })
      data.filledAt = new Date()
      data.outcome = "FILLED"
      data.status = "DELIVERED"
    }
    if (body.outcome !== undefined && ["FILLED", "REFUNDED", "WITHDRAWN"].includes(String(body.outcome))) {
      data.outcome = String(body.outcome)
    }

    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    const after = await (prisma as any).talentRequest.update({ where: { id }, data })
    await auditAdmin(auth, body.accept ? "hire.accept" : body.markFilled ? "hire.filled" : "hire.update", {
      requestId: id,
      changes: diffRecords(before, after, ["status", "assignedHrId", "quotedCHF", "guaranteeDays", "acceptedAt", "filledAt", "outcome"]),
    }, req)

    const sla = guaranteeState({ acceptedAt: after.acceptedAt, filledAt: after.filledAt, guaranteeDays: after.guaranteeDays, status: after.status, now: new Date() })
    return NextResponse.json({ success: true, sla: sla.state, deadline: sla.deadline })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
