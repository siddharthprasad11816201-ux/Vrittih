# Phase 6 — Enterprise ERP (Finance) — Completion Report

**Status: GO (local).** Built fully in-house. No third-party accounting/ERP libraries;
deterministic, **FX-safe** rollups in `lib/erp/finance.ts` (pure, unit-tested). Local-first:
verified on this laptop, not yet deployed.

## Scope delivered
- **Invoices** — `DRAFT → SENT → PAID → OVERDUE → VOID`; client, amount, currency, due date; auto number if blank.
- **Expenses** — `SUBMITTED → APPROVED → REJECTED → REIMBURSED`; category, description, amount, currency.
- **Budgets** — per category + period; **utilisation** vs approved/reimbursed spend (CHF-only band; over-budget flagged).
- **Vendors + Purchase Orders** — vendor directory; POs (`DRAFT → OPEN → RECEIVED → CLOSED → CANCELLED`) optionally linked to a vendor.
- **Financial summary** — per-currency rollup: revenue (PAID), outstanding (SENT+OVERDUE), expenses (APPROVED+REIMBURSED), net.

## FX-safety (hard constraint honoured)
Figures are **grouped by currency and never summed across currencies.** CHF, EUR, etc. each get
their own rollup card; there is no "MIXED"/merged total. Conversion to a single number remains an
explicit, separate step (via `lib/fx`). Verified by test: EUR stays separate from CHF, no merge.

## Surfaces
- API: `app/api/erp/finance/route.ts` (GET summary + invoices/expenses/vendors/pos/budgets/budgetUtil; POST create-invoice/expense/vendor/po/budget + set-status).
- UI: `app/finance/page.tsx` (per-currency rollup cards, tabs for Invoices / Expenses / Budgets / Vendors, inline status changes, budget utilisation bars). Nav: employer **Operations → Finance**.
- Lib: `lib/erp/finance.ts` — `financialSummary`, `budgetUtilization`, status vocabularies.

## Authorization & safety
- Every read/mutation scoped to `ownerId === caller`. Invalid status → 400; cross-user mutate → 404; unauthenticated → 401. All verified. Amounts clamped ≥ 0; currency normalised to a 3-char upper code.

## Verification
- Pure-lib unit tests: passed (financialSummary FX grouping, budgetUtilization).
- Local E2E (dev server): create invoice (CHF + EUR), expense, budget, vendor; set-status; summary reflects PAID revenue + APPROVED expenses; per-currency isolation; budget utilisation; validation + isolation guards — **all green** (part of the 37/37 Phase 5+6 run).
- `/finance` renders 200; `npm run build` compiled successfully (139 pages).

## Payroll note
Phase 4's `PayrollRun` / `Payslip` already provide the payroll side of ERP; this phase adds the
finance ledger (AR/AP, budgets, procurement) on top.
