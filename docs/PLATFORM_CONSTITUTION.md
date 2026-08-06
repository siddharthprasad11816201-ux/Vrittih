# EduRankAI Platform Constitution

> **Status:** Permanent · **Priority:** P0 (Highest) · **Classification:** Master Platform Constitution
> This document supersedes feature-first development. If any implementation conflicts with it, this document wins.

---

## 1. Mission

Connect the world's best talent with the world's best opportunities while continuously helping every individual become the best version of themselves.

We are **not building software**. We are building the **intelligence infrastructure for human capability**.

## 2. Who we serve

- **Employers** — they don't want software, they want the best people. *"Who should we hire, why, can they perform, how do we evaluate/interview/onboard/develop/retain them?"* — answered **with evidence**.
- **Individuals** (students, interns, employees, researchers, faculty, professionals, executives, freelancers, career-changers) — *"Who can I become? What's missing? How do I improve? Which mentor/project/role fits?"* — **continuously guided**.

## 3. Core philosophy

We are **not** building an ATS / HRMS / LMS / job board / CRM / ERP / community / learning platform in isolation. Those are **business modules** — specialised interfaces over **one unified Enterprise Talent Intelligence & Human Capability Platform**.

## 4. The managed model (how the business actually works)

EduRankAI is a **two-sided managed talent service**, operated by an in-house HR/recruiter team and powered by the AI:

- **Employer:** *"I need the best Backend Engineer."* → EduRankAI runs **Find → Evaluate → Interview → Assess → Train → Certify → Hire → Onboard → Develop → Retain → Promote** → delivers the best hire.
- **Individual:** *"I want to become an AI Engineer."* → **Career DNA → Skill-Gap → Learning → Projects → Mock Interviews → Mentoring → Research → Certification → Placement → Employment → Growth.**

The individual never leaves the ecosystem: Potential → Discovery → Assessment → Learning → Projects → Research → Mentoring → Competency → Portfolio → Certification → Interview-readiness → Recruitment → Hiring → Onboarding → Performance → Promotion → Leadership → Succession → Alumni → Rehire.

## 5. The Enterprise Brain (unified AI architecture)

Every AI capability executes through **one** intelligence pipeline — no module bypasses it:

```
Intent → Context → Knowledge → Memory → Competency → Evidence → Reasoning
→ Planning → Decision → Recommendation → Reflection → Confidence → Explainability → Action
```

**Implemented as** `lib/intelligence/deliberate.ts` (the deliberation core), invoked through the AIOS gateway (`execute("intelligence.deliberate")`, audited via `AiRun`). It composes the in-house cognitive engines (`reason`, `evaluate`, `recommend`, `reflect`) — **no external LLM, no fabricated confidence**.

## 6. Universal AI capabilities (shared brain, different interface)

Career Coach · Recruiter Copilot · Interview AI · Learning Tutor · Research Assistant · HR Copilot · Executive Copilot · Finance/Project/Government/Healthcare/Developer/Community Copilots. **The intelligence is shared; only the interface changes.**

## 7. Evidence-based, always

Every recommendation must state: **Why · Evidence · Confidence · Supporting observations · Alternatives · Risks · Required improvements.** Everything traceable. **No arbitrary scores. No fake AI.** (No random scores, fake confidence, keyword-matching-as-AI, or static question banks presented as adaptive.)

## 8. Career DNA

Not a score — a **living, evidence-backed capability model** (learning style, problem-solving, architecture aptitude, communication, leadership, research orientation, execution, growth trajectory, motivations…), continuously evolved from **verified evidence** (assessments, projects, interviews, learning, achievements).

## 9. AI Quality bar (Definition of Done)

An AI capability is complete **only when an experienced domain expert would willingly rely on it in real work** — benchmarked against senior recruiters, principal engineers, architects, professors, HR directors, executives. UI/API/DB/docs alone do **not** make it done. Until every existing AI capability reaches this bar, **pause new AI-facing features** (infrastructure, security, bug-fixes, stability continue).

## 10. Implementation principles

Never build isolated modules. Never duplicate AI/services/workflows/knowledge. Everything reuses **AIOS · Workflow Engine · Enterprise Intelligence · Knowledge Graph · Talent Graph · Capability Framework · Identity · Communication · Design System**. Every module contributes back to the Enterprise Brain.

## 11. Success metric

Not APIs/pages/dashboards/modules. Success = **employers hire better, individuals become more capable, organizations decide better, learning is personalized, interviews are meaningful, careers accelerate.** If those outcomes improve, the platform succeeds.

---

*See [ROADMAP.md](ROADMAP.md) for phases/progress, [IMPLEMENTATION_TRACKER.md](IMPLEMENTATION_TRACKER.md) for per-module status, and [README.md](README.md) for the documentation index.*
