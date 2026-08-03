import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { canTransition } from "@/lib/offer/lifecycle"
import { createNotification } from "@/lib/notify"
import { emit } from "@/lib/webhooks"

export const dynamic = "force-dynamic"

/* EROS Module 8 — a candidate's digital response to an offer.
 * Only the offer's candidate may respond, only to a SENT offer. Accepting drives the
 * linked application to HIRED (with a timeline event) and can trigger onboarding. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.cookies.get("er_token")?.value
  const p = token ? verifyToken(token) : null
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { decision, reason } = await req.json()
  const action = decision === "accept" ? "accept" : decision === "decline" ? "decline" : null
  if (!action) return NextResponse.json({ error: "decision must be 'accept' or 'decline'." }, { status: 400 })

  const offer = await prisma.offer.findUnique({ where: { id: params.id }, select: { id: true, candidateId: true, status: true, title: true, companyName: true, applicationId: true, createdById: true, expiresAt: true } })
  if (!offer || offer.candidateId !== p.userId) return NextResponse.json({ error: "Offer not found" }, { status: 404 })

  // Expired offers can't be accepted — retire it honestly.
  if (offer.status === "SENT" && offer.expiresAt && +offer.expiresAt < Date.now()) {
    await prisma.offer.update({ where: { id: offer.id }, data: { status: "EXPIRED", events: { create: { action: "expired", note: "Expired before response" } } } }).catch(() => {})
    return NextResponse.json({ error: "This offer has expired." }, { status: 409 })
  }

  const check = canTransition(action, offer.status)
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 })

  // Atomic + optimistic: the offer transition and (on accept) the application→HIRED
  // write commit together or not at all. The `status: "SENT"` guard means only the
  // first of two concurrent responses wins — the loser gets a 409, never a divergence.
  try {
    await prisma.$transaction(async (tx) => {
      const res = await tx.offer.updateMany({
        where: { id: offer.id, status: "SENT" },
        data: {
          status: check.to, respondedAt: new Date(),
          declineReason: action === "decline" && reason ? String(reason).slice(0, 1000) : undefined,
        },
      })
      if (res.count !== 1) throw new Error("STALE")
      await tx.offerEvent.create({ data: { offerId: offer.id, action, actorId: p.userId, note: action === "decline" ? (reason ? String(reason).slice(0, 300) : "Declined") : "Accepted" } })
      if (action === "accept" && offer.applicationId) {
        await tx.application.update({
          where: { id: offer.applicationId },
          data: { status: "HIRED", timeline: { create: { status: "HIRED", note: "Offer accepted" } } },
        })
      }
    })
  } catch (e: any) {
    if (e?.message === "STALE") return NextResponse.json({ error: "This offer has already been responded to." }, { status: 409 })
    return NextResponse.json({ error: "Could not record your response — please try again." }, { status: 500 })
  }

  // Notify the recruiter who created the offer.
  await createNotification({
    userId: offer.createdById,
    title: `Offer ${action === "accept" ? "accepted" : "declined"} — ${offer.title}`,
    body: action === "accept" ? `The candidate accepted the ${offer.title} offer.` : `The candidate declined the ${offer.title} offer${reason ? `: ${String(reason).slice(0, 140)}` : "."}`,
    link: "/offers", sendEmail: false,
  }).catch(() => {})
  await emit(offer.createdById, action === "accept" ? "offer.accepted" : "offer.declined", { offerId: offer.id, title: offer.title }).catch(() => {})

  return NextResponse.json({ success: true, status: check.to })
}
