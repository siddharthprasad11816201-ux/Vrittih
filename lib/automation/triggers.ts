/* Phase 13 — Automation triggers. ONLY real platform events that the app actually
 * emit()s onto the AIOS event bus (lib/aios/events.ts). Each lists the payload
 * fields a condition can test + a sample used by the rule tester. */
export type TriggerField = { key: string; label: string }
export type Trigger = { key: string; label: string; fields: TriggerField[]; sample: any }

export const TRIGGERS: Trigger[] = [
  {
    key: "application.status_changed",
    label: "Application status changed",
    fields: [
      { key: "status", label: "New status" },
      { key: "jobTitle", label: "Job title" },
      { key: "jobId", label: "Job id" },
    ],
    sample: { applicationId: "app_demo", jobId: "job_demo", jobTitle: "Backend Engineer", status: "SHORTLISTED", applicant: { name: "Asha Rao" } },
  },
  {
    key: "job.created",
    label: "Job posted",
    fields: [
      { key: "title", label: "Title" },
      { key: "industry", label: "Industry" },
      { key: "type", label: "Employment type" },
      { key: "remote", label: "Remote (true/false)" },
    ],
    sample: { jobId: "job_demo", title: "Backend Engineer", industry: "Technology", type: "FULLTIME", remote: true },
  },
  {
    key: "ai.executed",
    label: "AI capability executed",
    fields: [
      { key: "capId", label: "Capability id" },
      { key: "status", label: "Status" },
    ],
    sample: { capId: "intelligence.deliberate", status: "ok" },
  },
]

export const TRIGGER_KEYS = new Set(TRIGGERS.map(t => t.key))
export const triggerByKey = (k: string) => TRIGGERS.find(t => t.key === k) || null
