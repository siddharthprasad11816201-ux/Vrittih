import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"

export const dynamic = "force-dynamic"

const uid = (req: NextRequest) => {
  const t = req.cookies.get("er_token")?.value
  return t ? verifyToken(t)?.userId ?? null : null
}

const DEFAULT_FORM = {
  useProfile: true,
  requireResume: true,
  coverLetter: "optional" as const,
  questions: [] as any[],
  documents: [] as any[],
  testId: null as string | null,
  testRequired: false,
  instructions: null as string | null,
}

// GET -> what this job asks of an applicant, plus (when signed in) the candidate's
// own profile so the form can be prefilled. A job with no form configured falls
// back to sensible defaults rather than 404ing, so every job stays applicable.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, company: true, postedById: true, applyUrl: true, govUrl: true, form: true },
  })
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const f = job.form
  const form = f ? {
    useProfile: f.useProfile,
    requireResume: f.requireResume,
    coverLetter: f.coverLetter,
    questions: safeJson(f.questions, []),
    documents: safeJson(f.documents, []),
    testId: f.testId,
    testRequired: f.testRequired,
    instructions: f.instructions,
  } : DEFAULT_FORM

  // An aggregated listing has no employer account here, so it cannot receive
  // applications — the client must send people to the original posting instead.
  const aggregated = !!(job.applyUrl || job.govUrl) && !!job.form === false && false

  let profile: any = null
  let alreadyApplied = false
  const me = uid(req)
  if (me) {
    const [u, existing] = await Promise.all([
      prisma.user.findUnique({
        where: { id: me },
        select: {
          name: true, email: true, phone: true, location: true, headline: true, bio: true, resumeUrl: true,
          experience: { orderBy: { startDate: "desc" } },
          education: { orderBy: { startYear: "desc" } },
          skills: { include: { skill: true } },
        },
      }),
      prisma.application.findFirst({ where: { userId: me, jobId: params.id }, select: { id: true } }),
    ])
    alreadyApplied = !!existing
    if (u) profile = {
      name: u.name, email: u.email, phone: u.phone, location: u.location,
      headline: u.headline, bio: u.bio, resumeUrl: u.resumeUrl,
      experience: u.experience, education: u.education,
      skills: u.skills.map(s => s.skill?.name).filter(Boolean),
    }
  }

  let test: any = null
  if (form.testId) {
    test = await prisma.test.findUnique({ where: { id: form.testId }, select: { id: true, title: true, duration: true } }).catch(() => null)
  }

  return NextResponse.json({
    job: { id: job.id, title: job.title, company: job.company },
    form, profile, alreadyApplied, test, aggregated,
  })
}

// PUT -> the employer who owns this job defines what it collects.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const me = uid(req)
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const job = await prisma.job.findUnique({ where: { id: params.id }, select: { postedById: true } })
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })
  const actor = await prisma.user.findUnique({ where: { id: me }, select: { role: true } })
  const isAdmin = actor?.role === "ADMIN" || actor?.role === "SUPER_ADMIN"
  if (job.postedById !== me && !isAdmin) {
    return NextResponse.json({ error: "You don't manage this job." }, { status: 403 })
  }

  const b = await req.json()
  const cover = ["required", "optional", "off"].includes(b.coverLetter) ? b.coverLetter : "optional"

  // Normalise, and give every field a stable id so answers stay attributable
  // even after the employer edits the wording later.
  const questions = (Array.isArray(b.questions) ? b.questions : []).slice(0, 30).map((q: any, i: number) => ({
    id: String(q.id || `q${i + 1}`),
    label: String(q.label || "").slice(0, 300),
    type: ["text", "textarea", "select", "boolean", "number"].includes(q.type) ? q.type : "text",
    options: Array.isArray(q.options) ? q.options.slice(0, 20).map((o: any) => String(o).slice(0, 120)) : [],
    required: !!q.required,
    help: q.help ? String(q.help).slice(0, 300) : null,
  })).filter((q: any) => q.label)

  const documents = (Array.isArray(b.documents) ? b.documents : []).slice(0, 15).map((d: any, i: number) => ({
    id: String(d.id || `d${i + 1}`),
    label: String(d.label || "").slice(0, 200),
    required: !!d.required,
    accept: String(d.accept || ".pdf,.doc,.docx,.png,.jpg,.jpeg").slice(0, 200),
    help: d.help ? String(d.help).slice(0, 300) : null,
  })).filter((d: any) => d.label)

  const data = {
    useProfile: b.useProfile !== false,
    requireResume: b.requireResume !== false,
    coverLetter: cover,
    questions: JSON.stringify(questions),
    documents: JSON.stringify(documents),
    testId: b.testId || null,
    testRequired: !!b.testRequired && !!b.testId,
    instructions: b.instructions ? String(b.instructions).slice(0, 2000) : null,
  }

  await prisma.applicationForm.upsert({
    where: { jobId: params.id },
    update: data,
    create: { jobId: params.id, ...data },
  })

  return NextResponse.json({ ok: true, questions: questions.length, documents: documents.length })
}

function safeJson(s: string, fallback: any) {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : fallback } catch { return fallback }
}
