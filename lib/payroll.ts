// Payroll computation engine — in-house, no third-party payroll library.
//
// SCOPE, STATED PLAINLY: this computes pay from a structure the employer defines.
// It is NOT a statutory-compliance engine. It does not know your jurisdiction's
// current PF/ESI/TDS/social-security rates, slabs, caps or exemptions, and it does
// not file anything. Every rate here comes from the employer's own configuration.
// Have finance or a chartered accountant verify a structure before paying anyone
// from it. Getting payroll wrong costs people their salary and you your licence —
// so the engine is deliberately explicit rather than clever.

export type ComponentKind = "earning" | "deduction"
export type ComponentCalc = "fixed" | "pct_basic" | "pct_ctc"

export type PayComponent = {
  name: string
  kind: ComponentKind
  calc: ComponentCalc
  value: number        // fixed → amount per month; pct_* → percentage (e.g. 12 = 12%)
  statutory?: boolean  // employer's own labelling; carries no legal meaning here
  cap?: number         // optional monthly ceiling on the computed amount
}

export type PayslipLine = { name: string; kind: ComponentKind; amount: number }

export type ComputedPayslip = {
  currency: string
  gross: number
  deductions: number
  net: number
  lines: PayslipLine[]
  paidDays: number
  lopDays: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function parseComponents(json: string | null | undefined): PayComponent[] {
  if (!json) return []
  try {
    const v = JSON.parse(json)
    if (!Array.isArray(v)) return []
    return v.filter((c) => c && typeof c.name === "string" && (c.kind === "earning" || c.kind === "deduction"))
  } catch { return [] }
}

// A conventional Indian private-sector shape, offered as a STARTING POINT to edit.
// The percentages are the common convention, not a statement of current law.
export const TEMPLATE_IN: PayComponent[] = [
  { name: "Basic", kind: "earning", calc: "pct_ctc", value: 40 },
  { name: "House Rent Allowance", kind: "earning", calc: "pct_basic", value: 50 },
  { name: "Special Allowance", kind: "earning", calc: "pct_ctc", value: 25 },
  { name: "Provident Fund (employee)", kind: "deduction", calc: "pct_basic", value: 12, statutory: true, cap: 1800 },
  { name: "Professional Tax", kind: "deduction", calc: "fixed", value: 200, statutory: true },
]

// A flat structure for salaried markets that do not use an allowance stack.
export const TEMPLATE_FLAT: PayComponent[] = [
  { name: "Base Salary", kind: "earning", calc: "pct_ctc", value: 100 },
]

/**
 * Compute one payslip.
 *
 * Order matters: percent-of-CTC components resolve first so that Basic exists
 * before anything expressed as a percentage of Basic is evaluated. Loss of pay
 * prorates EARNINGS only — deductions such as professional tax are not reduced
 * by absence unless the employer models them that way.
 */
export function computePayslip(opts: {
  annualCTC: number
  currency: string
  components: PayComponent[]
  workingDays?: number
  lopDays?: number
}): ComputedPayslip {
  const workingDays = opts.workingDays && opts.workingDays > 0 ? opts.workingDays : 30
  const lopDays = Math.max(0, Math.min(opts.lopDays || 0, workingDays))
  const paidDays = round2(workingDays - lopDays)
  const factor = workingDays > 0 ? paidDays / workingDays : 1

  const monthlyCTC = opts.annualCTC > 0 ? opts.annualCTC / 12 : 0

  // pass 1 — resolve Basic (and any other percent-of-CTC earning)
  const basic = opts.components
    .filter((c) => c.kind === "earning" && c.calc === "pct_ctc" && /basic/i.test(c.name))
    .reduce((sum, c) => sum + (monthlyCTC * c.value) / 100, 0)

  const amountOf = (c: PayComponent): number => {
    let a = 0
    if (c.calc === "fixed") a = c.value
    else if (c.calc === "pct_ctc") a = (monthlyCTC * c.value) / 100
    else if (c.calc === "pct_basic") a = (basic * c.value) / 100
    if (typeof c.cap === "number" && c.cap >= 0) a = Math.min(a, c.cap)
    return a
  }

  const lines: PayslipLine[] = []
  let gross = 0, deductions = 0

  for (const c of opts.components) {
    let amount = amountOf(c)
    if (c.kind === "earning") amount = amount * factor // absence reduces earnings only
    amount = round2(amount)
    if (amount === 0 && c.calc === "fixed" && c.value === 0) continue
    lines.push({ name: c.name, kind: c.kind, amount })
    if (c.kind === "earning") gross += amount
    else deductions += amount
  }

  gross = round2(gross)
  deductions = round2(deductions)
  // Never hand someone a negative payslip — surface it as zero net and let the
  // employer see the breakdown rather than silently inventing a number.
  const net = round2(Math.max(0, gross - deductions))

  return { currency: opts.currency, gross, deductions, net, lines, paidDays, lopDays }
}

// Sanity check a structure before it is saved. Returns human-readable problems.
export function validateStructure(annualCTC: number, components: PayComponent[]): string[] {
  const errs: string[] = []
  if (!(annualCTC > 0)) errs.push("Annual CTC must be greater than zero.")
  if (!components.length) errs.push("Add at least one earning component.")
  if (!components.some((c) => c.kind === "earning")) errs.push("A structure needs at least one earning.")
  const pctCtc = components.filter((c) => c.kind === "earning" && c.calc === "pct_ctc").reduce((s, c) => s + c.value, 0)
  if (pctCtc > 100) errs.push(`Percent-of-CTC earnings total ${pctCtc}%, which exceeds 100% of CTC.`)
  for (const c of components) {
    if (!c.name?.trim()) errs.push("Every component needs a name.")
    if (typeof c.value !== "number" || isNaN(c.value) || c.value < 0) errs.push(`"${c.name}" needs a value of zero or more.`)
    if (c.calc !== "fixed" && c.value > 100) errs.push(`"${c.name}" is a percentage but is set to ${c.value}%.`)
  }
  if (components.some((c) => c.calc === "pct_basic") && !components.some((c) => /basic/i.test(c.name) && c.calc === "pct_ctc")) {
    errs.push("A component is a percentage of Basic, but no percent-of-CTC 'Basic' earning is defined — it would compute as zero.")
  }
  return errs
}

export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
export const periodLabel = (y: number, m: number) => `${MONTHS[m - 1] || "?"} ${y}`
