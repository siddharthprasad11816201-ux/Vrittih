import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyToken } from "@/lib/jwt"
import { analyzeCareer } from "@/lib/career/engine"
import { rankJobs, jobRequirements } from "@/lib/career/match"
import { computeCareerDNA } from "@/lib/career/dna"
import { reviewResume } from "@/lib/career/resume"
import { interviewPrep } from "@/lib/career/interview"
import { computeFrontier } from "@/lib/career/frontier"
import { simulateCareer } from "@/lib/career/simulator"
import { parseChfSalary } from "@/lib/career/salary"
import { momentum, diffVectors, type SeriesPoint, type SkillVector } from "@/lib/career/progress"
import { inputFromUser, resumeFromUser } from "@/lib/career/fromUser"
import { parseQuery, conversational, FOLLOWUPS, list, type Intent } from "@/lib/career/coach"
import { getCalibration } from "@/lib/career/calibrationStore"
import { writeAiRun, inputsHash } from "@/lib/aios/audit"

export const dynamic = "force-dynamic"

/* ICIRE — the in-house AI Career Coach. No external LLM: owned intent
 * classification + template answers filled with REAL data from the engine. */

const auth = (req: NextRequest) => { const t = req.cookies.get("er_token")?.value; return t ? verifyToken(t) : null }
type Card = { kind: "jobs" | "chips" | "list" | "meter"; title?: string; items: any[] }

export async function POST(req: NextRequest) {
  const p = auth(req)
  if (!p) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const body = await req.json().catch(() => ({}))
    const message = String(body?.message || "").slice(0, 500)

    // General/conversational messages (greeting, thanks, "nothing", "how are you")
    // get a warm human reply + gentle steer — never the robotic menu. Runs first and
    // needs no profile, so "hi" works for anyone.
    const conv = conversational(message)
    if (conv) return NextResponse.json({ intent: "help", reply: conv.reply, cards: [], suggestions: conv.suggestions, cta: null })

    const { intent, slots } = parseQuery(message)
    // AIOS §4 governance: audit every coach invocation as a registered-agent run.
    writeAiRun({ capId: "career.coach.answer", agentId: "agent:career-coach", subjectId: p.userId, modelId: "intent-classify-v1", inputsHash: inputsHash(message), outputs: { intent }, status: "ok", explanation: `Coach intent: ${intent}` }).catch(() => {})

    if (intent === "help") {
      return reply(intent, "I'm your in-house career coach. I read your real profile and live job listings — no guesswork — to help you decide what to do next. Ask me things like:", [
        { kind: "list", items: FOLLOWUPS.help },
      ])
    }

    const input = await inputFromUser(p.userId)
    const analysis = analyzeCareer(input)
    const candidate = analysis.skills

    // Nothing to reason about yet — guide honestly instead of inventing.
    if (candidate.length === 0) {
      return reply(intent, "I don't have enough about you yet to answer that honestly. Add your experience and skills — or upload your résumé — and I'll base everything on your real profile.", [], { label: "Complete your profile", href: "/profile/edit" })
    }

    const experienceMonths = (input.experiences || []).reduce((n, e) => n + (e.months || 0), 0)
    const roleTitles = (input.experiences || []).map((e) => e.title).filter(Boolean)

    // Load active jobs only for intents that need the market.
    let jobLikes: any[] = []
    if (["matches", "learn", "resume", "interview", "path", "salary"].includes(intent)) {
      const jobs = await prisma.job.findMany({
        where: { active: true },
        select: { id: true, title: true, company: true, description: true, industry: true, createdAt: true, remote: true, salary: true, skills: { include: { skill: true } } },
        orderBy: { createdAt: "desc" }, take: 200,
      })
      jobLikes = jobs.map((j) => ({ id: j.id, title: j.title, company: j.company, description: j.description, industry: j.industry, createdAt: j.createdAt, remote: j.remote, salary: j.salary, skills: (j.skills || []).map((s: any) => s.skill?.name).filter(Boolean) }))
    }
    const cal = jobLikes.length ? await getCalibration("global").catch(() => null) : null
    const ranked = jobLikes.length ? rankJobs(candidate, jobLikes, cal) : []
    const top = ranked[0]

    switch (intent) {
      case "learn": {
        const f = computeFrontier(candidate, jobLikes)
        if (!f.learnNext.length) return reply(intent, "You already cover the core skills across the live roles I can see — focus on a strong application and interview prep rather than new skills.", [])
        const top3 = f.learnNext.slice(0, 3)
        const lead = top3[0]
        // Honesty: only claim "within reach" for roles the frontier actually
        // computed as unlockable; otherwise report the near-miss relevance count.
        const leadLine = lead.jobsUnlocked > 0
          ? `Learning ${lead.skill} alone would bring ${lead.jobsUnlocked} more role${lead.jobsUnlocked === 1 ? "" : "s"} within reach.`
          : `${lead.skill} is the most common gap across roles you're already close on (${lead.nearMissJobs} near-miss role${lead.nearMissJobs === 1 ? "" : "s"}).`
        return reply(intent, `Across ${f.jobsConsidered} live roles, the highest-leverage skills to learn next are ${list(top3.map((s) => s.skill))}. ${leadLine}`, [
          { kind: "chips", title: "Learn next", items: f.learnNext.slice(0, 8).map((s) => `${s.skill} · ${s.difficulty} · ~${s.prepDays}d`) },
        ], { label: "See your learning plan", href: top ? `/jobs/${top.job.id}` : "/career" })
      }
      case "level": {
        const dna = computeCareerDNA(analysis, { experienceMonths, roleTitles })
        const sen = dna.dimensions.find((d) => d.key === "seniority")
        const band = sen?.band || "developing"
        return reply(intent, `You read as ${article(dna.archetype.label)} ${dna.archetype.label} at a ${band.toLowerCase()} level. ${sen ? sen.evidence.map((e) => e.detail).join(" ") : ""}`, [
          { kind: "meter", title: "Seniority signals", items: dna.dimensions.filter((d) => ["seniority", "depth", "breadth"].includes(d.key)).map((d) => ({ label: d.label + (d.band ? ` · ${d.band}` : ""), value: d.value })) },
        ], { label: "Open Career DNA", href: "/career" })
      }
      case "dna": {
        const dna = computeCareerDNA(analysis, { experienceMonths, roleTitles })
        return reply(intent, dna.narrative, [
          { kind: "meter", title: "Your dimensions", items: dna.dimensions.map((d) => ({ label: d.label + (d.band ? ` · ${d.band}` : ""), value: d.value })) },
          ...(dna.categoryLean.length ? [{ kind: "chips" as const, title: "Where your weight sits", items: dna.categoryLean.map((c) => `${c.label} ${c.pct}%`) }] : []),
        ], { label: "Open Career DNA", href: "/career" })
      }
      case "matches": {
        if (!ranked.length) return reply(intent, "There are no active roles to match against right now — check back shortly.", [])
        // Apply the query's structured filters (§NLP): a match threshold and/or remote.
        let pool = ranked
        if (slots.remote) pool = pool.filter((r) => (r.job as any).remote)
        const hasThreshold = slots.threshold != null
        const thr = hasThreshold ? (slots.threshold as number) : 35
        const above = pool.filter((r) => r.match.overall >= thr)
        const shown = (above.length ? above : pool).slice(0, hasThreshold ? 12 : 5)
        const rw = slots.remote ? " remote" : ""
        let lead: string
        if (!pool.length) lead = `I don't see any${rw} roles to match against right now — check back shortly.`
        else if (hasThreshold) lead = above.length
          ? `${above.length}${rw} role${above.length === 1 ? "" : "s"} match you at ${thr}% or higher — ranked by real fit:`
          : `No${rw} roles currently reach ${thr}% for your profile. Your closest are below — ask me what to learn to raise them.`
        else lead = above.length
          ? `Your strongest${rw} matches right now — ranked by real fit against your skills:`
          : `Nothing${rw} is a strong fit yet, but these are your closest roles. Ask me what to learn to raise them.`
        const cards: Card[] = [
          { kind: "jobs", items: shown.map((r) => ({ id: r.job.id, title: r.job.title, subtitle: (r.job as any).company, score: r.match.overall })) },
        ]
        // Show the semantics working: skills the top role needs that the candidate
        // is partway to via an adjacent skill they already hold.
        const topR = shown[0]
        if (topR?.match.transferable?.length) cards.push({ kind: "chips", title: `Transferable strengths for ${topR.job.title}`, items: topR.match.transferable.slice(0, 5).map((t) => `${t.via} → ${t.skill}`) })
        return reply(intent, lead, cards, { label: "Browse all jobs", href: "/jobs" })
      }
      case "resume": {
        if (!top) return reply(intent, "Add a target role first — pick a job and I'll review your résumé against exactly what it screens for.", [], { label: "Find jobs", href: "/jobs" })
        const targets = jobRequirements(top.job).filter((r) => r.weight >= 0.8).map((r) => r.skill)
        const resume = await resumeFromUser(p.userId)
        const rev = reviewResume(resume, targets)
        const fixes = rev.findings.slice(0, 3).map((f) => f.message + " → " + f.fix)
        return reply(intent, `Against ${top.job.title}, your résumé scores ${rev.score}/100 (${rev.stats.keywordCoverage}% keyword match). ${rev.missingKeywords.length ? "Add the keywords it screens for where true, and tighten these bullets:" : "Tighten these bullets:"}`, [
          ...(rev.missingKeywords.length ? [{ kind: "chips" as const, title: "Missing keywords", items: rev.missingKeywords.slice(0, 8) }] : []),
          { kind: "list", title: "Top fixes", items: fixes.length ? fixes : ["Your résumé already reads well for this role."] },
        ], { label: "Full résumé check", href: `/jobs/${top.job.id}` })
      }
      case "interview": {
        if (!top) return reply(intent, "Pick a role and I'll build a mock interview from it and your profile.", [], { label: "Find jobs", href: "/jobs" })
        const prep = interviewPrep(candidate, top.job as any, top.match.overall)
        const sample = prep.rounds.flatMap((r) => r.questions.slice(0, 1)).slice(0, 4)
        return reply(intent, `For ${top.job.title} (a ${prep.difficulty.toLowerCase()}-level bar) you're ${prep.readiness}% ready — ${prep.readinessLabel}. Expect these rounds: ${list(prep.rounds.map((r) => r.name))}. A few to rehearse:`, [
          { kind: "list", title: "Practice questions", items: sample },
          { kind: "list", title: "Tips", items: prep.tips },
        ], { label: "Full interview prep", href: `/jobs/${top.job.id}` })
      }
      case "path": {
        const dna = computeCareerDNA(analysis, { experienceMonths, roleTitles })
        const bucket = dna.categoryLean[0]?.bucket
        const band = dna.dimensions.find((d) => d.key === "seniority")?.band
        const sim = simulateCareer(candidate, { bucket, band, jobs: jobLikes })
        const cards: Card[] = sim.tracks.map((t) => ({ kind: "list", title: t.label, items: t.steps.map((s) => `${s.role} — +${s.addSkills.length} skills (~${s.prepDays}d)${s.salary ? " · " + s.salary : ""}`) }))
        return reply(intent, `From ${sim.current.title}, here's where you can go next. Salary is shown only where real CHF listings exist — never estimated.`, cards, { label: "Open path simulator", href: "/career" })
      }
      case "salary": {
        const withChf = ranked.map((r) => ({ r, chf: parseChfSalary((r.job as any).salary) })).filter((x) => x.chf).slice(0, 5)
        if (!withChf.length) return reply(intent, "I only show salaries employers actually list in CHF — I never estimate or convert pay, so I won't guess a number. None of your current top matches list a CHF salary. When CHF-paying roles match you, they'll show here.", [], { label: "Browse jobs", href: "/jobs" })
        return reply(intent, "Vrittih only shows salaries listed in CHF (never estimated). Roles matching you that list one:", [
          { kind: "jobs", items: withChf.map((x) => ({ id: x.r.job.id, title: x.r.job.title, subtitle: `${(x.r.job as any).company} · ${x.chf!.display}`, score: x.r.match.overall })) },
        ])
      }
      case "progress": {
        const snaps = await prisma.careerSnapshot.findMany({
          where: { userId: p.userId }, orderBy: { createdAt: "asc" },
          select: { createdAt: true, avgConfidence: true, skillCount: true, explicitCount: true, skillVector: true },
        })
        if (snaps.length < 2) return reply(intent, "I don't have enough history to show a trend yet — I record a snapshot when your profile content changes (or every 30 days). Keep your skills, experience and résumé current and your growth will show here.", [], { label: "Update your profile", href: "/profile/edit" })
        const series: SeriesPoint[] = snaps.map((s) => ({ at: s.createdAt.toISOString(), avgConfidence: s.avgConfidence, skillCount: s.skillCount, explicitCount: s.explicitCount }))
        const m = momentum(series)
        const first = snaps[0], last = snaps[snaps.length - 1]
        const deltas = diffVectors(safeVec(first.skillVector), safeVec(last.skillVector)).slice(0, 6)
        const trend = m.direction === "up" ? `up ${m.deltaPct} points` : m.direction === "down" ? `down ${Math.abs(m.deltaPct)} points` : "holding steady"
        return reply(intent, `Across ${snaps.length} snapshots your average skill confidence is ${trend}, and you've gone from ${first.skillCount} to ${last.skillCount} tracked skills (${last.explicitCount} demonstrated). All measured from your own recorded history — nothing estimated.`, [
          { kind: "meter", title: "Confidence over time", items: series.map((pt) => ({ label: new Date(pt.at).toLocaleDateString(), value: Math.round(pt.avgConfidence * 100) })) },
          ...(deltas.length ? [{ kind: "chips" as const, title: "Biggest movers", items: deltas.map((d) => `${d.skill} ${d.delta >= 0 ? "+" : ""}${d.delta}`) }] : []),
        ], { label: "Open Career DNA", href: "/career" })
      }
      default:
        return reply("fallback", "I'm not sure I caught that. I can help with your best-fit jobs, what to learn next, your seniority, résumé, interview prep, Career DNA and career paths — try one of these:", [{ kind: "list", items: FOLLOWUPS.fallback }])
    }
  } catch (e: any) {
    console.error("[COACH]", e?.message)
    return NextResponse.json({ error: "temporary", temporary: true }, { status: 503 })
  }

  function reply(intent: Intent, text: string, cards: Card[], cta?: { label: string; href: string }) {
    return NextResponse.json({ intent, reply: text, cards, suggestions: FOLLOWUPS[intent] || [], cta: cta || null })
  }
}

const article = (s: string) => (/^[aeiou]/i.test(s) ? "an" : "a")
function safeVec(s: string): SkillVector { try { return JSON.parse(s || "{}") } catch { return {} } }
