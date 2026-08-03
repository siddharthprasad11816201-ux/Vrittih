# Multimodal AI Interview, Assessment, Intelligent Proctoring & Recruitment Intelligence Platform
## Enterprise Technical Specification

**Status:** Living engineering specification. Permanent architectural source of truth
for EROS Modules 6 (Interview Intelligence) and 7 (Assessment & Intelligent Proctoring).
**Owner:** Vrittih / EduRankAI platform. **Last updated:** 2026-08-03.

---

## 0. Reading this document — the council's stance

This specification was authored by the named council (Chief AI Scientist, Chief CV
Scientist, Principal ML/Multimodal/LLM/Systems/Security/Enterprise architects,
Principal Data Scientist/Engineer, MLOps/DevOps, HCI/UX, Psychometrician, **AI Safety
Researcher**, **Privacy Engineer**, Distributed Systems, Database Architect, Product
Strategist). It is deliberately **evidence-first and responsibility-first**, and it is
grounded in the real platform (Next.js/Prisma/Vercel, AIOS, capability framework,
Interview + governance, Test/TestAttempt, EIDP), which it EXTENDS — it does not
duplicate existing systems.

Three principles shape every section, and they are the reason this design is both safer
**and** more valid than surveillance-first incumbents:

1. **Semantic Digital Twin, not a recording.** The system does not store the interview;
   it stores what was *observed to happen* — typed, timestamped, evidence-linked,
   consented semantic events — and discards raw signal. Raw capture is on-device and
   ephemeral; recordings exist only under explicit, revocable, purpose-limited consent.
2. **Evidence over inference; humans decide.** Candidates are evaluated on demonstrable
   work product and human-rated competencies, each linked to retrievable evidence.
   Affect/emotion/personality/"confidence"/accent inference from face or voice is
   scientifically contested and discrimination-prone; it is **never** a candidate score.
   Proctoring flags observable *events* that trigger human review — never verdicts about
   a person's character. Every AI output carries confidence + evidence and is advisory.
3. **In-house first, on-device where feasible; consent-first and law-aware.** Every core
   capability has a deterministic/in-house/on-device path (patent goal: no mandatory
   external LLM/ML/vector-DB/cloud-CV). Heavy CV/GPU/streaming are an explicitly
   separated enterprise/future tier — never a hard dependency of the buildable core.
   Design is EU-AI-Act-high-risk-aware (risk management, logging, transparency, human
   oversight), GDPR/BIPA-aware for biometrics, with consent lifecycle, data
   minimization, retention limits, candidate rights, and an appeals path.

Where a requested capability (e.g. emotion/personality scoring, 1:N face surveillance,
accent scoring) conflicts with validity, fairness, or law, the specification says so
explicitly and proposes the responsible alternative rather than implementing it naively.
Section 29 (Implementation Roadmap) separates what is **buildable in-house on this
platform now** (Phase 1) from the on-device CV (Phase 2) and enterprise streaming/edge/
GPU (Phase 3) tiers.

---

## 1. Product Vision

### 1.1 Thesis — the Human Digital Understanding Engine (HDUE) and the Semantic Digital Twin

EROS Modules 6 (Interview Intelligence) and 7 (Assessment & Intelligent Proctoring) together form the **Human Digital Understanding Engine (HDUE)**: a system whose purpose is to understand what a candidate *can demonstrably do* and to conduct that evaluation *fairly, transparently, and lawfully* — not to surveil, profile, or infer character from a face.

The organizing idea is the **Semantic Digital Twin (SDT)**. The incumbent paradigm (record everything → run opaque CV/voice models → emit a black-box "employability score") is inverted:

> **We do not store the interview. We store what was *observed to happen* in it — as typed, timestamped, evidence-linked, consented semantic events — and we throw the raw signal away.**

The SDT is the structured, append-only, evidence-referenced representation of a candidate's demonstrated competencies and the integrity context in which they were demonstrated. It is a first-class extension of the platform's existing **Career DNA** (`CareerProfile.graph`, `SkillProficiency`, `CareerSnapshot`): interviews and assessments *feed* the same twin rather than living in a separate surveillance silo.

```
  INCUMBENT (surveillance-maximizing)          HDUE / SEMANTIC DIGITAL TWIN (evidence-maximizing)
  ┌───────────────────────────────┐            ┌──────────────────────────────────────────────┐
  │ raw video + audio + biometrics│            │ raw signal stays ON-DEVICE, ephemeral          │
  │            │                  │            │            │                                   │
  │            ▼                  │            │            ▼ (on-device perception, WASM)       │
  │ opaque cloud CV / voice model │   ──►      │ typed SEMANTIC EVENTS (observed facts + hash)  │
  │            │                  │            │            │                                   │
  │            ▼                  │            │            ▼                                   │
  │ black-box "employability" #   │            │ evidence-linked competency record + integrity  │
  │            │                  │            │ EVENTS (never character), human decides         │
  │            ▼                  │            │            │                                   │
  │ hiring decision (unexplained) │            │ explainable rec + confidence + appeal path     │
  └───────────────────────────────┘            └──────────────────────────────────────────────┘
   more data → more risk, more                  less raw data → less risk, MORE valid signal
   disparate impact, more distrust              (validity comes from work product, not pixels)
```

**Why less raw data yields *more* valid signal (the validity/invasiveness frontier).** Facial-expression, vocal-affect, "confidence," and personality inference are scientifically contested and reliably discriminatory (they encode accent, disability, neurodivergence, gender, and race as noise). Adding them raises invasiveness *and legal exposure* while adding little construct validity. Work product — code that runs, an aptitude answer that is right, a competency a trained human observed and rated with evidence — is where validity actually lives. HDUE is deliberately positioned on the high-validity / low-invasiveness quadrant.

```
  construct   │  ▲  ██ HDUE target zone
  validity    │  │  ██ (work product, structured
  (does it    │  │  ██  human ratings, verified skills)
  predict     │  │
  job perf?)  │  │            · SHL-style psychometrics (valid, low-invasive)
              │  │
              │  │  · game/scenario assessments
              │  │
              │  │                         ✗ emotion/personality/"confidence"
              │  │                           from face/voice  (contested + invasive)
              └──┴──────────────────────────────────────────►
                 low                 invasiveness / surveillance                high
```

### 1.2 Design tenets (non-negotiable, encoded into the architecture)

1. **Evidence over inference.** A candidate is scored on what they *did*, linked to retrievable evidence. Inferred affect/traits are never a candidate score.
2. **Semantic over raw.** The default persisted artifact is a typed event, not media. Raw capture is on-device and ephemeral; recordings exist only under explicit, revocable, purpose-limited consent.
3. **Human decides.** Every AI output is a *recommendation with confidence and evidence*; a capability-holding human makes the decision. High-stakes automation is structurally blocked (`safetyClass = "forbidden-auto"` in the AIOS gateway).
4. **Explain everything.** Every inference writes an immutable `AiRun` with `confidence`, `explanation`, and an evidence trace. No unexplained numbers reach a decision-maker.
5. **Capability, not role.** Access derives from capability keys (`lib/capability`), never from role strings.
6. **Fail-closed.** Missing consent, missing capability, unknown capability, or a `forbidden-auto` class → denied/blocked, audited.
7. **Region-aware consent-first.** No perception event is accepted without a matching `ConsentGrant` for its purpose and jurisdiction.
8. **Proctoring flags events, never people.** Signals are observable facts (`face.absent`, `face.multiple`, `window.blur`) that *trigger human review*, not verdicts about honesty or character.
9. **Portable & appealable twin.** The candidate can export their SDT and can contest any flag or decision (`Appeal`).
10. **In-house first, on-device where feasible.** Every core capability has a deterministic/on-device path; GPU/cloud CV/LLM are an optional, clearly-separated enterprise tier — never a hard dependency.

### 1.3 Target users and their guardrails

| Persona | Needs | HDUE gives them | Rights / guardrails |
|---|---|---|---|
| **Candidate / applicant** | Fair, transparent evaluation; low friction; know what's captured | Consent-first flows; a portable Semantic Digital Twin; visibility into flags | Informed consent per purpose; data minimization; export; **appeal**; no character inference |
| **Recruiter / hiring manager** | Compare candidates on job-relevant evidence | Structured scorecards, competency roll-ups, evidence-linked results | `candidates.view` / `pipeline.manage`; sees redacted views per `confidential` |
| **Interview panelist / interviewer** | Run a structured, bias-aware interview | Question guides, per-competency ratings, bias/process signals | `interviews.host`; panel-seniority governance (`evaluatePanel`) |
| **Assessment author / I-O psychologist** | Author valid, defensible instruments | Test/Question authoring, item analytics, validity metadata | `jobs.post`+authoring caps; validity caveats surfaced |
| **Integrity reviewer / proctor** | Triage flagged sessions efficiently | Review queue of *events with evidence*, never auto-verdicts | Human decision required; every action audited |
| **DPO / compliance / legal** | Prove lawful, fair processing | DPIA hooks, consent ledger, retention controls, audit trail | `ai.governance.review`; read the append-only `AiRun`/consent log |
| **AI governance reviewer** | Approve model/policy/prompt changes | `ChangeProposal` queue (AI proposes, humans approve) | Nothing self-approves; `forbidden-auto` gate |
| **Enterprise admin / white-label partner** | Deploy per tenant, per region | Tenant policy packs, region routing, tiered features | `admin.access`/`admin.super`; tenant isolation |
| **Auditor / regulator** | Verify compliance after the fact | Immutable `AiRun` + consent + revision history, replayable events | Read-only, capability-gated access |

### 1.4 Differentiators — safer *and* better than surveillance-first incumbents

Positioning below reflects the incumbents' **public product positioning** and contrasts it with HDUE's design commitments; it is a design comparison, not a legal characterization of any vendor.

| Axis | Surveillance-first incumbents (typical) | **HDUE / this platform** |
|---|---|---|
| Primary decision signal | Video/voice + inferred behavior; game scores | **Work product + structured human competency ratings + verified skills** |
| Facial/vocal affect → candidate score | Historically marketed; contested | **Refused for scoring** (research-tier only, caveated, opt-in, human-reviewed) |
| Raw video retention | Recorded and retained by default | **Raw stays on-device/ephemeral**; recording is opt-in, purpose-limited, TTL'd |
| Proctoring output | Risk/"suspicion" score | **Observable events → human review trigger**; never a character verdict |
| Explainability | Often black-box | **Every inference: confidence + explanation + evidence (`AiRun`)** |
| Human-in-the-loop | Optional/advisory | **Structurally mandated** (`forbidden-auto` blocks high-stakes automation) |
| In-house / on-device | Cloud ML + GPU dependent | **In-house deterministic core; on-device WASM; cloud/GPU optional enterprise tier** |
| Candidate appeal | Rare | **First-class `Appeal` right** |
| AuthZ model | Roles | **Capability-driven, fail-closed** |
| Fairness instrumentation | Add-on / audit-only | **Built-in bias/process signals** (`aggregatePanel`), evidence-linked |
| Deploy reality | Heavy backend | **Ships on Next.js/Vercel/Prisma today**; scales to edge-AI later |

The wedge is simple: **incumbents compete on *more monitoring*; HDUE competes on *more valid, more explainable, more governed* evaluation with *less* data.** That is simultaneously the ethically defensible position and, under the EU AI Act (Annex III high-risk employment use), BIPA/Illinois AI Video Interview Act, and GDPR, the *lower-liability* and more *enterprise-sellable* position.

### 1.5 What the platform explicitly does **not** do (honesty / anti-pseudoscience taxonomy)

HDUE sorts every possible signal into exactly one of three tiers. The tier determines whether a signal may influence a hiring decision.

| Tier | Definition | Examples | Decision weight | Governance |
|---|---|---|---|---|
| **A — Valid Evidence** | Directly observed work product or a trained human's structured, evidenced judgment | Coding output & tests passed; aptitude/technical answers; per-competency panel ratings; verified credentials; demonstrated `SkillProficiency` | **Scored; decision-relevant** | Explainable, evidence-linked, appealable |
| **B — Integrity Events** | Observable, deterministic facts about the session environment | `face.absent`, `face.multiple`, `window.blur` (tab switch), `fullscreen.exit`, `paste_burst`, `audio.multiple_speakers` (VAD only) | **Never a competency score.** Triggers human review only | Human-reviewed, false-positive-aware, appealable |
| **C — Refused / Research-only** | Scientifically contested inferences of internal state or traits | Emotion/affect, personality (Big-Five from face/voice), "confidence," "enthusiasm," accent/"communication style" scoring | **Never a candidate score in core.** Available only as an opt-in, caveated, human-reviewed *research* signal in the enterprise tier — or recommended against outright | DPIA-gated, validity warning attached, low-weight, never automated |

This taxonomy is not marketing; it is enforced at the architecture layer (Section 2): Tier C detectors are absent from the in-house core, Tier B events are structurally routed to *review*, not to *scores*, and Tier A is the only input to any hiring recommendation.

### 1.6 Outcome metrics (how we prove it works and is fair)

- **Predictive/construct validity** of assessments and structured interviews (tracked via `EvalRun`, e.g. score→advance-rate calibration, reusing the ICIRE `MatchCalibration` isotonic approach).
- **Adverse-impact ratio** (4/5ths rule) monitored per stage on aggregate, PII-free cohorts — a fairness regression alarm, not a per-candidate signal.
- **Proctoring precision & false-positive rate** on human-adjudicated flags (a high FP rate is a *product defect*, tracked and driven down).
- **Candidate trust & completion** (consent-grant rate, drop-off, appeal volume and overturn rate).
- **Time-to-decision** and **panel consensus/confidence** (`aggregatePanel.confidence`).
- **Governance latency** (`ChangeProposal` review turnaround; % automated decisions = target 0 for high-stakes).

---

## 2. System Architecture

### 2.1 Architectural principles

1. **One gateway for all AI.** No module infers anything except through `AIOS.execute(capId, ctx)` (`lib/aios/execute.ts`): capability resolution → safe-evolution gate (`forbidden-auto`) → capability authorization (never role) → provider → immutable `AiRun` audit → event emit. Fail-closed.
2. **Perception at the edge (the device).** Raw frames/audio never leave the candidate's browser in the core tier. On-device WASM detectors emit *semantic events*; media is ephemeral. This is both a privacy control and the reason the system runs on Vercel serverless (no server-side media pipeline required).
3. **Append-only, replayable event backbone.** Lifecycle events flow through `emit()`/`PlatformEvent` (`lib/aios/events.ts`); high-volume perception events land in a dedicated append-only, TTL'd store. Nothing is overwritten.
4. **Consent gates ingestion.** Every perception event carries a `consentRef`; ingestion rejects any event lacking a valid, in-scope `ConsentGrant`.
5. **Evidence, not media, is the persisted artifact.** `EvidenceItem` rows are content-addressed pointers (hashes, optional consented thumbnail/clip), never a default raw archive.
6. **Deterministic, in-house scoring.** Scorecard aggregation, bias signals, assessment scoring, and proctor-risk *fusion* are pure, testable functions (`lib/interview/scorecard.ts` today). GPU/cloud CV is an optional provider behind `ModelRegistry`, never a hard dependency.

### 2.2 End-to-end reference architecture (layered)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ L0  CAPTURE PLANE  (candidate browser — Zone Z0)                                           │
│   WebRTC getUserMedia/getDisplayMedia · RTCPeerConnection (A/V P2P) · RTCDataChannel        │
│   TestAttempt runner (coding/aptitude) · focus/visibility/clipboard/fullscreen listeners    │
│   Device sensors: camera, mic, screen, input timing                                         │
└───────────────┬────────────────────────────────────────────────────────────────────────────┘
                │  RAW media stays local (ephemeral)         ▲ A/V peer stream (interviews only)
                ▼                                            │
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ L1  ON-DEVICE PERCEPTION  (WASM, deterministic — Zone Z0)                                   │
│   face-presence · second-face · identity-match-vs-enrolled (on-device) · gaze/off-screen*   │
│   audio VAD / multi-speaker* · code telemetry · paste/keystroke burst detection             │
│   ── produces SEMANTIC EVENTS (Tier B). NO Tier-C affect/personality detectors in core. ──  │
└───────────────┬────────────────────────────────────────────────────────────────────────────┘
                │  signed, batched semantic events (facts + hashes, NO raw bytes)
                │  transport: navigator.sendBeacon / fetch(keepalive)  ── consentRef attached
                ▼                                       ── TLS across Zone Z1 (public internet) ──
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ L2/L3  INGESTION & VALIDATION  (Next.js route handlers — Vercel serverless, Zone Z3)        │
│   verify er_token (JWT) · capability check (lib/capability) · CONSENT GATE (ConsentGrant)   │
│   schema-validate event union · idempotency (event.id) · rate/replay guard · region route   │
└───────────────┬────────────────────────────────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ L4  EVENT STORE  (Prisma → SQLite dev / Postgres prod — Zone Z4)                            │
│   ProctorEvent (append-only, TTL) · PlatformEvent (lifecycle, replayable) ·                 │
│   TestAttempt/Answer · Interview/InterviewParticipant · EvidenceItem (content-addressed)    │
└───────────────┬───────────────────────────────────────────┬────────────────────────────────┘
                ▼                                             ▼
┌───────────────────────────────────┐   ┌────────────────────────────────────────────────────┐
│ L5  KNOWLEDGE / SEMANTIC GRAPH     │   │ L6  INFERENCE & SCORING  (AIOS.execute, Zone Z3)     │
│   SemanticDoc/SemanticPosting      │   │   scorecard.aggregatePanel (bias signals)            │
│   (TF-IDF, in-house)               │◄──┤   assessment scoring · proctor-risk FUSION           │
│   Career DNA: CareerProfile,       │   │   ModelRegistry (in-house providers; GPU optional)   │
│   SkillProficiency, CareerSnapshot │   │   every call → AiRun (confidence+explanation+trace)  │
│   ── assembles the Digital Twin ── │   └───────────────┬────────────────────────────────────┘
└───────────────────────────────────┘                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ L7  POLICY & GOVERNANCE ENGINE  (Zone Z3/Z6)                                                │
│   capability authz · forbidden-auto gate · consent/region policy · retention · DPIA hooks   │
└───────────────┬────────────────────────────────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ L8  REVIEWER WORKFLOW  (human-in-the-loop — Zone Z5)                                        │
│   interview scorecards · proctor review queue (events+evidence) · ChangeProposal approvals  │
│   candidate Appeal handling                                                                  │
└───────────────┬────────────────────────────────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ L9  DECISION & DOWNSTREAM                                                                    │
│   Application.status / StatusEvent · Offer/OfferEvent (M8) · SDT update · webhooks           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
      CROSS-CUTTING:  audit (AiRun, append-only) · events (emit/on/drain) · evals (EvalRun) ·
                      observability · retention sweeps (cron) · knowledge revisions (immutable)
```

*`gaze/off-screen` and `multi-speaker` are optional, low-weight Tier-B process signals; disabled unless the tenant policy and candidate consent both enable them.

### 2.3 The Semantic Event contract (typed transport)

The event union is the API boundary between L1 (device) and L3 (ingestion). It carries **facts and hashes, never raw bytes**. Observed facts (`kind:"observed"`) are distinct from derived signals (`kind:"derived"`), and no Tier-C event type exists in the core union.

```ts
// lib/perception/events.ts — Semantic Event contract (EROS M6/M7). In-house, deterministic.
export type EventSource = "on-device" | "server" | "human"
export type Severity    = "info" | "low" | "medium" | "high"

interface BaseEvent {
  v: 1
  id: string                    // client-generated UUID — idempotency key at ingestion
  ts: number                    // device epoch ms (server also stamps recvTs; clock-skew tracked)
  sessionId: string             // ProctorSession.id
  subjectId: string             // candidate User.id (the data subject)
  context: { kind: "attempt" | "interview"; id: string }
  source: EventSource
  consentRef: string            // ConsentGrant.id authorizing THIS capture purpose (fail-closed)
  confidence?: number           // 0..1 on-device detector confidence (required for `derived`)
  evidenceRef?: string          // EvidenceItem.id (content hash) — NEVER raw media inline
}

// ---- Tier B: integrity / proctoring (observed facts + bounded derived signals) ----
type ProctorEvent =
  | (BaseEvent & { type: "face.present" })
  | (BaseEvent & { type: "face.absent"; durationMs: number; severity: Severity })
  | (BaseEvent & { type: "face.multiple"; count: number; severity: Severity })       // second person
  | (BaseEvent & { type: "identity.match";  score: number })                          // vs enrolled template, on-device
  | (BaseEvent & { type: "identity.drift";  score: number; severity: Severity })
  | (BaseEvent & { type: "window.blur" }) | (BaseEvent & { type: "window.focus" })    // tab switch (→ tabSwitches)
  | (BaseEvent & { type: "fullscreen.exit" })
  | (BaseEvent & { type: "display.multiple"; count: number })
  | (BaseEvent & { type: "clipboard.paste"; chars: number; severity: Severity })
  | (BaseEvent & { type: "input.paste_burst"; chars: number; withinMs: number })
  | (BaseEvent & { type: "audio.voice" })
  | (BaseEvent & { type: "audio.multiple_speakers"; severity: Severity })             // VAD only, not content
  | (BaseEvent & { type: "gaze.offscreen"; durationMs: number; kind: "derived" })     // OPTIONAL, low-weight
  | (BaseEvent & { type: "network.disconnect" }) | (BaseEvent & { type: "network.reconnect" })

// ---- Interview lifecycle / structured evaluation ----
type InterviewEvent =
  | (BaseEvent & { type: "room.join"; role: string })  | (BaseEvent & { type: "room.leave"; role: string })
  | (BaseEvent & { type: "question.asked"; guideId: string })
  | (BaseEvent & { type: "note.added"; confidential: boolean })
  | (BaseEvent & { type: "scorecard.submitted"; panelistId: string })
  | (BaseEvent & { type: "recording.started" | "recording.stopped" })                 // consent-gated, optional
  | (BaseEvent & { type: "transcript.segment"; evidenceRef: string; kind: "derived" })// on-device STT, consented

// ---- Assessment lifecycle ----
type AssessmentEvent =
  | (BaseEvent & { type: "attempt.started" }) | (BaseEvent & { type: "attempt.submitted" })
  | (BaseEvent & { type: "question.viewed"; questionId: string })
  | (BaseEvent & { type: "answer.saved"; questionId: string })
  | (BaseEvent & { type: "integrity.flag"; ruleId: string; severity: Severity })

export type SemanticEvent = ProctorEvent | InterviewEvent | AssessmentEvent
// NOTE: there is deliberately NO emotion.* / personality.* / confidence.* / accent.* member.
// Tier-C detectors do not exist in the in-house core (see §1.5).
```

Proctor-risk **fusion** is a pure, deterministic function producing a *review trigger*, not a hiring score — bounded, explainable, and always human-adjudicated:

```ts
// lib/proctor/risk.ts — deterministic fusion → REVIEW TRIGGER (never a competency/hiring score).
export interface ProctorRisk {
  score: number                 // 0..1 review-priority, NOT a verdict
  band: "clear" | "review" | "priority-review"
  evidence: { type: string; count: number; weight: number; note: string }[]
  falsePositiveHints: string[]  // e.g. "single face.absent < 3s during a network.disconnect"
  confidence: number
  requiresHumanReview: boolean  // true for any band above "clear" — enforced downstream
}
export function fuseProctorRisk(events: ProctorEvent[], policy: ProctorPolicy): ProctorRisk { /* weighted, explainable */ }
```

### 2.4 Proposed additive data model (both-DB safe, follows existing conventions)

New models are **additive**, both-DB safe (JSON stored as `String`, scalar ids, no `User` back-relations), and consistent with the AIOS block. Existing models (`Interview`, `InterviewParticipant`, `TestAttempt`, `Answer`, `Application`, `Offer`, `AiRun`, `PlatformEvent`, `SemanticDoc`) are **reused, not duplicated**.

```prisma
// ===================== EROS M6/M7 — Interview Intelligence & Proctoring (PROPOSED, additive) =====================

// Consent is the gate for ALL perception capture. Purpose-limited, region-aware, revocable, TTL'd.
model ConsentGrant {
  id            String    @id @default(cuid())
  subjectId     String                              // candidate User.id (data subject)
  context       String                              // "attempt:<id>" | "interview:<id>"
  purpose       String                              // proctoring | identity | recording | transcript | research
  region        String    @default("EU")           // jurisdiction resolved at grant time (GDPR/BIPA/IL-AIVIA...)
  policyVersion String                              // the notice/DPIA text version shown at grant
  granted       Boolean   @default(false)
  grantedAt     DateTime?
  revokedAt     DateTime?
  expiresAt     DateTime?                           // retention horizon for data captured under this grant
  evidence      String    @default("{}")           // JSON: what was shown, checkbox states, IP-hash
  createdAt     DateTime  @default(now())
  @@index([subjectId, context])
  @@index([context, purpose])
}

// One monitored engagement (an assessment attempt or an interview). Snapshots the active policy.
model ProctorSession {
  id             String   @id @default(cuid())
  context        String                             // "attempt:<id>" | "interview:<id>"
  subjectId      String                             // candidate
  enrolledFaceRef String?                           // hash/ref of the on-device template (NOT an image)
  policySnapshot String   @default("{}")            // JSON: which detectors on, thresholds, region rules
  status         String   @default("ACTIVE")        // ACTIVE | ENDED | ABORTED
  clockSkewMs    Int      @default(0)
  startedAt      DateTime @default(now())
  endedAt        DateTime?
  @@index([context])
  @@index([subjectId])
}

// Append-only, TTL'd perception events. High-volume; retention-swept by cron. Facts + hashes only.
model ProctorEvent {
  id          String   @id @default(cuid())
  sessionId   String
  subjectId   String
  type        String                                // SemanticEvent.type
  ts          DateTime                              // device time
  recvTs      DateTime @default(now())              // server receipt time
  source      String   @default("on-device")
  severity    String   @default("info")
  confidence  Float?
  consentRef  String                                // must resolve to a valid ConsentGrant
  evidenceRef String?                               // -> EvidenceItem
  payload     String   @default("{}")               // JSON typed payload
  expiresAt   DateTime?                             // retention horizon (from ConsentGrant)
  @@index([sessionId, ts])
  @@index([type, recvTs])
  @@index([expiresAt])
}

// Content-addressed evidence pointer. Raw bytes are the exception, not the rule.
model EvidenceItem {
  id          String   @id @default(cuid())
  sessionId   String
  subjectId   String
  kind        String                                // frame_hash | clip | transcript_seg | code_snapshot
  contentHash String                                // sha256 of the artifact
  mediaId     String?                               // -> MediaAsset ONLY if consented retention applies
  meta        String   @default("{}")               // JSON: bbox, window [ts0,ts1], detector id
  expiresAt   DateTime?
  createdAt   DateTime @default(now())
  @@index([sessionId, kind])
  @@index([contentHash])
  @@index([expiresAt])
}

// Fused integrity risk + the HUMAN review outcome. AI proposes a review; a human decides.
model IntegrityReview {
  id           String   @id @default(cuid())
  sessionId    String   @unique
  subjectId    String
  riskScore    Float    @default(0)                 // 0..1 review priority (NOT a hiring score)
  band         String   @default("clear")           // clear | review | priority-review
  evidenceJson String   @default("[]")              // JSON weighted evidence list
  confidence   Float    @default(0)
  aiRunId      String?                              // -> AiRun for the fusion inference
  status       String   @default("PENDING")         // PENDING | CLEARED | UPHELD | INCONCLUSIVE
  reviewerId   String?                              // human decider (capability-gated)
  reviewNote   String?
  decidedAt    DateTime?
  createdAt    DateTime @default(now())
  @@index([status, band])
  @@index([subjectId])
}

// Structured interview evaluation persisted from lib/interview/scorecard.ts (currently computed in-memory).
model InterviewScorecard {
  id             String   @id @default(cuid())
  interviewId    String
  panelistId     String
  ratingsJson    String   @default("{}")            // competencyKey -> 1..4
  recommendation String                             // STRONG_NO | NO | YES | STRONG_YES
  notes          String?
  confidential   Boolean  @default(false)
  aiRunId        String?                            // -> AiRun for the panel aggregation
  submittedAt    DateTime @default(now())
  @@unique([interviewId, panelistId])
  @@index([interviewId])
}

// Candidate's right to contest a flag or decision (human oversight / GDPR Art.22, EU AI Act).
model Appeal {
  id          String   @id @default(cuid())
  subjectId   String
  target      String                                // "integrityReview:<id>" | "decision:<applicationId>"
  reason      String
  status      String   @default("OPEN")             // OPEN | UNDER_REVIEW | UPHELD | OVERTURNED
  handlerId   String?
  resolution  String?
  createdAt   DateTime @default(now())
  resolvedAt  DateTime?
  @@index([subjectId])
  @@index([status])
}
```

Minimal additive fields on existing models (no breaking change):

```prisma
model TestAttempt {
  // ...existing (proctored, tabSwitches)...
  proctorSessionId  String?   // -> ProctorSession
  integrityBand     String?   // clear | review | priority-review (mirror of IntegrityReview.band)
}
```

### 2.5 API & transport surface (App Router route handlers)

All routes verify the `er_token` JWT and authorize via `lib/capability` (fail-closed). Perception routes additionally enforce the consent gate. **No WebSocket is required in the near-term tier** (see §2.6).

| Method | Path | Capability | Purpose | Zone |
|---|---|---|---|---|
| POST | `/api/consent` | `platform.access` | Grant/revoke a `ConsentGrant` (returns `consentRef`) | Z3 |
| POST | `/api/proctor/:sessionId/enroll` | `platform.access` | Register on-device face template hash (`enrolledFaceRef`) | Z3 |
| POST | `/api/assessment/attempts/:id/events` | `jobs.apply` | Batched `SemanticEvent[]` beacon (consent-gated) | Z3 |
| POST | `/api/assessment/attempts/:id/answer` | `jobs.apply` | Persist `Answer` (server-scored) | Z3 |
| POST | `/api/interview/:roomCode/signal` | `interviews.host` / participant | Batched interview/proctor events | Z3 |
| GET | `/api/interview/:roomCode/room` | governance (`mayJoin`) | Join gate + WebRTC signaling exchange | Z3 |
| POST | `/api/interview/:id/scorecard` | `interviews.host` | Submit `InterviewScorecard`; triggers `aggregatePanel` | Z3 |
| GET | `/api/review/queue` | `pipeline.manage` | Proctor/integrity review queue (events + evidence) | Z5 |
| POST | `/api/review/:sessionId/decision` | `pipeline.manage` | Human `IntegrityReview` outcome | Z5 |
| POST | `/api/appeal` | `platform.access` | File a candidate `Appeal` | Z3 |
| POST | `/api/ai/execute` | `ai.execute` | Invoke an AIOS capability (`execute(capId, ctx)`) | Z3 |
| GET | `/api/twin/export` | `account.manage` | Export the candidate's Semantic Digital Twin | Z3 |
| POST | `/api/cron/proctor-retention` | `admin.super` (cron secret) | TTL sweep of `ProctorEvent`/`EvidenceItem` | Z6 |
| POST | `/api/cron/ingest-drain` | `admin.super` (cron secret) | `drain()` unprocessed `PlatformEvent`s | Z6 |

**Ingestion gate (pseudocode) — consent-first, fail-closed:**

```ts
// app/api/assessment/attempts/[id]/events/route.ts (sketch)
export async function POST(req, { params }) {
  const subject = await requireUser(req)                              // er_token / JWT
  if (!authorize(subject.caps, "jobs.apply")) return deny(403)        // capability, not role
  const batch = parseEvents(await req.json())                         // validate SemanticEvent union
  for (const e of batch) {
    const grant = await getConsent(e.consentRef)                      // CONSENT GATE
    if (!grant?.granted || grant.revokedAt || grant.subjectId !== subject.id
        || !purposeCovers(grant, e.type)) return deny(403, "consent")  // fail-closed
    if (await seen(e.id)) continue                                    // idempotency
    await prisma.proctorEvent.create({ data: toRow(e, grant.expiresAt) })
    if (e.type === "window.blur") await bumpTabSwitches(params.id)    // reuse existing signal
  }
  return ok()                                                          // fusion runs async via AIOS.execute
}
```

### 2.6 Near-term topology (Next.js 14 App Router · Vercel · Prisma) — buildable today

```
                         ┌──────────────────────────── CANDIDATE BROWSER (Z0) ──────────────────────────┐
                         │  React runner · WASM perception · WebRTC (A/V P2P) · consent UI               │
                         │  RAW media never uploaded · events via navigator.sendBeacon / fetch keepalive  │
                         └───────┬─────────────────────────────────────────────────┬────────────────────┘
                                 │ HTTPS batched events / signaling                  │ WebRTC media P2P
                                 │                                                   │ (interviewer ↔ candidate)
                                 ▼                                                   ▼
                         ┌──────────────── VERCEL EDGE (Z2) ───────────────┐   ┌──────────────────────────┐
                         │ middleware: JWT (er_token) verify · region route │   │ INTERVIEWER BROWSER (Z0) │
                         └───────┬──────────────────────────────────────────┘   └──────────────────────────┘
                                 ▼
                         ┌──────────── VERCEL SERVERLESS FUNCTIONS (Z3) ────────────┐
                         │ App Router route handlers · lib/capability (authz) ·      │
                         │ consent gate · AIOS.execute (in-house providers) ·        │
                         │ scorecard/assessment/proctor-risk (pure, deterministic)   │
                         └───────┬───────────────────────────────────────────┬──────┘
                                 ▼                                            ▼
                         ┌──────── POSTGRES / SUPABASE (Z4) ────────┐   ┌──── VERCEL CRON (Z6) ─────┐
                         │ Prisma · TestAttempt/Answer · Interview · │   │ /api/cron/proctor-retention│
                         │ ProctorSession/Event · EvidenceItem ·     │◄──┤ /api/cron/ingest-drain     │
                         │ AiRun (audit) · PlatformEvent · Consent   │   │ /api/cron/evals            │
                         └───────────────────────────────────────────┘   └────────────────────────────┘
```

**Vercel reality and how the design respects it:**
- **No long-lived WebSockets on standard serverless.** Interview A/V is **peer-to-peer WebRTC** (browser↔browser); the serverless functions do only *signaling* (SDP/ICE exchange via short-poll HTTPS on the existing `roomCode`), plus STUN. **TURN relay is an optional enterprise add-on** for restrictive NATs — never required by the core.
- **Perception events are batched HTTPS beacons**, not a socket. `navigator.sendBeacon` / `fetch(keepalive)` survive page unload; ingestion is idempotent by `event.id`.
- **Short function lifetimes** → all inference is request-scoped and deterministic; long/async fusion and retention run on **Vercel Cron** draining `PlatformEvent` (`drain()`).
- **No server-side media pipeline** → nothing heavy to host; on-device perception is what makes "deploy-on-push" viable.
- **SQLite (dev) / Postgres (prod)** both supported because every new model stores JSON as `String` with scalar ids.

### 2.7 Enterprise future-state topology (clearly separated, optional)

```
 CANDIDATE (Z0)                 EDGE / GATEWAY               STREAMING BUS            INFERENCE TIER (Z7, isolated VPC)
 ┌───────────────┐   WSS/QUIC   ┌────────────────┐  publish  ┌───────────────┐  sub  ┌──────────────────────────────┐
 │ WASM percep-  │─────────────►│ WS Gateway +    │──────────►│ Kafka/Redpanda│──────►│ edge AI workers (on-device-   │
 │ tion + optional│  live events│ TURN/SFU (media)│  events   │ (event log)   │       │ first WASM; OPTIONAL GPU CV)  │
 │ on-device STT │◄────────────►│                 │           └──────┬────────┘       │ liveness · advanced identity  │
 └───────┬───────┘   media SFU  └────────┬────────┘                  │                │ behind ModelRegistry provider │
         │                               │                           ▼                └───────────────┬──────────────┘
         │ consented recording           │                    ┌───────────────┐                       │ AiRun + confidence
         ▼ (KMS-encrypted, TTL)          ▼                    │ stream proces- │                       ▼
 ┌────────────────────┐         ┌────────────────┐           │ sors (fusion,  │              ┌────────────────────────┐
 │ Object store (S3-   │         │ Feature/graph  │◄──────────┤ evals, calib.) │─────────────►│ Postgres + Vector index │
 │ compatible, DPA'd)  │         │ store          │           └───────────────┘              │ (SDT + Career DNA)      │
 └────────────────────┘         └────────────────┘                                          └────────────────────────┘
   RETAINED ONLY under explicit consent; every subprocessor DPA-bound; KMS keys per-tenant/region.
```

**Rules that keep the enterprise tier from becoming a hard dependency:**
- Any GPU/cloud-CV/LLM capability is registered in `ModelRegistry` as an *optional provider* and invoked only through `AIOS.execute`; if absent/disabled, the in-house deterministic path still satisfies the capability.
- On-device WASM remains the **default** even in this tier; server-side CV is opt-in per tenant and DPIA-gated.
- Streaming/object-store are performance/scale enhancements; the semantic-event contract (§2.3) is identical, so a tenant can move from near-term to enterprise without changing the device code.
- **Tier-C detectors remain refused for scoring** here too — the enterprise tier adds *scale*, not *pseudoscience*.

### 2.8 Trust boundaries

```
 Z0 CANDIDATE DEVICE      Z1 PUBLIC NET   Z2 VERCEL EDGE   Z3 SERVERLESS     Z4 DATA        Z5 REVIEWER   Z6 GOVERN/AUDIT   Z7 ENTERPRISE INFER
 ┌───────────────────┐    ┌──────────┐   ┌────────────┐   ┌────────────┐   ┌─────────┐    ┌─────────┐   ┌─────────────┐   ┌────────────────┐
 │ raw media (sovereign,│  │  TLS 1.3 │   │ JWT verify │   │ authz+consent│  │ Postgres│    │ humans  │   │ AiRun (WORM)│   │ optional GPU/CV │
 │ ephemeral) · WASM   │──┤  only    │──►│ region     │──►│ AIOS.execute │─►│ (enc.   │───►│ decide  │──►│ ChangeProp. │   │ isolated VPC   │
 │ untrusted for       │  │ ciphertext│  │ route      │   │ deterministic│  │ at rest)│    │ cap-gated│  │ consent log │   │ per-tenant KMS │
 │ integrity           │  └──────────┘   └────────────┘   └────────────┘   └─────────┘    └─────────┘   └─────────────┘   └────────────────┘
        ▲  trust boundary        ▲               ▲                ▲              ▲               ▲              ▲                  ▲
        │  raw NEVER crosses ────┘  everything    │  only signed   │  PII        │  no raw       │  read-only    │  DPA-bound,
        │  (core tier)              encrypted      │  facts+hashes  │  isolated   │  media by     │  append-only  │  never core dep
        │                                          │  cross here    │             │  default      │
```

| Boundary | From → To | Threats controlled | Controls |
|---|---|---|---|
| **Z0 → Z1** | Device → internet | Raw-media exfiltration, MITM | Raw stays on-device (core tier); TLS 1.3; only signed semantic events cross |
| **Z1 → Z2** | Internet → edge | Forged identity, wrong-region routing | `er_token` JWT verify in middleware; region resolution; rate limiting |
| **Z2 → Z3** | Edge → compute | Privilege escalation, missing consent | Capability authz (never role); **consent gate**; `forbidden-auto` block; schema validation; idempotency |
| **Z3 → Z4** | Compute → DB | PII sprawl, over-retention | Data minimization; JSON-hashed inputs (`inputsHash`); TTL/`expiresAt` sweeps; encryption at rest |
| **Z3 → Z5** | Compute → reviewer | Confidential leakage, unaccountable decisions | `mayView`/`maySeeConfidential` redaction; capability-gated queues; human decision mandated |
| **Z3/Z5 → Z6** | Any → audit/governance | Tampering, self-approval | Append-only `AiRun`; immutable `KnowledgeRevision`; `ChangeProposal` (AI proposes, humans approve); nothing self-approves |
| **Z3 ↔ Z7** | Core ↔ enterprise inference | Vendor lock-in, unlawful subprocessing | Optional `ModelRegistry` provider only; DPA-bound; per-tenant/region KMS; never a core dependency |

### 2.9 Reference data flows

**A) Structured interview (near-term, in-house):**

```
Candidate + panelists → GET /api/interview/:roomCode/room
  → governance.mayJoin() (visibility/seniority) → WebRTC A/V P2P established (media never touches server)
  → on-device perception → POST /api/interview/:roomCode/signal (room.join, question.asked, window.blur ...)
  → panelists submit InterviewScorecard → AIOS.execute("interview.scorecard.aggregate")
        → scorecard.aggregatePanel() → PanelResult { decision, consensus, biasSignals, confidence }
        → AiRun written (confidence + explanation + bias-signal trace)
  → HUMAN reviews aggregation + bias signals → decision → StatusEvent / Offer  (never auto-decided)
  → SDT updated (competency evidence linked to CareerProfile / SkillProficiency)
```

**B) Proctored assessment (near-term, in-house):**

```
Candidate → POST /api/consent (proctoring, identity) → consentRef
  → POST /api/proctor/:sessionId/enroll (on-device template hash)
  → attempt.started → on-device WASM emits ProctorEvents → batched to /api/assessment/attempts/:id/events
        → CONSENT GATE + idempotency + append to ProctorEvent (TTL); window.blur bumps TestAttempt.tabSwitches
  → answers scored server-side (deterministic) → attempt.submitted
  → cron/AIOS.execute("proctor.risk.fuse") → fuseProctorRisk() → IntegrityReview { band, evidence, confidence }
        → AiRun written;  band>"clear" ⇒ requiresHumanReview
  → REVIEW QUEUE (Z5): human adjudicates IntegrityReview (CLEARED/UPHELD/INCONCLUSIVE)   ← never automated
  → candidate may file Appeal → human handler → UPHELD/OVERTURNED
  → retention sweep (cron) purges ProctorEvent/EvidenceItem past expiresAt
```

Both flows share one invariant: **inference produces an explainable, evidence-linked recommendation with confidence; a capability-holding human makes the decision; the candidate can appeal; and every step leaves an immutable `AiRun`.** That invariant, enforced by the AIOS gateway rather than left to convention, is the architecture's core safety and differentiation property.

## 3. AI Architecture

## 3.1 Design stance

Modules 6 (Interview Intelligence) and 7 (Assessment/Proctoring) add a **perception plane** to a platform that already has cognition and decision planes. Nothing here is a new runtime: every AI action still flows through the existing `AIOS.execute(capId, ctx)` gateway (`lib/aios/execute.ts`), is authorized by capability (never role, `lib/capability/policy.ts`), is audited to one immutable `AiRun` row (`lib/aios/audit.ts`), and fans out as a `PlatformEvent` for replayable learning (`lib/aios/events.ts`). The perception plane is different in exactly one respect — its **input originates on the candidate's device from biometric-adjacent sensors** — and that single fact drives every constraint below: raw media never leaves the device, capture is consent-gated and region-aware, and no perception output is ever a hiring *score*.

**Three planes, one gateway:**

```
┌───────────────────── DEVICE (candidate browser) — TRUST BOUNDARY ─────────────────────┐
│  Sensors:  camera │ mic │ screen │ DOM input │ assessment telemetry                     │
│     │                                                                                   │
│  ┌──▼ PERCEPTION LAYER  (on-device only; raw pixels/audio never cross the boundary) ─┐  │
│  │  detectors: face-presence · visibility · 2nd-person · occlusion · head-pose(coarse)│  │
│  │             object-presence · VAD · speaker-turn · focus/tab · paste/keystroke     │  │
│  │  each emits a SemanticEvent { confidence, evidence, method } — NO media            │  │
│  └───────────────────────────────┬───────────────────────────────────────────────────┘  │
│  privacy filter:  infer-in-RAM ▸ discard raw ▸ state-change coalesce ▸ sample ▸ batch  │
└──────────────────────────────────┼─────────────────────────────────────────────────────┘
                                    │  WSS / HTTPS batch  ── semantic events only ──
┌───────────────────────────────────▼──────────────── SERVER (Next.js API on Vercel) ────┐
│  /api/proctor/ingest → AIOS.execute(capId, ctx)                                          │
│     resolve capability ▸ safe-evolution gate ▸ authz(caps) ▸ provider ▸ AiRun ▸ emit()  │
│                                                                                          │
│  ┌── COGNITION LAYER  (in-house deterministic engines, lib/aios/*) ────────────────────┐ │
│  │  reason · evaluate(rubric) · reflect · recommend · calibrate                         │ │
│  │  + Module-6/7: sessionizer · cross-modal correlator · integrity aggregator ·        │ │
│  │    scorecard roll-up (lib/interview/scorecard.ts) · bias/process signals            │ │
│  └────────────────────────────────────┬────────────────────────────────────────────────┘ │
│  ┌── DECISION LAYER  (human-in-the-loop; advisory only) ───────────────────────────────┐ │
│  │  panel decides · adverse actions = forbidden-auto → ChangeProposal · candidate appeal│ │
│  │  every output carries confidence + evidence + validity caveat + audit ref           │ │
│  └─────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

The trust boundary is the browser sandbox. **Everything above the WSS line is on-device and disposable; everything below is semantic, audited, and governed.**

## 3.2 Model-agnostic layering: perception → cognition → decision

| Plane | Responsibility | Where it runs | Default (mandatory) implementation | Optional tier |
|---|---|---|---|---|
| **Perception** | Turn sensor frames into typed, time-aligned *observations of events* (never traits) | Candidate device | Deterministic heuristics + bundled tiny on-device models (WASM/WebGPU), weights shipped with the app | External/GPU CV as an on-prem enterprise provider |
| **Cognition** | Reason over event streams + structured assessment data; aggregate, correlate, calibrate | Server (`lib/aios/*` engines) | In-house deterministic engines (`reason`, `evaluate`, `recommend`, `reflect`) | External LLM only for *drafting* human-facing summaries, never for scoring |
| **Decision** | Convert cognition into an *advisory* a human accepts/rejects | Server + human UI | Human-in-the-loop; adverse actions are `forbidden-auto` | — (never automated) |

The layering is **model-agnostic because the provider is a database row.** A capability (`Capability.provider`) resolves to a registered provider function (`registerProvider(key, fn)` in `execute.ts`). Swapping the in-house deterministic face-presence heuristic for a bundled WASM model, or later for an on-prem GPU model, is a `ModelRegistry`/`Capability` row change — no call-site changes, because callers only ever see `AIOS.execute("proctor.integrity.aggregate", ctx)`. This is the same pattern the platform already uses for its foundation models (`MODELS[]` in `lib/aios/registry.ts`, e.g. `tfidf-embed-v1`, `icire-rank-v1`).

## 3.3 Riding the existing `execute()` gateway

New Module-6/7 capabilities are registered exactly like existing ones, extending `CAPABILITIES[]` in `lib/aios/registry.ts`. The gateway already gives us, for free: fail-closed authz, the `forbidden-auto` safe-evolution gate (`execute.ts:30`), immutable `AiRun` audit with `inputsHash` (no PII persisted), calibrated `confidence`, human-facing `explanation`, and a `steps` trace.

**New capability seeds (proposed):**

```ts
// lib/aios/registry.ts — appended to CAPABILITIES[]
// safetyClass semantics (existing): standard | sensitive | forbidden-auto
//   sensitive      → may run automatically, but requires a consent precondition + region gate
//   forbidden-auto → NEVER runs automatically; produces a ChangeProposal for a human (execute.ts:30)
[
  // ── Module 7: proctoring / integrity (observational only) ──────────────────
  { capId: "proctor.session.start",     name: "Start a proctored session (consent + region gate)",
    provider: "proctor.session.start",  modelId: "proctor-consent-v1", safetyClass: "sensitive",  permissions: ["auth","proctor.operate"] },
  { capId: "proctor.signal.ingest",     name: "Ingest on-device semantic proctor events",
    provider: "proctor.signal.ingest",  modelId: "proctor-sessionize-v1", safetyClass: "sensitive", permissions: ["auth"] },
  { capId: "proctor.integrity.aggregate", name: "Aggregate integrity EVENTS into a review packet",
    provider: "proctor.integrity.aggregate", modelId: "integrity-agg-v1", safetyClass: "sensitive", permissions: ["proctor.review"] },
  { capId: "proctor.face.verify",       name: "1:1 identity verification (consent-gated, on-device match)",
    provider: "proctor.face.verify",    modelId: "face-verify-1to1-v1", safetyClass: "sensitive",  permissions: ["auth","identity.verify"] },

  // ── Module 6: interview intelligence (advisory) ────────────────────────────
  { capId: "interview.scorecard.aggregate", name: "Panel scorecard roll-up + bias/process signals",
    provider: "interview.scorecard.aggregate", modelId: "scorecard-agg-v1", safetyClass: "standard", permissions: ["interview.assess"] },
  { capId: "interview.summary.draft",   name: "Draft a human-editable interview summary from notes/transcript",
    provider: "interview.summary.draft", modelId: "extractive-summary-v1", safetyClass: "sensitive", permissions: ["interview.assess"] },

  // ── Adverse-action gate — ALWAYS forbidden-auto ────────────────────────────
  { capId: "recruit.adverse.propose",   name: "Propose an adverse action (reject/flag) — human approval required",
    provider: "recruit.adverse.propose", modelId: "adverse-gate-v1", safetyClass: "forbidden-auto", permissions: ["recruit.decide"] },
]
```

**Why `forbidden-auto` matters here.** EU AI Act Art. 22 (GDPR) forbids solely-automated decisions with legal/significant effect. Any capability that could *reject or penalize a candidate* is `safetyClass: "forbidden-auto"`, so `execute.ts:30` returns `{status:"blocked", error:"requires_human_approval"}` and writes a blocked `AiRun` — the action becomes a `ChangeProposal` a human must approve. Perception and aggregation are `sensitive` (they run, but only behind consent + region gates enforced in the provider); *deciding* is never automatic.

**Consent as a first-class precondition.** `sensitive` capabilities in Modules 6/7 must resolve a valid `ConsentGrant` before doing work. The provider checks it and fail-closes:

```ts
registerProvider("proctor.signal.ingest", async (ctx, spec) => {
  const grant = await requireConsent(ctx.input.sessionId, "PROCTORING", ctx.input.region)
  if (!grant.ok) throw new Error("consent_absent_or_expired") // → AiRun status:"error", nothing stored
  const events = validateSemanticEnvelope(ctx.input.events)   // rejects any payload carrying media
  const out = sessionize(events)                              // deterministic
  return { output: out, confidence: out.confidence,
           explanation: out.humanSummary, modelId: spec.modelId }
})
```

## 3.4 Deterministic in-house engines vs optional on-device models

Every capability has a **mandatory in-house path** and an **optional accelerated path**. The core platform never hard-depends on the optional path (constraint 1).

| Function | Mandatory in-house (near-term, buildable now) | Optional tier (enterprise/future) | Never |
|---|---|---|---|
| Face present / absent | Frame-difference + luminance/skin heuristics; or bundled tiny WASM face detector | On-prem GPU detector | Cloud face API as a hard dependency |
| Second person present | Multi-region motion + multi-face count from the same detector | Higher-recall on-device model | Uploading frames to classify |
| Head pose / gaze | Coarse landmark PnP → yaw/pitch buckets (`center/left/right/down`) | Fine gaze model (on-device) | Continuous gaze *scoring* |
| Object (phone/paper) | Bundled tiny object detector (few classes) or edge/rectangle heuristic | On-prem detector, more classes | Trait inference from objects |
| Speech activity / turns | Energy + zero-crossing VAD; diarization by turn-taking, **not identity** | On-device diarizer | Emotion/accent/personality from voice |
| Integrity aggregation | Deterministic rule engine over event counts/durations (like `scorecard.ts`) | ML anomaly model (advisory only) | A black-box "cheating score" |
| Interview summary | Extractive summarizer over panelist notes (in-house, `tfidf`-style) | External LLM to *draft* (human edits) | LLM that *decides* outcome |

The cognition-layer engines already exist and are reused verbatim: `lib/interview/scorecard.ts` (`aggregatePanel` → per-competency means, consensus, decision, `biasSignals[]`, calibrated `confidence`) is the template for `integrity-agg-v1` — deterministic, explainable, every signal explains itself in plain language, and *nothing about protected attributes ever enters the computation*.

## 3.5 The confidence + evidence contract (every inference)

**No inference may leave any layer without confidence, evidence, method, and a validity caveat.** This is the contract that makes the system auditable and appealable, and it maps 1:1 onto the existing `AiRun` columns.

```ts
// lib/aios/contract.ts  (new — the universal inference envelope)
export interface Evidence {
  kind: "event" | "metric" | "rule" | "threshold" | "sample"
  ref: string          // eventId, metric name, or rule id — resolvable for audit
  weight: number       // 0..1 contribution to the conclusion
  detail?: string      // human-readable ("face absent 14s across 3 spans")
}

export interface ValidityCaveat {
  scientificBasis: "observable-event" | "contested" | "not-supported"
  knownLimits: string[]      // e.g. ["low light lowers recall", "not an identity claim"]
  notA: string[]             // e.g. ["not a measure of honesty", "not a hiring score"]
}

export interface Inference<T> {
  capId: string
  value: T
  confidence: number                 // 0..1, CALIBRATED (see §3.6)
  method: "deterministic" | "on-device-model" | "external-model"
  modelId?: string
  evidence: Evidence[]               // MUST be non-empty when confidence > 0
  validity: ValidityCaveat
  abstain: boolean                   // true ⇒ below threshold: report "unknown", never guess
  reviewRequired: boolean            // true ⇒ routes to a human before any effect
}
```

**Mapping onto `AiRun` (`prisma/schema.prisma:764`, `lib/aios/audit.ts`):**

| Contract field | `AiRun` column | Notes |
|---|---|---|
| `value` | `outputs` (JSON, capped 20k) | semantic only, never media |
| `confidence` | `confidence` (Float 0..1) | calibrated |
| `evidence[]` + `method` | `steps` (JSON trace) | the "why", resolvable |
| human summary of `validity` | `explanation` | user-appropriate reason (§26) |
| `capId` | `capId` | |
| `modelId` | `modelId` | provider/model actually used |
| inputs | `inputsHash` (sha256, no PII) | raw never stored |
| gate outcome | `status` = ok\|denied\|error\|**blocked** | `blocked` = forbidden-auto |

**Contract invariants (enforced in `execute()` wrapper + provider unit tests):**
1. `confidence > 0 ⇒ evidence.length > 0`. A conclusion with no evidence is a bug, not an inference.
2. `abstain = true` when `confidence < capThreshold`. The system says *"unknown"*, never a low-confidence guess that could taint a decision.
3. Any inference feeding a person-affecting decision has `reviewRequired = true`.
4. `validity.notA` is mandatory for every biometric-derived output and must state what the output is **not** (not honesty, not competence, not a score).
5. Inferences whose `validity.scientificBasis` is `"contested"` or `"not-supported"` are **rejected at registration** — the provider must not exist (see §4 DO-NOT list). This is how "no pseudoscience" is enforced structurally, not by policy memo.

## 3.6 Confidence calibration (in-house, honest)

Raw detector scores are miscalibrated. Each detector ships a **monotonic calibration map** (isotonic/Platt-style, fit offline on internal labeled data) so a reported `0.8` means "≈80% of the time this observation is correct." Calibration curves are versioned in `ModelRegistry` and their reliability is tracked over time in the existing `EvalRun` table (`schema.prisma:883`, metrics like `integrity_flag_precision`, `face_verify_far`). When a detector's live precision drifts below floor, the sessionizer raises its abstain threshold automatically — a self-evaluation loop the platform already supports (`reflect`/`EvalRun`), degrading *safely* toward "unknown" rather than toward false accusations.

## 3.7 Human-in-the-loop & appeal (cross-cutting)

- **Advisory only.** Module 6/7 never changes an `Application.status` or `TestAttempt.passed` on its own. It produces review packets (`IntegrityFlag`, aggregated scorecards) surfaced to a human with the required capability.
- **Adverse-action gate.** Any reject/penalize path routes through `recruit.adverse.propose` (`forbidden-auto`) → `ChangeProposal` → human approval, fully audited.
- **Candidate rights.** Every `IntegrityFlag` and every biometric event is disclosable to the candidate (evidence + confidence + validity caveat) and carries an `appealState`. Appeals create a `PlatformEvent("integrity.appealed")` that reopens the packet for a second human reviewer.
- **Auditability.** Reconstructing "why was this candidate flagged?" is a single query over `AiRun` (by `subjectId`/`capId`) joined to `PerceptionEvent`/`IntegrityFlag` — no hidden state.

---

## 4. Computer Vision Architecture

## 4.1 Principles (read before the table)

1. **On-device, raw-never-leaves.** All CV runs in the candidate's browser (WASM / WebGPU). Frames live in RAM only long enough to infer, then are discarded. Only `SemanticEvent`s (§5) egress.
2. **Observable events, not traits.** CV flags *what is observable in the frame* (a face is/ isn't present, a second face appeared, the phone-shaped object entered view). It never infers character, emotion, honesty, competence, or demographic traits.
3. **In-house first, model-optional.** Every detector has a deterministic heuristic fallback that runs with **zero downloaded weights**; bundled tiny models (shipped with the app, not fetched from a third party) are an accuracy upgrade, not a dependency. GPU/cloud CV is a clearly separated enterprise tier.
4. **Consent- and region-gated.** No camera access without an active `ConsentGrant` for `PROCTORING` valid in the candidate's region. Biometric identity verification (face recognition) is a separate, stricter grant.
5. **Confidence + evidence per detector**, per §3.5. Low light, occlusion, and unusual setups *lower confidence and trigger abstain* — they never manufacture accusations.

## 4.2 The on-device CV stack (near-term, buildable on this platform)

```
 getUserMedia(video)  ─►  <video> (never rendered to a visible sink for proctoring)
        │
        ▼   requestVideoFrameCallback @ adaptive 1–4 fps (NOT 30fps)
   OffscreenCanvas  ──►  downscaled grayscale/RGBA tile (e.g. 160×120)  [RAM only]
        │
        ├─► Detector graph (WASM/WebGPU; deterministic fallback if weights absent)
        │      ├ face-presence / count
        │      ├ visibility / occlusion (luma + coverage)
        │      ├ head-pose (coarse, landmark PnP)
        │      └ object-presence (tiny detector or edge/rect heuristic)
        │
        └─► frame DISCARDED (canvas cleared) ── no frame retained, no upload
        ▼
   SemanticEvent emitter  ──►  privacy filter  ──►  batch (§5)
```

**Detector taxonomy — feasibility, limits, gating, evidence:**

| Detector | In-house method (mandatory path) | On-device feasibility *now* | Accuracy / validity limits | Emits (event `kind`) | Consent tier | Confidence source / evidence |
|---|---|---|---|---|---|---|
| **Face presence** | Bundled tiny face detector (WASM); fallback: motion + skin-tone + luma-variance heuristic | High. 1–4 fps on a mid laptop CPU | Low light, dark skin under poor WB, backlight → lower recall (must be calibrated per §3.6, not left to bias illumination) | `face.present` / `face.absent{durationMs}` | Proctoring | detector score → calibrated; evidence = span durations, luma |
| **Face count / second person** | Multi-detection count from same detector; fallback: disjoint motion-region count | Medium-High | Posters, reflections, screens behind candidate → false positives; hence **event, human-reviewed** | `person.second{count}` | Proctoring | count + bbox separation (normalized), persistence over N frames |
| **Occlusion / visibility** | Coverage + luma-variance over face ROI; hand/object over camera → sudden coverage drop | High | Cannot distinguish *intent* (adjusting glasses vs. hiding) — only reports *visibility*, never motive | `face.occluded{ratio}` / `frame.dark` | Proctoring | coverage ratio, luma; low ratio ⇒ abstain on downstream |
| **Head pose (coarse)** | Landmark subset → PnP → yaw/pitch → 5 buckets (`center/left/right/up/down`) | Medium | Coarse only; head pose **is not gaze**, gaze **is not attention**. Buckets, not angles-as-truth | `pose.bucket{yaw,pitch}` | Proctoring | landmark reprojection error as inverse-confidence |
| **Gaze (coarse, optional)** | Eye-region vector estimate (on-device) | Medium (WebGPU helps) | Scientifically weak as an "attention/cheating" proxy → **process signal only, low weight, human-reviewed**, or omit | `gaze.offscreen{durationMs}` | Proctoring (opt-in) | vector confidence; high abstain threshold |
| **Object presence (phone/paper)** | Bundled tiny detector (few classes: phone, paper/book) or rectangle/edge + aspect heuristic | Medium | Class confusion (tablet vs book), partial views → **event, human-reviewed**, never auto-adverse | `object.present{class}` | Proctoring | class score + persistence; class enumerated, not free-text |
| **Identity verification (1:1)** | On-device template extraction from a **candidate-provided** reference (e.g. ID photo the candidate consents to), matched against live frame **on-device**; only match/no-match + score egresses | Medium (heaviest; enterprise-leaning) | Demographic error-rate disparities are well documented → **1:1 only, consent-gated, region-gated, ephemeral template, human fallback on no-match** | `identity.match{score}` / `identity.nomatch` | **Biometric (separate grant)** | calibrated FAR/FRR from `EvalRun`; match threshold region-tunable |

**Bundled ≠ external.** "In-house" permits shipping small model weights *inside our own bundle*, versioned in `ModelRegistry`, served from our origin, runnable offline in WASM/WebGPU. What it forbids (constraint 1) is a **mandatory runtime dependency on a third-party/cloud CV service or GPU**. When no weights are available (locked-down device, download blocked), the deterministic fallback still produces the core presence/second-person/occlusion events at reduced recall — the session degrades, it does not fail.

## 4.3 Face RECOGNITION — the hard rules

Face *recognition* (identity) is categorically separated from face *detection* (presence).

- **1:1 verification only.** "Is the live person the same as the reference this candidate consented to provide?" Yes/no + score. **Never 1:N.** There is no gallery, no cross-session matching, no watchlist, no surveillance. A 1:N code path must not exist in the repository.
- **Consent + region gate.** Requires a distinct `ConsentGrant` of kind `BIOMETRIC_VERIFICATION`. In BIPA (Illinois) and comparable regimes, verification is **disabled by default** and only enabled where a valid, informed, written-equivalent consent and a lawful basis (GDPR Art. 9) exist. The region gate (§3.3) refuses the capability otherwise.
- **On-device match, ephemeral template.** The biometric template is computed **on the device**, matched **on the device**, and destroyed at session end. Only the boolean + calibrated score leaves. Raw reference and live frames are never uploaded. No template is persisted server-side unless a separate explicit retention consent exists — and even then only a non-reversible hash with a hard retention TTL.
- **Human fallback.** A `nomatch` never auto-rejects; it routes to a human identity check. Documented demographic error disparities make automated adverse action on face recognition unacceptable.

**Prisma (ephemeral by design):**

```prisma
model BiometricVerification {
  id            String   @id @default(cuid())
  sessionId     String
  method        String   @default("face-1to1")   // enumerated; 1:N is not a valid value
  result        String                            // MATCH | NOMATCH | ABSTAIN
  score         Float?                            // calibrated; null when abstain
  region        String                            // gate that authorized it
  consentId     String                            // FK to ConsentGrant(BIOMETRIC_VERIFICATION)
  templateStored Boolean @default(false)          // default: template destroyed on device
  expiresAt     DateTime                          // hard TTL; row purged by retention cron
  createdAt     DateTime @default(now())
  @@index([sessionId])
}
```

## 4.4 DO-NOT list (enforced structurally, not by policy alone)

These providers **must not exist**. Attempting to register a capability whose `validity.scientificBasis ∈ {contested, not-supported}` fails at registration (§3.5 invariant 5).

- ❌ **Emotion / affect recognition** from face or voice as any candidate signal. (Contested science; EU AI Act restricts emotion inference in the workplace.)
- ❌ **Personality / "confidence" / "trustworthiness" / "leadership potential"** inference from face, micro-expressions, or voice. Pseudoscience; discriminatory.
- ❌ **Demographic inference** — age, gender, race, ethnicity, disability, pregnancy, health — from any modality, for any purpose, including "fairness auditing" (use voluntary self-report instead).
- ❌ **Accent / dialect / "communication quality"** scoring from audio.
- ❌ **1:N face recognition, gallery matching, cross-session or cross-candidate identity linking, watchlists.**
- ❌ **Continuous gaze/attention *scoring*** that produces a number affecting outcomes. (Coarse offscreen *events* are permissible as low-weight, human-reviewed process signals — or omitted.)
- ❌ **A single "cheating score" / "integrity score"** that reduces observed events to one number driving auto-rejection.
- ❌ **Covert capture** — recording without an active, visible consent and a live capture indicator.
- ❌ **Raw frame/audio egress or server-side storage** as a normal path. (Optional evidence clips are a separate, off-by-default, consent-gated, quarantined enterprise feature — §5.6.)

## 4.5 Enterprise / aspirational tier (explicitly separated)

Clearly out of the near-term, buildable-on-Vercel core; offered only as an opt-in, on-prem/enterprise extension with its own DPIA:

- On-prem GPU detectors for higher-recall face/object detection (still 1:1 for identity).
- On-device WebGPU diarization (turn attribution, **never** speaker-identity classification).
- Richer object taxonomies (secondary monitor, additional persons at range).
- Encrypted, quarantined evidence clips for human review with auto-expiry.

Each enterprise detector still obeys §3.5 (confidence+evidence), §4.4 (DO-NOT), and the `forbidden-auto` adverse-action gate. Heavier ≠ more authority.

---

## 5. Multimodal Pipeline

## 5.1 From sensors to time-aligned semantic events

Four sensor classes and one server clock become a single, ordered, time-aligned stream of `SemanticEvent`s. **The unifying principle (the platform's Semantic Digital Twin): store the *meaning of what happened*, never the raw recording.**

```
 CAMERA ─┐                         ┌─ vision.*  (face/person/object/pose)
 MIC ────┤   on-device detectors   ├─ audio.*   (VAD, turn — NOT identity/emotion)
 SCREEN ─┤ ───────────────────────►├─ screen.*  (share start/stop, focus, tab)
 INPUT ──┤   (WASM/WebGPU/deter.)  ├─ input.*   (paste, keystroke cadence — integrity only)
 TEST ───┘                         └─ assess.*  (question nav, answer commit, timing)
                                          │
                         ┌────────────────▼───────────────────┐
                         │  Session clock: t0 + monotonic tMs  │  ← time alignment
                         │  seq (gap detection) + wallClock    │
                         └────────────────┬───────────────────┘
                    privacy filter ▸ coalesce ▸ sample ▸ ring-buffer ▸ batch
                                          │  WSS / HTTPS
                              /api/proctor/ingest  → AIOS.execute("proctor.signal.ingest")
                                          │
                    AiRun audit ─┬─ emit PlatformEvent("interview.signal")
                                 └─ (later) drain() → sessionize → correlate → IntegrityFlag
```

**Time alignment model.** At session start the server issues `t0` (server wall time) and the device establishes a **monotonic clock** (`performance.now()`), so every event carries `tMs` = ms since `t0` (immune to wall-clock skew/adjustment) plus a `wallClock` for human correlation and a per-session monotonic `seq` for **gap detection** (a missing `seq` range means events were dropped or suppressed — itself an auditable observation, never silently ignored). Clock offset is measured once via a round-trip and stored on the session; cross-modal correlation (§5.4) uses `tMs` exclusively.

## 5.2 The `SemanticEvent` envelope (the wire contract)

```ts
// lib/proctor/events.ts — the ONLY thing allowed to cross the device boundary
export type Modality = "vision" | "audio" | "screen" | "input" | "assessment" | "system"

export interface SemanticEvent<K extends string = string, P = unknown> {
  v: 1                              // schema version
  sessionId: string                // ProctorSession.id
  seq: number                      // monotonic per session — gaps are detectable
  tMs: number                      // ms since session t0 (monotonic; alignment key)
  wallClock: string                // ISO-8601, correlation only
  modality: Modality
  kind: K                          // enumerated: "face.absent" | "person.second" | ...
  confidence: number               // 0..1, calibrated on device (§3.6)
  method: "deterministic" | "on-device-model"
  detectorId: string               // "vision.facepresence@1.3-wasm" (version-pinned)
  evidence: Evidence[]             // metrics/thresholds that fired (§3.5)
  payload: P                       // SCALARS / ENUMS / NORMALIZED bbox ONLY — never media
  privacy: { rawDiscarded: true; redactions: string[] } // asserted at source
}
```

**Egress schema validation is a hard gate.** `/api/proctor/ingest` rejects any event whose `payload` contains a data-URI, base64 blob, media MIME, or oversized field. The type system forbids raw media at compile time; the ingest validator forbids it at runtime; the provider re-checks (defense in depth). An event that violates this is dropped and logged as a `system.schema_violation` — the raw data is *never* accepted "just in case."

**Illustrative event kinds & payloads:**

| Modality | `kind` | `payload` (semantic only) | Notes |
|---|---|---|---|
| vision | `face.absent` | `{ durationMs }` | span, not frames |
| vision | `person.second` | `{ count, sepNorm }` | normalized bbox separation |
| vision | `object.present` | `{ class: "phone"\|"paper", persistMs }` | enumerated class |
| vision | `pose.bucket` | `{ yaw:"left", pitch:"center" }` | buckets, not angles-as-truth |
| audio | `speech.active` | `{ durationMs }` | VAD only |
| audio | `turn.change` | `{ fromTurn, toTurn }` | turn-taking, **not identity** |
| screen | `focus.lost` | `{ durationMs }` | window blur |
| screen | `tab.switch` | `{}` | maps to existing `TestAttempt.tabSwitches` |
| input | `paste.large` | `{ chars }` | integrity signal, not content |
| input | `type.cadence` | `{ burst:boolean }` | cadence stats, never keylogged text |
| assessment | `answer.commit` | `{ questionId, elapsedMs }` | ties to `Answer` |
| system | `sensor.denied` | `{ sensor:"camera" }` | consent/permission state |

Note `input.*` carries **statistics, never captured text** — no keystroke content, ever. `tab.switch` deliberately reuses the field the platform already has (`TestAttempt.tabSwitches`, `schema.prisma:1714`), so Module 7 *extends* existing proctoring rather than duplicating it.

## 5.3 On-device inference → emission → backpressure/sampling

The device must never flood the link nor drain the battery. Emission is **state-change-driven and adaptively sampled**, not frame-by-frame.

**Sampling & backpressure policy:**

| Mechanism | Rule |
|---|---|
| Base sample rate | Vision 1–4 fps (adaptive), audio VAD 20 ms hop, screen/input event-driven |
| **State-change only** | Emit on *transition* (`present→absent`), not every frame it stays absent |
| **Debounce / coalesce** | Collapse flapping (e.g. `face.absent` shorter than `minSpanMs` is buffered, then summarized as one span with `durationMs`) |
| **Severity-aware drop** | Under backpressure, drop low-severity/high-frequency events first (`pose.bucket` before `person.second`); safety-relevant events are never dropped silently |
| **Local ring buffer** | Bounded (e.g. 5 min) in-memory buffer; on WS reconnect, replay by `seq` so no gap is fabricated |
| **Batch flush** | Every N ms or M events (whichever first) over WSS; HTTPS `POST /api/proctor/ingest` fallback when WS unavailable |
| **Adaptive downshift** | On thermal/CPU pressure (or low `confidence` from poor conditions), lower fps and raise abstain thresholds rather than emit noise |
| **Gap honesty** | If sampling *had* to drop, emit `system.sampling_degraded{fromFps,toFps}` — degradation is itself an audited observation |

Backpressure never manufactures signal: when the device can't observe reliably, it reports *less certainty and explicit gaps*, which the cognition layer treats as "unknown," not as suspicion.

## 5.4 Ingest, sessionization & offline cross-modal enrichment

Ingest is thin and fail-closed; heavy correlation is deferred to the existing event/drain machinery so it is **idempotent and replayable** (`lib/aios/events.ts`).

**Hot path (per batch):**
```ts
// app/api/proctor/ingest/route.ts (sketch)
export async function POST(req: Request) {
  const { sessionId, events } = await parse(req)              // validate envelope; reject media
  const ctx = { subjectId: sub(req), caps: caps(req),
                input: { sessionId, region: regionOf(req), events } }
  const r = await execute("proctor.signal.ingest", ctx)      // consent+region gate inside provider
  return json(r.ok ? { accepted: events.length } : { error: r.error }, r.ok ? 200 : 403)
}
```
The provider validates consent (§3.3), persists compact `PerceptionEvent` rows, writes the `AiRun`, and calls `emit("interview.signal", …)`. It does **not** correlate synchronously.

**Cold path (offline enrichment via `drain()`):** registered handlers (`on("interview.signal", …)`) run inline best-effort and are re-runnable from the existing ingest cron (`drain(limit)`):
1. **Sessionize** — fold spans/counts per `sessionId` (durations, transition counts).
2. **Cross-modal correlate** — align by `tMs` (e.g. `face.absent` co-occurring with `focus.lost` and `object.present:phone` is a *stronger, corroborated* observation than any alone).
3. **Aggregate integrity** — `AIOS.execute("proctor.integrity.aggregate")`, a deterministic rule engine mirroring `aggregatePanel` in `lib/interview/scorecard.ts`: it produces a **review packet of enumerated, self-explaining observations with counts, durations, corroboration, and calibrated confidence — never a single score.**
4. **Emit `IntegrityFlag`** for human review; any adverse consequence must still pass the `forbidden-auto` gate.

Because everything rides `PlatformEvent`, "why was this flagged and can we reproduce it?" is answered by replaying the same events through the same deterministic handlers — the platform's core auditability guarantee, extended to proctoring.

## 5.5 Privacy filter (before anything leaves the device)

Five ordered stages; the boundary is crossed only after stage 4.

```
1. CAPTURE GATE   consent(kind, region) valid?  ─no─► sensors never start; system.sensor_denied
        │yes
2. INFER-IN-RAM   frame → detector → result      (frame held only in OffscreenCanvas RAM)
        │
3. REDACT/DISCARD canvas cleared; frame dropped   (default: NO thumbnail, NO clip, NO upload)
        │
4. SEMANTIC EGRESS emit SemanticEvent only        (schema-validated: zero media payloads)
        │
5. TRANSPORT      WSS/TLS batch → ingest          (server re-validates; media = hard reject)
```

- **Data minimization by construction.** The only artifacts that persist server-side are semantic events, aggregated flags, and hashed audit rows (`AiRun.inputsHash`). Raw pixels/audio have no persistence path in the core.
- **Purpose limitation.** Events are usable only for the consented purpose (integrity/interview support); the region gate + `ConsentGrant.purpose` are checked at ingest and again at aggregation.
- **Retention limits.** `PerceptionEvent` and `IntegrityFlag` carry a `retentionExpiresAt`; a retention cron purges expired rows. Biometric artifacts default to on-device destruction at session end (§4.3).
- **Transparency & DPIA.** Sessions require a visible capture indicator and a candidate-facing disclosure of exactly which detectors are active; Modules 6/7 ship with a DPIA template, because biometric-adjacent capture and any inferred signal are EU-AI-Act high-risk.

## 5.6 Optional evidence clips (enterprise, off by default)

If — and only if — an enterprise policy plus an explicit `ConsentGrant(kind:"EVIDENCE_CLIP")` are present, a short clip around a high-severity corroborated event may be **encrypted on-device**, uploaded to a **quarantined, human-review-only** store with a **hard auto-expiry**, and referenced by id from the `IntegrityFlag` — never inlined into events, never used for training, never used for automated decisions. This is the single, deliberately narrow exception to "raw never leaves," and it is disabled in the default/near-term tier.

## 5.7 Supporting Prisma models (proposed extensions, not duplications)

```prisma
model ConsentGrant {
  id           String   @id @default(cuid())
  subjectId    String                            // the candidate
  sessionId    String?
  kind         String                            // PROCTORING | BIOMETRIC_VERIFICATION | EVIDENCE_CLIP
  purpose      String                            // purpose-limitation string
  region       String                            // jurisdiction the grant is valid in
  detectors    String   @default("[]")           // JSON: exactly which detectors were disclosed
  grantedAt    DateTime @default(now())
  revokedAt    DateTime?                          // revocable any time; stops capture immediately
  expiresAt    DateTime
  @@index([sessionId, kind])
  @@index([subjectId])
}

model ProctorSession {
  id            String   @id @default(cuid())
  attemptId     String?                           // FK → TestAttempt (Module 7)
  interviewId   String?                           // FK → Interview   (Module 6)
  t0            DateTime                          // clock origin for tMs alignment
  clockOffsetMs Int      @default(0)
  region        String
  status        String   @default("ACTIVE")       // ACTIVE | ENDED | ABORTED
  lastSeq       Int      @default(0)              // gap detection
  createdAt     DateTime @default(now())
  @@index([attemptId]); @@index([interviewId])
}

model PerceptionEvent {                            // one compact row per semantic event (no media)
  id           String   @id @default(cuid())
  sessionId    String
  seq          Int
  tMs          Int
  modality     String
  kind         String
  confidence   Float
  method       String
  detectorId   String
  payload      String   @default("{}")            // JSON scalars/enums/normalized bbox ONLY
  runId        String?                             // FK → AiRun for full audit lineage
  retentionExpiresAt DateTime
  createdAt    DateTime @default(now())
  @@index([sessionId, tMs]); @@index([kind])
}

model IntegrityFlag {                              // human-review packet — NEVER an auto-decision
  id           String   @id @default(cuid())
  sessionId    String
  category     String                             // absence | second_person | object | focus | input
  severity     String                             // low | medium | high
  observations String   @default("[]")            // JSON: corroborated events + counts/durations
  confidence   Float                              // calibrated aggregate
  humanSummary String                             // plain-language "what was observed" (+ validity caveat)
  reviewState  String   @default("PENDING")       // PENDING | CONFIRMED | DISMISSED
  reviewerId   String?
  appealState  String   @default("NONE")          // NONE | RAISED | UPHELD | OVERTURNED
  retentionExpiresAt DateTime
  createdAt    DateTime @default(now())
  @@index([sessionId]); @@index([reviewState])
}
```

Every model above is an **extension** of the existing recruitment core: `ProctorSession` hangs off `TestAttempt`/`Interview`; `PerceptionEvent.runId` links to `AiRun` for lineage; `IntegrityFlag` feeds the human review UI and the `forbidden-auto` adverse-action gate. No existing model is duplicated, and the existing `TestAttempt.proctored`/`tabSwitches` and `Interview.roomCode`/`recordingUrl`/`confidential` fields remain the anchors Modules 6/7 build upon.

## 6. Knowledge Graph

## 6.1 Design stance — a property graph *over* the relational core, in-house first

There is **no separate graph database**. Introducing Neo4j/Neptune would violate constraint (1) — a heavy external dependency the core cannot function without. Instead the enterprise interview graph is a **materialized property-graph view over the existing Prisma relational schema plus the in-house semantic index** (`SemanticDoc`/`SemanticPosting`, `lib/knowledge/semindex.ts`, DDR-003). Nodes are rows; structural edges are foreign keys; similarity edges are cosine neighbours computed on demand.

- **Near-term (buildable on this platform):** graph traversal = indexed Prisma joins + `semindex.search()` for semantic edges. Adjacency is served by a thin `lib/graph/` resolver that maps node/edge types to queries. Deployable on Vercel today.
- **Enterprise / aspirational future-state:** an optional nightly export of this same node/edge model to a columnar or graph store (Neptune/Neo4j/DuckDB) for org-wide analytics. Strictly additive; the core never reads from it.

```text
                      ┌──────────────────────────────────────────────┐
                      │  IN-HOUSE PROPERTY GRAPH (materialized view)   │
                      │  lib/graph/*  →  Prisma rows + SemanticDoc     │
                      └──────────────────────────────────────────────┘
        (structural edges = FKs)                 (semantic edges = cosine over TF-IDF)
                    │                                      │
   ┌────────────────┴───────────────┐        ┌────────────┴─────────────┐
   ▼                                ▼        ▼                           ▼
Candidate ─PARTICIPATED_IN─► InterviewSession ─ASKED─► Question ─ANSWERED_BY─► Answer
   │                                │  │  │                                     │
   │                       ┌────────┘  │  └────────┐                    TRANSCRIBED_AS
   │                       ▼           ▼           ▼                            ▼
   │                 VisionEvent  AudioEvent  ScreenEvent                  Transcript
   │                    │  │  │        │  │        │  │                         │
   │                 (all EMITTED_BY session; each ─EVIDENCED_BY─► Evidence)    │ INDEXED_AS
   │                                                                            ▼
   │  ┌──DEMONSTRATES──────────────────────────────────────────────────► SemanticDoc
   ▼  ▼                                                                    (refType=answer|transcript)
 Skill ─ROLLS_UP_TO─► Competency ◄─SCORES─ InterviewScorecard ◄─AUTHORED_BY─ Reviewer ∈ Panel
                                                     │                          │
 Risk ◄─RAISED_BY── ProctorEvent ─GOVERNED_BY─► Policy                      DECIDED
   │                     ▲                          ▲                          ▼
 PRODUCED_BY         PRODUCED_BY               APPLIES_TO                ReviewDecision
   ▼                     │                          │                          │
 AIModel ──────────────┘                  (Confidence & Evidence reified) ─────┘
                                                                            │
Candidate ─RECEIVED─► Offer ◄─────────────────────────DERIVED_FROM─────────┘
```

## 6.2 Node types

Every node carries `id`, `kind`, `createdAt`, a `securityClass` (mirrors `KnowledgeItem`), and a backing store. **Confidence, Evidence, and Risk are reified** (RDF-reification style) — they annotate *assertions/edges*, not the world — so provenance and contestability are first-class rather than opaque columns.

| Node | Backing store (Prisma) | Semantic index? | Notes |
|------|------------------------|-----------------|-------|
| **Candidate** | `User` (role=JOBSEEKER) / `Application.userId` | via `CareerProfile` | Never carries inferred-trait scores. |
| **InterviewSession** | `InterviewSession` (§7, extends `Interview`) | no | Root of a session subgraph. |
| **Question** | `InterviewKit.items[]` + `Question` (assessment) | `refType="question"` | Rubric-linked. |
| **Answer** | `Answer` / `InterviewSession` answer log | `refType="answer"` | Content, not affect. |
| **Transcript** | `EvidenceNode(kind="transcript")` | `refType="transcript"` | Diarized text; the *semantic* form of audio (raw audio not retained by default). |
| **VisionEvent / AudioEvent / ScreenEvent** | `ProctorEvent` (source-discriminated) | no | Observable events only (§8). |
| **Reviewer** | `User` via `InterviewParticipant` (ASSESSING_ROLES) | no | Human, authoritative. |
| **Panel** | `Interview` + its `InterviewParticipant` set | no | Composition governed by `lib/interview/governance.ts`. |
| **Offer** | `Offer` (EROS M8) | no | Terminal outcome edge target. |
| **Skill** | `Skill` / `SkillProficiency` | `refType="skill"` | Reuses ICIRE skill graph. |
| **Competency** | `KnowledgeItem(kind="hr")` (rubric) + `scorecard.ts` keys | `refType="knowledge"` | e.g. `DEFAULT_COMPETENCIES`. |
| **Evidence** | `EvidenceNode` (§7) | optional | Pointer to the observation(s) supporting an assertion. |
| **Risk** | `EvidenceNode(kind="risk")` / derived from `ProctorEvent` | no | Integrity concern, **never a character judgment**. |
| **Policy** | `PolicyRule` (§7) + `KnowledgeItem(kind="policy")` | `refType="policy"` | Region-aware, versioned. |
| **AIModel** | `ModelRegistry` + `ModelInferenceLog` (§7) | no | Every inference traces to a registered model+version. |
| **Confidence** | reified on the edge (`ModelInferenceLog.confidence`, `AiRun.confidence`) | no | Value + method + calibration state. |

## 6.3 Edge types

Directed, typed, and each edge may itself be annotated by a reified `Confidence`/`Evidence` node.

```text
STRUCTURAL (foreign-key backed, deterministic)
  (Candidate)         -[:PARTICIPATED_IN {role}]->      (InterviewSession)
  (InterviewSession)  -[:ASKED {order}]->               (Question)
  (Question)          -[:ANSWERED_BY]->                 (Answer)
  (Answer)            -[:TRANSCRIBED_AS]->              (Transcript)
  (InterviewSession)  -[:EMITTED]->                     (VisionEvent|AudioEvent|ScreenEvent)
  (Reviewer)          -[:MEMBER_OF]->                   (Panel)
  (Panel)             -[:EVALUATES]->                   (InterviewSession)
  (Reviewer)          -[:AUTHORED]->                    (InterviewScorecard)
  (InterviewScorecard)-[:SCORES {rating}]->             (Competency)
  (Reviewer)          -[:DECIDED]->                     (ReviewDecision)
  (ReviewDecision)    -[:RESOLVES]->                    (Risk)
  (Candidate)         -[:RECEIVED]->                    (Offer)
  (Offer)             -[:DERIVED_FROM]->                (InterviewSession)

SEMANTIC / DERIVED (in-house, explainable — cosine or rule)
  (Answer)            -[:DEMONSTRATES {weight,confidence}]-> (Skill)
  (Skill)             -[:ROLLS_UP_TO]->                 (Competency)
  (Answer|Transcript) -[:SIMILAR_TO {cosine}]->         (Answer|Transcript)   // semindex
  (Answer)            -[:MATCHES_RUBRIC {score}]->      (Question)

INTEGRITY / GOVERNANCE (append-only, human-in-the-loop)
  (Risk)              -[:RAISED_BY]->                   (ProctorEvent+)       // >=1 events
  (Risk)              -[:GOVERNED_BY]->                 (Policy)
  (ProctorEvent)      -[:EVIDENCED_BY]->                (Evidence)
  (AIModel)           -[:PRODUCED]->                    (VisionEvent|AudioEvent|ScreenEvent|Risk)
  (Confidence)        -[:QUALIFIES]->                   (<any inferred edge/node>)
  (Evidence)          -[:SUPPORTS]->                    (<any assertion>)
  (Policy)            -[:APPLIES_TO {region}]->         (InterviewSession)
```

**Invariant (honesty + human-in-the-loop):** no edge terminating on `Offer`, `ReviewDecision`, or an adverse `Application.status` may originate from an `AIModel`-`PRODUCED` node without passing through a `Reviewer`-`DECIDED` `ReviewDecision`. This is enforced structurally, not by convention (see §7 `ReviewDecision`, §9 `aiDecision` ≠ authoritative).

## 6.4 Example queries

Each query is shown as intent (Cypher-like, for the aspirational graph store) **and** the real in-house implementation on this stack.

**Q1 — All evidence supporting a competency rating for a candidate (explainability / appeal).**
```cypher
MATCH (c:Candidate {id:$cid})-[:PARTICIPATED_IN]->(s:InterviewSession)
MATCH (r:Reviewer)-[:AUTHORED]->(sc:InterviewScorecard)-[sco:SCORES]->(comp:Competency {key:'technical'})
MATCH (a:Answer)-[:DEMONSTRATES]->(:Skill)-[:ROLLS_UP_TO]->(comp)
OPTIONAL MATCH (a)-[:TRANSCRIBED_AS]->(t:Transcript)
RETURN sc.rating, r.id AS reviewer, collect(a.id) AS answers, collect(t.id) AS transcripts
```
```ts
// in-house: indexed joins, no graph DB
const cards = await prisma.interviewScorecard.findMany({
  where: { session: { candidateId: cid } },
  select: { authorId: true, ratings: true, sessionId: true },
})
const evidence = await prisma.evidenceNode.findMany({
  where: { sessionId: { in: cards.map(c => c.sessionId) }, competencyKey: "technical" },
})
```

**Q2 — Which model produced this risk, at what confidence, under which policy? (auditability)**
```ts
const risk = await prisma.evidenceNode.findUnique({ where: { id: riskId } }) // kind="risk"
const events = await prisma.proctorEvent.findMany({ where: { id: { in: JSON.parse(risk.linkedEventIds) } } })
const infer  = await prisma.modelInferenceLog.findMany({ where: { proctorEventId: { in: events.map(e=>e.id) } } })
const models = await prisma.modelRegistry.findMany({ where: { modelId: { in: infer.map(i=>i.modelId) } } })
const policy = await prisma.policyRule.findUnique({ where: { id: risk.policyRuleId } })
// → returns {model, modelVersion, confidence, calibration, policy.region, humanReviewRequired}
```

**Q3 — Correlate second-person vision events with tab-switch screen events in one session (process signal, human-reviewed).**
```ts
const ev = await prisma.proctorEvent.findMany({
  where: { sessionId, type: { in: ["vision.behavior.second_person.sustained","screen.behavior.focus_loss.repeated"] } },
  orderBy: { ts: "asc" }, select: { type: true, ts: true, confidence: true, evidenceRef: true },
})
// windowed co-occurrence → a single Risk node RAISED_BY both; still requires ReviewDecision.
```

**Q4 — Semantic neighbours of an answer (calibration / plagiarism-signal, not a score).** Reuses `semindex`:
```ts
import { search } from "@/lib/knowledge/semindex"
const similar = await search(answerText, { index: "interview", refType: "answer", limit: 5 })
// edges (Answer)-[:SIMILAR_TO {cosine}]->(Answer); flag near-duplicates for HUMAN review only.
```

**Q5 — Path from Offer back to its human decisions (provenance of a hire).**
```cypher
MATCH (o:Offer {id:$oid})-[:DERIVED_FROM]->(s)<-[:EVALUATES]-(p:Panel)
MATCH (r:Reviewer)-[:MEMBER_OF]->(p), (r)-[:DECIDED]->(d:ReviewDecision)
RETURN o, collect({reviewer:r.id, decision:d.decision, rationale:d.rationale})
```

## 6.5 Reuse of the existing knowledge / semantic-index layer

- **Transcript, Answer, Question** nodes are written to `SemanticDoc` with a dedicated `index="interview"` on create/update (via the `lib/knowledge/pipeline.ts` reindex hook), giving `SIMILAR_TO` and rubric-match edges for free — **no embeddings API, no vector DB** (DDR-003). Sparse TF-IDF vectors + inverted `SemanticPosting` postings scale retrieval without a rebuild.
- **Policy** and **Competency** nodes are `KnowledgeItem` rows (`kind="policy"|"hr"`), inheriting versioning (`KnowledgeRevision`, never overwritten), `status` (`verified|pending_review|…`), `confidence`, and `provenance`. A policy change is a new revision, so every historical `Risk` still resolves to the exact policy text in force at capture time.
- **AIModel** nodes *are* `ModelRegistry` rows; graph edges `PRODUCED` are `ModelInferenceLog` rows (§7). `deploymentStatus=shadow` models emit graph nodes flagged non-authoritative for A/B evaluation without touching decisions.
- **Memory:** durable, non-PII graph summaries (e.g. "candidate strengths from panel consensus") land in `MemoryEntry(scope="user", kind="interview")` — structured, never weights.
- **Traversal governance:** every read of the graph goes through `lib/capability/policy.ts::authorize()` (capability, never role). Confidential subgraphs (raw evidence, redacted per `maySeeConfidential`) are filtered at the resolver, reusing `lib/interview/governance.ts`.

---

## 7. Database Design

## 7.1 Principles carried from the existing schema

All new models are **additive and both-DB safe**: JSON is stored as `String` (SQLite has no native JSON/array; Postgres tolerates it), ids are `cuid()`, timestamps default `now()`. High-volume, append-only event tables follow the `AiRun`/`PlatformEvent` convention — **scalar foreign ids, no `User`/back-relations, immutable, index-driven** — so they never bloat relational join planning and can be partitioned/pruned independently. Relational, low-volume, lifecycle-bearing entities (`InterviewSession`, `InterviewScorecard`, `ReviewDecision`) *do* relate, mirroring `Interview`/`Offer`.

## 7.2 New Prisma models

```prisma
// ── 1. InterviewSession ─ a concrete run of an Interview (extends, never replaces,
//     the existing Interview shell: roomCode/visibility/governance stay there).
model InterviewSession {
  id            String    @id @default(cuid())
  interviewId   String                                   // -> Interview (relational)
  candidateId   String                                   // -> User (scalar; no back-rel)
  kitId         String?                                  // -> InterviewKit used
  mode          String    @default("LIVE")               // LIVE | ASYNC | ASSESSMENT
  status        String    @default("SCHEDULED")          // SCHEDULED|CONSENTED|IN_PROGRESS|COMPLETED|ABANDONED|VOIDED
  // consent & legal (privacy-by-design; NOTHING captured before CONSENTED)
  consentId     String?                                  // -> ConsentRecord (required to start capture)
  region        String    @default("EU")                 // drives PolicyRule selection (GDPR/BIPA/…)
  proctoringTier String   @default("NONE")               // NONE|LIGHT|STANDARD|STRICT — max tier the consent allows
  captureProfile String   @default("SEMANTIC_ONLY")      // SEMANTIC_ONLY | SEMANTIC_PLUS_CLIP (raw split, §7.5)
  // integrity roll-up (derived, human-reviewed; never an auto candidate score)
  integrityState String   @default("CLEAR")              // CLEAR|FLAGS_PENDING_REVIEW|REVIEWED
  eventCount    Int       @default(0)
  riskCount     Int       @default(0)
  startedAt     DateTime?
  endedAt       DateTime?
  retentionAt   DateTime?                                // hard-delete deadline (storage limitation)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  interview     Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  scorecards    InterviewScorecard[]
  decisions     ReviewDecision[]
  @@index([interviewId])
  @@index([candidateId, status])
  @@index([status, retentionAt])                          // retention sweep
}

// ── 2. ProctorEvent ─ the high-volume, append-only semantic event stream (§8/§9).
//     RAW media is NOT here (or anywhere by default) — only observations.
model ProctorEvent {
  id            String   @id @default(cuid())
  sessionId     String                                    // scalar; partition key
  ts            DateTime                                  // event time (client/on-device clock, server-validated)
  layer         String                                    // sensor|perception|behavior|risk
  source        String                                    // vision|audio|screen|system
  type          String                                    // dotted taxonomy, e.g. vision.perception.face.count
  severity      String   @default("INFO")                 // INFO|NOTICE|LOW|MEDIUM|HIGH|CRITICAL
  observation   String   @default("{}")                   // JSON payload (counts/fractions/booleans — NEVER traits)
  confidence    Float?                                    // 0..1 (null for deterministic/system events)
  modelId       String?                                   // -> ModelRegistry (null = deterministic rule)
  modelVersion  String?
  evidenceRef   String?                                   // -> EvidenceNode.id (semantic pointer, not raw)
  policyRuleId  String?                                   // -> PolicyRule matched
  linkedEventIds String  @default("[]")                   // JSON string[] correlation
  reviewState   String   @default("NONE")                 // NONE|PENDING|CLEARED|CONFIRMED (risk layer only)
  createdAt     DateTime @default(now())
  @@index([sessionId, ts])
  @@index([sessionId, layer, severity])
  @@index([type, createdAt])
  @@index([reviewState])
}

// ── 3. EvidenceNode ─ the SEMANTIC evidence object referenced by events/scorecards/
//     risks. Transcripts, keyframe descriptors, hashes — the "semantic digital twin".
model EvidenceNode {
  id            String   @id @default(cuid())
  sessionId     String
  kind          String                                    // transcript|keyframe_descriptor|audio_segment_meta|screen_meta|risk|answer_snapshot
  competencyKey String?                                   // when evidence supports a competency
  summary       String   @default("")                     // human-readable, redaction-safe
  data          String   @default("{}")                   // JSON: diarized text, bbox counts, perceptual hash — NO raw pixels/audio
  rawArtifactId String?                                   // -> MediaArtifact (ONLY if captureProfile allows; else null)
  hash          String?                                   // sha256 integrity seal of the underlying observation
  linkedEventIds String  @default("[]")
  confidence    Float?
  createdAt     DateTime @default(now())
  @@index([sessionId, kind])
  @@index([competencyKey])
}

// ── 4. InterviewScorecard ─ persists lib/interview/scorecard.ts output per reviewer.
model InterviewScorecard {
  id            String   @id @default(cuid())
  sessionId     String
  reviewerId    String                                    // -> User
  ratings       String   @default("{}")                   // JSON competencyKey -> 1..4
  recommendation String                                   // STRONG_NO|NO|YES|STRONG_YES
  notes         String?
  biasSignals   String   @default("[]")                   // JSON BiasSignal[] (process signals only)
  confidence    Float    @default(0)                      // panel confidence from aggregatePanel
  submitted     Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  session       InterviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@unique([sessionId, reviewerId])                        // one card per reviewer per session
  @@index([sessionId])
}

// ── 5. InterviewKit ─ the reusable, governed structure of an interview/assessment:
//     questions + rubric + competency map + which proctoring signals are enabled.
model InterviewKit {
  id            String   @id @default(cuid())
  ownerId       String                                    // company (employer User) / workspace
  title         String
  roleLevel     String?                                   // IC|SENIOR|LEAD|EXECUTIVE (feeds governance)
  competencies  String   @default("[]")                   // JSON [{key,label,weight}]
  items         String   @default("[]")                   // JSON [{id,prompt,type,rubric,competencyKey,points}]
  proctoring    String   @default("{}")                   // JSON: enabled signal types + thresholds (opt-in)
  version       Int      @default(1)
  status        String   @default("draft")                // draft|active|deprecated
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([ownerId, status])
}

// ── 6. PolicyRule ─ region-aware, versioned governance rule that turns an event
//     pattern into an allowed severity + a mandated human-review disposition.
model PolicyRule {
  id            String   @id @default(cuid())
  key           String                                    // e.g. "second_person.sustained"
  region        String   @default("EU")                   // EU|US-IL(BIPA)|US|IN|GLOBAL
  appliesTo     String   @default("[]")                   // JSON event type globs
  maxSeverity   String   @default("MEDIUM")
  action        String   @default("FLAG_FOR_REVIEW")      // LOG|NOTIFY|FLAG_FOR_REVIEW|PAUSE_SESSION
  humanReviewRequired Boolean @default(true)              // adverse action NEVER auto (EU AI Act high-risk)
  legalBasis    String?                                   // GDPR Art.6/9 basis, DPIA ref
  retentionDays Int      @default(180)                    // storage limitation for matching evidence
  knowledgeItemId String?                                 // -> KnowledgeItem(kind="policy") full text
  version       Int      @default(1)
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  @@unique([key, region, version])
  @@index([region, active])
}

// ── 7. ReviewDecision ─ the AUTHORITATIVE human disposition. AI outputs are inputs
//     to this row; they are never a substitute for it (human-in-the-loop invariant).
model ReviewDecision {
  id            String   @id @default(cuid())
  sessionId     String
  reviewerId    String                                    // -> User (must hold capability)
  scope         String   @default("RISK")                 // RISK|INTEGRITY_OVERALL|APPEAL
  targetId      String?                                   // ProctorEvent/EvidenceNode(risk) resolved
  decision      String                                    // CLEARED|CONFIRMED|INCONCLUSIVE|VOID_SESSION|UPHELD|OVERTURNED
  rationale     String                                    // required free text (why)
  aiRunId       String?                                   // -> AiRun that advised (traceability)
  appealOfId    String?                                   // -> prior ReviewDecision (candidate appeal chain)
  createdAt     DateTime @default(now())
  session       InterviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@index([sessionId, scope])
  @@index([reviewerId])
}

// ── 8. ModelInferenceLog ─ per-inference provenance for EVERY model output feeding a
//     ProctorEvent/EvidenceNode/Risk. Complements AiRun (which audits execute() calls).
model ModelInferenceLog {
  id            String   @id @default(cuid())
  sessionId     String
  proctorEventId String?
  modelId       String                                    // -> ModelRegistry.modelId
  modelVersion  String
  runtime       String   @default("on-device-wasm")       // on-device-wasm|server-deterministic|server-gpu(optional tier)
  task          String                                    // face_detect|voice_activity|diarize|window_focus|...
  inputHash     String                                    // hash of the on-device feature, NOT raw media
  output        String   @default("{}")                   // JSON observation
  confidence    Float?
  calibration   String   @default("uncalibrated")         // uncalibrated|platt|isotonic (+ version)
  latencyMs     Int      @default(0)
  createdAt     DateTime @default(now())
  @@index([sessionId, createdAt])
  @@index([modelId, createdAt])
}

// ── companion (privacy non-negotiable): explicit, versioned, revocable consent.
model ConsentRecord {
  id            String   @id @default(cuid())
  subjectId     String                                    // candidate User
  sessionId     String?
  scope         String   @default("[]")                   // JSON: which capture tiers/signals consented
  region        String
  granted       Boolean  @default(false)
  grantedAt     DateTime?
  revokedAt     DateTime?                                  // revocation ⇒ capture stops + purge scheduled
  policyVersion String                                     // exact policy text shown
  evidenceHash  String?                                    // sealed copy of the consent screen presented
  createdAt     DateTime @default(now())
  @@index([subjectId])
}
```

## 7.3 Indexing strategy

- **Hot path (live session ingest & timeline):** `ProctorEvent(@@index([sessionId, ts]))` serves the reviewer timeline and correlation windows in one range scan. `@@index([reviewState])` powers the "flags awaiting human review" queue across all sessions.
- **Governance/analytics:** `@@index([type, createdAt])` on `ProctorEvent` + `@@index([modelId, createdAt])` on `ModelInferenceLog` support model-drift and false-positive-rate evaluation feeding `EvalRun`.
- **Retention sweeps:** `InterviewSession(@@index([status, retentionAt]))` and per-event `createdAt` indices let the retention cron select expired rows without full scans.
- **Uniqueness guards:** `InterviewScorecard @@unique([sessionId, reviewerId])` (one card/reviewer), `PolicyRule @@unique([key, region, version])` (deterministic policy resolution).

## 7.4 Partitioning & retention for high-volume events

`ProctorEvent` and `ModelInferenceLog` are the only tables expected at 10³–10⁵ rows/session.

**Postgres (prod):** declarative **RANGE partitioning by `createdAt` (monthly)**, created via a raw-SQL migration (Prisma models the logical table; partition DDL lives in `prisma/migrations/*/partition.sql`). Retention becomes an O(1) `DETACH PARTITION … DROP` instead of a mass `DELETE` — this is the scalable path and the honest way to meet GDPR storage-limitation at volume.

```sql
-- prod partition maintenance (run monthly by the retention cron)
CREATE TABLE "ProctorEvent_2026_08" PARTITION OF "ProctorEvent"
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
-- ...expire: DROP TABLE "ProctorEvent_2026_02";  (past retentionDays for its region)
```

**SQLite (local dev):** no partitioning; a `BackgroundJob(type="proctor.retention")` prunes rows past `InterviewSession.retentionAt`. Identical logical behaviour, different mechanism — the in-house queue (`BackgroundJob`, no Redis) already exists.

**Vercel/serverless reality (near-term):** partition rotation + retention run as a scheduled cron (`app/api/cron/retention`) enqueuing `BackgroundJob`s, matching the platform's existing ingest-cron pattern. No always-on worker required.

**Retention policy** is data-driven: each `PolicyRule.retentionDays` (region-specific) sets `InterviewSession.retentionAt = endedAt + max(applicable retentionDays)`. On `ConsentRecord.revokedAt`, a purge job runs immediately (right to erasure). Aggregate, PII-free metrics survive into `EvalRun`/`MatchCalibration` (k-anonymous), so deletion never blinds the platform's self-evaluation.

## 7.5 Raw-vs-semantic storage split

The platform's core principle — a **Semantic Digital Twin** — is enforced structurally: **the default (`captureProfile="SEMANTIC_ONLY"`) never persists a single raw frame or audio sample.**

| Tier | What is stored | Where | Default retention | Legal posture |
|------|----------------|-------|-------------------|---------------|
| **Perception (on-device)** | Raw camera/mic/screen frames | **On-device only, discarded after feature extraction; never uploaded** | 0 (never at rest server-side) | Data minimization; no biometric template leaves device unless consented |
| **Semantic events** | `ProctorEvent` observations (counts, fractions, booleans, event types) | Postgres (partitioned) | `PolicyRule.retentionDays` (e.g. 180d EU) | Purpose-limited process signals |
| **Semantic evidence** | `EvidenceNode`: diarized transcript text, keyframe *descriptors* (e.g. "2 faces, bbox areas"), perceptual **hashes** | Postgres | = event retention | Redaction-safe; supports appeal without raw media |
| **Raw clip (opt-in only)** | Short encrypted media segment tied to a `HIGH/CRITICAL` risk | `MediaArtifact` (encrypted `MediaAsset` bytes / object store) | Short (e.g. 30d), separate legal basis, per-region gate | `SEMANTIC_PLUS_CLIP` **only** with explicit `ConsentRecord` scope + BIPA/GDPR-Art.9 basis; blocked in Illinois unless BIPA-conformant |
| **Aggregate metrics** | PII-free rates/calibration | `EvalRun`, `MatchCalibration` | Indefinite (k-anonymous) | Legitimate interest; no individual re-identification |

Biometric face-matching reuses the existing `IdentityVerification`/`faceVector` path (on-device vector, `faceMatchScore` stored — not the image), extending an established pattern rather than adding new raw-biometric storage. Face vectors are **verification templates, not surveillance features**, and are excluded from the SEMANTIC_ONLY event stream.

---

## 8. Event Taxonomy

Dotted namespace: `<source>.<layer>.<subject>.<signal>`. Four **layers** (increasing interpretation) × four **sources** (sensor modalities). Severity classes: `INFO` (telemetry), `NOTICE` (state change), `LOW`/`MEDIUM`/`HIGH` (integrity concern of growing weight), `CRITICAL` (session-integrity-breaking). **Every non-`INFO` risk-layer event carries a `policyRuleId` and is `humanReviewRequired` unless the policy says otherwise.** Nothing in this taxonomy is a character, ability, or trait judgment.

## 8.1 Layer semantics

- **Sensor layer** — device/capture facts. Deterministic, no model, no confidence. About *equipment*, not the person.
- **Perception layer** — on-device detections with a confidence. About *observable state* in a single window.
- **Behavior layer** — temporal patterns aggregated from perception over a window. Still observable; not inferred intent.
- **Risk layer** — policy-scored integrity concerns correlating multiple lower-layer events. **Advisory input to a human**, never an autonomous adverse decision.

## 8.2 Vision (`vision.*`)

**Sensor**
- `vision.sensor.camera.requested` / `.granted` / `.denied` / `.started` / `.stopped` — INFO/NOTICE
- `vision.sensor.camera.disconnected` — MEDIUM (capture integrity lost)
- `vision.sensor.resolution.low` — LOW (may degrade perception reliability; caveat, not fault)
- `vision.sensor.virtual_camera.suspected` — MEDIUM (OS reports a virtual/loopback device)

**Perception**
- `vision.perception.face.count` `{n}` — INFO (n=1 normal)
- `vision.perception.face.present` `{bool, frac}` — INFO
- `vision.perception.face.absent` — LOW
- `vision.perception.gaze.on_screen` `{frac}` — INFO (**process signal only; low weight; explicit validity caveat — gaze ≠ honesty**)
- `vision.perception.head_pose.off_axis` `{deg}` — INFO
- `vision.perception.object.detected` `{class: phone|second_screen|book|earpiece, conf}` — LOW..MEDIUM
- `vision.perception.identity.match` `{score}` / `.mismatch` `{score}` — NOTICE / HIGH (vs enrolled `faceVector`)
- `vision.perception.lighting.insufficient` — LOW (reliability caveat)

**Behavior**
- `vision.behavior.second_person.sustained` `{durationMs}` — MEDIUM (two+ faces over a window)
- `vision.behavior.absence.prolonged` `{durationMs}` — MEDIUM
- `vision.behavior.gaze.off_screen.repeated` `{count}` — LOW (**advisory; never scored against the candidate**)
- `vision.behavior.identity.drift` — HIGH (matched person changed mid-session)
- `vision.behavior.frame.static` — LOW (possible looping/static image)

**Risk**
- `vision.risk.possible_second_person` — MEDIUM/HIGH → `PolicyRule("second_person.sustained")`, human review
- `vision.risk.identity_mismatch` — HIGH/CRITICAL → identity policy, human review
- `vision.risk.prohibited_object_present` — MEDIUM → device/object policy
- `vision.risk.feed_manipulation_suspected` — HIGH (virtual cam + static frame)

## 8.3 Audio (`audio.*`)

**Sensor**
- `audio.sensor.mic.requested/granted/denied/started/stopped` — INFO/NOTICE
- `audio.sensor.mic.muted` `{byWhom}` — NOTICE
- `audio.sensor.virtual_audio.suspected` — MEDIUM

**Perception**
- `audio.perception.voice.activity` `{frac}` — INFO
- `audio.perception.speaker.count_estimate` `{n, conf}` — INFO (**diarization count only; NO speaker identification of third parties, NO voiceprinting without consent**)
- `audio.perception.background.speech` `{conf}` — LOW
- `audio.perception.silence.prolonged` `{durationMs}` — INFO
- `audio.perception.noise.high` `{level}` — LOW (reliability caveat)

**Behavior**
- `audio.behavior.background.voice.recurring` `{count}` — MEDIUM (repeated distinct off-camera speech)
- `audio.behavior.speaker.overlap.sustained` — LOW
- `audio.behavior.whisper.pattern` — LOW (**process signal; explicitly NOT an "assistance" verdict**)

**Risk**
- `audio.risk.possible_external_assistance` — MEDIUM → correlated with gaze-off/second-voice, human review
- `audio.risk.undisclosed_third_party` — MEDIUM/HIGH → third-party-presence policy

> **Explicitly excluded from audio (pseudoscience / illegal-inference guardrail):** emotion, stress, "confidence", deception, sentiment, personality, accent, gender, age, or ethnicity inference. These are **not emitted as events at all.** Speech is converted to **diarized transcript text** (`EvidenceNode`) — the content is assessable by humans; the acoustics are not scored.

## 8.4 Screen / environment (`screen.*`)

**Sensor**
- `screen.sensor.share.requested/granted/denied/stopped` — INFO/NOTICE
- `screen.sensor.fullscreen.entered/exited` — NOTICE
- `screen.sensor.display.count` `{n}` — INFO (multi-monitor present)

**Perception**
- `screen.perception.window.focus_lost` — LOW (extends existing `TestAttempt.tabSwitches`)
- `screen.perception.window.focus_gained` — INFO
- `screen.perception.clipboard.paste` `{sizeClass}` — LOW (no clipboard *content* captured)
- `screen.perception.clipboard.large_paste` `{sizeClass}` — MEDIUM
- `screen.perception.devtools.opened` — MEDIUM (assessment context)
- `screen.perception.copy` / `.cut` — LOW

**Behavior**
- `screen.behavior.focus_loss.repeated` `{count, totalMs}` — MEDIUM
- `screen.behavior.paste_burst` `{count}` — MEDIUM (rapid large pastes in a coding item)
- `screen.behavior.typing.cadence.anomalous` — LOW (**advisory only; keystroke-dynamics are NOT a biometric identifier or a score here**)
- `screen.behavior.answer.near_duplicate` `{cosine}` — MEDIUM (semindex similarity vs other answers)

**Risk**
- `screen.risk.possible_external_reference` — MEDIUM → focus-loss + large-paste correlation, human review
- `screen.risk.possible_collusion` — MEDIUM → near-duplicate answers across candidates, human review
- `screen.risk.environment_control_lost` — LOW/MEDIUM → fullscreen exit + display added

## 8.5 System / network / integrity (`system.*`)

**Sensor**
- `system.sensor.session.consented` — NOTICE (**gate: no other event may precede this**)
- `system.sensor.session.started/paused/resumed/ended` — NOTICE
- `system.sensor.clock.skew` `{ms}` — LOW (client/server time divergence)
- `system.sensor.network.degraded/restored` — LOW/INFO

**Perception**
- `system.perception.heartbeat.missed` `{count}` — LOW
- `system.perception.event.gap` `{durationMs}` — LOW (telemetry blackout)
- `system.perception.integrity.hash_mismatch` — HIGH (tamper on the event stream seal)

**Behavior**
- `system.behavior.reconnect.repeated` `{count}` — LOW
- `system.behavior.telemetry.suppressed` — MEDIUM (sustained gaps suggest client tampering)

**Risk**
- `system.risk.stream_tampering_suspected` — HIGH → tamper policy, human review
- `system.risk.consent_scope_exceeded` — CRITICAL → a signal fired outside consented scope; **auto-pause + purge**, immediate governance alert
- `system.risk.model_low_confidence_regime` — INFO/LOW → flags that downstream events this window are low-reliability (fairness caveat surfaced to reviewer)

## 8.6 Cross-cutting rules

- **Severity ceilings are region-scoped** via `PolicyRule.maxSeverity`: e.g. in a strict jurisdiction certain vision behaviors cap at `LOW` (log-only) and never become a `risk`.
- **No risk without evidence:** a `*.risk.*` event MUST carry ≥1 `linkedEventIds` and an `evidenceRef`.
- **No adverse action from an event alone:** severity affects *reviewer prioritization*, never `Application.status`. Adverse effect requires a `ReviewDecision`.
- **Reliability honesty:** any perception/behavior event produced under `system.risk.model_low_confidence_regime` is tagged `lowReliability=true` and down-weighted in the reviewer UI.

---

## 9. Event Schemas

Canonical TypeScript, colocated at `lib/proctor/events.ts`. Every event serializes 1:1 into a `ProctorEvent` row (§7). The discriminated union keys on `source` × `layer`. **`aiDecision` is always advisory; `reviewerDecision` is authoritative** — the type system encodes that a risk cannot be `resolved` except via a `ReviewerDecision`.

## 9.1 Shared primitives

```ts
export type EventSource   = "vision" | "audio" | "screen" | "system";
export type EventLayer    = "sensor" | "perception" | "behavior" | "risk";
export type Severity      = "INFO" | "NOTICE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ReviewState   = "NONE" | "PENDING" | "CLEARED" | "CONFIRMED" | "INCONCLUSIVE";

/** Confidence is never a bare float: it declares method + calibration so it can be
 *  honestly presented and audited. null ⇒ deterministic (no model). */
export interface Confidence {
  value: number;                       // 0..1
  method: "deterministic" | "heuristic" | "on-device-model" | "server-model";
  calibration: "uncalibrated" | "platt" | "isotonic";
  calibrationVersion?: string;
  lowReliability?: boolean;            // set under system.risk.model_low_confidence_regime
}

/** A pointer to the SEMANTIC twin — never raw pixels/audio. rawStored is explicit
 *  and defaults to false everywhere (data minimization). */
export interface EvidenceRef {
  evidenceNodeId: string;              // -> EvidenceNode
  kind: "transcript" | "keyframe_descriptor" | "audio_segment_meta" | "screen_meta" | "hash";
  hash?: string;                       // integrity seal
  rawStored: false | { artifactId: string; consentId: string; expiresAt: string }; // opt-in only
}

export interface PolicyRef {
  policyRuleId: string;                // -> PolicyRule
  key: string;
  region: string;
  humanReviewRequired: boolean;
}

/** AI output feeding a human. NOT a decision authority. */
export interface AiDecision {
  aiRunId: string;                     // -> AiRun (AIOS audit)
  modelId: string;
  modelVersion: string;
  suggestion: "no_action" | "flag_for_review" | "needs_more_evidence";
  confidence: Confidence;
  explanation: string;                 // required, user-appropriate
  authoritative: false;                // compile-time guarantee (see invariant)
}

/** The authoritative human disposition. */
export interface ReviewerDecision {
  reviewDecisionId: string;            // -> ReviewDecision
  reviewerId: string;
  decision: "CLEARED" | "CONFIRMED" | "INCONCLUSIVE" | "VOID_SESSION" | "UPHELD" | "OVERTURNED";
  rationale: string;                   // required
  decidedAt: string;                   // ISO
  appealOf?: string;                   // prior reviewDecisionId (candidate appeal chain)
}
```

## 9.2 The canonical `SemanticEvent`

```ts
export interface SemanticEvent<Obs = Record<string, unknown>> {
  id: string;                          // cuid
  ts: string;                          // ISO event time (on-device clock, server-validated)
  sessionId: string;                   // -> InterviewSession
  source: EventSource;
  layer: EventLayer;
  type: string;                        // dotted taxonomy (§8), e.g. "vision.perception.face.count"
  severity: Severity;
  observation: Obs;                    // structured facts ONLY — counts/fractions/booleans/enums
  model?: string | null;               // ModelRegistry.modelId; null = deterministic
  modelVersion?: string | null;
  confidence?: Confidence | null;      // null iff model == null
  evidenceRef?: EvidenceRef | null;
  policyRef?: PolicyRef | null;        // required on risk layer
  linkedEvents: string[];              // correlated event ids
  reviewState: ReviewState;            // NONE except on risk layer
  aiDecision?: AiDecision | null;      // advisory
  reviewerDecision?: ReviewerDecision | null; // authoritative (risk layer)
}
```

## 9.3 Subtypes (discriminated union)

```ts
export interface VisionEvent extends SemanticEvent {
  source: "vision";
  observation: Partial<{
    faceCount: number; facePresent: boolean; presentFrac: number;
    gazeOnScreenFrac: number; headPoseDeg: number;
    object: "phone" | "second_screen" | "book" | "earpiece";
    identityMatchScore: number;        // vs enrolled faceVector
    durationMs: number;
  }>;
}

export interface AudioEvent extends SemanticEvent {
  source: "audio";
  observation: Partial<{
    voiceActivityFrac: number;
    speakerCountEstimate: number;      // diarization count ONLY (no voiceprint/ID of 3rd parties)
    backgroundSpeech: boolean;
    silenceMs: number; noiseLevel: number; count: number;
  }>;
  // NOTE: no emotion/stress/deception/accent/sentiment fields exist — by design.
}

export interface ScreenEvent extends SemanticEvent {
  source: "screen";
  observation: Partial<{
    focusLost: boolean; focusMs: number; count: number;
    pasteSizeClass: "small" | "medium" | "large"; displayCount: number;
    devtools: boolean; nearDuplicateCosine: number;
  }>;
}

export interface SystemEvent extends SemanticEvent {
  source: "system";
  observation: Partial<{
    consented: boolean; clockSkewMs: number; eventGapMs: number;
    heartbeatMissed: number; hashMismatch: boolean; reconnects: number;
  }>;
}

/** A RiskEvent is a SemanticEvent on the risk layer: it MUST carry policyRef +
 *  ≥1 linkedEvents + evidenceRef, and can only be resolved by a reviewerDecision. */
export interface RiskEvent extends SemanticEvent {
  layer: "risk";
  policyRef: PolicyRef;                 // non-optional
  evidenceRef: EvidenceRef;            // non-optional
  linkedEvents: [string, ...string[]]; // ≥1
}

export type AnyEvent = VisionEvent | AudioEvent | ScreenEvent | SystemEvent;
```

**Compile-time invariants (honesty + human-in-the-loop):** `AiDecision.authoritative` is the literal `false`, and only `ReviewerDecision.decision` can move a `RiskEvent.reviewState` to `CLEARED|CONFIRMED`. A pipeline that tried to close a risk from an `AiDecision` fails to typecheck.

## 9.4 JSON examples

**(a) Perception — face count (deterministic-adjacent, on-device model, benign):**
```json
{
  "id": "cmevt_f1a2",
  "ts": "2026-08-03T10:14:22.500Z",
  "sessionId": "cises_9k3",
  "source": "vision", "layer": "perception",
  "type": "vision.perception.face.count",
  "severity": "INFO",
  "observation": { "faceCount": 1, "presentFrac": 1.0 },
  "model": "facedet-wasm-v2", "modelVersion": "2.1",
  "confidence": { "value": 0.97, "method": "on-device-model", "calibration": "isotonic", "calibrationVersion": "3" },
  "evidenceRef": { "evidenceNodeId": "cev_kf88", "kind": "keyframe_descriptor",
                   "hash": "9f2c…", "rawStored": false },
  "linkedEvents": [], "reviewState": "NONE"
}
```

**(b) Risk — possible second person (advisory AI, awaiting human):**
```json
{
  "id": "cmevt_r77",
  "ts": "2026-08-03T10:31:05.000Z",
  "sessionId": "cises_9k3",
  "source": "vision", "layer": "risk",
  "type": "vision.risk.possible_second_person",
  "severity": "MEDIUM",
  "observation": { "faceCount": 2, "durationMs": 14000 },
  "model": "risk-correlator-v1", "modelVersion": "1.0",
  "confidence": { "value": 0.71, "method": "heuristic", "calibration": "platt", "calibrationVersion": "2" },
  "evidenceRef": { "evidenceNodeId": "cev_risk12", "kind": "keyframe_descriptor", "hash": "aa10…", "rawStored": false },
  "policyRef": { "policyRuleId": "cpol_2p_eu", "key": "second_person.sustained", "region": "EU", "humanReviewRequired": true },
  "linkedEvents": ["cmevt_v51", "cmevt_a44"],
  "reviewState": "PENDING",
  "aiDecision": {
    "aiRunId": "cair_88", "modelId": "risk-correlator-v1", "modelVersion": "1.0",
    "suggestion": "flag_for_review", "authoritative": false,
    "confidence": { "value": 0.71, "method": "heuristic", "calibration": "platt" },
    "explanation": "Two faces detected for ~14s while a distinct background voice recurred. This is a PROCESS signal, not a finding — a reviewer must confirm."
  },
  "reviewerDecision": null
}
```

**(c) The same risk after human review (authoritative disposition, appeal-ready):**
```json
{
  "id": "cmevt_r77", "reviewState": "CLEARED",
  "reviewerDecision": {
    "reviewDecisionId": "crd_31", "reviewerId": "usr_hm7",
    "decision": "CLEARED",
    "rationale": "Candidate's parent briefly entered the room; candidate remained the sole participant. No integrity impact.",
    "decidedAt": "2026-08-03T15:02:00.000Z"
  }
}
```

**(d) Screen — repeated focus loss (extends existing `tabSwitches`):**
```json
{
  "id": "cmevt_s09", "ts": "2026-08-03T10:20:00Z", "sessionId": "cises_9k3",
  "source": "screen", "layer": "behavior", "type": "screen.behavior.focus_loss.repeated",
  "severity": "MEDIUM",
  "observation": { "count": 6, "focusMs": 41000 },
  "model": null, "modelVersion": null, "confidence": null,
  "evidenceRef": { "evidenceNodeId": "cev_scr3", "kind": "screen_meta", "rawStored": false },
  "policyRef": { "policyRuleId": "cpol_focus_eu", "key": "focus_loss.repeated", "region": "EU", "humanReviewRequired": true },
  "linkedEvents": ["cmevt_s02","cmevt_s05"], "reviewState": "PENDING"
}
```

**(e) System — consent gate (must precede all capture) and scope breach:**
```json
[
  { "id": "cmevt_c0", "ts": "2026-08-03T10:00:00Z", "sessionId": "cises_9k3",
    "source": "system", "layer": "sensor", "type": "system.sensor.session.consented",
    "severity": "NOTICE", "observation": { "consented": true },
    "evidenceRef": { "evidenceNodeId": "cev_consent", "kind": "hash", "hash": "c0ff…", "rawStored": false },
    "linkedEvents": [], "reviewState": "NONE" },

  { "id": "cmevt_cx", "ts": "2026-08-03T10:41:00Z", "sessionId": "cises_9k3",
    "source": "system", "layer": "risk", "type": "system.risk.consent_scope_exceeded",
    "severity": "CRITICAL",
    "observation": { "hashMismatch": false },
    "model": null, "confidence": null,
    "evidenceRef": { "evidenceNodeId": "cev_scope", "kind": "hash", "rawStored": false },
    "policyRef": { "policyRuleId": "cpol_scope", "key": "consent.scope", "region": "EU", "humanReviewRequired": true },
    "linkedEvents": ["cmevt_r99"], "reviewState": "PENDING" }
]
```
> A `system.risk.consent_scope_exceeded` triggers automatic session pause and a purge of any out-of-scope evidence — the one place the platform acts autonomously, and it acts *against* itself in the candidate's favour.

## 9.5 Ingest binding

Events are validated on the server, sealed (`hash`), and persisted through the AIOS gateway so the whole stream is governed and audited like every other capability:

```ts
// app/api/proctor/ingest — each event → execute("proctor.event.ingest", ctx)
await execute("proctor.event.ingest", { subjectId, input: event, caps });
//   → capability resolution (safetyClass="sensitive")
//   → authorization via lib/capability/policy (interviews.host / candidates.view)
//   → PolicyRule resolution by (type, region) → severity ceiling + humanReviewRequired
//   → ProctorEvent row + ModelInferenceLog (if model) + EvidenceNode (semantic twin)
//   → emit("proctor.event", …) on the PlatformEvent bus (replayable handlers)
//   → AiRun audit (inputsHash, no PII)
```
Risk-layer events additionally `emit("proctor.risk.raised", …)`, whose handler enqueues a review task and notifies holders of the review capability — never the candidate's `Application.status`, which only a `ReviewDecision` can move.

## 10. API Specifications

### 10.0 Design principles (binding on every endpoint)

1. **Capability-gated, never role-gated.** Every route resolves the caller's capability set via `lib/capability/derive.ts` and checks it with `authorize(caps, required, mode)` (`lib/capability/policy.ts`). AI-backed routes never call a provider directly — they call `AIOS.execute(capId, ctx)` (`lib/aios/execute.ts`), which re-checks capabilities, applies the safe-evolution gate, writes an immutable `AiRun`, and emits a `PlatformEvent`. No route bypasses the gateway (DDR-005).
2. **Fail-closed.** Unknown capability, missing capability, unknown session, expired consent, or region block ⇒ deny. Absence of a signal is never treated as consent or as a pass.
3. **Semantic events over raw media.** Ingestion accepts *observed, typed events* (`face.absent`, `tab.switch`), not raw video/audio frames. Raw media, when captured at all, is on-device, consent-gated, retention-bounded, and referenced only by hash + short-lived signed URL (§10.6). The Semantic Digital Twin is the source of truth.
4. **Every AI output carries `confidence` + `evidence[]`.** No endpoint returns a bare judgment. Reviewers see contributing evidence; candidates can retrieve the same bundle (redacted) and appeal.
5. **Deploy-on-push reality.** The **near-term tier** runs on Vercel serverless: server→client uses **SSE**, client→server uses **batched idempotent HTTP POST**. The **enterprise tier** adds a dedicated duplex **WebSocket** realtime service. Both speak the identical event schema (§10.5).

### 10.1 Conventions

| Concern | Rule |
|---|---|
| Base path | `/api/eros/v1/...` (new M6/M7 surface). Existing `/api/interviews/*`, `/api/tests/*` are extended, not duplicated. |
| Auth (human) | JWT `er_token` cookie → subject + derived capability set. |
| Auth (capture client) | Short-lived **session capture token** (JWT, ≤ session duration) scoped to `{sessionId, cap:"proctor.events.ingest"}`, minted at session start. The raw `er_token` is never handed to the browser capture loop. |
| Region | `X-Region` (ISO-3166) resolved server-side from account + IP; drives the policy engine (§10.8). Client value is advisory only. |
| Idempotency | Mutating ingestion/action routes require `Idempotency-Key` header **or** body `clientEventId`; server dedupes (§10.5.3). |
| Versioning | Path-versioned (`/v1`). `AiRun.modelId` records the exact engine version behind any AI output. |
| Errors | Uniform envelope (below). Never leak raw model internals or another subject's PII. |
| Pagination | Cursor-based: `?cursor=&limit=` → `{ items, nextCursor }`. |

```ts
// Uniform response envelope
type Ok<T>  = { ok: true;  data: T;  runId?: string }           // runId present for AI-backed calls
type Err    = { ok: false; error: { code: string; message: string; retryable?: boolean; details?: unknown } }
// error.code ∈ unauthenticated | forbidden_capability | consent_required | consent_withdrawn |
//   region_blocked | unknown_session | invalid_state | idempotency_conflict | validation | rate_limited |
//   requires_human_approval | provider_error
```

### 10.2 Capability additions (proposed for `lib/capability/catalog.ts`)

These extend `CAPABILITIES`; they are *derived* (never role-checked) in `derive.ts` from plan + employer relationship + panel membership.

| Capability key | Group | Held by (evidence) | Guards |
|---|---|---|---|
| `interview.session.manage` | recruit | employer owning the job / hiring plan | create, configure, schedule sessions |
| `assessment.author` | recruit | employer with assessment entitlement | author `Test`/`Question` |
| `assessment.attempt` | career | candidate invited to a `Test` | start/submit an attempt |
| `assessment.grade` | recruit | employer / grader on the plan | trigger + view grading |
| `proctor.run` | recruit | employer with proctoring entitlement + DPIA on file | enable proctoring on a session |
| `proctor.events.ingest` | proctor | session capture token only | POST/stream events for that one session |
| `proctor.evidence.view` | recruit | assigned reviewer for the session | retrieve `EvidenceBundle` |
| `proctor.risk.view` | recruit | assigned reviewer | read `RiskScore` + factors |
| `scorecard.submit` | recruit | panelist on the interview | submit own scorecard |
| `scorecard.view` | recruit | host / hiring manager | read aggregated `PanelResult` |
| `decision.render` | recruit | hiring manager / decision owner | write a `Decision` |
| `decision.appeal` | career | the candidate who is the subject | open/track an appeal |
| `consent.manage` | account | the candidate (data subject) | grant/withdraw/inspect consent |
| `policy.evaluate` | recruit | any capability-holder acting on a session | dry-run policy checks |
| `dsr.manage` | admin | privacy officer | export/erase on a data-subject request |

All AI-backed endpoints additionally require the base `ai.execute` capability and route through `AIOS.execute`.

### 10.3 Session lifecycle (REST)

A **`ProctorSession`** is the unifying supervision envelope (§12). It references *either* an `Interview` (M6) *or* a `TestAttempt` (M7) via `subjectType`/`subjectId`, so we extend rather than duplicate the existing entities.

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/eros/v1/sessions` | `interview.session.manage` \| `assessment.author` | Create a session over an Interview/TestAttempt; returns policy preflight + required consents |
| GET | `/api/eros/v1/sessions/:id` | member cap (`*.view`/`*.manage`) | Session metadata + state + governance snapshot |
| POST | `/api/eros/v1/sessions/:id/consent` | `consent.manage` (subject) | Candidate grants/updates granular consent; **must precede** any capture |
| POST | `/api/eros/v1/sessions/:id/start` | `interview.session.manage` \| `assessment.attempt` | Transition `READY→LIVE`; mints session capture token; requires all mandatory consents `granted` |
| POST | `/api/eros/v1/sessions/:id/heartbeat` | capture token | Liveness of the capture channel; carries coverage metrics |
| POST | `/api/eros/v1/sessions/:id/pause` | `interview.session.manage` | `LIVE→PAUSED` (candidate break; capture suspended) |
| POST | `/api/eros/v1/sessions/:id/end` | `interview.session.manage` \| `assessment.attempt` | `LIVE→ENDED`; freezes event log; schedules bundle assembly |
| POST | `/api/eros/v1/sessions/:id/consent/withdraw` | `consent.manage` (subject) | Withdraw consent mid-session ⇒ capture halts immediately, prior events retained per policy |

```ts
// POST /api/eros/v1/sessions  (request)
type CreateSession = {
  subjectType: "interview" | "assessment"
  subjectId: string                       // Interview.id or TestAttempt.id
  candidateId: string
  proctoring?: {
    enabled: boolean
    features: ProctorFeature[]            // ["face.presence","tab.focus","second.person",...]
    tier: "in-house" | "on-device"        // never a hard external dependency
  }
  region: string
}
// response
type SessionCreated = {
  sessionId: string
  state: SessionState                     // "DRAFT" (see §12 state machine)
  requiredConsents: ConsentScope[]        // ["camera","microphone","screen","identity_match",...]
  policy: PolicyDecision                  // §10.8 preflight (some features may be region-stripped)
  governance?: GovernanceResult           // evaluatePanel() snapshot for interviews
}
```

Start is refused (`invalid_state` / `consent_required`) unless every `requiredConsents` entry with `mandatory:true` is `granted` for the current consent-text version, and the policy engine permits the requested features in the resolved region.

### 10.4 Event ingestion (batched, idempotent)

**Near-term (Vercel):** clients batch semantic events and POST them. **Enterprise:** identical events flow over the WebSocket (§10.5). Either way the server persists deduplicated `ProctorEvent` rows and lets the deterministic rule engine (§11, `proctor-rules-v1`) recompute `RiskScore`.

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/eros/v1/sessions/:id/events` | `proctor.events.ingest` (capture token) | Ingest a batch of semantic events (idempotent) |
| GET | `/api/eros/v1/sessions/:id/events` | `proctor.evidence.view` | Reviewer reads the event timeline (cursor-paged) |
| GET | `/api/eros/v1/sessions/:id/stream` | member cap | **SSE** server→client push (risk updates, reviewer notes, control) |

```ts
// POST .../events  (request) — at-least-once from client, exactly-once effect on server
type EventBatch = {
  batchId: string                         // uuid; whole-batch idempotency
  sessionId: string
  events: ProctorEventIn[]
}
type ProctorEventIn = {
  clientEventId: string                   // uuid; per-event dedupe key
  seq: number                             // monotonic per session (gap detection)
  t: string                               // ISO capture time (client clock; server also stamps)
  type: ProctorEventType                  // enum §10.5.2 — OBSERVABLE events only
  confidence: number                      // 0..1 detector confidence
  evidenceRef?: string                    // hash/handle of an on-device artifact (never inline media)
  meta?: Record<string, number|string|boolean>  // e.g. {count:2} for second.person; NO trait inference
}
// response
type BatchAck = {
  batchId: string
  accepted: number
  duplicates: number                      // (sessionId, clientEventId) already seen
  rejected: { clientEventId: string; reason: string }[]
  serverSeqHigh: number                   // highest contiguous seq observed (client resumes from here)
  risk: RiskScoreView                     // recomputed snapshot (deterministic)
}
```

**Idempotency guarantees.** Uniqueness on `(sessionId, clientEventId)`. Re-POSTing a batch after a network failure returns the same `accepted/duplicates` split with no double-counting. `serverSeqHigh` lets a reconnecting client replay only the gap. Ingestion after `state ∈ {ENDED, ABORTED}` is rejected (`invalid_state`) so the evidence log is append-only within the live window.

### 10.5 WebSocket / stream protocol

#### 10.5.1 Channels
- **Near-term:** client→server = HTTP `POST /events`; server→client = **SSE** `GET /stream`.
- **Enterprise:** single **WSS** `wss://rt.<host>/eros/v1/sessions/:id` duplex, authenticated by the session capture token in the `Sec-WebSocket-Protocol` header (never a query string). Same message bodies as SSE/HTTP.

```
Client ─(EVENT_BATCH, HEARTBEAT, RESUME)────────────►  Realtime edge
Client ◄─(RISK_UPDATE, CONTROL, REVIEWER_NOTE, PING)─  Realtime edge
                     │  (fan-in, dedupe, order)
                     ▼
        proctor-rules-v1 (deterministic)  →  RiskScore  →  emit("proctor.risk.updated")
```

#### 10.5.2 Message taxonomy

Client → server: `EVENT_BATCH` (§10.4), `HEARTBEAT {coverage, camState, micState}`, `RESUME {lastSeq}`.
Server → client: `RISK_UPDATE {risk}`, `CONTROL {action:"pause"|"end"|"consent_recheck"}`, `REVIEWER_NOTE {note}`, `PING`.

`ProctorEventType` (observable events only — this list is the whole vocabulary; anything not here cannot be ingested):

```
face.absent | face.multiple | face.returned |
gaze.offscreen*        (* low-weight PROCESS signal, never a score — see §11)
tab.switch | window.blur | fullscreen.exit |
clipboard.large | paste.detected | devtools.open |
second.voice | audio.silence.long |
device.change | network.drop | network.resume |
identity.match | identity.mismatch    (biometric — consent-gated, §11)
```

There is deliberately **no** `emotion.*`, `stress.*`, `confidence.*`, `personality.*`, or `deception.*` event type. The schema makes pseudoscientific signals unrepresentable (§11).

#### 10.5.3 Backpressure & ordering
Client caps batches (≤ 200 events / ≤ 5 s). Server returns `serverSeqHigh`; a client detecting `429 rate_limited` applies exponential backoff and coalesces. Ordering is by `(seq)` with server arrival time as tiebreak; out-of-order late events are still accepted while `LIVE`.

### 10.6 Evidence retrieval

| Method | Path | Capability | Purpose |
|---|---|---|---|
| GET | `/api/eros/v1/sessions/:id/evidence` | `proctor.evidence.view` | The assembled `EvidenceBundle` (semantic log + hashes + optional consented artifacts) |
| GET | `/api/eros/v1/evidence/:bundleId/artifacts/:artifactId` | `proctor.evidence.view` | Short-lived signed URL to one artifact (audit-logged access) |
| GET | `/api/eros/v1/sessions/:id/evidence/candidate` | `decision.appeal` (subject) | Candidate's **own** redacted copy (transparency / appeal) |

```ts
type EvidenceBundle = {
  bundleId: string
  sessionId: string
  integrity: { merkleRoot: string; algo: "sha256" }   // tamper-evidence over the ordered event log
  timeline: ProctorEventView[]                          // semantic events, human-readable
  artifacts: EvidenceArtifact[]                         // ONLY those the candidate consented to; keyframes/transcript, not full video
  retention: { policyId: string; expiresAt: string; basis: LegalBasis }
  redactions: string[]                                  // fields stripped for the candidate copy
}
type EvidenceArtifact = {
  artifactId: string; kind: "keyframe"|"transcript_segment"|"screen_thumb"|"audio_clip"
  hash: string; mime: string; consentScope: ConsentScope; expiresAt: string   // url minted on demand
}
```

Every artifact fetch writes an access `AiRun`/audit row. Artifacts with elapsed `expiresAt` are unreachable and the bytes are purged by the retention cron.

### 10.7 Reviewer actions & scorecard submission

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/eros/v1/sessions/:id/flags/:flagId/review` | `proctor.evidence.view` | Reviewer dispositions a flag: `confirm` / `dismiss` / `benign` + rationale (human-in-the-loop) |
| POST | `/api/eros/v1/sessions/:id/notes` | member cap | Add a timestamped reviewer note (confidential-aware, `maySeeConfidential`) |
| POST | `/api/eros/v1/interviews/:id/scorecards` | `scorecard.submit` | Panelist submits own competency ratings + recommendation |
| GET | `/api/eros/v1/interviews/:id/scorecard` | `scorecard.view` | Aggregated `PanelResult` (calls `aggregatePanel`, `scorecard-agg-v1`) |
| POST | `/api/eros/v1/interviews/:id/decision` | `decision.render` | Record the human hiring decision (links Application/Offer) |
| POST | `/api/eros/v1/sessions/:id/appeal` | `decision.appeal` (subject) | Candidate contests a flag/decision; opens a review task |

```ts
// POST .../scorecards  (mirrors lib/interview/scorecard.ts::Scorecard)
type ScorecardIn = {
  ratings: Record<string, 1|2|3|4>        // competencyKey → 1..4
  recommendation: "STRONG_NO"|"NO"|"YES"|"STRONG_YES"
  notes?: string
}
// GET .../scorecard  (response = PanelResult, unchanged from scorecard.ts)
type ScorecardOut = PanelResult           // perCompetency[], overall{mean,recommendation,consensus},
                                          // decision, biasSignals[], panelSize, confidence

// POST .../decision
type DecisionIn = {
  outcome: "advance"|"hold"|"reject"|"hire"
  rationale: string                       // required free text — the human owns the call
  reliedOn: { scorecard?: boolean; riskScore?: boolean; assessment?: boolean }
  overrideRisk?: { flagId: string; reason: string }[]   // explicit, audited overrides of proctoring flags
}
```

The decision endpoint **rejects** any body that cites `riskScore`/`assessment` as the *sole* basis without a `rationale`, and stores the exact `modelId`s relied upon in the `Decision` (§12) for auditability. Scorecard aggregation returns `biasSignals` (split panel, non-differentiation, lenient/severe outlier) that the UI surfaces *before* the decision is written.

### 10.8 Policy evaluation

The policy engine is deterministic and region-aware; it is the single choke point deciding which capture features are lawful for a given `{region, subject, purpose}`. Reviewers/candidates can dry-run it.

| Method | Path | Capability | Purpose |
|---|---|---|---|
| POST | `/api/eros/v1/policy/evaluate` | `policy.evaluate` | Dry-run: which features/consents are permitted, and why |
| GET | `/api/eros/v1/policy/regions/:region` | `policy.evaluate` | Region policy card (retention caps, prohibited features, DPIA requirement) |

```ts
// POST /policy/evaluate
type PolicyQuery = { region: string; purpose: "recruitment"|"assessment"; features: ProctorFeature[] }
type PolicyDecision = {
  allow: ProctorFeature[]
  deny:  { feature: ProctorFeature; reason: string; law: string }[]   // e.g. {"emotion.*","prohibited","EU AI Act Art.5(1)(f)"}
  requires: { consent: ConsentScope[]; dpia: boolean; humanReview: boolean }
  retentionDaysMax: number
  riskTier: "prohibited"|"high"|"limited"|"minimal"                    // EU AI Act mapping (§11)
}
```

Example: `emotion.*`, `personality.*`, `deception.*` always resolve to `deny` with `law:"EU AI Act Art.5(1)(f) — emotion recognition in the workplace"`; `identity.match` resolves to `high` risk, `requires.consent:["identity_match"]`, `requires.humanReview:true`, and is `deny` in BIPA-strict jurisdictions absent written consent on file.

### 10.9 Consent & data-subject rights

| Method | Path | Capability | Purpose |
|---|---|---|---|
| GET | `/api/eros/v1/consent/:sessionId` | `consent.manage` (subject) | Current consent state + the exact text version presented |
| POST | `/api/eros/v1/consent/:sessionId` | `consent.manage` (subject) | Grant/deny per scope (`camera`,`microphone`,`screen`,`identity_match`,`recording`,`on_device_processing`) |
| POST | `/api/eros/v1/dsr/export` | `dsr.manage` \| subject | Data-subject access export (machine-readable) |
| POST | `/api/eros/v1/dsr/erase` | `dsr.manage` \| subject | Right-to-erasure; purges artifacts, keeps audit-minimal hashes |

### 10.10 Rate limits, audit, events

- **Rate limits.** `events` ingest: 60 req/min/session (batched). `stream`: 1 open SSE/WS per participant. `decision`/`scorecard`: 30/min/user. Over-limit ⇒ `429 rate_limited retryable:true`.
- **Audit.** Every AI-backed call returns `runId` → one `AiRun` row (`capId, modelId, inputsHash, confidence, explanation, status`). Reviewer actions, artifact fetches, consent changes, and decisions each emit a `PlatformEvent` (`proctor.event.ingested`, `proctor.risk.updated`, `interview.completed`, `decision.rendered`, `consent.updated`, `evidence.accessed`) via `lib/aios/events.ts` for replayable, non-destructive learning.

---

## 11. AI Model Catalog

Every engine below is a governed row in `ModelRegistry` (`modelId`, `provider`, `task`, `deploymentStatus`, `securityClass`) and is invoked only through `AIOS.execute` (audited in `AiRun`). **Confidence semantics** are stated per engine and always accompanied by an evidence pointer. **EU AI Act tier** uses: *Prohibited* (Art. 5), *High* (Annex III — employment/recruitment & access to education/vocational training), *Limited* (Art. 50 transparency), *Minimal*.

### 11.1 In-house deterministic core (no external LLM/ML/vector-DB/GPU; runs on Vercel)

| modelId | Modality | In-house / on-device | Inputs → Outputs | Confidence semantics | Validity limits | EU AI Act tier | Human review |
|---|---|---|---|---|---|---|---|
| `proctor-rules-v1` | Session events | In-house, deterministic | `ProctorEvent[]` → `RiskScore{score, factors[], flags[]}` | Coverage-weighted: function of event certainty × capture coverage; **not** a probability of cheating | Flags **observable events**, not intent or character. Low camera coverage caps confidence | **High** (access to employment/education) | **Required** — flags are advisory; a human dispositions each |
| `scorecard-agg-v1` | Structured ratings | In-house (`lib/interview/scorecard.ts`) | `Scorecard[]` → `PanelResult{perCompetency, overall, consensus, biasSignals, confidence}` | `confidence` grows with panel size × consensus (≤0.95); `consensus` from rating spread | Aggregates human judgment only; surfaces bias signals, does not correct them | **High** | **Required** — panel decides; bias signals shown pre-decision |
| `panel-governance-v1` | Metadata | In-house (`lib/interview/governance.ts`) | panel + `roleLevel` → `GovernanceResult{violations, warnings}` | N/A (rule outcome) | Governs panel seniority/visibility; no candidate inference | **Minimal** | Override is an audited human action |
| `assessment-grade-v1` | Test answers | In-house, deterministic | `Answer[]` + rubric/test-cases → per-question `correct/points`, total `score` | 1.0 for objective items (MCQ/exact/test-case); borderline free-text flagged `needs_review` | Only auto-scores objectively verifiable items; subjective items routed to humans | **High** | **Required for borderline**; objective items human-auditable |
| `funnel-calibration-v1` | Aggregate outcomes | In-house (`MatchCalibration`, isotonic) | decided `Application.snapshot` cohort → per-decile stage rates | Calibrated stage-rate, PII-free; k-anonymity floors (`sampleSize/jobCount/employerCount`) | Cohort statistics, never an individual verdict; suppressed below k-anonymity | **Limited** | Periodic fairness audit |
| `tfidf-embed-v1` / `semantic-index` | Text | In-house sparse TF-IDF (`SemanticDoc`) | JD / résumé / question text → sparse vector, cosine retrieval | Cosine similarity ∈ [0,1]; relevance, not fit | Retrieval/dedup aid only; not a ranking of people | **Minimal** | Not required |
| `identity-match-v1` | **Biometric** (face) | In-house cosine over `faceVector`; **extraction on-device preferred** | enrolled `faceVector` vs live vector → `match/mismatch` + distance | Distance-based similarity with an explicit, published threshold; emits `identity.mismatch` event, not a score of the person | **Purpose-limited to identity verification only.** Never used for any trait/demographic inference. Consent-first; disabled where prohibited | **High** (biometric identification) | **Required** on mismatch; candidate can appeal |

### 11.2 On-device optional (enterprise/future tier — WASM, never a hard dependency)

These improve signal quality but the core proctoring path is fully functional without them. All run **on-device**, emit **semantic events only** (never raw frames), and default **off**.

| modelId | Modality | Placement | Inputs → Outputs | Confidence semantics | EU AI Act tier | Human review |
|---|---|---|---|---|---|---|
| `face-presence-wasm` | Video (local) | On-device WASM | Camera frame → `face.absent`/`face.returned`/`face.multiple` events | Detector confidence per frame; hysteresis to avoid flicker | **High** (proctoring) | Required (events feed rules) |
| `second-person-wasm` | Video (local) | On-device WASM | Camera frame → `face.multiple {count}` | Detector confidence | **High** | Required |
| `liveness-wasm` | Video (local) | On-device WASM | Frame sequence → `liveness.pass/fail` (anti-spoof for `identity-match`) | Anti-presentation-attack score | **High** (biometric-adjacent) | Required |
| `asr-transcribe-wasm` | Audio (local) | On-device WASM | Audio → transcript segments (for **human** review) | Word-level confidence | **Limited** (Art. 50 transparency) | Transcript aids humans; not a score |
| `voice-activity-wasm` | Audio (local) | On-device WASM | Audio → `second.voice`/`audio.silence.long` | VAD confidence | **High** (proctoring event) | Required |

> Optional heavy/external CV or cloud ASR may be *swapped in behind the same `modelId` contract* at the enterprise tier, but is **never** a prerequisite for any core capability. The registry `deploymentStatus` (`shadow`) lets such a model run in evaluation without affecting outcomes.

### 11.3 Excluded / caveated — do **not** ship as candidate scores

These are listed to make the boundary explicit and enforceable. The event vocabulary (§10.5.2) and the policy engine (§10.8) render them unrepresentable or `deny`.

| Candidate "signal" | Status | Reason | Law |
|---|---|---|---|
| Emotion / affect recognition | **Excluded (prohibited)** | Scientifically contested; discriminatory | EU AI Act **Art. 5(1)(f)** — emotion recognition in workplace & education |
| Personality / Big-Five from face/voice | **Excluded** | Pseudoscience; no construct validity | EU AI Act (unacceptable/biometric categorization) |
| "Confidence"/stress/deception scoring | **Excluded** | No validated basis; discrimination-prone | Art. 5; GDPR fairness |
| Accent / dialect scoring | **Excluded** | Proxy for national/ethnic origin | GDPR Art. 9 special-category; anti-discrimination law |
| Biometric categorization of sensitive traits | **Excluded (prohibited)** | Infers protected attributes | EU AI Act Art. 5 |
| **Gaze / attention** (`gaze.offscreen`) | **《Caveated》** | Contested; posture/disability/neurodivergence confounds | Permitted **only** as a low-weight, human-reviewed **process** signal — never a candidate score, never auto-adverse; carries a standing validity caveat and is region-suppressible |

**Global invariants for every AI output:** (1) carries `confidence` + `evidence[]`; (2) is `explanation`-annotated in `AiRun`; (3) never the sole basis of an adverse decision (`decision.render` enforces `rationale` + `reliedOn`); (4) appealable by the candidate; (5) subject to the safe-evolution gate — anything `safetyClass:"forbidden-auto"` cannot run without human approval (`ChangeProposal`).

---

## 12. Data Models

All additions follow the repo's conventions: additive, both-SQLite-and-Postgres safe (**JSON stored as `String`**), scalar owner ids (no heavy back-relations), history never overwritten, `cuid()` ids. New models extend `Interview`, `TestAttempt`, `Application`, `Offer`, `AiRun` — never duplicate them.

### 12.1 Entity relationships (ASCII ERD)

```
                        ┌───────────────────────────┐
   Interview ◄──────────┤  ProctorSession           ├──────────► TestAttempt
   (M6, existing)        │  subjectType/subjectId    │            (M7, existing)
                         │  candidateId, region      │
                         │  state, features[]        │
                         └───┬───────┬───────┬───────┘
             1:1 mandatory   │       │ 1:N   │ 1:N
                             ▼       ▼       ▼
                    ConsentRecord  ProctorEvent  RiskScore(latest)
                    (per scope)    (append-only) (recomputed, deterministic)
                             │             │
                             │             └────────► EvidenceBundle ──► EvidenceArtifact
                             │                         (frozen at end)   (consented, TTL)
                             ▼
              Candidate (User, existing: faceVector, idVerified)

   Interview ──1:N──► ScorecardModel ──agg──► PanelResult(view)
                                   │
   ProctorSession ─┐              ▼
   RiskScore ──────┼───────► Decision ──links──► Application(status) / Offer(EROS M8)
   PanelResult ────┘              │
                                  └──► DecisionAppeal (candidate-initiated)

   Every AI-derived row (RiskScore, PanelResult, grade) → AiRun (audit) + PlatformEvent (learning)
```

### 12.2 Prisma additions (proposed, additive)

```prisma
// The unifying supervision envelope over an Interview (M6) or TestAttempt (M7).
model ProctorSession {
  id           String   @id @default(cuid())
  subjectType  String                         // "interview" | "assessment"
  subjectId    String                         // Interview.id | TestAttempt.id
  candidateId  String                         // User.id (the data subject)
  region       String   @default("EU")        // drives the policy engine (§10.8)
  purpose      String   @default("recruitment")
  features     String   @default("[]")        // JSON ProctorFeature[] actually enabled after policy strip
  tier         String   @default("in-house")  // in-house | on-device
  state        String   @default("DRAFT")     // DRAFT|READY|LIVE|PAUSED|ENDED|ABORTED
  captureCoverage Float @default(0)           // 0..1, from heartbeats — caps risk confidence
  policyJson   String   @default("{}")        // frozen PolicyDecision at start
  dpiaRef      String?                         // link to the DPIA on file (required when biometric)
  startedAt    DateTime?
  endedAt      DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([candidateId])
  @@index([subjectType, subjectId])
  @@index([state])
}

// Granular, versioned, withdrawable consent — one row per (session, scope).
model ConsentRecord {
  id           String   @id @default(cuid())
  sessionId    String
  candidateId  String
  scope        String                          // camera|microphone|screen|recording|identity_match|on_device_processing
  status       String   @default("pending")    // pending|granted|denied|withdrawn
  mandatory    Boolean  @default(false)
  textVersion  String                          // version id of the consent text shown
  textHash     String                          // sha256 of exact text presented (provable)
  legalBasis   String   @default("consent")    // consent|legitimate_interest|contract
  grantedAt    DateTime?
  withdrawnAt  DateTime?
  createdAt    DateTime @default(now())
  @@unique([sessionId, scope])
  @@index([candidateId])
}

// Append-only semantic event log. OBSERVABLE events only (§10.5.2). No raw media.
model ProctorEvent {
  id           String   @id @default(cuid())
  sessionId    String
  clientEventId String                         // dedupe key
  seq          Int
  type         String                          // ProctorEventType enum
  confidence   Float    @default(0)
  evidenceRef  String?                         // hash/handle of an on-device artifact
  meta         String   @default("{}")         // JSON, e.g. {"count":2}
  reviewState  String   @default("none")       // none|confirmed|dismissed|benign (human-in-the-loop)
  reviewNote   String?
  capturedAt   DateTime                        // client clock
  createdAt    DateTime @default(now())        // server clock
  @@unique([sessionId, clientEventId])         // exactly-once effect
  @@index([sessionId, seq])
}

// Deterministic, recomputable integrity signal. NOT a character judgment.
model RiskScore {
  id           String   @id @default(cuid())
  sessionId    String   @unique                // latest; history lives in AiRun
  modelId      String   @default("proctor-rules-v1")
  score        Float    @default(0)            // 0..1 integrity-concern index
  band         String   @default("low")        // low|medium|high (thresholds published)
  confidence   Float    @default(0)            // coverage-weighted (§11)
  factors      String   @default("[]")         // JSON [{type,weight,eventIds[],note}] — full explanation
  humanReviewed Boolean @default(false)
  computedAt   DateTime @default(now())
}

// Assembled at session end; the transparency + appeal artifact.
model EvidenceBundle {
  id           String   @id @default(cuid())
  sessionId    String   @unique
  merkleRoot   String                          // tamper-evidence over ordered events
  retentionPolicyId String
  legalBasis   String   @default("consent")
  expiresAt    DateTime                         // hard retention cap → purge cron
  redactions   String   @default("[]")         // JSON fields stripped from candidate copy
  createdAt    DateTime @default(now())
  artifacts    EvidenceArtifact[]
}

model EvidenceArtifact {
  id           String   @id @default(cuid())
  bundleId     String
  kind         String                          // keyframe|transcript_segment|screen_thumb|audio_clip
  consentScope String                          // must match a granted ConsentRecord.scope
  hash         String
  mediaId      String?                         // -> MediaAsset (bytes in DB; on-device-first)
  mime         String
  expiresAt    DateTime
  bundle       EvidenceBundle @relation(fields: [bundleId], references: [id], onDelete: Cascade)
  @@index([bundleId])
}

// One panelist's structured evaluation (mirrors lib/interview/scorecard.ts::Scorecard).
model ScorecardModel {
  id             String   @id @default(cuid())
  interviewId    String
  panelistId     String
  ratings        String   @default("{}")        // JSON competencyKey -> 1..4
  recommendation String                          // STRONG_NO|NO|YES|STRONG_YES
  notes          String?
  submittedAt    DateTime @default(now())
  @@unique([interviewId, panelistId])            // one card per panelist; revisions supersede
  @@index([interviewId])
}

// The human decision. Cites what it relied on; never model-only.
model Decision {
  id            String   @id @default(cuid())
  sessionId     String?                          // if it followed a proctored session
  interviewId   String?
  applicationId String?                          // links to Application funnel
  offerId       String?                          // may trigger EROS M8 Offer
  candidateId   String
  deciderId     String                           // the human decision owner
  outcome       String                           // advance|hold|reject|hire
  rationale     String                           // REQUIRED free text
  reliedOn      String   @default("{}")          // JSON {scorecard,riskScore,assessment} + modelIds/runIds
  riskOverrides String   @default("[]")          // JSON [{flagId,reason}] audited overrides
  createdAt     DateTime @default(now())
  @@index([applicationId])
  @@index([candidateId])
}

// Candidate-initiated contest of a flag or decision.
model DecisionAppeal {
  id           String   @id @default(cuid())
  decisionId   String?
  sessionId    String?
  candidateId  String
  reason       String
  status       String   @default("open")         // open|under_review|upheld|overturned
  reviewerId   String?
  resolution   String?
  createdAt    DateTime @default(now())
  resolvedAt   DateTime?
  @@index([candidateId])
  @@index([status])
}
```

### 12.3 Domain TypeScript types (view/DTO layer)

```ts
type SessionState = "DRAFT" | "READY" | "LIVE" | "PAUSED" | "ENDED" | "ABORTED"
type ConsentStatus = "pending" | "granted" | "denied" | "withdrawn"
type ConsentScope = "camera" | "microphone" | "screen" | "recording" | "identity_match" | "on_device_processing"
type ProctorFeature = "face.presence" | "second.person" | "tab.focus" | "voice.activity" | "identity.verify" | "screen.capture"
type LegalBasis = "consent" | "legitimate_interest" | "contract"

interface RiskScoreView { score: number; band: "low"|"medium"|"high"; confidence: number
  factors: { type: string; weight: number; eventIds: string[]; note: string }[]; humanReviewed: boolean }

interface Candidate { userId: string; region: string; idVerified: boolean
  faceEnrolled: boolean /* User.faceVector present */ }
```

### 12.4 State machines

**ProctorSession**
```
DRAFT ──(all mandatory consents granted + policy ok)──► READY
READY ──start──► LIVE ──pause──► PAUSED ──resume──► LIVE
LIVE ──end──► ENDED ──(assemble)──► [EvidenceBundle frozen]
any ──consent.withdraw / policy.violation / timeout──► ABORTED
Guards:  READY requires ConsentRecord(mandatory).status = "granted" ∀ scopes AND PolicyDecision.allow ⊇ features
         LIVE→(any) capture-token valid; ingestion rejected once state ∈ {ENDED, ABORTED} (append-only window)
```

**ConsentRecord**
```
pending ──grant──► granted ──withdraw──► withdrawn   (withdrawn halts capture immediately)
pending ──deny──► denied
* withdrawn/denied on a mandatory scope while LIVE ⇒ session → ABORTED; prior events retained per retention policy
```

**Decision**
```
(scorecards submitted + risk reviewed) ──render──► Decision{outcome}
  outcome ∈ {advance,hold} → Application.status transition (StatusEvent)
  outcome = hire          → may create/accept Offer (EROS M8)  [supersede on revision]
Decision ──candidate contests──► DecisionAppeal(open) ──review──► upheld | overturned(→ new Decision)
Invariant: a Decision citing riskScore/assessment MUST carry non-empty rationale; model-only outcomes are rejected.
```

**EvidenceArtifact retention**
```
created ──(now < expiresAt)──► retrievable (signed URL, access-audited)
       ──(now ≥ expiresAt)──► purged (bytes deleted; only hash + audit-minimal metadata survive)
DSR erase ──► immediate purge of artifacts; ProctorEvent semantic log reduced to non-identifying counts
```

### 12.5 Minimization & retention annotations

| Model | PII sensitivity | Minimization / retention |
|---|---|---|
| `ProctorEvent` | Low (semantic, no media) | Append-only; reduced to aggregate counts on DSR erase |
| `EvidenceArtifact` | High (may contain image/audio) | Consent-scoped only; hard `expiresAt`; on-device-first; purge cron |
| `ConsentRecord` | Medium | `textHash` proves exactly what was shown; never deleted (audit) — but references no biometric data |
| `RiskScore` | Medium (derived) | Latest row; full history via immutable `AiRun`; `humanReviewed` required before adverse use |
| `identity` match | High (biometric) | Uses existing `User.faceVector`; result stored as `identity.mismatch` **event**, not a stored biometric template on the session |
| `Decision` | Medium | Immutable; cites `runId`s for full explainability + appeal |

## 13. Security Architecture

### 13.1 Design stance and threat model

Modules 6 (Interview Intelligence) and 7 (Assessment/Proctoring) capture the most sensitive data the platform ever touches: live audio/video, screen and keystroke telemetry, code, and — in the optional enterprise tier — biometrics. Security is therefore **Zero Trust by construction**: no network position, no session, and no service identity is trusted on its own; every access is a fresh, fail-closed decision made from verified identity + resolved capabilities + resource attributes, and every AI action is mediated by the AIOS gateway (`lib/aios/execute.ts`), never called directly.

STRIDE-oriented threat model for the two modules:

| Threat | Vector specific to M6/M7 | Primary control |
|---|---|---|
| Spoofing | Candidate impersonation; forged interviewer identity; replayed room join | JWT `er_token` verification, per-room signed join tokens, optional liveness (enterprise), device binding |
| Tampering | Editing a proctoring timeline to fabricate/erase a flag; altering a scorecard after decision | Hash-chained `EvidenceRecord`, signed Merkle anchors, append-only `AiRun` |
| Repudiation | "I never flagged this candidate" / "that score wasn't mine" | Signed actor attribution on every evidence + decision event; forensic audit |
| Information disclosure | Raw video leakage; cross-tenant candidate data; confidential notes to an OBSERVER | Semantic-over-raw (§14), per-tenant envelope encryption, `maySeeConfidential()` redaction |
| Denial of service | Media relay flooding; assessment submission storms | Rate limits, capability-gated room creation, per-tenant quotas |
| Elevation of privilege | Candidate reading recruiter surfaces; role confusion | Capability framework (role-free authz), fail-closed `authorize()` |
| Model abuse | Prompt/telemetry injection to bias an inference; auto-retraining poisoning | AIOS safe-evolution gate, curated-datasets-only (§15.7), inputs hashed not trusted |

### 13.2 Identity, sessions, and Zero Trust enforcement points

Identity resolution is already centralized in `resolveContext(req)` (`lib/capability/context.ts`): the `er_token` cookie is verified (`verifyToken`), the user is loaded, and a `PlatformContext` with a derived capability `Set` is returned. Anonymous or unverifiable requests resolve to `anon()` — **zero capabilities, fail-closed**. Every M6/M7 surface (REST route, WS upgrade, React Server Component, AIOS provider) is an enforcement point that must resolve context and authorize before doing work.

Hardening additions for M6/M7 (near-term):

```ts
// lib/security/session.ts — session posture for high-sensitivity surfaces
export type SessionPosture = {
  mfaSatisfied: boolean          // proctor review & evidence export require step-up MFA
  deviceBound: boolean           // token bound to a device fingerprint (rotating)
  ip: string; asn?: string
  freshnessMs: number            // re-auth age; evidence export requires < 15 min
}
// Step-up: reviewing raw-tier evidence or exporting chain-of-custody bundles
// re-checks posture even for a holder of the capability.
export function requireStepUp(ctx: PlatformContext, posture: SessionPosture): boolean {
  return posture.mfaSatisfied && posture.freshnessMs < 15 * 60_000
}
```

WebRTC rooms (`Interview.roomCode`) issue **short-lived, single-use join tokens** (JWT, ≤120 s, audience = roomCode, subject = userId) gated by `mayJoin()` (`lib/interview/governance.ts`). The signalling channel authenticates every message; media is DTLS-SRTP end-to-end between peers, with the platform as an authenticated SFU/relay that never persists media unless recording is separately consented (§14).

### 13.3 RBAC + ABAC via the capability framework

The platform is deliberately **role-free at the decision point** (DDR-004): roles/plans are only *evidence* consumed by `deriveCapabilities()` to compute the capabilities a subject holds. That gives us the **RBAC** dimension (coarse "what may this kind of subject do"). **ABAC** is layered on top as attribute predicates evaluated against the specific resource and environment — never as new roles.

**New capability keys** to add to `CAPABILITIES` (`lib/capability/catalog.ts`) for M6/M7. They follow the existing `group.action` convention and remain role-free:

```ts
// recruit group — interview intelligence (M6)
{ key: "interview.record",   group: "recruit", label: "Record interviews",  description: "Enable consented recording/semantic capture" },
{ key: "interview.review",   group: "recruit", label: "Review interviews",   description: "View scorecards, transcripts, semantic timeline" },
{ key: "interview.calibrate",group: "recruit", label: "Calibrate panels",    description: "Run structured-interview calibration" },
// recruit group — assessment & proctoring (M7)
{ key: "assessment.author",  group: "recruit", label: "Author assessments",  description: "Create tests/question banks" },
{ key: "assessment.grade",   group: "recruit", label: "Grade assessments",   description: "Score/override answers" },
{ key: "proctor.session",    group: "recruit", label: "Proctor sessions",    description: "Configure/run a proctored attempt" },
{ key: "proctor.review",     group: "recruit", label: "Review proctor flags", description: "Adjudicate proctoring events (human-in-loop)" },
// evidence & privacy operations
{ key: "evidence.access",    group: "admin",   label: "Access evidence",     description: "Open chain-of-custody evidence records" },
{ key: "evidence.export",    group: "admin",   label: "Export evidence",     description: "Export signed evidence bundles (step-up MFA)" },
{ key: "privacy.dsar",       group: "admin",   label: "Handle DSARs",        description: "Fulfil access/erasure requests" },
{ key: "consent.manage",     group: "account", label: "Manage consent",      description: "Grant/revoke own consent (candidate)" },
```

The ABAC layer extends the existing `authorize()` (`lib/capability/policy.ts`) with a resource-aware guard. Capabilities gate the *verb*; attributes gate *this object in this context*:

```ts
// lib/capability/abac.ts — attribute-based constraints on top of capabilities
export type ResourceAttrs = {
  tenantId: string
  ownerIds: string[]                 // hosts/creators who own the resource
  visibility?: Visibility            // PARTICIPANTS | COMPANY | LINK (interviews)
  confidential?: boolean
  region?: string                    // data-residency region of the resource
  purpose: PurposeTag                // §14.4 purpose the access is claimed for
}
export type EnvAttrs = { region: string; posture: SessionPosture; now: number }

export type Decision = { allow: boolean; reason: string; obligations: Obligation[] }
// Obligations are post-authorization duties the caller MUST honor:
type Obligation = "redact_confidential" | "log_forensic" | "step_up_mfa" | "watermark" | "consent_required"

export function guard(ctx: PlatformContext, cap: string, r: ResourceAttrs, env: EnvAttrs): Decision {
  if (!ctx.has(cap)) return deny("missing_capability")
  if (ctx.user && r.tenantId !== tenantOf(ctx)) return deny("cross_tenant")          // isolation
  if (r.region && r.region !== env.region) return deny("residency_violation")        // §14.6
  const obligations: Obligation[] = ["log_forensic"]
  if (r.confidential && isObserver(ctx, r)) obligations.push("redact_confidential")   // maySeeConfidential
  if (cap === "evidence.export" && !requireStepUp(ctx, env.posture)) return deny("step_up_required")
  return { allow: true, reason: "ok", obligations }
}
```

Decision precedence: **capability (RBAC) → tenant isolation → residency → consent/purpose → posture/step-up → obligations**. Any failed predicate denies; the caller must discharge every returned obligation (e.g. redaction, watermarking) before returning data.

### 13.4 Authorization + AI-mediation decision flow

```
 HTTP/WS request (er_token)
        │
        ▼
 resolveContext(req) ───────────────► anon() if unverifiable  → 401
        │  PlatformContext {caps}
        ▼
 requireCapability(cap)  ───────────► not held               → 403
        │
        ▼
 guard(ctx, cap, resourceAttrs, env)  ─► tenant/residency/    → 403
        │  Decision{allow,obligations}    posture fail
        ▼
 ┌───────────────── if action invokes AI ─────────────────┐
 │ AIOS.execute(capId, {subjectId, caps, input})           │
 │   getCapability → enabled?          → error             │
 │   safetyClass == "forbidden-auto"?  → BLOCKED (human)   │  §15.5
 │   authorize(caps, cap.permissions)  → denied            │
 │   provider(ctx)  → ProviderResult{output,confidence,    │
 │                     explanation,modelId}                 │
 │   writeAiRun(...) (immutable audit)                      │  §13.9
 │   emit("ai.executed", ...)                               │
 └─────────────────────────────────────────────────────────┘
        │
        ▼
 discharge obligations (redact / watermark / forensic-log)
        │
        ▼
 response
```

No M6/M7 inference (question generation, semantic transcript, scorecard aggregation, proctor-event classification) may bypass `execute()` (DDR-005). Inferences that could influence a hiring decision are registered with `safetyClass: "forbidden-auto"` so they **cannot run headless** — they surface as recommendations a human confirms.

### 13.5 Multi-tenancy isolation

The platform is white-label multi-tenant. Isolation is defense-in-depth across four layers:

1. **Logical (schema):** every M6/M7 model carries a non-null `tenantId` (org id). A composite index leads with `tenantId`. New models below all include it.
2. **Query guard (application):** a Prisma client extension injects `tenantId` into every `where`/`create` for tenant-scoped models, derived from `PlatformContext`. A query without a resolved tenant throws (fail-closed) rather than returning global rows.

```ts
// lib/db/tenant.ts — Prisma $extends query guard (near-term isolation)
export const tenantScoped = (tenantId: string) => prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_MODELS.has(model)) return query(args)
        if (!tenantId) throw new Error("tenant_unresolved")               // fail-closed
        if (READS.has(operation)) args.where = { ...args.where, tenantId }
        if (operation === "create") args.data = { ...args.data, tenantId }
        if (operation === "createMany") args.data = args.data.map((d:any)=>({ ...d, tenantId }))
        return query(args)
      },
    },
  },
})
```

3. **Database (enterprise):** Postgres **Row-Level Security** with `current_setting('app.tenant_id')` set per transaction — a second, DB-enforced wall so an application bug cannot cross tenants.
4. **Cryptographic:** per-tenant Data Encryption Keys (§13.6) — even with raw storage access, one tenant's ciphertext is undecryptable with another tenant's key.

Media relay/SFU rooms are namespaced by `tenantId:roomCode`; join tokens embed and are validated against the tenant. Enterprise tenants may pin dedicated relay + storage buckets ("bring-your-own-region").

### 13.6 Encryption: at rest, in transit, in use

**In transit:** TLS 1.3 for all HTTP/WS; DTLS-SRTP for media; HSTS; strict CSP on capture pages; no mixed content. Internal service hops (relay ↔ storage ↔ app) are mutually authenticated.

**At rest:** envelope encryption with a per-tenant key hierarchy.

```
Root KEK (KMS/HSM, never exported)
   └─ Tenant Master Key (TMK, wrapped by KEK, rotated 90d)
        ├─ DEK: evidence/media blobs (AES-256-GCM, per-object IV)
        ├─ DEK: biometric templates  (separate DEK; crypto-shred unit) §14.9
        └─ DEK: field-level PII (deterministic only where search is required)
```

Blob store objects (recordings where consented, screen captures) are client-or-edge encrypted before persistence; the object key wraps a per-object DEK. SQLite (local/dev) uses full-database encryption; Postgres (prod) uses TDE plus application-level field encryption for special categories.

**In use (the hard case):** the primary strategy is to **not have raw data server-side at all** — on-device / in-browser WASM processing produces semantic events, and only those events (not frames) traverse the network (§14.3). Where server-side processing of sensitive plaintext is unavoidable, near-term uses process isolation + ephemeral memory (no swap, zeroed buffers, no disk spill); the enterprise tier targets **confidential computing** (TEE/enclaves, e.g. SEV-SNP/TDX) so plaintext exists only inside an attested enclave. Homomorphic/secure-MPC scoring is flagged aspirational, not a core dependency.

### 13.7 Key & secret management

- **Hierarchy & custody:** KEK in a managed KMS/HSM (cloud KMS in prod; the near-term Vercel deployment uses the platform KMS with keys never in env). Application secrets (JWT signing key, provider keys) in a secret manager, injected at runtime; **no secrets in the repo or client bundle**.
- **Rotation:** JWT signing keys rotate with overlapping `kid`s (verify old+new during the window); TMKs rotate 90 days; DEKs are re-wrapped without re-encrypting data. Biometric-template DEKs rotate on policy change and on breach.
- **Separation of duties:** issuing/rotating evidence-signing keys requires `admin.super` **plus** a second approver (`ai.governance.review`) — two-person control, logged as a `ChangeProposal`.
- **Signing keys:** an **Ed25519** evidence-signing keypair per tenant (private key in HSM) signs Merkle anchors and export bundles (§13.8/13.10). Public keys are published so exports are third-party-verifiable.

### 13.8 Tamper-evident evidence (hash chains + signatures)

Every proctoring event and interview artifact is a link in a per-session **hash chain**; chains are periodically sealed with a signed Merkle root. This makes silent insertion, deletion, or reordering detectable.

```prisma
// Proctoring emits observable EVENTS only — never character/emotion judgments (§15, honesty).
model ProctorEvent {
  id           String   @id @default(cuid())
  tenantId     String
  attemptId    String                        // TestAttempt (M7) OR interviewId (M6)
  surface      String                        // "assessment" | "interview"
  kind         String   // FACE_MISSING|SECOND_PERSON|TAB_SWITCH|WINDOW_BLUR|PASTE|DEVICE_CHANGE|
                        // AUDIO_SPEECH_OVERLAP|NETWORK_DROP|FULLSCREEN_EXIT  (observable, enumerated)
  observedAt   DateTime                       // client clock
  recordedAt   DateTime @default(now())       // server clock (skew captured)
  confidence   Float?                         // detector confidence 0..1 (never a candidate score)
  evidenceRef  String?                        // pointer to encrypted thumbnail/clip IF consented; else null
  detector     String                         // "wasm.face.v3" | "dom.visibility" | "input.paste"
  seq          Int                            // per-session monotonic
  prevHash     String                         // hash of previous link in this session's chain
  selfHash     String   @unique               // sha256(canonical(payload) + prevHash)
  reviewStatus String   @default("unreviewed")// unreviewed|confirmed|dismissed|inconclusive
  reviewedBy   String?                        // human adjudicator (proctor.review)
  @@index([tenantId, attemptId, seq])
}

model EvidenceAnchor {                          // periodic seal of a chain segment
  id         String   @id @default(cuid())
  tenantId   String
  scope      String                            // "proctor:<attemptId>" | "audit:<yyyy-mm-dd>"
  fromSeq    Int
  toSeq      Int
  merkleRoot String
  signature  String                            // Ed25519 over merkleRoot||scope||toSeq (tenant key)
  keyId      String                            // signing kid for verification
  createdAt  DateTime @default(now())
  @@index([tenantId, scope])
}
```

```ts
// lib/evidence/chain.ts — deterministic, in-house, no external service
import crypto from "crypto"
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex")
export const linkHash = (canonicalPayload: string, prevHash: string) => sha(canonicalPayload + prevHash)
// Merkle root over an ordered list of selfHashes (binary tree, duplicate last if odd)
export function merkleRoot(leaves: string[]): string {
  if (!leaves.length) return sha("")
  let lvl = leaves.slice()
  while (lvl.length > 1) {
    const nxt: string[] = []
    for (let i = 0; i < lvl.length; i += 2) nxt.push(sha(lvl[i] + (lvl[i + 1] ?? lvl[i])))
    lvl = nxt
  }
  return lvl[0]
}
// Verification: recompute each selfHash from stored payload, walk prevHash links,
// rebuild the Merkle root, verify the Ed25519 signature against the published tenant key.
```

Anchors are written on session close and on a cron cadence; the root may additionally be published to an append-only external notary/transparency log in the enterprise tier (optional, not required for integrity).

### 13.9 Forensic audit logs

`AiRun` (`lib/aios/audit.ts`) already gives an **immutable, PII-free** record of every AI execution (inputs hashed via `inputsHash`, outputs truncated, `confidence`, `explanation`, `status`, `latencyMs`). M6/M7 extend forensic coverage to non-AI security events and make the AI log **tamper-evident** by chaining it:

```prisma
model SecurityAudit {                            // human & system security-relevant actions
  id         String   @id @default(cuid())
  tenantId   String
  actorId    String?                             // null = system
  action     String    // evidence.view|evidence.export|consent.revoke|proctor.dismiss|key.rotate|dsar.fulfil
  target     String                              // resource id
  ip         String?
  ua         String?
  meta       String    @default("{}")            // JSON (no raw PII)
  prevHash   String
  selfHash   String    @unique
  createdAt  DateTime  @default(now())
  @@index([tenantId, action, createdAt])
}
```

Audit logs are append-only (no update/delete grants; enforced by the query guard and, in enterprise, Postgres triggers + WORM storage). A daily `EvidenceAnchor` with scope `audit:<date>` seals the day's `AiRun` + `SecurityAudit` selfHashes, giving the whole audit trail the same tamper-evidence as evidence. Retention of forensic logs is decoupled from content retention: **content is minimized/deleted per §14.5, but the hashed forensic record of what happened is retained** for the statutory/EU-AI-Act logging window.

### 13.10 Evidence integrity + chain of custody

Every piece of evidence has an explicit custody record answering *who created it, who touched it, and can we prove it is unchanged*.

```prisma
model CustodyEvent {
  id          String   @id @default(cuid())
  tenantId    String
  evidenceRef String                            // ProctorEvent.id / artifact id / anchor id
  actorId     String?                           // null = automated capture
  act         String    // CAPTURED|SEALED|ACCESSED|REDACTED|EXPORTED|LEGAL_HOLD|DELETED|SHREDDED
  reason      String?                           // purpose asserted for access (§14.4)
  posture     String    @default("{}")          // JSON: mfa, ip, step-up (for ACCESSED/EXPORTED)
  prevHash    String
  selfHash    String    @unique
  createdAt   DateTime  @default(now())
  @@index([tenantId, evidenceRef, createdAt])
}
```

Chain-of-custody guarantees:

- **Provenance:** capture events record `detector` + device + clock skew; nothing enters the chain without a `CustodyEvent(act: CAPTURED)`.
- **Integrity:** any read verifies `selfHash`/`prevHash` and the covering `EvidenceAnchor` signature before returning; a broken link raises a `SecurityAudit(action: integrity.fail)` and quarantines the artifact.
- **Export:** `evidence.export` (step-up MFA required) produces a signed bundle: `{ records[], custody[], anchors[], tenantPublicKey, verifier.md }`, independently verifiable offline. Every export writes `CustodyEvent(act: EXPORTED)`.
- **Legal hold:** a hold flag suspends retention deletion (§14.5); `SHREDDED` (crypto-shred of the object DEK) is the terminal, irreversible custody act and is itself anchored.

### 13.11 Near-term vs. enterprise/aspirational

| Control | Near-term (buildable on this stack now) | Enterprise / future-state |
|---|---|---|
| Isolation | `tenantId` scoping + Prisma query guard | Postgres RLS, dedicated per-tenant relay/storage |
| Encryption in use | On-device WASM (no raw server-side) + ephemeral memory | Confidential computing (TEE/enclaves), MPC/HE scoring |
| Keys | Platform KMS + rotating JWT `kid`, per-tenant TMK | External HSM, BYOK, dual-control ceremonies |
| Tamper-evidence | Hash-chained events + signed Merkle anchors | External transparency-log/notary anchoring |
| Audit | Immutable `AiRun` + `SecurityAudit`, daily anchor | WORM storage, SIEM streaming, 3rd-party attestation |
| Liveness/anti-spoof | Deterministic on-device checks (event-level) | Optional GPU/on-device CV model, hardware attestation |

---

## 14. Privacy Architecture

### 14.1 Principles: the Semantic Digital Twin

The platform's own principle — **semantic events over raw media** — is the privacy cornerstone. The system does not want your face; it wants the *observable, purpose-relevant fact* ("candidate left frame 00:12:04–00:12:31") expressed as a structured event. Raw modalities are processed at the edge/on-device, distilled to minimal semantic events, and discarded. This directly serves GDPR data-minimization (Art. 5(1)(c)), purpose limitation (Art. 5(1)(b)), and storage limitation (Art. 5(1)(e)), and shrinks the EU-AI-Act high-risk surface.

```
 CAPTURE (browser/device)        EDGE FILTER (WASM, on-device)         SERVER (minimized)
 ┌───────────────┐   frames      ┌──────────────────────────┐  events  ┌──────────────┐
 │ camera / mic  │──────────────►│ liveness/face-present,    │─────────►│ ProctorEvent │
 │ screen / DOM  │  never leave   │ tab/visibility, paste     │ semantic │ (hash-chain) │
 │ keystrokes    │  the device    │ → SEMANTIC EVENTS ONLY    │  only    └──────────────┘
 └───────────────┘               │ raw dropped after distill │          raw NOT stored
                                  └──────────────────────────┘          (unless separately
                                          │ ephemeral                     consented recording)
                                          ▼
                                   discarded (≤ frame buffer)
```

### 14.2 Consent lifecycle — granular, revocable, per-modality

Consent is **per-modality, per-purpose, per-session, versioned, and revocable**, captured before any capture begins. No modality may be captured without a matching active grant; revocation stops capture immediately and triggers deletion of that modality's data per policy.

```prisma
model ConsentGrant {
  id           String   @id @default(cuid())
  tenantId     String
  subjectId    String                          // the candidate (data subject)
  contextType  String                          // "interview" | "assessment"
  contextId    String                          // interviewId | testAttemptId
  modality     String   // VIDEO|AUDIO|SCREEN|KEYSTROKE|CODE|TRANSCRIPT|BIOMETRIC_FACE|RECORDING_STORE
  purpose      String                          // PurposeTag (§14.4) — bound at grant time
  policyVersion String                         // notice text version shown to the subject
  state        String   @default("granted")    // pending|granted|declined|revoked|expired
  lawfulBasis  String                          // "consent" (default) | "contract" | "legit_interest"
  region       String                          // residency at grant time
  grantedAt    DateTime @default(now())
  revokedAt    DateTime?
  expiresAt    DateTime?
  evidenceHash String                          // hash of the exact notice+choice (proof of consent)
  @@unique([subjectId, contextType, contextId, modality, purpose])
  @@index([tenantId, subjectId])
}
```

State machine (deny is always reachable and always wins):

```
        show notice (versioned)
 pending ───────────────► granted ──(subject revokes)──► revoked ──► delete modality data (§14.5)
   │                        │  ▲                             ▲
   │ (subject declines)     │  │(re-consent, new version)    │(TTL)
   ▼                        ▼  │                          expired
 declined ◄────────────────┘  └──────────────────────────────┘
 → capture never starts / stops; alternative path offered (e.g. non-proctored, human-scheduled)
```

Rules:
- **Pre-capture gate.** The capture client will not initialize a track without `state == "granted"` for that exact modality+purpose; the server rejects events lacking a matching grant (fail-closed).
- **No dark patterns / no bundling.** Each modality is a separate, equally-weighted choice; declining proctoring must offer a genuine alternative (proctor-lite or human-scheduled), never an automatic rejection.
- **Proof of consent.** `evidenceHash` binds the exact notice version and choice — replayable in a dispute; recorded in `SecurityAudit`.
- **Revocation is real-time.** Revoke → capture stops → `emit("consent.revoked")` → deletion job for that modality's data → confirmation to the subject.

### 14.3 Data minimization

Minimization is enforced by *what leaves the device*, not by after-the-fact deletion. Per-modality policy:

| Modality | On-device processing | Leaves device | Server storage default | Raw retained? |
|---|---|---|---|---|
| Video | Liveness / face-present / second-person (WASM) | `ProctorEvent`s + optional low-res thumbnail (if consented) | Events only | No (recording only on explicit `RECORDING_STORE` consent) |
| Audio | Speech-present / overlap detection | Event flags; transcript text if consented | Semantic timeline | No raw audio |
| Screen | Region/window-change detection | Change events; snapshot only on flag+consent | Events | No |
| Keystroke | Paste/burst detection (counts, not content) | Aggregate counts (`tabSwitches` already exists) | Counts | No content |
| Code | Diff/paste/AST signals | Submission + signals | Submission (needed to grade) | Submission is the deliverable |
| Transcript | STT on-device where feasible | Text | Text (semantic index) | No source audio |

`TestAttempt.tabSwitches` and `TestAttempt.proctored` are the existing minimal precedent; M7 generalizes this to the event model above. Thumbnails/clips are the **exception**, captured only when a flag fires *and* `RECORDING_STORE`/`VIDEO`-store consent exists, and are always encrypted + hash-chained (§13.8).

### 14.4 Purpose limitation

Every capture, storage, and access is bound to an enumerated **purpose tag**; a purpose is asserted at consent time and re-asserted at access time (the `guard()` obligation and `CustodyEvent.reason`). Access for a purpose the subject did not consent to is denied.

```ts
// lib/privacy/purpose.ts
export type PurposeTag =
  | "interview.conduct"        // run the live interview
  | "assessment.deliver"       // deliver/grade a test
  | "proctor.integrity"        // detect exam-integrity events
  | "hiring.decision.support"  // human-reviewed decision support (never autonomous)
  | "dispute.appeal"           // candidate-initiated appeal review
  | "security.investigation"   // narrow, logged, dual-authorized
  | "legal.hold"
// Forbidden purposes — enumerated and rejected at the type/policy level:
export const FORBIDDEN_PURPOSES = [
  "emotion.inference", "personality.scoring", "affect.scoring",
  "accent.scoring", "demographic.inference", "training.autoretrain", // §15.7
  "marketing", "resale", "cross_context_profiling",
] as const
```

Purpose is stored on `ConsentGrant.purpose` and checked in `guard()`; secondary use requires a new grant. This is the mechanism that structurally forbids the pseudoscientific uses called out in §15.

### 14.5 Retention & deletion

Default is aggressive minimization; retention is per-artifact-class, region-configurable, and enforced by a cron sweep plus crypto-shredding.

| Artifact class | Default retention | Deletion mechanism |
|---|---|---|
| Raw video/audio frames | Not stored (ephemeral, ≤ buffer) | N/A — never persisted |
| Consented recording/thumbnails | 30 days (config 7–90) | Crypto-shred object DEK |
| ProctorEvents (semantic) | Duration of hiring cycle + 90 days | Row delete + anchor note |
| Transcripts / semantic timeline | Hiring cycle + 180 days | Row delete |
| Scorecards / decisions | Statutory (e.g. 12 mo post-decision) | Retain (decision record) |
| Biometric templates | Session-only or ≤ statutory min (BIPA ≤ 3 yr, prefer purge on completion) | Crypto-shred DEK (§14.9) |
| Forensic audit (hashed) | AI-Act logging window (multi-year) | Retain (no content) |

```ts
// lib/privacy/retention.ts — cron sweep (idempotent, replayable)
export async function sweepRetention(now = Date.now()) {
  const due = await prisma.$queryRaw/* find artifacts past TTL & not on legal hold */``
  for (const a of due) {
    if (a.legalHold) continue
    await cryptoShred(a.dekId)                 // shred key → ciphertext unrecoverable
    await writeCustody(a, "SHREDDED")          // anchored (§13.10)
    await emit("privacy.retention.deleted", { ref: a.id })
  }
}
```

Crypto-shredding (destroying the object's DEK) makes deletion **provable and cheap** even on immutable/backup storage — the ciphertext remains but is permanently undecryptable, and the shred act is itself tamper-evident.

### 14.6 Region / data residency

- **Region tagging.** `ConsentGrant.region`, resource `region`, and env `region` are compared in `guard()`; cross-region access is denied unless a lawful transfer basis is recorded.
- **Routing.** Capture endpoints and relays resolve the tenant/subject region and pin storage to that region's bucket; enterprise tenants pin a dedicated region ("EU-only").
- **Transfers.** Any cross-border flow requires a recorded transfer mechanism (SCCs/adequacy) and a `SecurityAudit(action: cross_region_transfer)` entry; biometrics never leave their capture region by default.

### 14.7 Candidate rights (access / appeal / erasure)

Candidates are first-class data subjects with self-service rights, exposed as capability-gated endpoints (`consent.manage` for the subject; `privacy.dsar` for operators):

```
GET  /api/privacy/me/data           → export: consents, events (semantic), scorecards visible to subject
POST /api/privacy/me/consent/revoke → { modality, contextId } → stop+delete
POST /api/privacy/me/appeal         → { decisionId, statement } → opens AppealCase (§15.10)
POST /api/privacy/me/erase          → right-to-erasure request → DSAR workflow
GET  /api/privacy/me/explain/:runId → human-readable explanation of an AI output (AiRun.explanation)
```

```prisma
model DsarRequest {
  id         String   @id @default(cuid())
  tenantId   String
  subjectId  String
  kind       String   // access|erasure|rectification|portability|objection
  state      String   @default("received") // received|verifying|in_progress|fulfilled|refused
  dueBy      DateTime                        // statutory clock (e.g. 30 days GDPR)
  handledBy  String?                         // privacy.dsar holder
  outcome    String?
  createdAt  DateTime @default(now())
  @@index([tenantId, state, dueBy])
}
```

- **Access/portability:** returns semantic data + explanations, not other parties' confidential notes (`maySeeConfidential`), in a machine-readable bundle.
- **Erasure:** crypto-shred + row delete of the subject's content, preserving only the hashed forensic minimum required by law; confirmation issued.
- **Appeal:** every AI-influenced decision is appealable to a human (§15.10); the appeal path is surfaced with the decision, not buried.
- **Explanation:** `GET /explain/:runId` returns the stored `AiRun.explanation` + `confidence` + evidence pointers — no black boxes.

### 14.8 DPIA template (per capability, before launch)

A Data Protection Impact Assessment is mandatory for M6/M7 (biometrics + high-risk decision support) and is a living document reviewed by the ethics board (§15.9):

```
DPIA — <capability key, e.g. proctor.session>
1. Description        purpose, modalities, data flows (edge→server), retention
2. Necessity/         Is capture necessary & proportionate? Less-intrusive alternative
   proportionality    considered (proctor-lite, human-scheduled)?  Why event-over-raw.
3. Lawful basis       per modality (consent default); special-category basis (§14.9)
4. Data subjects      candidates (incl. potentially minors, accessibility needs)
5. Risks              re-identification, discrimination/bias, function creep,
                      false-positive integrity flags harming a candidate, breach
6. Likelihood/severity  scored matrix per risk
7. Mitigations        semantic-over-raw, human-in-loop, appeal, on-device, consent,
                      retention limits, fairness monitoring (§15.8)
8. Residual risk      accepted / not-accepted (board sign-off)
9. Human oversight    who reviews flags; SLA; competence
10. Review date       + trigger events (model change, new region, incident)
```

### 14.9 Biometric special-category handling (BIPA / GDPR Art. 9)

Biometric identifiers (facial geometry, voiceprints) are **GDPR Art. 9 special-category** data and **BIPA-regulated** (Illinois and similar). This platform's default is **to avoid them entirely** — proctoring uses face-*presence* and second-*person* detection, which are event signals, not identity/biometric templates. When an enterprise tenant enables biometric identity verification, the following plan is mandatory and non-negotiable:

- **Separate, explicit, written consent** (BIPA §15(b)): a dedicated `ConsentGrant(modality: BIOMETRIC_FACE)` with its own notice stating what is collected, the purpose, and the **retention/destruction schedule** — never bundled with general consent.
- **Written retention & destruction policy** (BIPA §15(a)): publicly available; destroy on purpose completion or within the statutory maximum (BIPA: ≤ 3 years from last interaction — we default to *purge on session completion*).
- **No sale / no disclosure** (BIPA §15(c)/(d)): biometrics are never sold, shared, or used for any secondary purpose; `FORBIDDEN_PURPOSES` enforced.
- **Template, not image.** Where identity verification is used, compute an on-device match against a candidate-provided reference; store an **irreversible template** (not the image) under a **dedicated DEK** so it can be crypto-shredded independently, or — preferably — perform match on-device and store only a boolean result.
- **Art. 9 basis:** explicit consent is the basis; a genuine non-biometric alternative must exist (documents + human check), or the biometric path is unlawful.
- **DPIA required** before enablement; region gating (BIPA-strict states / EU) baked into `guard()`.
- **No inference from biometrics.** Face/voice are used *only* for presence or (enterprise) identity verification — never to infer emotion, confidence, personality, honesty, or demographics (§15 honesty stance). Those uses are in `FORBIDDEN_PURPOSES` and rejected at the type level.

| Aspect | Near-term default | Enterprise (opt-in, guarded) |
|---|---|---|
| Face use | Presence / second-person event only (no identity) | On-device identity verification, template stored |
| Voice use | Speech-present/overlap event | (Not offered — no voiceprint) |
| Storage | No biometric template | Irreversible template, dedicated DEK, purge-on-complete |
| Basis | Not special-category (event only) | Explicit written consent + DPIA + region gate |

---

## 15. Governance Framework

### 15.1 EU AI Act classification and honesty stance

M6/M7 are treated as a **high-risk AI system** under the EU AI Act (Annex III — employment, recruitment, and worker-management). This triggers the full conformity obligations (Art. 9–15, 17): risk management, data governance, technical documentation, record-keeping/logging, transparency, human oversight, and accuracy/robustness/cybersecurity. We design to those obligations regardless of jurisdiction because it is the strictest bar.

**Foundational honesty position (binds the whole framework):** inference of **emotion, personality, "confidence," honesty, accent quality, or demographics from face or voice is scientifically contested and discrimination-prone.** The platform:

- does **not** produce these as candidate **scores** that affect hiring — ever;
- treats proctoring as detection of **observable, enumerated events** (face-missing, second-person, tab-switch, paste), never character judgments;
- confines any face/voice affect signals, if ever surfaced, to **low-weight, human-reviewed process signals with explicit validity caveats**, and the council's recommendation is to **omit them** from decisioning entirely;
- additionally, the EU AI Act **prohibits emotion inference in the workplace** (Art. 5) — so emotion recognition of candidates/workers is not merely discouraged here, it is disallowed and enumerated in `FORBIDDEN_PURPOSES` (§14.4).

Every AI output carries `confidence` + `explanation` + evidence (already in `AiRun`); **humans decide; candidates can appeal** (§15.10).

### 15.2 Risk management system (Art. 9)

A continuous, documented cycle per high-risk capability, owned by the ethics board (§15.9) and evidenced in the DPIA (§14.8):

```
 identify ─► analyze ─► evaluate ─► mitigate ─► verify (test) ─► monitor ─► (re-enter)
   │           │          │           │            │              │
 known+     severity×   accept?    design/       pre-deploy     post-market
 foreseeable likelihood  residual   process/HITL  eval gate      signals + incidents
 misuse                  controls
```

Registered risks for M6/M7 include: false-positive integrity flags harming an honest candidate; disparate impact across protected groups; over-reliance/automation bias by reviewers; function creep into affect inference; re-identification from "semantic" data; adversarial evasion of proctoring. Each has an owner, mitigation, residual-risk decision, and a monitoring metric in `EvalRun`.

### 15.3 Data governance (Art. 10)

- **Curated, documented datasets only.** Any dataset used to build/tune an in-house detector or scoring model is versioned, provenance-tracked (`KnowledgeItem.provenance`, `securityClass`, `status`), and reviewed for representativeness and bias before use. Datasets carry a datasheet (source, consent basis, demographics coverage, known gaps).
- **No training on production user interactions** (see §15.7) — the event stream (`PlatformEvent`) drives *retrieval/recommendation freshness and analytics*, **not** silent model weight updates.
- **Bias examination** of training data is mandatory and recorded; gaps trigger targeted, consented data collection, never scraping.
- **Data quality gates:** schema validation, label-quality review, and leakage checks before a dataset is admitted.

### 15.4 Logging & record-keeping (Art. 12)

Already substantially in place and extended in §13: `AiRun` (immutable, PII-free, per-execution, with `confidence`/`explanation`/`status`), `SecurityAudit`, `ProctorEvent` (hash-chained), `PlatformEvent`, and daily `EvidenceAnchor` seals. This satisfies automatic recording of events over the system's lifetime and enables post-market monitoring and incident reconstruction. Logs are retained for the statutory window independent of content deletion (§14.5).

### 15.5 Transparency & human oversight (Art. 13–14)

- **Disclosure:** candidates are told, before capture, that AI-assisted assessment/proctoring is used, what modalities are captured, what the outputs mean, and how to appeal (interacts with §14.2 consent notice).
- **Human-in-the-loop is architectural, not policy-only.** Capabilities that could influence a hiring outcome are registered `safetyClass: "forbidden-auto"` in the AIOS registry, so `execute()` returns `BLOCKED` rather than acting autonomously (`lib/aios/execute.ts` line: `if (cap.safetyClass === "forbidden-auto")`). A human must confirm.
- **Meaningful oversight:** reviewers see the output, its `confidence`, its `explanation`, and the underlying evidence, and can override or dismiss; the interface is designed to counter automation bias (surfaces uncertainty, requires an explicit human rationale to confirm adverse actions).
- **Panel/attendance governance** (`lib/interview/governance.ts`) already encodes human-oversight guardrails (panel seniority requirements, confidential redaction, who-may-view/join) — extended to require a qualified human reviewer for any adverse proctoring adjudication (`proctor.review`).
- **Structured over impressionistic:** scorecards (`lib/interview/scorecard.ts`) aggregate competency evidence with bias signals; the framework favors structured, job-relevant, rubric-based assessment over holistic impressions.

### 15.6 Accuracy & robustness (Art. 15)

- **Metrics tracked in `EvalRun`** per detector/capability: for proctoring detectors, false-positive rate and false-negative rate (with candidate-harm weighted toward minimizing false positives); for retrieval/recommendation, existing accuracy/freshness metrics. Thresholds gate deployment.
- **Calibration:** confidence outputs are calibrated; a detector below its accuracy floor is disabled (`enabled: false`) rather than shipped.
- **Adversarial robustness:** proctoring assumes evasion attempts; multiple independent signals corroborate before a flag is treated as significant; single low-confidence signals never auto-adjudicate.
- **Graceful degradation:** network drop / device change are themselves logged as events, not silently treated as violations; the candidate is not penalized for infrastructure faults.

### 15.7 Model change governance — curated only, NEVER auto-retrain

**Hard rule:** the system does **not** auto-retrain, fine-tune, or update model weights from user interactions or captured candidate data. The event-driven learning in `lib/aios/events.ts` updates **knowledge, memory, indexes, recommendations, and analytics** — structured, inspectable state — **never model weights**, and never from special-category or candidate-assessment data.

Every model or decision-logic change flows through the existing human-approval pipeline (`ChangeProposal`, `safetyClass`, `ai.governance.review`):

```
 curated dataset (datasheet, bias-reviewed §15.3)
        │
        ▼
 candidate model / rule change ──► ChangeProposal(kind:"prompt"|"knowledge"|"governance",
        │                                          status:"pending")
        ▼
 offline eval gate (EvalRun: accuracy, FPR/FNR, fairness §15.8) — must pass thresholds
        │
        ▼
 human review (ai.governance.review) + ethics board for high-risk ──► approved | rejected
        │ approved                                                        (never self-approved,
        ▼                                                                  §27/§28)
 staged rollout (canary) ──► monitor EvalRun/incidents ──► promote | rollback
```

- **No self-approval** (DDR §27/§28): AIOS may *propose*; humans *approve*. Applied only after approval.
- **Immutability of decision logic per attempt:** the model/ruleset version used for a given attempt is pinned in `AiRun.modelId` so a decision can be reproduced and audited even after the logic changes.
- **Poisoning defense:** because production capture never feeds training, telemetry/prompt injection cannot silently shift model behavior.

### 15.8 Bias & fairness governance

- **Protected attributes are not collected for scoring** and are never inputs to any assessment/proctoring model. Where demographic data exists (voluntary, separate consent, e.g. for diversity reporting), it is walled off from decision paths and used *only* to **measure** fairness in aggregate.
- **Disparate-impact monitoring:** `EvalRun` tracks outcome and flag-rate distributions across available protected dimensions (four-fifths / adverse-impact ratio, flag-rate parity for proctoring). Breaches raise a `ChangeProposal(kind:"governance")` and can auto-disable a capability pending review.

```ts
// lib/governance/fairness.ts — aggregate, privacy-preserving (k-anonymous buckets)
export type FairnessMetric = { dimension: string; groupRates: Record<string, number>;
  impactRatio: number /* min/max */; sampleSizes: Record<string, number>; passesFourFifths: boolean }
// Computed on aggregates only; suppressed when any bucket < k (default k=20) to avoid re-identification.
```

- **Scorecard bias signals** (`lib/interview/scorecard.ts`) already flag intra-panel disagreement and potential bias patterns; governance requires these be reviewed, not ignored, before decisions.
- **Proctoring fairness specifics:** integrity detectors are tested for differential false-positive rates (e.g. face-detection across skin tones, lighting; second-person flags in shared-living contexts; keystroke signals for assistive-tech users). Accessibility accommodations (screen readers, extra time, non-camera paths) must not generate integrity flags.
- **Regular audits:** independent bias audit of high-risk capabilities at least annually and on any material change; results to the ethics board.

### 15.9 Ethics review board

A standing, cross-functional board with real authority (can block or disable a capability):

- **Composition:** Privacy Engineer, AI Safety Researcher, legal/DPO, an HR/fairness domain expert, an accessibility representative, and an independent external member; a candidate-advocate voice for adverse-impact reviews.
- **Mandate:** approve DPIAs (§14.8) and high-risk `ChangeProposal`s; own the risk register (§15.2); review fairness audits (§15.8) and incident reports; sign off on any biometric/affect-adjacent proposal (default answer: no).
- **Cadence & powers:** scheduled reviews + emergency convene on incident; power to require rollback, disable (`enabled:false`), or add obligations. Decisions recorded as `ChangeProposal` outcomes with rationale — auditable.
- **Escalation triggers:** any new modality, new region, affect/biometric proposal, a fairness threshold breach, or a cluster of appeals.

### 15.10 Appeals & redress

Every AI-influenced decision (assessment score, proctoring flag that affected progression, ranking that gated a candidate) is **appealable to a competent human**, and the appeal path is presented *with* the decision.

```prisma
model AppealCase {
  id          String   @id @default(cuid())
  tenantId    String
  subjectId   String                          // candidate
  decisionRef String                          // AiRun.id / scorecard id / ProctorEvent.id
  statement   String                          // candidate's account
  state       String   @default("open")       // open|reviewing|upheld|overturned|withdrawn
  reviewerId  String?                          // human, distinct from original decider
  rationale   String?                          // reasoned outcome (given to candidate)
  createdAt   DateTime @default(now())
  resolvedAt  DateTime?
  @@index([tenantId, state])
}
```

Guarantees:
- **Independent human review:** the reviewer differs from the original decision-maker and sees full evidence + explanation + chain-of-custody integrity check.
- **Burden on the system:** a proctoring flag is a *signal to review*, never an automatic adverse decision; the candidate is given the benefit of the doubt where evidence is inconclusive (`reviewStatus: "inconclusive"`).
- **Reasoned outcome + correction:** the candidate receives the rationale; an overturned decision triggers correction of the record and a `ChangeProposal` if it reveals a systemic issue (feeding §15.2/§15.8).
- **No retaliation / free appeal:** appealing never worsens standing; the process is transparent and time-bound.

### 15.11 Near-term vs. enterprise/aspirational (governance)

| Obligation | Near-term (now) | Enterprise / future-state |
|---|---|---|
| High-risk conformity | DPIA + risk register + human-in-loop (`forbidden-auto`) + logging | Notified-body conformity assessment, CE-style declaration, registration |
| Human oversight | AIOS gate + reviewer UI with confidence/explanation | Certified reviewer training, SLA-backed oversight center |
| Model change | `ChangeProposal` + offline eval gate + no auto-retrain | Formal MLOps model registry, staged canary automation, external audit |
| Fairness | Aggregate disparate-impact metrics in `EvalRun` | Independent third-party bias audit, continuous fairness dashboards |
| Ethics board | Cross-functional internal board + external member | Chartered board with published transparency reports |
| Appeals | `AppealCase` workflow + human review | Ombudsperson, regulator liaison, public accountability reporting |

## 16. Human Review Workflows

### 16.1 The governing invariant: *advisory-until-confirmed*

Every automated output produced by Modules 6 and 7 — a proctoring event, an interview process-signal, a scorecard bias flag, an assessment auto-score, an identity-match — enters the platform as an **advisory artifact with no decision authority**. It cannot, by construction, cause an adverse action (rejection, disqualification, integrity-violation on record, withdrawal of an offer) until a capability-holding human has reviewed it and recorded a verdict. This is enforced three ways:

1. **At the AI gateway** (`lib/aios/execute.ts`): capabilities that can produce adverse-affecting output are registered `safetyClass: "forbidden-auto"` and are *blocked* from autonomous execution (the gate already returns `blocked / requires_human_approval`). They may only run in `mode:"assist"` — producing a `ReviewFlag`, never a `StatusEvent`.
2. **At the funnel writer**: the code path that writes an adverse `Application.status` / `StatusEvent` / integrity outcome refuses any write whose `causeRef` points at an *unconfirmed* `ReviewFlag`. Fail-closed.
3. **At data model level**: a `ReviewFlag` has no `outcome` a human did not sign; the candidate-visible record is derived from `ReviewAction`, not from the raw signal.

```
 detector (in-house, deterministic/on-device)
      │  emits SEMANTIC event (never a verdict, never raw video)
      ▼
 ReviewFlag  ── advisory, confidence + evidence ──►  Triage Queue
      │                                                   │
      │                                          human reviewer (capability-gated)
      ▼                                                   ▼
 (no effect on candidate)                        ReviewAction  { confirm | dismiss | inconclusive | override }
                                                          │
                                     ┌────────────────────┴───────────────────┐
                                 high-stakes?                              routine
                                     │                                         │
                              dual independent review                    single verdict
                                     │                                         │
                                     └──────────────► StatusEvent / integrity outcome ◄──┘
                                                    (only now can it be adverse)
```

### 16.2 Roles (capability-gated, never role-gated)

Authorization uses `lib/capability/policy.ts` (`authorize(caps, required, "all"|"any")`). "Roles" below are *bundles of capabilities* derived per `lib/capability/derive.ts`; a person may hold any subset.

| Persona | Core capabilities (catalog keys) | May do |
|---|---|---|
| Reviewer (L1) | `review.queue.read`, `review.flag.view_evidence`, `review.flag.adjudicate` | Triage, adjudicate routine flags (confirm/dismiss/inconclusive) |
| Senior reviewer (L2) | + `review.flag.override`, `review.case.merge`, `review.dualreview.second` | Override L1, serve as second reviewer, handle ambiguous cases |
| Integrity officer / compliance | + `review.case.escalate`, `review.rawmedia.request`, `review.audit.read` | Escalate, request consent-gated raw media (dual-control), read full audit |
| Ombudsperson (appeals) | `review.appeal.handle`, `review.audit.read` (segregation-of-duties: **cannot** hold `review.flag.adjudicate` on the same case) | Independent appeal adjudication |
| Hiring manager / recruiter | `interview.decision.record`, `review.case.read:own` | See *confirmed* outcomes only; record hiring decisions |
| DPO / regulator (read) | `review.audit.read`, `explain.decision.read` | Immutable audit + explanations, no mutation |

Two hard segregation-of-duties rules, checked in policy middleware: (a) the reviewer who produces a verdict cannot be the appeal adjudicator for that case; (b) for dual-review, the two reviewers must be distinct subjects and the second is **blind** to the first's verdict until they submit.

### 16.3 Data model (Prisma — near-term buildable)

```prisma
// The advisory artifact. One per detected signal. Never candidate-authoritative.
model ReviewFlag {
  id          String   @id @default(cuid())
  caseId      String
  source      String   // "proctor" | "interview" | "assessment" | "identity" | "scorecard"
  capId       String   // AIOS capability that produced it (joins AiRun.capId)
  runId       String?  // AiRun.id for full provenance
  kind        String   // taxonomy §16.7 e.g. "face_absent" | "second_person" | "tab_switch"
  observed    String   @default("{}") // JSON: the SEMANTIC observation (timestamps, counts) — NOT raw media
  confidence  Float                     // 0..1 from the detector (ProviderResult.confidence)
  evidenceRef String   @default("[]")   // JSON refs to EvidenceItem ids (semantic; raw is pointer+consent-gated)
  severity    String   @default("low")  // low|medium|high (deterministic, §16.5)
  status      String   @default("DETECTED") // DETECTED|UNDER_REVIEW|CONFIRMED|DISMISSED|INCONCLUSIVE
  createdAt   DateTime @default(now())
  case        ReviewCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  actions     ReviewAction[]
  @@index([caseId, status])
  @@index([kind, createdAt])
}

// Bundles all flags about one subject-in-one-context (an attempt or an interview).
model ReviewCase {
  id          String   @id @default(cuid())
  subjectId   String                       // candidate (User.id)
  contextType String                       // "TestAttempt" | "Interview"
  contextId   String
  riskScore   Float    @default(0)         // deterministic aggregate (§16.5)
  status      String   @default("NEW")     // §16.4 state machine
  assigneeId  String?                       // current reviewer
  dualRequired Boolean @default(false)
  slaDueAt    DateTime?
  slaTier     String   @default("standard") // standard|expedited|critical
  resolution  String?                       // CLEARED|SUSTAINED|INCONCLUSIVE (rollup of actions)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  flags       ReviewFlag[]
  actions     ReviewAction[]
  appeals     ReviewAppeal[]
  @@index([status, slaDueAt])
  @@index([subjectId])
  @@unique([contextType, contextId, subjectId])
}

// The human act. Immutable, append-only — corrections are new rows, never edits.
model ReviewAction {
  id         String   @id @default(cuid())
  caseId     String
  flagId     String?                        // null = case-level action (escalate, resolve)
  actorId    String                         // the human (never "aios")
  verdict    String                         // CONFIRM|DISMISS|INCONCLUSIVE|OVERRIDE|ESCALATE|RESOLVE|REOPEN
  rationale  String                         // REQUIRED free-text; enforced non-empty for adverse verdicts
  reviewSlot String   @default("primary")   // primary|second (dual review)
  policyRefs String   @default("[]")        // JSON policy clauses cited (§17)
  createdAt  DateTime @default(now())
  case       ReviewCase  @relation(fields: [caseId], references: [id], onDelete: Cascade)
  flag       ReviewFlag? @relation(fields: [flagId], references: [id])
  @@index([caseId, createdAt])
  @@index([actorId, createdAt])
}

model ReviewAppeal {
  id          String   @id @default(cuid())
  caseId      String
  filedBy     String                        // candidate
  grounds     String
  status      String   @default("OPEN")     // OPEN|UPHELD|OVERTURNED|WITHDRAWN
  handlerId   String?
  outcomeNote String?
  createdAt   DateTime @default(now())
  resolvedAt  DateTime?
  case        ReviewCase @relation(fields: [caseId], references: [id], onDelete: Cascade)
  @@index([status, createdAt])
}

// Semantic evidence, retention-bounded. Raw media is a POINTER, gated + expiring.
model EvidenceItem {
  id          String   @id @default(cuid())
  caseId      String
  kind        String   // "event" | "transcript_span" | "keystroke_meta" | "raw_media_ptr"
  payload     String   @default("{}") // semantic JSON (default); raw is external ref only
  rawUri      String?  // present only for raw_media_ptr; access dual-controlled, TTL-purged
  expiresAt   DateTime?
  createdAt   DateTime @default(now())
  @@index([caseId, kind])
}
```

The existing `TestAttempt.proctored` / `TestAttempt.tabSwitches` and `Interview.recordingUrl` are the *upstream* producers; this layer sits between them and any candidate-facing consequence. Existing `AiRun` supplies provenance (`runId` → `AiRun.capId/confidence/explanation`); existing `PlatformEvent` carries the review lifecycle events.

### 16.4 Case state machine

```
                 (flags arrive)
   NEW ───auto-triage(risk,SLA)──► TRIAGED ──assign──► IN_REVIEW
    │                                  │                   │
    │                                  │                   ├── verdict (single) ─────────────┐
    │                                  │                   │                                 │
    │                                  │        dualRequired│                                ▼
    │                                  │                   ▼                            RESOLVED
    │                                  │           PENDING_SECOND_REVIEW               (CLEARED |
    │                                  │            │            │                      SUSTAINED |
    │                                  │      agree │            │ disagree             INCONCLUSIVE)
    │                                  │            ▼            ▼                           │
    │                                  │        RESOLVED     ESCALATED ──officer verdict──►  │
    │                                  │                         ▲                           │
    │                                  └── SLA breach ───────────┘                           │
    │                                                                                        │
    └──────────────────────────────────────────────────────── APPEALED ◄────candidate files┘
                                                                    │
                                                        ombudsperson: UPHELD → RESOLVED(same)
                                                                     OVERTURNED → RESOLVED(CLEARED)
```

Transitions are capability-gated and each writes a `ReviewAction` + `PlatformEvent("review.case.*")`. `RESOLVED(SUSTAINED)` is the **only** state permitted to unlock an adverse `StatusEvent`, and only after the funnel writer re-checks the confirmation link.

Individual `ReviewFlag`: `DETECTED → UNDER_REVIEW → {CONFIRMED | DISMISSED | INCONCLUSIVE}`. A case's `resolution` is the deterministic rollup: any `CONFIRMED high` ⇒ candidate outcome `SUSTAINED`; all `DISMISSED` ⇒ `CLEARED`; else `INCONCLUSIVE`.

### 16.5 Triage & risk scoring (deterministic, explainable)

Risk is a transparent weighted sum a reviewer can reproduce by hand — no ML ranking of humans.

```
riskScore(case) = Σ_flags  severityWeight(kind) · confidence · recency
severityWeight:  face_absent .3 · second_person .9 · unknown_face .7
                 tab_switch .2 · paste_burst .4 · vm_signature .5 · scorecard_split .3
recency = 1 (all within one session)   // time-decay only for cross-session cases
slaTier = riskScore ≥ 0.8 → critical(4h) | ≥0.5 → expedited(1 business day) | else standard(3 business days)
dualRequired = (any confirmed-if-sustained flag would be adverse)  AND  (contextType == high-stakes test | roleLevel ∈ {LEAD,EXECUTIVE})
```

**Queue UI** (`/review`): columns = *Case · Subject(pseudonymous option) · Risk · Top flags · SLA countdown · Assignee · Status*. Filters: source, kind, severity, SLA-breaching, unassigned, my-queue. Sort default = SLA-ascending then risk-descending (protect the clock, not the scariest number). WIP limit per reviewer (config, e.g. 15 concurrent `IN_REVIEW`) to prevent rubber-stamping. Batch actions are **disabled for CONFIRM** (each confirmation is individual, with rationale) but allowed for DISMISS of same-kind low-severity noise.

### 16.6 Evidence timeline & the raw-media firewall

The review surface is a **semantic timeline**, never a video player by default — consistent with the platform's Semantic Digital Twin principle (minimize raw storage).

```
 00:00 ─●───────●──────────────●────────●──────── 45:00
        │       │              │        │
   session   face_absent    second_    tab_switch×3
   start     12s (conf .74)  person     (conf .95)
                             (conf .68)
 hover a marker → EvidenceItem: {what, when, duration, confidence, detector, model, on/off-device}
```

- **Default tier**: on-device/WASM detectors emit *events only*; no video/audio leaves the candidate device or is retained. `EvidenceItem.kind="event"`. This is the Vercel-deployable near-term reality.
- **Raw-media tier (enterprise/optional)**: only when (a) region+candidate consent was captured for retention, (b) an integrity officer with `review.rawmedia.request` issues a request, (c) a **second** approver co-signs (dual-control), and (d) within retention TTL. Access is logged as its own `AiRun`/`PlatformEvent`; the clip auto-purges at `EvidenceItem.expiresAt`. Raw media is *never* the trigger — always corroboration for an already-flagged event.

### 16.7 Flag taxonomy (observable events only — no character judgments)

| Source | kind | Semantic meaning (what is asserted) | Never asserted |
|---|---|---|---|
| proctor | `face_absent` | No face in frame > threshold | "inattentive", "cheating intent" |
| proctor | `second_person` | ≥2 faces detected in frame | "collusion" |
| proctor | `unknown_face` | Face present but low match to enrolled | "impersonation" (that's a *verdict*) |
| proctor | `tab_switch` / `focus_loss` | Window/focus left assessment | "looked up answers" |
| proctor | `paste_burst` | Large paste into answer field | "plagiarism" |
| proctor | `vm_signature` / `remote_ctrl` | Environment heuristic | — |
| interview | `panel_split` / `severe_outlier` | From `scorecard.ts` bias signals | any candidate trait |
| identity | `id_mismatch` | `IdentityVerification` scores below threshold | — |

Contested affective/personality "signals" (tone, "confidence", eye-contact) are **not** in this taxonomy as flags and **cannot** create a `ReviewCase`. If ever surfaced (enterprise research tier), they appear only as *labelled, low-weight process notes* in Module 6 with a validity caveat (§17.6), are excluded from `riskScore`, and can never be `CONFIRMED` into an adverse outcome.

### 16.8 APIs

```
REST (capability-gated, all writes audited via AiRun/PlatformEvent)
GET    /api/review/queue?tier=&status=&mine=1        → paged ReviewCase[]     [review.queue.read]
GET    /api/review/case/:id                          → case + flags + timeline [review.flag.view_evidence]
POST   /api/review/case/:id/assign  {assigneeId}                              [review.queue.read]
POST   /api/review/flag/:id/adjudicate {verdict,rationale,policyRefs[]}       [review.flag.adjudicate]
POST   /api/review/flag/:id/override  {verdict,rationale}                     [review.flag.override]
POST   /api/review/case/:id/escalate  {reason}                               [review.case.escalate]
POST   /api/review/case/:id/second-review {verdict,rationale}                [review.dualreview.second]
POST   /api/review/rawmedia/:evidenceId/request {reason}  (needs co-sign)    [review.rawmedia.request]
POST   /api/review/appeal/:caseId {grounds}                                  [auth, subject==candidate]
POST   /api/review/appeal/:caseId/resolve {status,note}                      [review.appeal.handle]

WS  /ws/review    (server→client)
  review.flag.created        {caseId, kind, severity}
  review.case.sla_warning    {caseId, minutesLeft}
  review.case.state_changed  {caseId, from, to}
  review.assignment.changed  {caseId, assigneeId}
```

### 16.9 SLA & escalation ladder

| Tier | First-touch | Resolve | Breach action |
|---|---|---|---|
| critical (risk ≥ .8, exec role) | 1h | 4h | auto-escalate to integrity officer + notify DPO |
| expedited (risk ≥ .5) | 4h | 1 business day | auto-escalate to L2 |
| standard | 1 business day | 3 business days | reassign, page team lead |

Escalation path: `L1 reviewer → L2 senior → integrity officer → ombudsperson (appeals only)`. Disagreement in dual-review always escalates (never averaged). SLA breach never auto-resolves adversely — it escalates; the safe default of an unreviewed flag is **no adverse effect**.

### 16.10 Near-term vs future-state

- **Near-term (buildable on this stack now)**: `ReviewFlag/Case/Action/Appeal/EvidenceItem` models; `/review` console; deterministic risk & SLA; semantic-event timeline; dual-review; capability gates; forbidden-auto gateway wiring; on-device event detectors feeding flags. All Vercel-deployable, no GPU.
- **Enterprise/aspirational**: consent-gated raw-media corroboration with dual-control + TTL purge; cross-session behavioral corroboration; reviewer workload balancing; live WS co-review rooms; regulator read-only portal.

---

## 17. Explainability Framework

### 17.1 Design stance

The platform already threads an `explanation` string and `confidence` through `ProviderResult` → `AiRun` (`§26`). Section 17 upgrades that string to a **structured, queryable Explanation object** attached to every AI output and to every human/automated decision, and codifies the **no-unexplained-adverse-action** rule as an enforced invariant, not a guideline.

Four audiences, one source of truth:

```
                 ┌──────────────► Reviewer view (full: evidence, policy, counterfactuals)
 Explanation ────┼──────────────► Candidate view (plain-language, redacted, appealable)
   record        ├──────────────► Auditor/DPO view (immutable, lineage, model card refs)
                 └──────────────► System view (machine-readable JSON for gating)
```

### 17.2 The Explanation object (canonical schema)

```typescript
// Attached to any AiRun output and any DecisionRecord. Every field is populated
// in-house; nothing here requires an external LLM to generate.
export interface Explanation {
  what:       string;                 // the output in one line ("Assessment auto-scored 62/100")
  why:        ExplanationReason[];    // ranked contributing factors, each with weight
  confidence: number;                 // 0..1 (mirrors AiRun.confidence)
  evidence:   EvidenceRef[];          // concrete, inspectable items (semantic)
  policy:     PolicyRef[];            // clauses/thresholds that governed the output
  caveats:    string[];               // validity limits, known failure modes (§17.6)
  counterfactuals?: Counterfactual[]; // "what would change this" (§17.5)
  modelCardRef?: string;              // KnowledgeItem(kind="modelcard").id (§17.4)
  humanReviewRef?: string;            // ReviewAction.id if a human confirmed
  generatedBy: "deterministic" | "on_device" | "assisted";
}
export interface ExplanationReason { factor: string; direction: "increases"|"decreases"|"neutral"; weight: number; detail: string; }
export interface EvidenceRef { kind: string; ref: string; summary: string; }   // never raw PII inline
export interface PolicyRef  { clause: string; threshold?: string; source: string; } // e.g. "passingScore=70"
export interface Counterfactual { change: string; wouldYield: string; plausibility: "candidate_controllable"|"fixed"; }
```

Persisted alongside audit:

```prisma
model DecisionRecord {
  id           String   @id @default(cuid())
  domain       String   // "assessment_score" | "interview_decision" | "proctor_outcome" | "match" | "identity"
  subjectId    String
  contextType  String
  contextId    String
  outcome      String   // human-readable outcome
  adverse      Boolean  @default(false)     // gating flag (§17.3)
  explanation  String                        // JSON Explanation
  runId        String?                       // AiRun provenance
  actionId     String?                       // ReviewAction if human-in-loop
  candidateExplanation String?               // plain-language, redacted (§17.7)
  createdAt    DateTime @default(now())
  @@index([subjectId, domain, createdAt])
  @@index([adverse, createdAt])
}
```

### 17.3 The "no unexplained adverse action" rule (enforced)

> **Invariant:** No `StatusEvent`, integrity outcome, offer withdrawal, or below-bar disposition may be written for a candidate unless a `DecisionRecord` with `adverse=true` exists, carrying a non-empty `why`, at least one `evidence` ref, at least one `policy` ref, and (for high-stakes) a `humanReviewRef`.

Enforcement is a gateway/writer guard, fail-closed:

```typescript
// pseudo — runs before any adverse funnel write
function assertExplainedAdverse(rec: DecisionRecord) {
  const e: Explanation = JSON.parse(rec.explanation);
  if (!rec.adverse) return;
  if (!e.why?.length)        throw new Error("adverse_without_reasons");
  if (!e.evidence?.length)   throw new Error("adverse_without_evidence");
  if (!e.policy?.length)     throw new Error("adverse_without_policy");
  if (isHighStakes(rec) && !rec.actionId) throw new Error("adverse_without_human_confirmation");
  if (!rec.candidateExplanation) throw new Error("adverse_without_candidate_explanation");
}
```

This composes with §16: adverse requires (a) a confirmed `ReviewFlag`/`ReviewAction` **and** (b) an explanation record. Neither alone suffices.

### 17.4 Model cards (every capability + model)

Each entry in `ModelRegistry` / each Module-6/7 capability publishes a card, stored as `KnowledgeItem(kind="modelcard")` (versioned, governed by the existing knowledge layer). Template:

```
Model card — <capId> / <modelId>          version: n   status: verified
────────────────────────────────────────────────────────────────────────
Purpose          what decision it supports; what it MUST NOT be used for
Method           deterministic | heuristic | on-device WASM | (optional) external
Inputs           features used; explicitly which are NOT used (protected attrs, affect)
Outputs          type, range, confidence semantics
Training/tuning  data provenance; n; date; refresh cadence  (or "rule-based, no training")
Validity         where it works; where it fails; known biases; contested? (§17.6)
Fairness eval    §19 metrics: adverse-impact ratio, FPR/FNR by cohort, last audit date
Human oversight  advisory-only? forbidden-auto? dual-review required?
Retention/DPIA   data kept, TTL, region constraints, DPIA link
Appeal path      how a candidate contests an output driven by this model
```

A capability with no current, `verified` model card is refused registration for adverse-affecting use (dev guard; hard block in prod tier).

### 17.5 Counterfactual / what-if (deterministic — a strength of in-house scoring)

Because the core scorers are deterministic (assessment = points over a rubric; match = feature weights; scorecard = `aggregatePanel`), counterfactuals are *exact*, not approximated by perturbation.

- **Assessment**: `Answer`/`Question` are known, so "+8 points and you pass" resolves to the specific unanswered/incorrect `Question`s ranked by `points`, filtered to `candidate_controllable`. Never reveals the correct answer post-hoc for a live item bank; reveals *topic* + point value.
- **Match / ICAE**: feature-weight model yields "raising skill X to proficiency Y moves match 0.61→0.72" directly from `SkillProficiency` weights.
- **Interview scorecard**: from `PanelResult`, "consensus would reach *advance* if the split on competency `communication` were reconciled" — reads straight off `perCompetency.spread` and `overall.consensus`.

```typescript
export function assessmentCounterfactuals(attempt, questions, threshold): Counterfactual[] {
  const gap = threshold - attempt.score;
  if (gap <= 0) return [];
  return missedQuestions(attempt, questions)
    .sort((a,b) => b.points - a.points)
    .reduce<{sum:number; out:Counterfactual[]}>((acc,q) => {
      if (acc.sum >= gap) return acc;
      acc.sum += q.points;
      acc.out.push({ change:`Answer the ${q.topic} item (${q.points} pts) correctly`,
                     wouldYield:`Score ${attempt.score+acc.sum}/${threshold} — pass`,
                     plausibility:"candidate_controllable" });
      return acc;
    }, {sum:0,out:[]}).out;
}
```

Counterfactuals are shown to candidates for *their own* scores and to reviewers for calibration. They are **not** offered for contested inferences (there is no honest counterfactual for a pseudoscientific score — its absence is itself an honesty signal).

### 17.6 Validity caveats & the contested-signal guardrail

Any output touching affect/personality/"confidence"/accent carries a mandatory caveat and cannot be a candidate score:

```
caveats: [
 "Inferring emotion/personality/confidence from face or voice is scientifically contested
  and can encode bias against neurodivergence, disability, culture, and accent.",
 "This is a low-weight PROCESS note for human interviewers, excluded from any score.",
 "It cannot cause an adverse action and cannot be 'confirmed' into an outcome (§16.7)."
]
```
The framework's default recommendation is *not to deploy* these as decision inputs at all; where an enterprise insists, this guardrail is the ceiling.

### 17.7 Candidate-facing plain-language layer

A deterministic translation/redaction pass (in-house templates + the platform's own i18n, no LLM required) turns the internal `Explanation` into `candidateExplanation`:

- **Reading level**: target ~Grade 8; template-driven sentence frames per domain.
- **Redaction**: drop internal-only evidence (reviewer identities, raw thresholds that would leak the item bank, other candidates' data). Keep what is actionable and true.
- **Localization**: region + language aware; legally required disclosures per region (EU AI Act right-to-explanation, GDPR Art. 22 human-review notice).
- **Appeal hook**: every adverse candidate explanation ends with the appeal route (`POST /api/review/appeal/:caseId`) and the human-oversight statement.

Example (assessment): *"You scored 62 of 100; the pass mark is 70. Answering the two data-structures questions correctly would have put you at 74. A person reviewed this result. If you believe there was an error — for example a technical problem during your test — you can request a review here."*

### 17.8 APIs

```
GET /api/explain/run/:aiRunId            → Explanation (reviewer/auditor)      [explain.decision.read]
GET /api/explain/decision/:recordId      → DecisionRecord + Explanation        [explain.decision.read]
GET /api/explain/me/:recordId            → candidateExplanation + appeal link  [auth, subject==self]
GET /api/explain/modelcard/:capId        → model card (current verified)       [auth]
GET /api/explain/counterfactual/:ctx/:id → Counterfactual[]                    [auth, self | reviewer]
```

### 17.9 Near-term vs future-state

- **Near-term**: structured `Explanation` on every `AiRun`; `DecisionRecord` + adverse-action gate; deterministic counterfactuals for assessment/match/scorecard; model cards as governed `KnowledgeItem`s; template-based candidate explanations + i18n; appeal linkage.
- **Enterprise/aspirational**: richer natural-language rendering (optional on-device small model, still deterministic-fallback); interactive what-if sandboxes; regulator-facing explanation exports; cross-decision explanation lineage graphs.

---

## 18. Enterprise Dashboards

Every workspace is one AppShell page, capability-gated, reading confidential-redacted data via `lib/interview/governance.ts` (`maySeeConfidential`, `mayView`) and reusing the EIDP intelligence surfaces (`computeIntelligence()` → `IntelligenceSnapshot { org, stats, series[], decisions[] }`, rendered today at `app/executive/page.tsx` and `app/api/intelligence/overview/route.ts`). No dashboard exposes raw proctoring media or per-candidate protected attributes; all AI panels show confidence + link to the `Explanation`.

### 18.1 Workspace → capability → surface matrix

| Workspace | Route | Gate (capability) | Primary surfaces | Data sources |
|---|---|---|---|---|
| Recruiter | `/recruiter` | `recruit.pipeline.read` | Funnel by stage, SLA aging, req health, interview-load balance, offer status | `Application`,`StatusEvent`,`Interview`,`Offer/OfferEvent` |
| Hiring manager | `/hiring` | `interview.decision.record` | Shortlist w/ scorecards, panel consensus, *confirmed* integrity outcomes, offer approvals | `scorecard.aggregatePanel`,`DecisionRecord`,`Offer` |
| Interviewer | `/interview/workspace` | `interview.conduct` | My upcoming panels, structured scorecard entry, question kit, governance banner | `Interview`,`InterviewParticipant`,`governance.evaluatePanel` |
| Proctoring / integrity | `/proctoring` | `review.queue.read` | Live session monitor (semantic), flag stream, case queue (→ §16), FPR watch | `ReviewFlag/Case`,`TestAttempt`,WS `/ws/review` |
| Executive | `/executive` (exists) | `intel.overview.read` | Org health index, forecasts, `DecisionCard`s, hiring quality & fairness rollups | `computeIntelligence()` |
| Campus / bulk | `/campus` | `recruit.campus.manage` | Cohort/drive throughput, slot utilization, batch-assessment integrity summary | `Test/TestAttempt`,`Application`,cohort tags |

### 18.2 Recruiter workspace

```
┌ Recruiter · Reqs: 14 open ──────────────────────────────────────── SLA ⚠ 3 ┐
│ Funnel (this req)                          Aging (days in stage)             │
│ Applied 320 ─▮▮▮▮▮▮▮▮▮▮ 100%                Screen ███ 4.2 ● within SLA       │
│ Screened 96 ─▮▮▮ 30%                        Interview ██████ 9.1 ⚠ over       │
│ Interview 41 ─▮▮ 12.8%                      Offer ██ 2.0 ● within             │
│ Offer     11 ─▮ 3.4%                        ───────────────────────────────  │
│ Hired      7 ─▮ 2.2%                        Interviewer load  (next 2 wks)    │
│                                             A.Rao ████████ 12  ⚠ overbooked   │
│ Offer status: 5 out · 3 accepted · 1 declined   J.Li ███ 4                    │
└──────────────────────────────────────── every AI figure → confidence + why ─┘
```
Time-in-stage and pass-through are deterministic aggregates; any predictive figure (forecast fill date) is an EIDP `series[].forecast` with its confidence band shown, never a bare number.

### 18.3 Hiring-manager workspace

Shortlist cards render `PanelResult`: per-competency mean±spread, `overall.consensus`, `decision`, and **bias signals surfaced as first-class UI** (`split_panel`, `severe_outlier` etc. from `scorecard.ts`) — the manager sees process risk before deciding. Integrity column shows only `ReviewCase.resolution` where `RESOLVED` (never open/advisory flags). Offer approvals link to `Offer/OfferEvent`. Every candidate comparison view suppresses protected attributes and shows the "human decides" banner.

### 18.4 Interviewer workspace

Pre-interview: governance banner from `evaluatePanel()` (panel too junior / single-assessor warning). During: structured scorecard (1–4 per competency + `Recommendation` + notes), with a "rate specifics, not vibes" nudge; `no_differentiation` warning appears live if all ratings identical. Confidential material hidden per `maySeeConfidential(role, confidential)` for OBSERVERs. No affect/emotion widgets.

### 18.5 Proctoring / integrity workspace

The operational face of §16: live semantic session tiles (green/amber/red by open-flag severity, **not** by candidate behavior interpretation), the flag stream over `/ws/review`, and the triage queue. A prominent **false-positive watch** tile (from §19) keeps the team honest about over-flagging. No raw video wall by default; raw access is the dual-controlled path of §16.6.

```
┌ Integrity · Live 38 · Flags/hr 12 · FPR(7d) 18% ⚠ ────────────────────────┐
│ Sessions        Flag stream                    Queue (SLA)                  │
│ ▢▢▢▣▢▢ 34 clear  10:02 tab_switch  conf .95     #4821 critical  03:12 ⏳     │
│ ▢▣▢ 3 amber      10:01 second_person conf .68   #4817 expedited 1d          │
│ ▣ 1 red          09:58 face_absent conf .74     #4790 standard  2d          │
│ FPR by kind: second_person 41% ⚠  tab_switch 6%  → tune threshold / caveat   │
└─────────── advisory until a human confirms · every tile links to evidence ─┘
```

### 18.6 Executive workspace (reuse EIDP)

Extends the existing `/executive` `IntelligenceSnapshot` with Module 6/7 domains: adds *Hiring Quality* and *Hiring Fairness* as EIDP domains feeding `org` health, and emits `DecisionCard`s such as "second_person false-positive rate is high — recalibrate before it harms candidates" using the exact `DecisionCard { title, severity, recommendation, evidence[], supportingMetrics[], confidence, alternatives[], risks[] }` shape already rendered. Dark-domain honesty ("awaiting data") is inherited from `health.ts`.

### 18.7 Campus / bulk

Cohort throughput, slot utilization, and an *aggregate* integrity summary (flag rates per drive, never per-student character scores). Enforces small-cell suppression (§19.7) so a 6-person cohort cannot be re-identified.

### 18.8 Near-term vs future-state

- **Near-term**: all six workspaces as AppShell pages over existing models + `scorecard`/`governance`/`intelligence` libs + §16/§17 records; WS live tiles; EIDP reuse.
- **Enterprise/aspirational**: cross-org benchmarking, configurable widget builder, saved executive briefings, real-time video co-monitoring (consent+region gated).

---

## 19. Analytics Platform

Two layers, non-negotiably co-equal: **operational analytics** (how the machine performs) and the **honesty layer** (whether it is fair, calibrated, and deferring to humans). A dashboard that shows throughput without fairness/false-positive metrics is considered incomplete and is blocked from the "verified" analytics tier.

Time-series reuse the EIDP `EvalRun` model (`metric`, `scope`, `value`, `sampleSize`, `detail`) so every metric below trends over time and can drive `DecisionCard`s.

### 19.1 Metric catalog — operational

| Domain | Metric | Definition / formula | Source |
|---|---|---|---|
| Funnel | Stage pass-through | `count(stage_{n+1}) / count(stage_n)` | `StatusEvent` |
| Funnel | Time-in-stage | median(`StatusEvent` gaps) | `StatusEvent` |
| Interview | Panel consensus | mean(`PanelResult.overall.consensus`) | `scorecard.ts` |
| Interview | Scorecard completion | completed scorecards / expected | `InterviewParticipant` |
| Assessment | Score distribution / pass rate | histogram; `passed/total` | `TestAttempt` |
| Assessment | Item difficulty / discrimination | p-value; point-biserial per `Question` | `Answer` |
| Proctoring | Flags per session; flag mix | counts by `kind` | `ReviewFlag` |
| Reviewer | Throughput, SLA adherence, backlog | actions/hr; % within SLA | `ReviewAction`,`ReviewCase` |
| AI ops | Latency, cost, error rate, blocked rate | from `AiRun.status/latencyMs/cost` | `AiRun` |

### 19.2 The honesty layer — fairness

Fairness metrics use **only** self-declared, explicitly-consented demographic data, computed **in aggregate**, with small-cell suppression (§19.7). Never inferred, never per-candidate-exposed.

- **Selection rate per cohort** `SR_g = advanced_g / eligible_g`.
- **Adverse Impact Ratio (four-fifths rule)** `AIR = SR_g / SR_reference`; flag when `AIR < 0.8`.
- **Statistical parity difference** `SR_g − SR_reference`.
- **Equal-opportunity gap** (where a defensible ground truth exists, e.g. later performance) `TPR_g − TPR_reference`.
- Computed at each decision boundary: screen, assessment pass, interview advance, offer — so disparity is localized to the step that produced it.

```typescript
export interface FairnessAudit {
  boundary: string;                 // "assessment_pass" | "interview_advance" | ...
  cohorts: { key: string; n: number; selectionRate: number|null; air: number|null }[]; // null = suppressed
  worstAir: number|null; flagged: boolean; note: string;
}
```
Persisted as `EvalRun(metric="adverse_impact", scope=boundary)`; a breach emits a high-severity `DecisionCard` and a `ChangeProposal(kind="compliance")` for human review — never an automatic model change.

### 19.3 Calibration

Do confidences mean what they say? For any scored/flagged output with eventual human-adjudicated truth:

- **Reliability curve**: bin predicted confidence vs observed correct-rate.
- **Expected Calibration Error** `ECE = Σ_b (n_b/N)·|acc_b − conf_b|`.
- **Brier score** `= (1/N) Σ (conf_i − y_i)²`.

Tracked per capability (`EvalRun(metric="ece", scope=capId)`); poor calibration downgrades a model card to `unverified` and forces confidence-band display.

### 19.4 False-positive / false-negative — the proctoring safety metric

Ground truth = human adjudication (`ReviewAction.verdict`). This is the metric that protects candidates from over-flagging.

```
                 human: CONFIRM     human: DISMISS
 detector flag        TP                 FP
 (per kind)     ───────────────────────────────
 FPR = FP / (FP+TN)      FNR = FN / (FN+TP)
 Precision = TP/(TP+FP)  reported PER KIND and PER CONSENTED COHORT
```
A confusion matrix per `ReviewFlag.kind` and per cohort. **A high FPR on a specific cohort is a discrimination alarm**, not a tuning nicety: it triggers threshold review, a caveat on the model card, and (if uncorrectable) retirement of that detector for adverse use. `EvalRun(metric="fpr", scope=kind)` + cohort detail.

### 19.5 Human agreement & oversight-integrity

Guards against rubber-stamping (humans blindly confirming AI) — the failure mode that makes "human-in-the-loop" cosmetic.

- **Inter-rater reliability**: Cohen's κ (two reviewers), Fleiss' κ (panels), and for interview competencies ICC.
- **Override rate** `overrides / total_reviews` per reviewer/kind — a rate *near zero* is a red flag (auto-confirmation), not a success.
- **AI–human concordance** `agree / total` — tracked *with* override rate so high concordance from genuine agreement is distinguished from rubber-stamping.
- **Time-to-decision distribution**: implausibly fast confirmations flagged for QA.
- **Appeal outcomes**: `OVERTURNED / appeals` — a rising overturn rate indicts the pipeline upstream.

### 19.6 Quality-of-hire & funnel outcomes (with caveats)

- **Funnel**: application→hire pass-through, drop-off attribution, source quality, offer accept/decline (`OfferEvent`).
- **Quality-of-hire** (lagging): early-tenure retention, ramp/performance, hiring-manager satisfaction — joined via HRMS `Employee`.
- **Predictive-validity check**: correlate assessment/interview scores with later QoH to test whether the instrument predicts anything. Reported with explicit caveats (small n, confounders, survivorship — you only observe hires) and never used to auto-tune scores; findings route to humans as `ChangeProposal`.

### 19.7 Privacy, aggregation & governance of analytics

- **Aggregate-only** for anything involving people-attributes; **k-anonymity threshold** (default k=10) — cohorts below k report `null` ("suppressed"), never a value.
- No analytics surface exposes per-candidate protected attributes or inferred traits.
- All fairness/FPR audits are themselves audited (`AiRun`/`PlatformEvent`) and versioned via `EvalRun`, giving an immutable trend a DPO/regulator can inspect.
- **Deploy-on-push reality**: near-term analytics run as scheduled aggregations (Vercel cron) writing `EvalRun` rows; no streaming warehouse required.

### 19.8 APIs

```
GET /api/analytics/funnel?req=            → stage rates, aging               [analytics.read]
GET /api/analytics/assessment/items       → difficulty/discrimination        [analytics.read]
GET /api/analytics/proctoring/confusion   → per-kind TP/FP/FN + FPR (k≥10)   [analytics.fairness.read]
GET /api/analytics/fairness?boundary=      → FairnessAudit (suppressed cells) [analytics.fairness.read]
GET /api/analytics/calibration/:capId      → reliability, ECE, Brier          [analytics.read]
GET /api/analytics/reviewers/agreement     → κ, override rate, overturn rate   [analytics.fairness.read]
GET /api/analytics/quality-of-hire         → QoH + validity caveats            [analytics.read]
```
`analytics.fairness.read` is a distinct, higher-trust capability (DPO/compliance) — fairness data is more sensitive than operational data and is gated separately.

### 19.9 Near-term vs future-state

- **Near-term**: all metrics above computed from existing tables + §16/§17 records into `EvalRun`; scheduled cron aggregation; fairness/FPR/κ dashboards; small-cell suppression; breach → `DecisionCard` + `ChangeProposal`.
- **Enterprise/aspirational**: continuous drift monitoring, automated periodic DPIA/fairness reports, cohort-level predictive-validity studies with statistical rigor, cross-tenant (privacy-preserving) benchmarking, and a regulator-facing fairness attestation export.

## 20. Machine Learning Platform

### 20.0 Framing — this is a *governance* platform, not a training farm

The platform's ML substrate is **in-house-first and deterministic-first (DDR-002)**. In EROS Modules 6 (Interview Intelligence) and 7 (Assessment/Proctoring), a "model" is overwhelmingly a **deterministic provider** whose parameters are *fitted* from curated data, not a self-optimizing neural net:

| Provider (real / near-term) | "Training" = fitting | Params produced | Registry `modelId` |
|---|---|---|---|
| Semantic index | corpus TF-IDF vocab + IDF weights | sparse term→weight table | `tfidf-embed-v1` |
| Job/candidate match | rubric weights + normalization | weight vector | `icire-rank-v1` |
| Outcome calibration | isotonic regression on decided applications | `MatchCalibration.buckets` | `outcome-calibrate-v1` |
| Panel roll-up + bias signals | fixed thresholds (`lib/interview/scorecard.ts`) | constants | *(pure lib, registrable)* |
| Proctor event classifiers | threshold calibration on **consented** labeled clips | per-detector thresholds | `proctor-detect-v1` *(proposed)* |
| Rubric evaluator | weighted criteria (`lib/aios/evaluate.ts`) | criteria/weights | `evaluate-engine-v1` |

Because parameters are small, versioned tables — not opaque weight blobs — **versioning, rollback, and audit are exact and instantaneous**, and the "explainability" and "human-in-the-loop" mandates fall out of the architecture rather than being retrofitted.

> **HARD RULE (DDR, enforced): Production models NEVER auto-retrain from user interactions.** User events (`PlatformEvent`, `AnalyticsEvent`, `RecommendationFeedback`, `ProctorEvent`) drive **continuous *evaluation*** and **human-reviewed *proposals*** (`ChangeProposal`) only. The path from "the world changed" to "a new model is live" always passes through a curated dataset and a human approval. There is no gradient flowing from candidate behavior into a deployed scorer.

> **HONESTY RULE (AI Safety):** No emotion / personality / "confidence" / accent / "cultural fit" model is *trained as a candidate score that affects hiring*. Such providers, if they exist at all, are (a) OPTIONAL enterprise tier, (b) `safetyClass: "forbidden-auto"` (cannot execute unattended — the gateway blocks them, see `execute.ts` §27 gate), (c) surfaced only as human-reviewed *process* signals with printed validity caveats, and (d) never feed `Application.status` transitions. Proctoring emits observable **events** (`face.absent`, `face.multiple`, `tab.blur`), never character judgments.

---

### 20.1 Reference architecture (near-term, on this stack)

```
                 CURATED + VERIFIED DATA ONLY
                            │
   ┌────────────────────────┼───────────────────────────────────────┐
   │  FEATURE LAYER          │                                        │
   │  offline (immutable,    │   online (live compute per request)    │
   │  point-in-time)         │                                        │
   │  • CareerSnapshot       │   • inputFromUser() → analyzeCareer()  │
   │  • Application.snapshot  │   • semindex vectors (SemanticDoc)     │
   │  • MatchCalibration      │   • on-device WASM proctor features    │
   └────────────┬────────────┴──────────────────┬────────────────────┘
                │ fit / derive                   │ serve
                ▼                                 ▼
   ┌───────────────────────┐          ┌──────────────────────────────┐
   │ TRAINING/FIT PIPELINE  │          │ AIOS GATEWAY  execute(capId)  │
   │ (offline job / cron)   │          │  cap → §27 gate → authz →     │
   │  curate→verify→fit→     │          │  provider → AiRun → event     │
   │  validate→eval→card     │          └───────────────┬──────────────┘
   └───────────┬────────────┘                          │ every run
               │ candidate                              ▼
               ▼                                  ┌──────────────┐
   ┌───────────────────────┐   shadow/canary/     │  AiRun (audit)│
   │  MODEL REGISTRY         │◄──promote/rollback──│  immutable    │
   │  ModelRegistry row      │                     └──────┬───────┘
   │  deploymentStatus       │                            │ feeds
   └───────────┬────────────┘                             ▼
               │ evaluated by                    ┌──────────────────┐
               ▼                                 │ CONTINUOUS EVAL   │
   ┌───────────────────────┐   threshold breach  │ runSelfEval →     │
   │  EvalRun (time series) │────────────────────►│ EvalRun rows      │
   └───────────────────────┘                     │ (cron/ai 06:00)   │
               │                                  └────────┬─────────┘
               ▼ never auto-applies                        │ drift/regression
   ┌───────────────────────────────────────────────────────▼─────────┐
   │  ChangeProposal (pending → human review → approved → applied)      │
   │  "AI proposes, humans dispose" — never self-approved (§27/§28)     │
   └───────────────────────────────────────────────────────────────────┘
```

---

### 20.2 Feature store

**Design principles:** point-in-time correctness, PII-minimization, and *no leakage from label to feature*.

**Point-in-time correctness is already structurally present**:
- `Application.snapshot` — the candidate's profile **frozen at submit time** ("a candidate must not be judged on a version they did not send"). This is the offline training row for match/outcome models.
- `CareerSnapshot` — an **immutable, gated** time series (real content change OR ≥30d) of skill vectors + DNA. This is the offline feature history; you can reconstruct the exact feature state at any prior date without back-computation.
- `MatchCalibration` — **PII-free aggregate** features with **k-anonymity guards** (`sampleSize`, `jobCount`, `employerCount`) so no cohort can re-identify individuals.

**Near-term feature registry (config + derivation, no new infra):**

```ts
// lib/ml/features.ts (proposed, near-term) — a feature is a pure, named,
// versioned derivation over frozen sources. NEVER reads live mutable profile
// for a training row; ALWAYS reads the point-in-time snapshot.
export type FeatureView = {
  key: string                 // "match.skill_overlap"
  version: number
  entity: "candidate" | "application" | "interview" | "attempt"
  pii: "none" | "pseudonymous"// gate: only "none" features enter cohort calibration
  online: boolean             // computable at request time
  offline: boolean            // computable from snapshots for training
  derive: (ctx: PitContext) => number | Record<string, number>
  source: ("CareerSnapshot"|"Application.snapshot"|"SemanticDoc"|"ProctorEvent")[]
}
```

**Offline vs online skew** is eliminated by making the *same* `derive()` function serve both paths (train from `Application.snapshot`, serve from `inputFromUser()` shaped to the identical `PitContext`).

**Enterprise future-state:** a materialized feature store (dedicated `FeatureDefinition` / `FeatureValue` tables or an in-house Feast-equivalent) with online (low-latency KV) + offline (columnar) stores and TTL. Explicitly *future*; the near-term path needs none of it.

**Forbidden features (fairness):** protected attributes and their proxies never enter any feature view feeding a hiring-affecting model. `lib/interview/scorecard.ts` already carries "no protected-attribute data" as an invariant; the feature registry enforces it with the `pii`/allow-list gate at fit time.

---

### 20.3 Training / fit → validation → evaluation → human-review pipeline

```
 ① CURATE      raw candidates → dataset manifest (source, license, consent basis,
               region, collection date). Nothing enters without provenance.
       │
 ② VERIFY      each datum must be KnowledgeItem.status ∈ {verified}  (NOT
               unverified/experimental/pending_review). Unverified data is
               quarantined and CANNOT enter a training set. (§13 knowledge gate)
       │
 ③ SPLIT       train / validation / GOLDEN holdout. Holdout is frozen, versioned,
               and never seen during fit. Proctor/interview holdouts are
               demographically labeled for fairness testing (consented research set).
       │
 ④ FIT         deterministic parameter estimation (TF-IDF vocab, isotonic buckets,
               rubric weights, detector thresholds). Reproducible: same inputs +
               same code hash ⇒ byte-identical params.
       │
 ⑤ VALIDATE    metrics on validation split; overfit/regression guards vs current
               prod model on the SAME holdout.
       │
 ⑥ FAIRNESS    subgroup parity on the holdout (see 20.7). A candidate that
               improves aggregate accuracy but worsens subgroup FPR is REJECTED.
       │
 ⑦ MODEL CARD  auto-generated: intended use, out-of-scope use, training data
               provenance, metrics incl. subgroup, known limitations, validity
               caveats, owner, review date. Stored as KnowledgeItem(kind:"model").
       │
 ⑧ REGISTER    ModelRegistry row, deploymentStatus="shadow", rollbackOf=<current>.
       │
 ⑨ PROPOSE     ChangeProposal(kind:"governance") "promote model X v_n". A human
               approves. NEVER auto-promoted. (§27/§28)
```

The fit step runs as an **offline `BackgroundJob`** (the in-house durable queue, `server/worker.js`) or an admin-triggered route — never inside a user request path, and never on Vercel's request-scoped functions for large jobs.

---

### 20.4 Model registry, versioning, experiment tracking — mapped to what exists

`ModelRegistry` (real, in `schema.prisma`) is the registry. Mapping:

| Concern | Field | Notes |
|---|---|---|
| Identity | `modelId` (unique) | e.g. `outcome-calibrate-v2` |
| Version | `version` + new row per version | history never overwritten |
| Task | `task` | embedding/ranking/classification/prediction/extraction |
| Lifecycle | `deploymentStatus` | `active | shadow | deprecated | disabled` |
| Health | `health` | healthy/degraded (fed by EvalRun) |
| Metrics | `evalScores` (JSON) | last accepted eval snapshot |
| Rollback link | `rollbackOf` | points at the version this supersedes |
| Kill switch | `enabled` | fail-closed if disabled |
| Cost | `cost` | in-house = 0; external tier > 0 |
| Security | `securityClass` | internal/sensitive |

**Lifecycle state machine:**

```
   registered ──► shadow ──► canary ──► active ──► deprecated ──► disabled
                   │           │          ▲             │
                   └─rollback──┴──────────┘◄────────────┘
   (rollback = flip prior version to active + disable current; O(1),
    because params are small versioned rows, not weight blobs to redeploy)
```

**Experiment tracking (near-term):** every gateway run already writes an immutable `AiRun` (`modelId`, `inputsHash` = sha256 no-PII, `outputs`, `confidence`, `explanation`, `steps`, `latencyMs`). Offline experiments and shadow comparisons record to `EvalRun` (`metric`, `scope`, `value`, `sampleSize`, `detail`). Proposed thin addition for A/B lineage:

```prisma
// PROPOSED (additive, both-DB safe: JSON as String, scalar ids, no back-relation)
model ExperimentRun {
  id          String   @id @default(cuid())
  experiment  String                       // "match-isotonic-v2-vs-v1"
  modelId     String                       // candidate ModelRegistry.modelId
  baselineId  String?                      // model compared against
  arm         String   @default("shadow")  // shadow | canary | control | treatment
  cohort      String   @default("global")  // tenant/family cohort (k-anon enforced)
  datasetHash String                       // curated split identity — reproducibility
  metrics     String   @default("{}")      // JSON per-metric + subgroup
  codeHash    String                       // git sha of fit code
  status      String   @default("running") // running|completed|rejected|promoted
  proposalId  String?                      // → ChangeProposal that promoted it
  createdAt   DateTime @default(now())
  @@index([experiment, createdAt])
}
```

---

### 20.5 Shadow / canary / rollback

- **Shadow:** register the candidate with `deploymentStatus:"shadow"`. The gateway invokes the active provider for the real response **and** the shadow provider for logging only; the shadow output is written to `AiRun`/`ExperimentRun` with zero user impact. Deterministic providers make this cheap.
- **Canary:** promote to `canary` and route a **cohort slice** (by `Workspace`/employer tenant + hash bucket) to the new version; compare `EvalRun` metrics between arms. Canaries are **tenant-scoped**, never a random slice of a single high-stakes interview panel.
- **Rollback:** flip the prior version back to `active`, set current to `disabled`. Because a "model" is a versioned parameter table, rollback is a DB write, not a redeploy — **seconds, not a build cycle**. `rollbackOf` records the lineage; `AiRun` shows the exact cutover moment.

**Guardrail:** high-stakes capabilities (anything affecting `Application.status`, offer decisions, or proctor *conclusions*) are `safetyClass:"sensitive"` and require human sign-off on *every* promotion; they never auto-canary.

---

### 20.6 Continuous EVALUATION (not auto-training) — mapped to `runSelfEval` + `EvalRun`

`cron/ai` (06:00 daily, `vercel.json`) already calls `drain()` (event bus) + `runSelfEval()`, which computes real metrics from the audit/index/knowledge stores and writes `EvalRun` rows. Extend the metric set for Modules 6/7:

| Metric (`EvalRun.metric`) | Meaning | Source | Alert |
|---|---|---|---|
| `execution_success_rate` | AiRun ok / total (7d) | AiRun | < 0.98 |
| `match_calibration_error` | predicted vs realized advance rate | MatchCalibration vs StatusEvent | ECE > 0.08 |
| `proctor_flag_precision` | flags upheld on human review | ProctorEvent + review outcome | < target |
| `proctor_flag_rate` (per cohort) | flags / attempt by cohort | ProctorEvent | subgroup disparity |
| `panel_consensus` | mean `PanelResult.consensus` | scorecard | trend |
| `interview_bias_signal_rate` | bias signals / panel | scorecard | spike |
| `feature_drift` | PSI on feature distributions vs training | Snapshots | PSI > 0.2 |
| `knowledge_verified_ratio` / `_freshness` | dataset health | KnowledgeItem | existing |

**The loop is closed by *proposals*, not by retraining:**

```
EvalRun breach ─► generate ChangeProposal(kind:"governance"/"maintenance",
                   status:"pending", proposedBy:"aios")
                 ─► human reviews rationale + evidence (AiRun/EvalRun links)
                 ─► approved ─► curate new dataset ─► §20.3 pipeline ─► shadow …
```

Nothing in this loop mutates a live model. `execute.ts`'s §27 gate + `ChangeProposal` never-self-approve invariant are the enforcement points.

---

### 20.7 Fairness, human-in-the-loop, and the proctoring/inference boundary (AI Safety + Privacy)

- **Continuous fairness evaluation** runs on the *consented, demographically-labeled research holdout* — **never on production candidate data** (we don't store protected attributes in prod at all). We test: equalized false-positive rates for proctor detectors across skin tone / age / assistive-tech use / connection quality; parity of match calibration across job families.
- **Detector calibration, not judgment.** A proctor detector's threshold is a fitted parameter with a published FPR. A `face.absent` event is a *fact about the video signal*, carries `confidence`, and is **human-reviewed before any adverse action**. Candidates can appeal (`ChangeProposal(kind:"governance")` or a dedicated appeal record) with the `AiRun` evidence trail.
- **Inferred traits are quarantined.** Any emotion/personality/confidence provider is `forbidden-auto`, excluded from training pipelines that produce hiring scores, and printed with a validity caveat ("scientifically contested; not a hiring criterion"). The council's recommendation is to **not build these as scores**; if an enterprise tenant insists, they exist only as flagged, low-weight, human-reviewed *process notes* with a DPIA on file.

---

## 21. Infrastructure Architecture

### 21.1 The governing principle: **semantic events over raw video**

The platform is a **Semantic Digital Twin**: it minimizes raw storage and reasons over derived, structured *events*. In Modules 6/7 this is both a privacy control and the primary infra simplification.

```
 CANDIDATE DEVICE (browser)                        SERVER (Vercel/Supabase)
 ┌───────────────────────────────┐   HTTPS/WS      ┌──────────────────────────┐
 │ Camera / mic / DOM             │  semantic ONLY  │ Route handler (App Router)│
 │  ▼ on-device WASM/JS           │ ───────────────►│  validate → persist       │
 │  • face-present / multi-face   │  ProctorEvent    │  ProctorEvent rows        │
 │  • gaze off-screen (coarse)    │  {kind,ts,conf}  │  (KB, not GB)             │
 │  • liveness challenge result   │                  └──────────────────────────┘
 │  • tab blur / fullscreen exit  │   raw frames NEVER leave device by default;
 │  • paste / devtools / 2nd voice│   optional evidence clip only with explicit
 │  WebRTC peer media (P2P)       │   consent → encrypted evidence store (ENT)
 └───────────────────────────────┘
```

Raw A/V for the interview itself flows **peer-to-peer over WebRTC** (`Interview.roomCode` already exists); the server brokers signaling and stores **structured scorecards + semantic events**, not the media, in the near-term tier.

---

### 21.2 Near-term tier (buildable on the current stack **today**)

| Concern | Near-term implementation (real) | Why it holds |
|---|---|---|
| Compute | Vercel serverless functions (Next.js 14 App Router route handlers, `dynamic="force-dynamic"`) | deploy-on-push; no servers to run |
| Primary DB | Supabase **Postgres** (prod) / **SQLite** (local) — `DATABASE_URL` env-driven | dual-provider, both-DB-safe schema |
| Inference | **on-device** (WASM/JS) for CV/liveness; **in-house deterministic** providers server-side | no GPU, no external LLM/ML |
| Vector search | in-house TF-IDF (`SemanticDoc` + `SemanticPosting` inverted index) | no vector DB dependency |
| Media/evidence | `MediaAsset` **bytes in-DB** (BLOB/bytea) | survives ephemeral FS; no object store needed for docs/avatars |
| Async work | in-house durable `BackgroundJob` queue + `server/worker.js` | no Redis/BullMQ |
| Scheduling | `vercel.json` crons (worker 03:00, ingest 04:00, calibrate 05:00, ai 06:00, discover 07:00) | native |
| Event bus | `PlatformEvent` + `lib/aios/events.ts` (`emit`/`process`/`drain`) | replayable, idempotent, DB-backed |
| Audit | `AiRun` (immutable, inputs hashed) | built-in |
| Real-time | WebRTC P2P (interview) + WS signaling | media never transits our servers |
| AuthZ | JWT `er_token` + `lib/capability/*` (capability-driven, never role) | fail-closed |

**Honest limits of the near-term tier (see §23):** in-DB media does **not** scale to storing interview video; Vercel functions are request-scoped (execution-time/memory caps, no long-lived stream consumers); Postgres connection count under serverless requires the **Supabase transaction pooler** (recent hardening: "resilient over the remote pooler").

---

### 21.3 Enterprise / future-state tier (explicitly aspirational — NOT a core dependency)

```
                          ┌───────────────────────────────────────────┐
   on-device WASM ───────►│ EDGE AI TIER (opt-in): edge functions run   │
   (still first line)      │ heavier WASM/quantized models near user     │
                          └───────────────┬─────────────────────────────┘
                                          │ semantic events
                                          ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │ STREAMING BUS  (Kafka / Redpanda)  topics: proctor.events,           │
   │ ai.runs, platform.events  — partitioned by tenant, retention-capped   │
   └───────┬───────────────────────┬───────────────────────┬──────────────┘
           ▼                        ▼                        ▼
   stream processors        FEATURE STORE            OBJECT STORE (evidence)
   (aggregation,            online KV + offline       S3/R2, client-side
    windowed metrics        columnar; TTL             ENCRYPTED, consented,
    → EvalRun)                                        region-pinned, retention
           │                        │                 policy + legal hold
           ▼                        ▼                        │
   ┌───────────────┐        ┌───────────────┐                │
   │ OLAP / lake    │        │ GPU INFERENCE │◄───OPTIONAL────┘
   │ (analytics)    │        │ CLUSTER (opt) │  heavy CV/ASR, isolated,
   └───────────────┘        └───────────────┘  never a hard core dep
```

| Future capability | What it adds | Replaces / relieves | Status |
|---|---|---|---|
| Streaming bus (Kafka/Redpanda) | high-throughput event ingest, real-time proctor aggregation | `PlatformEvent` polling + cron `drain()` | future |
| Object store for evidence | encrypted, consented A/V clips + large artifacts | `MediaAsset` in-DB (docs only today) | future/enterprise |
| Feature store (online+offline) | low-latency serving + reproducible training at scale | config-derived features (§20.2) | future |
| GPU inference cluster | optional heavy CV/ASR | on-device WASM (default) | **optional tier only** |
| Edge AI | inference near the user | server round-trips | future |
| Regional shards | data residency (GDPR/BIPA) | single-region Postgres | future/enterprise |

**Privacy invariant across both tiers:** the evidence object store is **opt-in, purpose-limited, consented, region-pinned, encrypted, and retention-bounded**. The core product functions with **only semantic events**; raw-media retention is a deliberate, DPIA-gated enterprise choice, never the default.

---

## 22. Deployment Architecture

### 22.1 Environments

| Env | DB | Deploy trigger | Purpose |
|---|---|---|---|
| **Local** | SQLite (`file:./dev.db`) | `next dev` | fast iteration; both-DB-safe schema means parity |
| **Preview** | Supabase Postgres (branch/preview db) | Vercel per-PR preview on push | review + integration |
| **Production** | Supabase Postgres | push to `main` → Vercel prod | live |

### 22.2 CI/CD

**Today (deploy-on-push reality):**
```
git push main ─► Vercel build ─► prisma generate ─► next build ─►
   atomic deploy (new immutable deployment) ─► traffic cutover
   rollback = "Promote previous deployment" (instant, atomic)
```
Preconditions enforced pre-merge (proposed CI on GitHub Actions, cheap to add): `prisma validate`, typecheck, unit tests for **pure** libs (`lib/interview/scorecard.ts`, `lib/aios/evaluate.ts`, feature `derive()` fns), and a **migration lint** (see 22.4).

**Enterprise future-state:** full GitHub Actions pipeline → IaC apply (Terraform/Pulumi for Postgres, object store, bus, edge/GPU) → **blue/green** environments with health-gated cutover → **canary** by tenant slice (mirrors the model canary of §20.5) → automated rollback on SLO/`EvalRun` breach.

```
 build ─► deploy GREEN (idle) ─► smoke + EvalRun sanity ─► shift 5%→25%→100%
        ▲                                                     │ breach
        └──────────────── rollback to BLUE ◄──────────────────┘
```

### 22.3 Secrets

- Env-scoped in Vercel (dev/preview/prod): `DATABASE_URL` (+ a **direct** non-pooled URL for migrations), `CRON_SECRET`, `WORKER_SECRET`, JWT signing secret for `er_token`.
- Cron/worker routes authenticate via `Bearer CRON_SECRET` or `x-worker-secret` (localhost allowed only when neither is set) — see `cron/ai/route.ts`.
- **No secret in the repo or client bundle.** On-device inference needs no keys (that's part of why it's on-device).
- Future: KMS / secret manager, automatic rotation, per-tenant evidence-store encryption keys (envelope encryption, tenant-held).

### 22.4 DB migration discipline — the dual-provider dance

The schema is authored to be **both-DB safe** (comments in `schema.prisma` state it): *"additive, both-DB safe (JSON as String), userId/ownerId scalar (no back-relation), history never overwritten (revision tables)."*

**Rules (enforced by migration lint):**
1. **JSON as `String`** — never native `Json[]`/arrays/enums (SQLite lacks them). Parse in app code (`safeArr`).
2. **Additive-only / expand→contract.** Add columns nullable-or-defaulted; backfill via `BackgroundJob`; only later remove. Never a breaking rename in one step.
3. **Immutable history tables** (`KnowledgeRevision`, `AiRun`, `EvalRun`, `OfferEvent`, `StatusEvent`, `CareerSnapshot`) — append, never overwrite.
4. **Scalar cross-cutting ids** (e.g. `AiRun.subjectId`) — no heavy back-relations that differ across providers.
5. **Migrations run against the *direct* Postgres URL**, not the transaction pooler (pgbouncer breaks prepared statements / DDL); the app runtime uses the pooler with `pgbouncer=true`.
6. **Shadow-DB check** in `prisma migrate` to catch drift; SQLite dev + Postgres CI both exercised before merge.

```
author schema ─► prisma migrate dev (SQLite) ─► CI: apply on Postgres shadow
   ─► deploy: prisma migrate deploy (direct URL) ─► app connects via pooler
```

---

## 23. Scalability Strategy

**Target:** 100M users / 1B+ events. The honest position: the near-term stack does **not** reach that alone; it reaches it *because the architecture pushes the expensive work off the server*, and the enterprise tier (§21.3) supplies the rest. Below, each lever is marked **[now]** (holds on current stack) or **[future]**.

### 23.1 On-device offload — the primary lever **[now]**

The single biggest scalability decision is that CV/liveness/embedding-adjacent work runs **in the candidate's browser (WASM)**, and the server ingests **semantic events**, not media.

```
 1 proctored hour of raw 720p video ≈ hundreds of MB — NEVER sent/stored (default)
 Same hour as ProctorEvents         ≈ single-digit KB  (bounded, sampled, typed)

  ⇒ server bytes/candidate-hour drops ~4–5 orders of magnitude
  ⇒ server CPU per interview ≈ persist + validate JSON  (no inference on hot path)
```
This is what makes 100M users survivable on serverless: the hot path does no heavy compute.

### 23.2 Event sampling & aggregation **[now → future]**

- **Type + threshold at the edge:** emit `face.absent` on a *state change*, not per frame; debounce `tab.blur`. Raw high-frequency signals are collapsed to typed transitions on-device.
- **Aggregate, don't hoard:** roll `PlatformEvent`/`AnalyticsEvent`/`ProctorEvent` into `EvalRun` and `MatchCalibration` (already **k-anonymized aggregates**), then age out raw rows under retention policy.
- **Bounded audit:** `AiRun.outputs`/`steps` are sliced to 20 000 chars; inputs are **hashed** (sha256, no PII). Audit grows linearly and cheaply.
- **[future]** windowed stream aggregation on Redpanda/Kafka replaces cron `drain()` for real-time metrics.

### 23.3 Sharding / partitioning by **tenant + time** **[future, designed-for now]**

Every high-volume table already carries a tenant-ish key (`Workspace`/employer id, `subjectId`) and `createdAt`. Enterprise plan:

```
 AiRun / PlatformEvent / AnalyticsEvent / ProctorEvent
   → Postgres declarative partitioning BY RANGE(createdAt) [monthly]
   → sub-shard / route by tenant hash (Workspace/employer)
 Old partitions → detach → cold storage/lake; hot partitions stay small + indexed
```
Existing composite indexes (`@@index([capId, createdAt])`, `@@index([type, createdAt])`, `@@index([workspaceId, stage])`) are already partition-friendly.

### 23.4 Stream processing **[now-lite → future]**

- **[now]** `BackgroundJob` durable queue + cron `drain()` — sufficient for near-term volumes; idempotent, replayable handlers (`events.ts`) mean reprocessing is safe.
- **[future]** Kafka/Redpanda consumers for proctor aggregation, drift detection, and real-time `EvalRun` updates at 1B-event scale.

### 23.5 Regional isolation **[future/enterprise]**

Region-pinned Postgres + evidence store per residency zone (EU, US-IL for BIPA, etc.); tenant → region mapping; cross-region only for de-identified aggregates. Satisfies GDPR data residency and EU-AI-Act high-risk record-keeping locality. The near-term single-region deployment is honest about *not* providing residency guarantees — a documented limitation, not a hidden one.

### 23.6 Graceful degradation **[now]**

- **Fail-closed where it must** (authorization: `authorize()` denies on unknown/missing capability; `execute.ts` denies on missing perms/blocked forbidden-auto).
- **Fail-open where it's safe** (a match/rank provider that errors returns *no recommendation* and an audited `error` `AiRun`, never a 500 that blocks the candidate's application).
- **Bounded latency:** deterministic providers have predictable cost; `ToolDef.timeoutMs` (default 15 000) caps runaway work; proctoring continues buffering events on-device through a `network.drop` and re-syncs.
- **No single AI dependency is load-bearing for core flows** — apply/interview/offer work even if every AIOS capability is disabled (`enabled:false` kill switch).

### 23.7 Honest capability matrix

| Dimension | Current stack supports | Requires future tier |
|---|---|---|
| Users (auth, apply, interview signaling, semantic proctoring) | ✅ millions, on-device offload | 100M+ needs pooling + read replicas + partitioning |
| Events ingest | ✅ moderate (cron drain, BackgroundJob) | 1B+ needs streaming bus + partitioned tables |
| Raw A/V storage | ❌ not in-DB `MediaAsset` | encrypted object store (opt-in, consented) |
| Heavy CV/ASR | on-device WASM (default) | optional GPU cluster (never core) |
| Vector search | ✅ in-house TF-IDF | ANN/vector DB only if scale demands |
| Data residency | ❌ single region | regional shards |
| Real-time analytics | near-real-time (cron) | stream processors |

The through-line: **push compute to the device, keep the server on semantic events, keep models deterministic and small, and make every heavy/biometric/external capability an opt-in, consented, human-reviewed, clearly-separated tier — never a hard dependency of the core.**

## 24. Monitoring & Observability

### 24.1 Observability philosophy

This platform is a **high-risk AI system under the EU AI Act**; observability is therefore not only an SRE concern but a **compliance control**. The core principle inherited from the platform (the Semantic Digital Twin) applies to telemetry too: **we observe semantic events, not raw biometrics.** No monitoring pipeline ever ingests, samples, or logs a raw camera/mic frame. Monitors operate on `ProctorEvent`, `AiRun`, and `PlatformEvent` — structured, minimized, already-consented records.

Three pillars, plus two AI-specific pillars mandated by our risk class:

```
  ┌── Pillar 1: METRICS  (aggregatable, cheap, alertable)
  ├── Pillar 2: LOGS     (structured, correlated, retention-bounded)
  ├── Pillar 3: TRACES   (per-request causality across AIOS gateway)
  ├── Pillar 4: MODEL/DATA-QUALITY MONITORS  (drift, calibration, coverage)
  └── Pillar 5: FAIRNESS MONITORS  (adverse impact in production)
```

### 24.2 Telemetry topology (near-term Vercel reality vs enterprise)

Vercel serverless functions are ephemeral — there is no long-lived process for Prometheus to scrape. Near-term we use a **push + in-DB rollup** model; the enterprise tier swaps in an OpenTelemetry (OTel) collector without changing call sites (the emit API is stable).

```
NEAR-TERM (buildable now)                    ENTERPRISE (future tier)
┌───────────────────────┐                    ┌───────────────────────┐
│ Route / AIOS provider │                    │ Route / AIOS provider │
│  obs.metric()         │                    │  OTel SDK (same API)  │
│  obs.log()            │                    │                       │
└──────────┬────────────┘                    └──────────┬────────────┘
           │ write                                       │ OTLP
   ┌───────▼─────────┐   cron /api/cron/obs-rollup       │
   │ MetricSample    │──────────► MetricRollup (1m/1h/1d) ▼
   │ AiRun (audit)   │                          OTel Collector ─► Prometheus / Tempo / Loki
   │ PlatformEvent   │                          Grafana dashboards + Alertmanager
   └───────┬─────────┘
           │
   Vercel Log Drain ──► SIEM (structured JSON logs, PII-scrubbed)
```

`obs.*` is a thin façade (`lib/obs/*`) so Phase-1 DB-backed metrics and Phase-3 OTel are call-site identical.

### 24.3 Metric taxonomy

We combine **RED** (Rate/Errors/Duration) for request surfaces and **USE** (Utilization/Saturation/Errors) for resources, plus domain and responsibility metrics.

| Layer | Metric | Type | Notes / source |
|---|---|---|---|
| Edge/API | `http_requests_total{route,status}` | counter | RED rate/errors |
| Edge/API | `http_request_duration_ms` | histogram | p50/p95/p99 |
| AIOS gateway | `aios_exec_total{capId,status}` | counter | from `AiRun.status` (ok/denied/error/blocked) |
| AIOS gateway | `aios_exec_latency_ms{capId}` | histogram | `AiRun.latencyMs` |
| AIOS gateway | `aios_confidence{capId}` | histogram | `AiRun.confidence` distribution |
| AIOS gateway | `aios_blocked_total{capId}` | counter | safe-evolution `forbidden-auto` blocks |
| DB | `db_pool_wait_ms`, `db_pool_saturation` | gauge | Postgres pooler (PgBouncer/Supabase) |
| DB | `db_query_duration_ms{model,op}` | histogram | Prisma middleware |
| Proctoring | `proctor_events_total{kind,severity,source}` | counter | `ProctorEvent` |
| Proctoring | `proctor_flag_rate{kind}` | gauge | flags ÷ sessions |
| Proctoring | `proctor_ws_connected` | gauge | live session sockets |
| Proctoring | `proctor_event_ingest_lag_ms` | histogram | `tsServer − tsClient` |
| Assessment | `attempt_completion_rate`, `attempt_abandon_rate` | gauge | `TestAttempt` |
| Interview | `interview_join_success_rate` | gauge | WebRTC `roomCode` joins |
| Review | `review_queue_depth`, `review_time_to_disposition_ms` | gauge/hist | human-in-the-loop SLA |
| Review | `appeal_rate`, `appeal_overturn_rate` | gauge | candidate-rights health |
| Model quality | `drift_psi{feature}`, `calibration_ece{capId}` | gauge | §24.5 |
| Fairness | `adverse_impact_ratio{stage,cohort}` | gauge | §24.6 |
| Cost | `aios_cost_chf{capId}` | counter | `AiRun.cost` (CHF) — budget guard |

**Prisma models (Phase-1, DB-backed):**

```prisma
model MetricSample {
  id        String   @id @default(cuid())
  name      String
  value     Float
  labels    String   @default("{}") // JSON {route,capId,...} — NEVER PII
  ts        DateTime @default(now())
  @@index([name, ts])
}
model MetricRollup {
  id       String   @id @default(cuid())
  name     String
  window   String   // "1m" | "1h" | "1d"
  bucket   DateTime
  labels   String   @default("{}")
  count    Int
  sum      Float
  min      Float
  max      Float
  p50      Float?
  p95      Float?
  p99      Float?
  @@unique([name, window, bucket, labels])
  @@index([name, window, bucket])
}
```

`GET /api/cron/obs-rollup` (Vercel Cron, 1-min) folds `MetricSample → MetricRollup` and prunes raw samples past retention. Dashboards read rollups; the raw `AiRun`/`ProctorEvent`/`PlatformEvent` tables are the immutable source of truth.

### 24.4 Logs & traces

**Structured logs** — one JSON object per line, PII-scrubbed at the boundary:

```ts
// lib/obs/log.ts — scrub-on-write; no free-form candidate text
type LogRecord = {
  ts: string; level: "debug"|"info"|"warn"|"error";
  msg: string; traceId: string; capId?: string;
  subjectHash?: string;   // sha256(subjectId) — pseudonymized, never raw id in logs
  status?: string; latencyMs?: number; region?: string;
}
```
- Rule: candidate free-text answers, names, emails, and any biometric-derived field are **forbidden in logs**. A pre-commit + runtime redaction filter enforces a denylist; logs failing the schema are dropped, not degraded to plaintext.
- Retention: application logs 30 days; security/audit logs (`AiRun`, `ConsentRecord` changes, disposition changes) retained per legal minimum, immutable.

**Traces** — a `traceId` is minted at the API boundary and threaded through `execute()`. `AiRun.steps` already stores the orchestration trace as JSON; we standardize it as OTel-compatible spans:

```
trace: interview.scorecard.generate  (traceId=abc123)
├─ span api.route              12ms
├─ span authz.capability        3ms   attrs{cap:"interview.score", decision:"allow"}
├─ span aios.execute           88ms   attrs{capId, modelId, status:"ok", confidence:0.71}
│   ├─ span engine.evaluate    61ms   (pure, deterministic)
│   └─ span audit.writeAiRun    9ms   → AiRun.id
└─ span emit.platformEvent      5ms   → interview.completed
```

The trace is **the explainability artifact**: every AI decision links traceId → `AiRun` (inputsHash, confidence, explanation, steps) → the human who reviewed it. This is what a DPIA auditor or an appealing candidate is shown.

### 24.5 Model drift & data-quality monitors

Our core engines are **deterministic** (rule/graph/statistical), so classic weight drift is largely N/A — but three real risks remain and are monitored:

1. **Input/data drift** — the population feeding the engine shifts (new device mix, new browser locales, changed question bank). Detected via **Population Stability Index (PSI)** and KL divergence on feature histograms vs a frozen baseline.
2. **Output drift** — flag rates or score distributions move without a config change. `proctor_flag_rate{kind}` and score histograms are tracked; a step change triggers review.
3. **Calibration drift** — when a confidence is emitted (e.g. liveness score, optional CV), the stated confidence must match observed reliability. Tracked via **Expected Calibration Error (ECE)** and reliability diagrams, computed only where ground truth (human disposition) exists.

**Data-quality monitors (freshness/volume/schema/distribution):**

| Monitor | Signal | Trip condition (example) |
|---|---|---|
| Freshness | `proctor_event_ingest_lag_ms` p95 | > 5s live-session lag |
| Volume | events per active session | 0 events for a session past 60s → sensor dead |
| Schema | `ProctorEvent.meta` validates | any invalid JSON / unknown `kind` |
| Range | `confidence ∈ [0,1]` | out-of-range → quarantine + alert |
| Clock skew | `tsClient − tsServer` | > 120s → mark session `clock_untrusted` |
| Coverage | question bank exposure | any item exposure > threshold → retire (anti-leak) |

```ts
// lib/obs/drift.ts — PSI, deterministic, in-house
export function psi(baseline: number[], current: number[], bins = 10): number {
  const edges = quantileEdges(baseline, bins)
  const b = hist(baseline, edges), c = hist(current, edges)
  let s = 0
  for (let i = 0; i < bins; i++) {
    const pb = Math.max(b[i], 1e-6), pc = Math.max(c[i], 1e-6)
    s += (pc - pb) * Math.log(pc / pb)
  }
  return s   // <0.1 stable · 0.1–0.25 watch · >0.25 drift (alert)
}
```
Drift jobs run in `GET /api/cron/model-monitors` (hourly), writing `MonitorSignal` rows and emitting `monitor.drift` / `monitor.calibration` platform events.

```prisma
model MonitorSignal {
  id        String   @id @default(cuid())
  monitor   String   // "psi" | "ece" | "adverse_impact" | "freshness" | ...
  target    String   // feature / capId / stage
  value     Float
  threshold Float
  status    String   // "ok" | "watch" | "trip"
  window    String
  detail    String   @default("{}")
  createdAt DateTime @default(now())
  @@index([monitor, createdAt])
}
```

### 24.6 Fairness monitors in production

This is a first-class, continuously-running control — not a one-time audit. **Design constraint: we do not store protected attributes on candidate records.** Fairness monitoring uses **consented, self-declared demographics held in a segregated store**, aggregated to **k-anonymized cohorts (k ≥ 20)**; individual fairness attribution is never exposed to recruiters. If a cohort is too small to anonymize, it is suppressed, not estimated.

Monitored quantities (per funnel stage — pass/fail of assessment, proctor-flag incidence, interview advance):

- **Adverse Impact Ratio (four-fifths rule):** `selection_rate(group) / selection_rate(reference)`; **trip at < 0.8**.
- **Flag-rate parity:** proctoring flag rates across cohorts (a disparity here can indicate the sensor penalizes a group — e.g. lighting/skin-tone effects on any optional CV path, or disability). This is a **halt-the-feature** signal for CV paths.
- **Calibration-by-group:** ECE computed per cohort — a model may be calibrated overall but miscalibrated for a subgroup.
- **Equalized-odds gap:** difference in false-positive (false-flag) rates across cohorts.

```ts
// lib/fairness/monitor.ts
export function adverseImpact(rates: Record<string, {selected:number; total:number}>) {
  const rate = (g:string) => rates[g].selected / Math.max(rates[g].total, 1)
  const ref = Math.max(...Object.keys(rates).map(rate))     // most-selected as reference
  return Object.fromEntries(Object.entries(rates).map(([g]) => {
    const r = rate(g) / ref
    return [g, { ratio: +r.toFixed(3), status: r < 0.8 ? "trip" : r < 0.9 ? "watch" : "ok" }]
  }))
}
```

**Governance coupling:** a fairness `trip` writes a `MonitorSignal(status:"trip")`, emits `fairness.alert`, opens an incident (§25.7), and — for any *inferred-trait or CV* capability — flips its registry `safetyClass` toward `forbidden-auto` via the safe-evolution gate, so it **cannot execute automatically** until a human review clears it. Deterministic browser-signal proctoring is not auto-disabled (it has no scored output), but the disparity is surfaced to the DPIA owner.

### 24.7 Alerting

| Severity | Examples | Route | Ack SLA |
|---|---|---|---|
| **SEV-1** | evidence store unreachable; auth bypass; fairness trip on a live scoring path; consent-store write failing | page on-call + Privacy/Safety owner | 15 min |
| **SEV-2** | AIOS error rate > budget; DB pool saturation; proctor ingest lag > 5s | page on-call | 30 min |
| **SEV-3** | drift `watch`; single-region degraded; review queue depth > threshold | Slack/email | next business day |
| **SEV-4** | cost budget 80%; non-critical schema warning | dashboard | best-effort |

Alerts are **symptom-based** (SLO burn), deduplicated, and every AI-fairness/safety alert carries a mandatory human-owner and a link to the runbook. No alert auto-remediates a scoring model silently; the only automated action permitted is **fail-closed** (block the capability), never fail-open.

### 24.8 SLOs & error budgets

| SLO | Target (near-term) | Window | Error budget |
|---|---|---|---|
| Candidate-facing availability (assessment/interview join) | 99.9% | 28d | 40 min |
| AIOS gateway success (non-denied) | 99.5% | 28d | — |
| Proctor event ingest p95 | < 2s | 28d | 5% > 2s |
| Scorecard generation p95 | < 3s | 28d | — |
| **Human-review SLA** (flag → disposition) | 95% < 24h | 28d | 5% |
| **Appeal acknowledgement** | 100% < 72h | rolling | 0 (hard) |
| **Fairness SLO**: no unresolved AIR trip | 100% | continuous | 0 (hard) |
| Evidence durability | 99.999999999% (11 nines target, enterprise) | — | — |

The fairness and appeal SLOs are **hard budgets (zero tolerance)**: burning them freezes the affected capability, not just pages an engineer — this is the operational teeth behind "humans decide, candidates can appeal."

---

## 25. Disaster Recovery

### 25.1 Data-class → RPO/RTO matrix

DR targets are set per data class, because a lost audit/evidence record is a legal event, whereas a lost cache entry is not.

| Data class | Store | RPO | RTO | Durability posture |
|---|---|---|---|---|
| **Evidence & audit** (`AiRun`, `ProctorEvent`, `ConsentRecord`, disposition/appeal records) | Postgres + WORM object store | **0 (zero loss)** | ≤ 1h | Immutable, hash-chained, object-lock, replicated |
| **Transactional core** (Interview, Test, Application, Offer, User) | Postgres (Supabase) | ≤ 5 min (PITR) | ≤ 1h | PITR + cross-region replica |
| **Semantic/derived** (scorecards, `KnowledgeItem`, rollups) | Postgres | ≤ 1h | ≤ 4h | Recomputable from events (replay) |
| **Minimized media artifacts** (consented thumbnails/clips, recordings) | Object store (versioned) | ≤ 15 min | ≤ 4h | Versioning + object-lock + lifecycle expiry |
| **Ephemeral** (WebRTC media, live WS buffers, caches) | in-memory/edge | N/A (acceptable loss) | immediate | Reconstructed on reconnect |

Design leverage: because the platform is **event-sourced** (`PlatformEvent` + idempotent replayable handlers, `drain()`), most *derived* state has an effective RPO equal to the event log's RPO — it can be **rebuilt by replay**, not restored. This is a major DR asset: scorecards, knowledge index, and analytics are regenerable; only the event/audit/evidence spine needs true zero-loss backup.

### 25.2 Backup strategy

```
Postgres (Supabase, prod)
 ├─ Continuous WAL archiving → PITR (any point in retention window)
 ├─ Nightly full snapshot → cross-region bucket (encrypted, KMS)
 ├─ Weekly snapshot → cold/immutable tier (object-lock, 1-yr+ per retention policy)
 └─ Logical dump of audit tables (AiRun, ConsentRecord, ProctorEvent) → append-only archive

Object store (evidence & minimized media)
 ├─ Versioning ON (no destructive overwrite)
 ├─ Object-Lock (WORM) on evidence prefix → immutable for retention period
 ├─ Cross-region replication (async)
 └─ Lifecycle: minimized media auto-expire at consented retention; evidence honors legal hold

Config & secrets
 └─ IaC in git; secrets in Vercel/KMS with export-encrypted escrow; rotation runbook
```

- **3-2-1**: ≥3 copies, ≥2 media/regions, ≥1 offline/immutable.
- **Backups are tested, not assumed**: automated monthly restore rehearsal into an isolated project verifies integrity + measures actual RTO (drift in RTO is itself an alert). A backup that has never been restored is treated as no backup.
- **Local dev** uses SQLite; DR here is trivial (repo + seed) and explicitly out of scope for production DR guarantees — this is called out so no one conflates the two.

### 25.3 Evidence durability & integrity (the DR crown jewel)

Proctoring/interview evidence must survive DR **and** remain tamper-evident so it can be trusted in a dispute or regulatory audit.

- **Hash chaining:** each `ProctorEvent`/`AiRun` carries a `prevHash`/`hash` chain per session; any tampering breaks the chain and is detectable.

```prisma
// evidence integrity fields (added to ProctorEvent / AiRun)
  prevHash  String?  // sha256 of previous record in the session chain
  hash      String   // sha256(canonical(this) + prevHash)
```
- **WORM + object-lock** on the evidence prefix: writes are append-only; deletes are blocked until retention expiry or a compliant legal-hold release.
- **Anchoring (enterprise):** periodic Merkle-root of the day's evidence chain signed and stored externally (optionally notarized), so post-incident you can prove the evidence set is complete and unaltered.
- **Minimization is a DR feature:** because we store semantic events + minimized artifacts (not raw streams), the evidence corpus is small enough for zero-loss replication to be economical, and a breach exposes far less.

### 25.4 Multi-region & failover

```
NEAR-TERM (Vercel + Supabase)             ENTERPRISE (active-active)
──────────────────────────────           ──────────────────────────────
Vercel functions: multi-region deploy     Multi-region app + regional data
Postgres: primary + cross-region read      residency (EU cohort stays in EU)
  replica (promotable)                     Global load balancer, health-based
Object store: cross-region replication     failover, RPO≈0 via sync replication
Failover: promote replica (manual/         for evidence, async for derived
  semi-automated), repoint DATABASE_URL    Chaos/game-days quarterly
DNS/edge reroute
```

- **Region-aware by law, not just latency:** an EU candidate's data (and evidence) is pinned to EU regions (GDPR/data-residency); failover targets respect residency — we fail over **within** a legal region before crossing one. BIPA/Illinois biometric data (if any optional CV path is enabled there) follows Illinois-specific retention/destruction rules independent of DR mechanics.
- **Read-replica promotion** is the near-term failover; documented, rehearsed, semi-automated. True active-active is enterprise-tier.

### 25.5 Kill-switches (AI-specific DR)

DR here includes **"the model is misbehaving"** as a disaster, not only "the server is down." The safe-evolution gate is the kill-switch substrate:

- **Per-capability kill:** set a capability's `safetyClass = "forbidden-auto"` (or `enabled=false`) in the registry → `execute()` fail-closes that capability instantly, platform-wide, with an auditable `AiRun(status:"blocked")`. No deploy required.
- **Global AI freeze:** a feature flag that forces all non-essential AI capabilities to `forbidden-auto` while keeping deterministic assessment/proctoring event capture running (evidence collection must not stop even if scoring is frozen).
- **Fail-closed contract:** on provider/dependency loss, capabilities deny rather than degrade to an unaudited path.

### 25.6 RPO/RTO verification & DR SLAs

- Quarterly **game-day**: simulate primary DB loss, evidence-store outage, and a fairness-trip freeze; measure actual RPO/RTO; file gaps as SEV-3.
- DR run status feeds `MonitorSignal` so "last successful restore test" and "measured RTO" are dashboarded and alert if stale.

### 25.7 Incident runbooks (index)

Each runbook: **Detect → Contain → Communicate → Recover → Verify → Post-mortem (blameless)**. Regulatory clocks (GDPR 72h breach notification) start at *detection*, tracked as a hard timer.

| # | Incident | First action | Recovery spine | Regulatory |
|---|---|---|---|---|
| RB-01 | Primary DB down | Confirm; promote read-replica; repoint `DATABASE_URL` | PITR if corruption; else replica promote | — |
| RB-02 | Evidence store unreachable | Halt *new* scored decisions (fail-closed); keep buffering events client-side w/ retry | Restore/replicate; verify hash chains | Possible if data at risk |
| RB-03 | Evidence tamper detected (broken hash chain) | Freeze affected sessions; legal hold | Forensics from immutable archive/anchor | Likely — notify DPO |
| RB-04 | Data breach / PII exposure | Contain access; rotate secrets; scope blast radius via `AiRun`/access logs | Restore integrity; patch | **GDPR 72h**, BIPA notice |
| RB-05 | Fairness trip on live scoring path | Auto-freeze capability (§24.6); notify Safety owner | Root-cause; re-validate; human-reviewed re-enable | AI Act logging |
| RB-06 | Model/provider misbehaving | Global AI freeze or per-cap kill | Roll back registry/model pin | AI Act |
| RB-07 | Proctoring sensor mass false-flag | Quarantine session dispositions; notify candidates | Fix + re-review affected attempts; offer appeal | Candidate rights |
| RB-08 | Region outage | Region-aware failover (respect residency) | Promote in-region resources | Residency preserved |
| RB-09 | Consent-store failure | **Stop all capture requiring consent** (fail-closed) | Restore; reconcile; no capture ran unconsented | GDPR/BIPA |

Every runbook ends by writing an incident record and a `PlatformEvent("incident.resolved")` so the learning loop and audit both capture it.

---

## 26. Testing Strategy

### 26.1 Test pyramid (and why the base is fat here)

Because the mandate is **in-house, deterministic-first**, the engines are pure functions — which makes them *exhaustively* unit-testable with golden fixtures. That is a deliberate architectural advantage: correctness and fairness are testable offline, without models or GPUs.

```
                 ▲  fewer, slower, higher-fidelity
        ┌────────────────┐
        │  E2E / device  │  Playwright: real browser proctor signals, WCAG, appeal flow
        ├────────────────┤
        │  Load / soak   │  k6/artillery: WS fan-out, attempt bursts, 72h soak
        ├────────────────┤
        │  Adversarial /  │  red-team: spoofing, cheating, evasion (§26.4)
        │  Fairness       │  demographic parity harness (§26.5)
        ├────────────────┤
        │  Integration    │  route → AIOS execute → AiRun → event → handler
        ├────────────────┤
        │   UNIT (pure engines): scorecard, governance, drift, fairness,      │
        │   proctor-classifier, calibration — deterministic golden tests      │
        └────────────────────────────────────────────────────────────────────┘
                 ▼  many, fast, cheap
```

### 26.2 Unit tests — pure engines

Targets and contracts:

| Engine (file) | Property tested | Example golden assertion |
|---|---|---|
| `lib/interview/scorecard.ts` | competency aggregation is deterministic & monotone; bias signals flagged | same inputs → identical scorecard hash; adding a rater cannot silently drop a competency |
| `lib/interview/governance.ts` | who-may-attend redaction | `confidential=true` → OBSERVER sees no notes/recording; violation snapshot recorded in `govJson` |
| `lib/obs/drift.ts` | PSI/ECE math | known distributions → known PSI (±1e-9) |
| `lib/fairness/monitor.ts` | AIR / equalized-odds | crafted cohorts → AIR trips exactly at 0.8 boundary |
| `lib/proctor/classify.ts` | signal→event mapping | tab blur + refocus < 300ms → **not** a flag (debounce); face-absent > threshold → `FACE_ABSENT` |
| `lib/proctor/score.ts` | **integrity summary is evidence, not a character score** | output contains events+confidence+timeline, never a "trustworthiness %"; disability accommodations suppress relevant flags |

Rules:
- **Determinism gate:** every engine test runs twice; non-identical output fails CI (guards against hidden nondeterminism/`Date.now()` leakage — pass a clock).
- **No network/model in unit layer.** Optional CV/LLM providers are mocked at the AIOS boundary.
- Coverage target: **100% of decision branches** in scoring/fairness/governance/proctor engines (these are the legally-sensitive paths), ≥85% overall.

### 26.3 Integration tests

Exercise the real spine end-to-end without external deps:

```
POST /api/interview/:id/score
   → capability authz (capability, not role)          [assert deny for missing cap]
   → aios.execute(capId)                              [assert forbidden-auto blocks]
   → engine.evaluate (pure)                           [assert scorecard shape]
   → AiRun written                                    [assert confidence+explanation+steps present]
   → emit("interview.completed")                      [assert handler ran idempotently]
   → drain() re-run                                   [assert no double-processing]
```
Key integration assertions: fail-closed on unknown/disabled capability; `AiRun` row exists for *every* AI decision (no silent path); event handlers are **idempotent** (run `drain` twice, state identical); consent absence blocks capture routes with 403 + audit.

### 26.4 Adversarial / red-team testing (spoofing, cheating, evasion)

A dedicated, versioned **attack catalog** run in CI + periodic manual red-team. Each attack maps to a detection signal and a regression test. Crucially, the honest posture: **some attacks we detect, some we only raise as human-reviewed signals, and some we explicitly declare out of scope** rather than pretend to defeat.

| Vector | Attack | Detection / response | Test | Honesty caveat |
|---|---|---|---|---|
| **Liveness spoof** | Printed photo, replay video, mask, deepfake feed (virtual camera) | (opt-in CV tier) PAD challenge-response, texture/motion; **flag not verdict** | synthetic replay fixtures | Liveness is an arms race; never "proof of identity," only a signal |
| **Identity** | Impersonation / proxy test-taker | ID match (opt-in), keystroke/interaction continuity as *signal* | proxy-swap session | Cannot fully solve; escalate to human + secondary verification |
| **Second person** | Off-camera coach | `FACE_MULTIPLE`, audio VAD (2nd voice) as event | multi-face fixture | Environmental; human reviews context |
| **Tab/app switch** | Googling answers | `TAB_BLUR`, `FULLSCREEN_EXIT`, visibility API | debounce test (avoid false flags) | Cannot see other devices — see below |
| **Copy/paste/exfil** | Paste answer, paste code from LLM | `PASTE` event + paste-length + paste-vs-typing ratio | coding-attempt fixture | Paste is legitimate in some tasks; task-aware weighting |
| **Second device** | Phone with LLM beside laptop | **Not detectable by browser** — mitigate by item design (novel, applied, oral follow-up) | N/A | **Declared limitation** — do not claim detection |
| **DevTools / automation** | Console/DOM tamper, headless bot, autotyper | `DEVTOOLS_OPEN`, integrity token, timing entropy | automation harness | — |
| **Network** | Disconnect to dodge signals | `NETWORK_DROP` + client-side buffered retry (no gap = no evasion) | offline-then-online fixture | Buffering closes this gap |
| **Model evasion** (if inference tier on) | Adversarial input to fool CV/scoring | robustness tests; low-confidence → route to human | perturbation set | Reason we keep inference low-weight/human-reviewed |
| **Prompt injection** (if optional LLM tier on) | Candidate text tries to manipulate an LLM grader | input isolation, no candidate text as instructions; grader is advisory only | injection corpus | Deterministic rubric is source of truth |
| **Authz** | Recruiter B reads confidential interview | capability + governance redaction | cross-tenant/role test | Fail-closed |

Anti-cheat design principle baked into tests: **prefer cheat-resistant assessment design over surveillance escalation.** Item-exposure limits, randomized/parameterized items, applied/oral components, and "show your reasoning" formats are tested as first-line defenses; proctoring is corroboration, not the primary control.

### 26.5 Fairness testing across demographics

Fairness is tested **before ship (gate)** and **monitored after ship** (§24.6).

- **Synthetic + consented panels:** a curated, consented evaluation panel spanning skin tone, age, gender presentation, accent/dialect, disability (assistive tech, atypical gaze/motion), device/camera quality, lighting, bandwidth. No protected attribute is ever a model input.
- **Metrics gate (CI, blocking):** Adverse Impact Ratio ≥ 0.8, equalized-odds gap ≤ threshold, per-group ECE within tolerance, and **flag-rate parity for proctoring** (a CV path that flags darker skin or wheelchair users more fails the build).
- **Disability accommodation tests:** screen-reader users, users who look away to think, users with speech differences, users on low-end cameras must **not** accumulate integrity flags for their disability; accommodation config suppresses the relevant signal classes and the test asserts zero disparate flagging.
- **Ship gate:** any inferred-trait/CV capability that fails a fairness test **cannot leave `forbidden-auto`** — the safe-evolution gate is wired to the fairness CI result. Deterministic browser-signal proctoring (no scored output) still must pass flag-rate parity.

### 26.6 Load, soak & resilience

| Test | Scenario | Target |
|---|---|---|
| Load | 5k concurrent proctored sessions, WS event fan-out | p95 ingest < 2s; no dropped events (buffered) |
| Spike | 10k attempts start in 60s (exam window open) | no 5xx > budget; DB pool holds |
| Soak | 72h steady interview+proctor load | no memory/handle leak; rollup keeps up; no unbounded `MetricSample` growth |
| Chaos | kill replica / drop region mid-session | failover within RTO; sessions resume, events preserved |
| Backpressure | evidence store slow | client buffers + retries; fail-closed on scored decisions, capture continues |

### 26.7 Accessibility (WCAG) + device/browser matrix

Candidate-facing surfaces target **WCAG 2.2 AA** (assessment, interview join, consent, appeal). Accessibility is both an ethics and a fairness requirement — an inaccessible assessment is a discriminatory one.

- Automated (axe-core in Playwright) + **manual AT testing**: NVDA/JAWS/VoiceOver, keyboard-only, 200% zoom, reduced-motion, high-contrast, captions for any audio/video.
- Consent and proctoring notices must be perceivable and operable via AT; a candidate must be able to request accommodations *before* proctoring starts.
- **Device/browser matrix (min supported):**

| | Chrome | Edge | Firefox | Safari | Mobile Safari (iOS) | Chrome Android |
|---|---|---|---|---|---|---|
| Assessment | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Browser proctor signals | ✓ | ✓ | ✓ | ✓ (limited APIs) | ○ (reduced) | ○ (reduced) |
| WebRTC interview | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Opt-in on-device CV (WASM) | ✓ | ✓ | ✓ | ○ | ○ | ○ |

Where an API is unavailable (e.g. Safari restrictions), the system **degrades transparently** — it records "signal unavailable on this platform" rather than penalizing the candidate for their device/OS choice.

### 26.8 Review-workflow verification

The human-in-the-loop is a testable system, not a promise:

- **Audit completeness test:** for a corpus of decisions, assert 1:1 `decision → AiRun → reviewer disposition` linkage; any AI output affecting a candidate with no human disposition fails.
- **Appeal path E2E:** candidate views the evidence shown to reviewers (their own data), submits appeal, appeal is acknowledged < 72h (hard SLO), overturn recorded and feeds calibration.
- **Reviewer-independence test:** confidential/redaction rules hold in the reviewer console (`governance.ts`); a reviewer cannot see beyond their capability scope.
- **"No auto-adverse-action" test:** assert no code path finalizes a rejection or a proctoring adverse outcome without a human disposition — enforced by the `forbidden-auto` gate on any such capability.

---

## 27. Benchmark Against Global Leaders

### 27.1 How to read this benchmark

Two axes, weighted equally by this council: **Capability** (what it can do) and **Responsibility** (transparency, candidate rights, bias governance, on-device privacy, scientific honesty). Most incumbents optimize the first; regulatory reality (EU AI Act, NYC Local Law 144, Illinois AIVIA/BIPA, GDPR) now makes the second existential. Our differentiation is being **strong on both, in-house, and honest about limits.**

Legend: ● strong · ◐ partial · ○ absent/weak · — N/A.

### 27.2 Capability comparison

| Capability | **This platform** | HireVue | Mercer Mettl | SHL | Talview | HackerRank | Codility | TestGorilla | iMocha | Teams/Zoom AI |
|---|---|---|---|---|---|---|---|---|---|---|
| Live interview (WebRTC) | ● (`roomCode`) | ● | ● | ◐ | ● | ○ | ○ | ○ | ○ | ● |
| Async video interview | ◐ (roadmap) | ● | ● | ● | ● | ○ | ○ | ◐ | ◐ | ○ |
| Structured scorecards + competency | ● (`scorecard.ts`) | ● | ● | ● | ● | ◐ | ◐ | ◐ | ● | ○ |
| Aptitude/psychometric tests | ● (`Test` types) | ◐ | ● | ●● | ● | ○ | ○ | ● | ● | — |
| Coding assessment | ◐ (CODING type) | ○ | ● | ◐ | ◐ | ●● | ●● | ● | ● | — |
| Browser proctoring (events) | ● (`ProctorEvent`) | ● | ● | ● | ● | ● | ● | ● | ● | ○ |
| Camera/liveness proctoring | ◐ opt-in WASM | ● | ● | ● | ● | ◐ | ◐ | ◐ | ● | ○ |
| Question bank scale | ◐ (growing) | ◐ | ●● | ●● | ● | ●● | ● | ● | ● | — |
| ATS / funnel | ● (`Application`/`StatusEvent`/`Offer`) | ◐ | ◐ | ◐ | ● | ◐ | ○ | ◐ | ◐ | ○ |
| Matching / recommendation | ● (ICAE/EIDP) | ◐ | ◐ | ● | ◐ | ◐ | ○ | ◐ | ● | ○ |
| Meeting summary/notes AI | ◐ (semantic, roadmap) | ● | ◐ | ○ | ● | ○ | ○ | ○ | ○ | ●● |
| Explainable AI audit trail | ●● (`AiRun`) | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ○ |

`●●` = category leader on that single capability. Honest read: **incumbents lead on raw scale** (SHL/Mettl psychometrics, HackerRank/Codility coding depth, Teams/Zoom meeting AI). We are not claiming to out-scale a 20-year question bank on day one; we claim a **unified, governed, in-house architecture** that is stronger where it matters legally and extensible where it matters competitively.

### 27.3 Responsibility comparison (the axis regulators now enforce)

| Responsibility dimension | **This platform** | HireVue | Mettl | SHL | Talview | HackerRank | Codility | TestGorilla | iMocha | Teams/Zoom AI |
|---|---|---|---|---|---|---|---|---|---|---|
| **No pseudoscientific trait scoring affecting hiring** (emotion/personality/"confidence" from face/voice) | ●● by design | ◐ (dropped facial analysis 2021) | ◐ | ● | ◐ | ● | ● | ● | ◐ | — |
| Per-decision explainability to candidate | ●● (`AiRun` + appeal) | ◐ | ○ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ |
| Candidate appeal / contest path | ● | ◐ | ○ | ◐ | ○ | ○ | ○ | ○ | ○ | — |
| Published bias audit / governance | ● (built-in monitors) | ● (audited) | ◐ | ● | ◐ | ◐ | ◐ | ◐ | ◐ | ○ |
| Continuous in-production fairness monitors | ●● | ◐ | ○ | ◐ | ○ | ○ | ○ | ○ | ○ | ○ |
| Data minimization (semantic events, not raw video) | ●● (Semantic Twin) | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| On-device / no mandatory cloud biometrics | ●● (WASM opt-in) | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Consent-first, region-aware, retention limits | ●● | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ |
| Human-in-the-loop enforced in architecture | ●● (`forbidden-auto` gate) | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | — |
| No mandatory external LLM/ML dependency | ●● (in-house first) | ○ | ○ | ○ | ○ | ◐ | ◐ | ○ | ○ | ○ |
| Kill-switch / capability freeze | ●● | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |

### 27.4 Positioning statement

> **Evidence-based, human-governed, in-house.** Where the market inferred character from faces (and quietly retreated when the science and the law caught up), this platform **never encodes contested inferences as hiring scores.** Proctoring reports *observable events* with confidence and evidence; humans decide; candidates can appeal. Uniquely, the entire stack has an **in-house deterministic path** (patent goal) with **no mandatory cloud biometrics** — heavy CV is an *opt-in, on-device (WASM), clearly-separated* tier, never a core dependency. The **Semantic Digital Twin** minimizes raw storage by design, turning privacy and DR economics into an architectural advantage. And every AI decision is a queryable `AiRun` record — explainability and auditability are the substrate, not a report bolted on.

Honest competitive gaps we will close (roadmap, §28–29): question-bank breadth, async-video depth, and meeting-summary polish — pursued **only** through governed, explainable mechanisms.

---

## 28. Future Research Roadmap

Framing: every item below is a **research frontier, not a shipped claim.** Each carries an explicit ethical guardrail and a **ship gate** tied to the safe-evolution mechanism: nothing graduates from research to a candidate-affecting feature until it passes fairness + calibration gates and human-oversight review; anything that cannot be made fair or valid is **recommended against, permanently.**

### 28.1 Robust liveness & presentation-attack detection (PAD)

- **Frontier:** on-device PAD resistant to print/replay/mask and — hardest — **deepfake/virtual-camera** injection; challenge-response (randomized head/gesture/lighting prompts) and camera-provenance signals.
- **Guardrail:** liveness is a **signal for a human, never automated identity proof or a candidate score.** Arms-race honesty: we publish detection scope and known bypasses. Accommodations for users who cannot perform certain challenges (disability) must never degrade their outcome.
- **Ship gate:** flag-rate parity across skin tone/lighting/device; false-positive rate bounded; human review mandatory on any adverse use.

### 28.2 Privacy-preserving on-device inference

- **Frontier:** WASM/WebGPU models running entirely client-side; **differential privacy** on any telemetry that leaves the device; explore **federated** model improvement so raw biometrics never centralize; monitor maturity of **homomorphic/secure-enclave** inference (candidly: not production-ready, tracked not promised).
- **Guardrail:** default is *no raw egress*; only minimized semantic events leave the device (extends the Semantic Twin). DP budgets are published and enforced.
- **Ship gate:** proof that no capability regresses when raw media never leaves the client.

### 28.3 Federated & cross-org evaluation

- **Frontier:** learn better *rubrics and calibration* across organizations without pooling candidate data — federated aggregation of anonymized, consented signals; secure aggregation to prevent single-org data reconstruction.
- **Guardrail:** federation improves **process quality (calibration, item difficulty)**, never builds cross-employer candidate profiles; strict purpose limitation; no candidate blacklisting substrate — that is an explicit non-goal.

### 28.4 Fairness research

- **Frontier:** counterfactual fairness (would this outcome change if a protected attribute changed?), intersectional subgroup discovery, causal disentanglement of skill from proxy, and **fairness under distribution shift** (a model fair at launch can drift unfair).
- **Guardrail:** protected attributes are used **only** to measure fairness in a segregated store, **never** as model inputs; k-anonymized cohorts; intersectional analysis suppresses sub-threshold groups rather than exposing individuals.
- **Ship gate:** continuous production fairness monitors (§24.6) with hard freeze on trip.

### 28.5 Confidence calibration & uncertainty

- **Frontier:** well-calibrated confidence (Platt/isotonic/temperature scaling; conformal prediction for principled abstention), so "confidence 0.6" *means* 60% reliability; **selective prediction** — the system abstains and routes to a human when uncertain.
- **Guardrail:** every AI output already carries `confidence` (`AiRun`); research makes it *honest*. Miscalibrated confidence is a defect, tracked via ECE (§24.5).
- **Ship gate:** ECE below threshold, overall and per subgroup.

### 28.6 Assessment science (the constructive frontier)

- **Frontier:** cheat-resistant, LLM-era assessment — **applied/generative tasks, oral-defense follow-ups, parameterized items, adaptive testing (IRT/CAT)**, and validity research linking assessment to on-the-job performance. This is where we invest *instead of* surveillance escalation.
- **Guardrail:** validity studies pre-registered; adverse-impact evaluated before deployment; item exposure monitored (§24.5).

### 28.7 Explicit non-goals (research we will not pursue as hiring signals)

- Emotion/affect recognition, personality inference, "confidence"/deception/accent scoring, gaze-as-honesty, or any physiognomic inference **as a candidate score.** These are scientifically contested and discrimination-prone; we treat them, at most, as low-weight human-reviewed *process* signals with published validity caveats — and default to **not building them.**

### 28.8 Research governance protocol

Every research→product transition passes: (1) DPIA + AI-Act conformity review, (2) pre-registered validity study, (3) fairness gate, (4) calibration gate, (5) human-oversight design review, (6) start life as `forbidden-auto`. A red X on any gate keeps it in the lab.

---

## 29. Implementation Roadmap

Three phases, strictly separating **in-house buildable on this exact stack now** from **opt-in on-device** from **enterprise/aspirational.** Each phase lists concrete deliverables, the reused existing primitives, and a Definition-of-Done.

### 29.1 Phase 1 — In-house buildable slice (ship on this platform now)

**Goal:** a governed, consent-first, human-reviewed proctoring + assessment-intelligence loop using only Next.js 14 App Router + Prisma + the existing AIOS/Interview/Test primitives. No CV, no external model, no GPU. Deploys on Vercel push.

**Reuses:** `Interview`/`InterviewParticipant` (+ `roomCode`, `governance.ts`, `scorecard.ts`), `Test`/`TestAttempt`(`proctored`,`tabSwitches`)/`Question`/`Answer`, `execute(capId,ctx)` gateway, `AiRun` audit, `PlatformEvent`/`emit`/`drain`, capability authz.

**New Prisma models:**

```prisma
model ProctorSession {
  id          String   @id @default(cuid())
  attemptId   String?  // TestAttempt
  interviewId String?  // Interview
  subjectId   String   // candidate
  consentId   String   // ConsentRecord (must exist & be granted — fail-closed)
  status      String   @default("ACTIVE") // ACTIVE|ENDED|ABORTED|UNTRUSTED
  region      String
  integrity   String   @default("{}") // summary snapshot (events+timeline), NOT a score
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  events      ProctorEvent[]
  @@index([subjectId, startedAt])
}
model ProctorEvent {
  id          String   @id @default(cuid())
  sessionId   String
  kind        String   // FACE_ABSENT|FACE_MULTIPLE|TAB_BLUR|FULLSCREEN_EXIT|PASTE|COPY|DEVTOOLS_OPEN|NETWORK_DROP|MIC_2ND_VOICE
  severity    String   @default("info") // info|notice|warn|critical
  source      String   @default("browser") // browser|wasm-cv|server|human
  confidence  Float    @default(1)
  evidenceRef String?  // hash/pointer to minimized artifact — never raw stream
  meta        String   @default("{}")
  tsClient    DateTime
  tsServer    DateTime @default(now())
  prevHash    String?  // integrity chain
  hash        String
  reviewed    Boolean  @default(false)
  reviewerId  String?
  disposition String?  // benign|note|flag|escalate|dismissed
  session     ProctorSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@index([sessionId, tsServer])
}
model ConsentRecord {
  id            String   @id @default(cuid())
  subjectId     String
  purpose       String   // PROCTORING_BROWSER|RECORDING|CV_ONDEVICE|BIOMETRIC_LIVENESS
  region        String
  policyVersion String
  granted       Boolean
  method        String   // click-through|signed
  grantedAt     DateTime @default(now())
  revokedAt     DateTime?
  expiresAt     DateTime?
  @@index([subjectId, purpose])
}
```

**Deliverables:**

1. **Consent flow** (`app/(candidate)/proctoring/consent`): region-aware, purpose-limited, plain-language; writes `ConsentRecord`; capture routes **fail-closed** without a granted, unexpired consent. Revocation stops capture immediately.
2. **Browser signal collector** (`lib/proctor/collector.ts`, client): Page Visibility, Fullscreen, `paste`/`copy`, devtools heuristic, `navigator.onLine`, optional mic VAD (2nd-voice flag only). **Buffers + retries** offline (no gap = no evasion). Emits over WS.
3. **Semantic classifier** (`lib/proctor/classify.ts`, pure engine): debounces raw signals into `ProctorEvent`s with severity + confidence; unit-tested golden fixtures; **no character judgments**.
4. **Ingest API + WS** (`app/api/proctor/session`, `/event`): validates consent, writes hash-chained events, `emit("proctor.event")`.
5. **AIOS capabilities** registered (deterministic providers): `proctor.summarize` (evidence timeline, not a score), `interview.scorecard` (already), `assessment.integrity-summary`. All run through `execute()` → `AiRun`; adverse-use variants set `forbidden-auto`.
6. **Reviewer console** (`app/(recruiter)/review`): timeline of events + minimized evidence, confidence, **human disposition required**; honors `governance.ts` redaction/confidential; nothing finalizes adverse action without disposition.
7. **Scorecards + bias signals** surfaced (reuse `scorecard.ts`).
8. **Candidate rights**: candidate sees their own evidence + submits **appeal**; appeal acknowledged < 72h.
9. **Monitors + crons**: `/api/cron/obs-rollup`, `/api/cron/model-monitors` (drift/flag-rate), fairness rollup; `MetricSample`/`MonitorSignal`.
10. **DR basics**: hash-chain integrity, WORM evidence prefix, PITR verified restore rehearsal.

**Phase-1 DoD:** every AI decision has an `AiRun`; no adverse outcome without human disposition; consent fail-closed proven by test; WCAG 2.2 AA on candidate surfaces; red-team browser vectors covered; fairness flag-rate parity test green; deploys on Vercel push.

### 29.2 Phase 2 — On-device CV (WASM), opt-in

**Goal:** add camera-based signals **entirely on-device**, opt-in, as *additional evidence*, never as scores.

**Deliverables:**
- WASM/WebGPU on-device models (`lib/proctor/wasm/*`): face-present/absent, multi-face, **liveness/PAD challenge-response**. Raw frames never leave the browser; only `ProctorEvent{source:"wasm-cv"}` (event + confidence + minimized thumbnail hash) is sent.
- `ConsentRecord{purpose:"CV_ONDEVICE"|"BIOMETRIC_LIVENESS"}` with BIPA/Illinois-specific retention + destruction and EU high-risk handling; per-region enablement.
- Calibration + **fairness gate wired to safe-evolution**: CV capabilities stay `forbidden-auto` until flag-rate parity across skin tone/lighting/device passes; accommodation paths suppress signals.
- Degrades transparently where WASM/APIs unavailable (Safari/mobile) — records "unavailable," never penalizes.

**Phase-2 DoD:** zero raw-media egress proven; DP/minimization on any telemetry; fairness + calibration gates green; DPIA updated; candidate can decline CV and still complete assessment via an equivalent path.

### 29.3 Phase 3 — Enterprise streaming / edge / GPU tier

**Goal:** high-scale, low-latency deployments for large enterprises, cleanly separated and never a dependency of Phases 1–2.

**Deliverables:**
- OTel collector + Grafana/Tempo/Loki (swap `obs.*` backend, call sites unchanged).
- Active-active multi-region with data residency; sync-replicated evidence (RPO≈0).
- Optional server/edge/GPU inference **behind the same AIOS boundary** (same `AiRun`, same `forbidden-auto` gate) — advisory signals only, still human-decided.
- Optional external LLM/vector providers as **pluggable, non-default** providers, region-gated, with the deterministic in-house path always retained as fallback.
- Streaming media pipeline, async-video interviews at scale, meeting-summary (semantic).

**Phase-3 DoD:** in-house path still passes all tests with every optional provider disabled (proving no hard dependency); residency + kill-switch verified in game-day; benchmark parity on scale dimensions (§27) without regressing any responsibility dimension.

### 29.4 Roadmap at a glance

```
Phase 1 (now, in-house)     Phase 2 (opt-in on-device)      Phase 3 (enterprise)
─────────────────────────   ─────────────────────────       ─────────────────────────
Consent + browser signals   WASM face/liveness (on-device)  OTel, active-active, GPU
Semantic ProctorEvent       BIPA/EU biometric handling      external providers (pluggable)
Reviewer console + appeal   fairness gate → safe-evolution  streaming, async video, mtg AI
AiRun audit + monitors      calibration + DP                residency + RPO≈0 evidence
Deploys on Vercel push      transparent degradation         in-house remains the fallback
        │ deterministic, no CV      │ no raw egress                 │ optional, never required
```

---

## 30. Complete Enterprise Technical Specification

### 30.1 Layered reference architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ L7  EXPERIENCE     Candidate (assessment, interview join, consent, appeal, my- │
│                    evidence) · Recruiter (review console, scorecards) ·         │
│                    Admin (capability registry, monitors, DPIA)   [WCAG 2.2 AA] │
├──────────────────────────────────────────────────────────────────────────────┤
│ L6  API / EDGE     Next.js 14 App Router routes · WS (proctor events, WebRTC   │
│                    signaling roomCode) · traceId minted here                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ L5  GOVERNANCE     Capability authz (NEVER role) · interview governance/        │
│     SPINE          redaction · CONSENT gate (fail-closed) · SAFE-EVOLUTION      │
│                    gate (forbidden-auto kill-switch)                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ L4  AIOS GATEWAY   execute(capId,ctx): resolve → safe-evo → authz → provider →  │
│                    AiRun audit (confidence+explanation+steps) → emit event      │
│                    Providers: DETERMINISTIC in-house (default) │ WASM (opt-in)   │
│                                                                │ ext/GPU (ent.)  │
├──────────────────────────────────────────────────────────────────────────────┤
│ L3  ENGINES        scorecard · governance · proctor.classify · fairness ·       │
│     (pure)         drift/calibration · assessment scoring   (deterministic)     │
├──────────────────────────────────────────────────────────────────────────────┤
│ L2  EVENTS &       PlatformEvent + emit/process/drain (idempotent, replayable)  │
│     KNOWLEDGE      · KnowledgeItem (versioned, confidence, provenance)          │
├──────────────────────────────────────────────────────────────────────────────┤
│ L1  DATA           Prisma · SQLite (dev) / Postgres-Supabase (prod) ·           │
│                    Evidence WORM+hash-chain · MetricSample/Rollup · Consent      │
├──────────────────────────────────────────────────────────────────────────────┤
│ L0  OBSERVABILITY  metrics · structured PII-scrubbed logs · traces (AiRun.steps)│
│  & DR (cross-cut)  · drift/fairness monitors · backups/PITR · kill-switch       │
└──────────────────────────────────────────────────────────────────────────────┘
        SEMANTIC DIGITAL TWIN principle applies at every layer: events, not raw media.
```

### 30.2 Module map to EROS

| EROS module | This spec | Key models/files | Status |
|---|---|---|---|
| **M6 Interview Intelligence** | §24–30 (interview slice) | `Interview`, `InterviewParticipant`, `governance.ts`, `scorecard.ts`, `roomCode` WebRTC | Core live; scorecards/governance shipped |
| **M7 Assessment & Proctoring** | §24–30 (proctoring slice) | `Test`/`TestAttempt`/`Question`/`Answer`, `ProctorSession`/`ProctorEvent`, `ConsentRecord` | Phase 1 buildable now |
| M8 Offers (context) | — | `Offer`/`OfferEvent` | Shipped (EROS M8) |
| Matching/intel (context) | — | ICAE, EIDP | Shipped |
| AIOS (substrate) | L4/L5 | `execute`, `AiRun`, `PlatformEvent`, registry | Shipped |

### 30.3 Governance spine (the non-negotiables, enforced in code)

```
CONSENT  ──► CAPABILITY AUTHZ ──► SAFE-EVOLUTION ──► PROVIDER ──► AUDIT ──► HUMAN
(fail-      (never role)          (forbidden-auto    (in-house    (AiRun:    REVIEW
 closed)                           kill-switch)       default)     conf+expl) + APPEAL
   │             │                     │                 │            │          │
   └─ no capture └─ least privilege    └─ nothing        └─ no hard   └─ every   └─ candidate
      w/o granted    per capability       adverse runs      external     decision    contests;
      consent                             automatically     dependency   traceable   overturns
                                                                                      calibrate
```

Invariants (each has a blocking test, §26):
1. No AI decision without an `AiRun` (no silent path).
2. No adverse candidate outcome without a human disposition.
3. No capture without granted, unexpired, region-appropriate consent (fail-closed).
4. No protected attribute as a model input — ever; used only in the segregated fairness store.
5. No inferred trait as a hiring score; proctoring reports observable events only.
6. Every AI output carries confidence + evidence; candidate can appeal.
7. In-house deterministic path passes all tests with every optional provider disabled.
8. Fairness trip freezes the affected scoring capability (hard SLO).

### 30.4 Canonical event schema (TS)

```ts
// lib/proctor/types.ts — semantic, minimized, evidence-not-verdict
export type ProctorEventKind =
  | "FACE_ABSENT" | "FACE_MULTIPLE" | "TAB_BLUR" | "FULLSCREEN_EXIT"
  | "PASTE" | "COPY" | "DEVTOOLS_OPEN" | "NETWORK_DROP" | "MIC_2ND_VOICE"
export interface ProctorEvent {
  id: string; sessionId: string
  kind: ProctorEventKind
  severity: "info" | "notice" | "warn" | "critical"
  source: "browser" | "wasm-cv" | "server" | "human"
  confidence: number            // 0..1 — honesty requirement
  evidenceRef?: string          // hash/pointer to MINIMIZED artifact, never raw stream
  meta: Record<string, unknown> // PII-minimized
  tsClient: string; tsServer: string
  prevHash?: string; hash: string        // tamper-evident chain
  disposition?: "benign"|"note"|"flag"|"escalate"|"dismissed"  // set by HUMAN
}
// Integrity summary is EVIDENCE, not a character/trust score:
export interface IntegritySummary {
  sessionId: string
  events: { kind: ProctorEventKind; count: number; maxSeverity: string }[]
  timeline: { ts: string; kind: ProctorEventKind }[]
  reviewerRequired: boolean
  // deliberately NO "trustScore" / "confidenceScore" / trait fields
}
```

### 30.5 Definition-of-Done / production-readiness checklist

**Functional**
- [ ] Consent flow region-aware; capture fail-closed; revocation immediate.
- [ ] Browser signals → semantic `ProctorEvent`s (debounced, buffered/offline-safe).
- [ ] Reviewer console with mandatory human disposition; governance redaction honored.
- [ ] Scorecards + bias signals; candidate appeal path (< 72h ack).

**AI governance**
- [ ] Every decision → `AiRun` (confidence + explanation + steps).
- [ ] No adverse action without human disposition (enforced by `forbidden-auto`).
- [ ] No pseudoscientific trait scoring; proctoring = observable events only.
- [ ] Kill-switch (per-capability + global freeze) tested.

**Privacy & law**
- [ ] DPIA completed; EU AI Act high-risk conformity docs; NYC LL144 / Illinois AIVIA/BIPA handling where applicable.
- [ ] Data minimization (semantic events, minimized artifacts, no raw stream storage).
- [ ] Retention limits + destruction jobs; region residency; RoPA current.

**Fairness**
- [ ] Pre-ship fairness gate (AIR ≥ 0.8, equalized-odds, per-group ECE, flag-rate parity) green.
- [ ] Production fairness monitors live; trip → freeze (hard SLO).
- [ ] Disability accommodations suppress relevant flags; zero disparate flagging test green.

**Quality & resilience**
- [ ] Pure-engine unit coverage 100% of decision branches; determinism gate green.
- [ ] Integration: authz deny, fail-closed, idempotent handlers proven.
- [ ] Red-team catalog (spoofing/cheating/evasion) in CI; declared limitations documented (e.g. second-device).
- [ ] Load/spike/soak/chaos within SLOs; WCAG 2.2 AA + device/browser matrix.

**Observability & DR**
- [ ] RED/USE + model/fairness metrics; SLOs + error budgets; symptom-based alerts w/ owners.
- [ ] Drift/data-quality/calibration monitors running (crons).
- [ ] Evidence WORM + hash-chain + verified restore rehearsal; RPO/RTO per data class met.
- [ ] Incident runbooks (RB-01…RB-09) rehearsed; GDPR-72h timer wired.

**Deployability**
- [ ] Phase-1 slice deploys on Vercel push; SQLite(dev)/Postgres(prod) parity verified.
- [ ] In-house path passes all tests with every optional (WASM/external/GPU) provider disabled — proving no hard dependency.

**Sign-off (council):** Platform/SRE, Privacy Engineer, AI Safety Researcher, Assessment Scientist, Accessibility Lead, and DPO must each sign; any unresolved fairness/appeal SLO breach or missing `AiRun` linkage is a **release blocker**, not a known issue.
