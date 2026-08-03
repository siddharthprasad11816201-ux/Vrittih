# Enterprise Design System

> **Governing blueprint — the single visual and interaction foundation for every Vrittih module.**
> No future feature may create its own UI foundations. Every screen is built from this system.
> Never overwrite — always extend. Source of truth: this document + `styles/vrittih.css`.
>
> Status: v0.1 · authored 2026-08-03 (grounded in the live repository inventory).

## 1. Architecture & Principles

Vrittih's UI is a strict four-layer stack. Each layer may consume only the layer beneath it, never reach sideways or upward. Today the stack is real at the top and bottom but hollow in the middle: **Layer 0 (tokens) and Layer 3 (layouts) exist and are strong; Layer 1 (primitives) is missing, so Layer 2 (patterns) reaches straight down to raw values.** That single gap is the root cause of every duplication in the inventory — ~15 re-declared card surfaces, ~6 copies of the status-colour hex maps, ~5 button variants. Fixing the architecture *is* building Layer 1 and enforcing the dependency rule.

### 1.1 The four layers

| Layer | Owns | Lives in | Consumes | Status today |
|---|---|---|---|---|
| **0 — Tokens** | colour, type, space, radius, elevation, motion primitives | `styles/vrittih.css` (`:root`) | nothing (root) | **Exists, canonical** — but self-duplicated (see §1.2) |
| **1 — Primitives** | `Button`, `Card`, `Field`/`Input`, `Badge`/`Chip`, `Meter`/`Bar`, `Table`, `Modal`, `Tabs`, `EmptyState` | `components/ui/*` | Layer 0 tokens **only** | **Largely absent** — `ui/` holds only `Icons`, `DuotoneIcons`, `NotificationBell`, `QRCode` |
| **2 — Patterns** | domain compositions: career panels, astro cards, pipeline dataviz, upgrade gate | `components/vrittih/*`, `components/career/*`, `components/developers/*` | Layers 1 + 0 | **Exists but skips Layer 1** — each re-inlines a local `const S` with raw hex |
| **3 — Layouts** | page chrome, nav, routing surfaces | `components/vrittih/AppShell.tsx` (canonical) | Layers 2 + 1 + 0 | **Exists** — one canonical shell + three legacy nav surfaces |

**The dependency rule (non-negotiable):** a component may reference tokens and any lower layer, and nothing else. A pattern (Layer 2) must not contain a literal `#E5E7EB` or a bespoke `padding:...;border:1px solid...` card recipe — it must render `<Card>`. A primitive (Layer 1) must not import a domain concept. A layout (Layer 3) must not hand-roll a chip. Violations are mechanically detectable: a raw `#hex` outside `styles/vrittih.css`, `components/vrittih/Logo.tsx`, `IllustrationSlot.tsx`, and data-driven charts (`PipelineDonut`/`PipelineRail`) is a lint failure.

### 1.2 Layer 0 — Tokens, and the two-scale ruling

`styles/vrittih.css` is the declared "single source of truth," and it is — but it currently ships **two competing scales for the same decisions**, a legacy set and a redesign set:

| Decision | Legacy scale | Redesign scale | **Ruling** |
|---|---|---|---|
| Radius | `--v-r 12` / `--v-r-sm 10` / `--v-r-lg 16` | `--r-sm 6` / `--r-md 8` / `--r-lg 12` | **Redesign wins.** `AppShell` already builds entirely on `--r-md`/`--r-lg`/`--r-pill`. Alias `--v-r*` → `--r-*` for one release, then delete. |
| Hairline | `--v-line` / `--v-line-2` | `--border` / `--border-strong` | **Redesign wins.** `AppShell` uses `--border` everywhere. Retire `--v-line*` (keep only where dark-mode flips are already wired, then migrate). |
| Pill | `--v-r-pill` | `--r-pill` | Collapse to one `--r-pill 999px`. |
| Spacing | ad-hoc px in `const S` | `--sp-1…16` (4px base) | **`--sp-*` is the only sanctioned scale.** Inline `padding: 24px` becomes `var(--sp-6)`. |
| De-emphasis | `opacity` | colour steps `--v-ink` → `-2` → `-3` → `--ink-disabled` | **Colour, never opacity** (per the redesign brief comment in-file). Four ink steps exist; use them. |

The canonical shell has already voted with its code — every author should read `AppShell.tsx`'s `const S` as the reference for *which* token generation is current. The elevation (`--v-shadow*`, indigo-tinted), motion (`--v-ease`, `--v-spring`), fluid type (`--fs-*`), and dark-mode flip (`:root[data-theme="dark"]` + `prefers-color-scheme` + `.v-dark`) are already single-sourced and need no reconciliation — they are the model the radius/hairline scales should match.

### 1.3 Layer 1 — Primitives (the tier to build)

This is the missing layer and the highest-leverage work. Each primitive is a thin, token-only React component in `components/ui/`. The mandated initial set, sized directly from the duplication the inventory found:

| Primitive | Replaces (real duplication) | Token contract |
|---|---|---|
| `Card` | ~15 inline `surface + border + radius + shadow` blocks across `career/*`, `developers/*`, `AstroCard` | `--v-surface`, `--border`, `--r-lg`, `--v-shadow` |
| `Button` (`variant=primary/ghost/danger`) | ~5 CTA variants (`#6495ED` vs `var(--brand-600)` vs `var(--v-accent)` vs module `btnPrimary`) | `--v-accent` + `--v-accent-ink`; ghost = `--border` |
| `Field`/`Input` | ~5 form-field re-declarations across all `developers/*` + `DocumentUpload` | `--border` idle → `--v-accent` focus ring |
| `Badge`/`Chip` + `Meter`/`Bar` | `tierColor`/`diffColor`/`scoreTone`/`diffTone` hex maps re-declared per career panel | **`--v-green`/`--v-amber`/`--v-red`/`--v-blue`/`--v-accent` only** — kill the private hex maps |
| `Table` | list/table markup currently living in `app/*` route files, not components | `--border`, `--v-surface-2` header, `data-table-wrap` scroll (see §2.7) |
| `EmptyState` (promote existing) | `vrittih/EmptyState.tsx` is the DS empty-state but is raw-hex throughout | tokenize in place, then it *is* the primitive |

Contract for every primitive: (1) zero raw hex — tokens only; (2) `forwardRef` + full native prop spread; (3) theme-agnostic (works because tokens flip, not because it branches on theme); (4) a `data-*` escape hatch, never a `style` override for one-offs.

### 1.4 Layer 3 — Layouts, and the one canonical shell

There are **four nav surfaces**; exactly one is canonical.

| Surface | Verdict |
|---|---|
| `components/vrittih/AppShell.tsx` | **Canonical.** 216px island sidebar + sticky topbar + mobile drawer + bottom tab bar + `CommandPalette` + Coach dock. 100% tokens, `buildNav(caps)`. |
| `components/admin/AdminShell.tsx` | **Refactor.** Raw-hex, off-token, active state uses pre-rebrand teal-green `rgba(15,110,86,.2)`/`#9FD4C3`. Rebuild on `AppShell` primitives. |
| `components/crm/CrmShell.tsx` | **Delete.** 8-line wrapper that just renders `AppShell` — inline `AppShell` at the call site. |
| `components/layout/Navbar.tsx` (+ `styles/navbar.module.css`) | **Legacy.** Off-brand `#0F0A1E`, legacy green `#9FD4C3`, own `btnPrimary`. Marketing-only; migrate to tokens or retire. |

The three **legacy teal-green survivors** from before the cornflower rebrand — `AdminShell` active state, `NotificationBell` unread bg, `navbar.module.css` wordmark/mobile links (`#0F6E56`/`#9FD4C3`/`rgba(15,110,86,*)`) — are flagged for removal on sight; they are not a supported accent.

### 1.5 Governance — "No module invents UI"

The one rule that keeps the stack from re-hollowing:

> A route or module may **compose** primitives and patterns and **place** them with `--sp-*`. It may **not** invent a surface, chip, bar, button, field, or colour. If a screen needs a UI element that does not exist as a primitive, the fix is to add the primitive to Layer 1 — not to grow the screen's local `const S`.

Concretely this forbids the three habits the inventory documents: (a) re-declaring `card`/`section` per file; (b) private `tierColor`/`scoreTone` hex maps that shadow the semantic tokens; (c) a fifth spelling of the primary button. The enforcement gate is cheap and should be CI, not review discretion: fail the build on any `#[0-9a-fA-F]{3,8}` or bare `rgba(` in `app/**`, `components/career/**`, `components/developers/**`, and `components/vrittih/**` except the allow-list in §1.1 (logo/illustration/data-driven charts). Tokens make the rule enforceable; the rule makes the tokens worth having.

### 1.6 Composition with the capability framework

The design system is deliberately **capability-blind at Layers 0–1.** Tokens and primitives never read `caps`, never branch on plan or role. This is what keeps them universal — a `Button` looks identical whether the viewer can `jobs.post` or not.

Capability awareness enters **only at Layers 2–3**, and only to decide *presence*, never *appearance*:

| Where | How it reads capability | What it decides |
|---|---|---|
| `AppShell.buildNav(caps)` | `caps.has("jobs.post")`, `can("hrms.view")`, `caps.has("admin.access")` | which nav sections/rows exist |
| `AppShell.bottomTabs(caps)` | `caps.has("network.access")` | Network vs Matched tab |
| `CommandPalette` props | `canCrm`, `canMail`, `canInterviews`, `canApi` | which actions are searchable |
| `FeatureGate` (pattern) | `hasFeature(user, feature)` via `lib/entitlements` | render children **or** an upgrade screen built from the same primitives |

Capabilities themselves are **role-FREE and evidence-derived** — `lib/capability/catalog.ts` defines units like `jobs.post`, `career.intelligence`, `network.access`; `derive.ts`/`policy.ts`/`context.ts` compute which a subject holds, surfaced to the client via `/api/me/capabilities` (fetched in `AppShell`'s effect). The design principle that falls out: **capabilities choose what renders; the design system chooses how anything renders, and the two never leak into each other.** Even a denial is on-system — `FeatureGate`'s upgrade screen uses `--v-accent-soft`/`--v-accent` and the standard shell, so a gated user sees a first-class page, never a blank or a bespoke wall.

---

## 2. Interaction, Motion, Accessibility & Responsive standards

Every standard below is anchored to WCAG 2.2 AA and to what is already in `styles/vrittih.css`, `styles/mobile.css`, and `AppShell.tsx`. Where the live code falls short of the standard, that is called out as a defect to close, not glossed.

### 2.1 Contrast — WCAG AA is a token guarantee, not a per-screen chore

Because de-emphasis is done with **ink steps, never opacity**, contrast can be guaranteed once, in tokens, and inherited everywhere:

| Pair | Ratio intent |
|---|---|
| `--v-ink` `#1F2937` on `--v-surface` `#FFFFFF` | body text, ≥ 7:1 (AAA headroom) |
| `--v-ink-2` `#64748B` on surface | secondary, ≥ 4.5:1 (AA) |
| `--v-ink-3` `#94A3B8` on surface | meta/labels — **AA-borderline; never load-bearing text** |
| `--ink-disabled` `#B4BCC7` | disabled only, exempt from AA by spec |
| white on `--v-accent` `#4F63D2` | **AA-fixed** — the file comment records the old `#6495ED` failed at ~2.6:1, which is why the accent was deepened |

Rules: (1) never restore `#6495ED` as a text/fill colour on white — it is the *brand ramp* value, not the *accent* value; use `--v-accent` for anything text- or icon-bearing. (2) `--v-ink-3` is for labels and placeholders, never sentences. (3) Semantic colour is **status only, never decoration** — a green chip means "good," not "pretty."

### 2.2 Keyboard

| Interaction | Status | Standard |
|---|---|---|
| ⌘K / Ctrl+K command palette | **Shipped** (`window` event `vrittih:open-command`, `CommandPalette`) | primary keyboard entry point |
| `Escape` closes drawer | **Shipped** (`AppShell` `keydown` listener) | Escape must close every dismissible overlay (drawer, modal, palette, dropdown) |
| Nav is real `<Link>`/`<button>` | **Shipped** — natural tab order, Enter/Space activate | no `<div onClick>` for interactive elements |
| **Skip-to-content link** | **Missing** — add | first focusable element jumps focus to `<main>`; required for a persistent 216px sidebar |
| Focus trap in drawer/modal | **Partial** — add | while `drawerOpen`/modal open, Tab must cycle within it and restore focus to the trigger on close |

### 2.3 Focus

One focus ring, defined once, applied app-wide:

- `.v-app :focus-visible { box-shadow: 0 0 0 3px rgba(100,149,237,.35); border-radius: 6px; }`
- Form controls: `input/textarea/select:focus { border-color:#6495ED; box-shadow: 0 0 0 3px rgba(100,149,237,.25); }`

Standards: `:focus-visible` (not `:focus`) so mouse clicks don't ring, but keyboard always does. **Never `outline:none` without a replacement** — the reset does, but only because it immediately supplies the box-shadow ring. The 3px ring must clear the element on all sides (no `overflow:hidden` clipping it). One cleanup: the two focus colours are literal `rgba(100,149,237,*)` — promote to a `--focus-ring` token so dark mode (`--v-accent #8ECDF8`) can flip it for contrast.

### 2.4 ARIA

Patterns already in the codebase, promoted to standards:

| Pattern | Reference in code | Rule |
|---|---|---|
| `aria-current="page"` on active nav | `AppShell` `NavRow`, bottom tabs | every active nav item |
| `aria-label` on icon-only controls | menu, search, notifications, avatar chip in `AppShell` | any control whose only content is an icon |
| `aria-hidden` on decorative icons | `Icons.tsx` `base()` sets `"aria-hidden": true` | all glyphs are decorative by default; the label lives on the control |
| `role="button"` on link-buttons | targeted in `mobile.css` | anchors styled as buttons carry the role |
| **`aria-live`** for async status | `.v-live` class exists; no `aria-live` region yet | toasts, save/apply results, and `NotificationBell` updates announce via a polite live region |
| **`aria-expanded`/`aria-controls`** | **Missing** on drawer & palette triggers | wire the menu button ↔ drawer and search ↔ palette |

### 2.5 Touch targets

`styles/mobile.css` sets `button, a[role="button"] { min-height: 42px; }` at ≤640px, plus `input/select/textarea { font-size:16px }` (prevents iOS focus-zoom) and a `-webkit-tap-highlight-color`. **Standard: raise the floor to 44×44px** (WCAG 2.5.5 / HIG) — 42px is 2px short. The 34px nav rows and 36px topbar controls in `AppShell` are acceptable **only** on the desktop (fine-pointer) layout; the mobile drawer and 64px bottom tab bar already give coarse-pointer users ≥44px. Rule: any control that appears in a coarse-pointer viewport is ≥44px; spacing between adjacent targets ≥8px (`--sp-2`).

### 2.6 Motion — a state-mapped token set

`--v-ease`/`--v-spring` are the only motion **tokens**; durations are currently hard-coded literals scattered across files (`.18s` in `.v-neu`, `.24s` on `.ks-pill`/drawer, `1.4s` shimmer, `1.6s` `.v-pulse`). Standardize by adding a small duration set and mapping every state to a `(duration, easing)` pair:

| Token | Value | Status | Mapped state |
|---|---|---|---|
| `--v-ease` | `cubic-bezier(.22,1,.36,1)` | **exists** | default in/out — entrances, hovers, layout |
| `--v-spring` | `cubic-bezier(.34,1.56,.64,1)` | **exists** | expressive settle — active pill, toggles (`.v-neu`) |
| `--dur-fast` | `120ms` | **add** | hover, focus, colour/border change |
| `--dur-base` | `180–240ms` | **add** | press, drawer/panel open, active-pill slide |
| `--dur-slow` | `320ms` | **add** | full-screen/route transitions, modal enter |
| `--dur-loop` | `1.4–1.6s` | **add** | `.v-skeleton` shimmer, `.v-live` pulse |

State → motion mapping (the contract):

| State | Duration × easing | Property (compositor-only) |
|---|---|---|
| Hover | `--dur-fast` × `--v-ease` | `background`, `border-color` |
| Press / active | `--dur-base` × `--v-spring` | `transform`, active-pill `left` (`.ks-pill`) |
| Enter (card/list) | `--dur-base` × `--v-ease` | `v-rise` keyframe (`opacity`+`translateY`) |
| Overlay open (drawer) | `--dur-base` × `cubic-bezier(.4,0,.2,1)` | `transform: translateX` (already in `AppShell`) |
| Loading | `--dur-loop` linear | `v-shimmer` (`.v-skeleton`) |
| Live/pending | `--dur-loop` × `--v-ease` | `v-pulse` (`.v-live`) |

Rules: animate `transform`/`opacity` only (never `width`/`top`/`left` on hot paths — the bottom-tab pill's `left` transition is the one sanctioned exception because it moves a small element). Motion is confirmation, never decoration. **Depth jurisdiction holds:** `.v-glass` = floating chrome, `.v-neu` = tactile controls (always bordered), 3D = one landing hero — motion follows the same jurisdiction.

### 2.7 Reduced motion

Two guards already exist and both must be preserved: the scoped one in `vrittih.css` (`.v-app *` → `.01ms`, `.v-live { animation:none }`) and the global one in `mobile.css` (`* → .001ms`), plus `AppShell`'s `ksCss` killing `.ks-pill`/`.ks-drawer` transitions. Standard: **no new animation may ship without honouring `prefers-reduced-motion: reduce`.** Because the global guards clamp *durations*, any motion built on `transition`/`animation` is covered automatically — motion built with `requestAnimationFrame` or JS springs is **not**, and must check the media query itself.

### 2.8 Responsive — canonical breakpoints vs. the live drift

Adopt this seven-stop set as the **only** sanctioned breakpoints, and reconcile the code to it:

| Stop | Target | Layout intent |
|---|---|---|
| **360** | small Android | single column; drop page title (`≤380` today) |
| **390** | iPhone 12–15 baseline | phone defaults: 15px body, 16px inputs, ≥44px targets |
| **414** | large phones | same phone rules, roomier padding |
| **768** | tablet portrait | sidebar → drawer; grids stack to 1 col |
| **1024** | tablet landscape / small laptop | island sidebar returns; 2-col content |
| **1280** | desktop | full canonical `AppShell` (216px island + content) |
| **1600** | wide desktop | max content width caps; no full-bleed stretch |

**Live drift to fix:** the running code uses an ad-hoc set — `AppShell` swaps to mobile at `matchMedia("(max-width: 860px)")`, `mobile.css` acts at `900`/`640`/`380`, `.rl-2col` at `860`, and `navbar.module.css` at `1024`/`768`. These `860`/`900`/`640`/`380` stops should collapse onto `768`/`390`/`360` so the shell's JS breakpoint and the CSS breakpoints agree (today the shell flips at 860 but the CSS content rules flip at 900 — a 40px band where the layout is half-transformed).

Layout rules that are already correct and are now standard: (1) **the page never scrolls sideways** (`html,body { overflow-x:hidden }`); wide content scrolls inside its own `data-table-wrap` container, not the page. (2) **Grids collapse to one column** at tablet-and-below via the `[style*="grid-template-columns"]` override — *except* real tables (`data-table`, which scroll) and opted-out rows (`data-keep-cols`). (3) **Long unbroken tokens** (URLs, IDs) wrap with `overflow-wrap:anywhere` on content text only. (4) The topbar **stays one row and shrinks** — search collapses to its icon rather than wrapping the avatar (the documented regression `mobile.css` exists to prevent). Fluid type (`--fs-*`, all `clamp()`) means most text needs no per-breakpoint rule at all — reach for a breakpoint only to change *layout*, not to resize type.


## 3. Design Tokens

The token layer is the single most-referenced artifact in the system and, today, its biggest source of drift. There is **one canonical file** — `styles/vrittih.css` (`:root`, 89 lines of tokens) — but it competes with a legacy `:root` in `styles/globals.css` and carries two internally-overlapping scales. This section documents every token as it exists, names the collisions, then specifies the complete target set (adding the families that are currently missing entirely: z-index, breakpoints, opacity/scrim, motion duration, and a tokenized focus ring).

### 3.1 Token architecture & cascade

Tokens are declared as CSS custom properties and resolved at four scopes. Load order is fixed in `app/layout.tsx` (lines 3–6):

```
globals.css   →   vrittih.css   →   mobile.css
(legacy :root)    (canonical)       (!important mobile wins)
```

| Scope | Selector | Purpose |
| --- | --- | --- |
| Light (default) | `:root` in `vrittih.css` | Base token values |
| Explicit dark | `:root[data-theme="dark"], .v-dark` | User-toggled dark; flips surfaces/ink/lines/accent/border |
| Auto dark | `@media (prefers-color-scheme: dark)` → `:root:not([data-theme="light"])` | OS preference, overridable by explicit `light` |
| App reset | `.v-app` | Applies `--font-sans` + `--v-ink`; scopes `::selection` and `:focus-visible` |

Fonts are wired via `next/font` in `app/layout.tsx`: **Inter** (`--font-inter`, weights 400/500/600/700, self-hosted) and **Bricolage Grotesque** (`--font-bricolage`, weights 400/500) — both attached as class variables on `<html>` (line 56). `--font-display` and `--font-sans` reference these with system fallbacks.

> **Cascade hazard (real):** both files define `--border`. `globals.css` sets `--border: rgba(0,0,0,0.07)`; `vrittih.css` sets `--border: #E6E8EC`. The intended value wins **only** because `vrittih.css` is imported after `globals.css` at equal specificity. Any reorder of the two imports silently changes every hairline in the app. This must be resolved by retiring the legacy namespace (§3.3), not by relying on import order.

### 3.2 Current tokens — full audit (`styles/vrittih.css`)

**Brand ramp** — cornflower → indigo identity (line 10–19). Fixed values (do not flip in dark; used for marks, tints, gradients):

| Token | Value | Usage |
| --- | --- | --- |
| `--brand-900` | `#0B1126` | Deep slate — dark slabs, `::selection` text |
| `--brand-700` | `#334EAC` | Indigo — secondary / gradient end |
| `--brand-600` | `#6495ED` | Cornflower — primary/active in legacy surfaces |
| `--brand-400` | `#4F86E8` | Hover, focus ring source |
| `--brand-200` | `#A9C6F6` | — |
| `--brand-100` | `#EAF1FE` | Tints, selected rows, badges, skeleton mid-stop |
| `--cyan` | `#8ECDF8` | Highlights, live, **dark-mode accent** |
| `--cream-0` | `#F7F9FC` | Page canvas alias |
| `--gold` | `#C8A24B` | **RESERVED** — Verified badge only (`.v-gold`) |

**Surfaces, ink, lines** — the theme-flipping core:

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `--v-bg` | `#F7F9FC` | `#0A0F1F` | Page background |
| `--v-surface` | `#FFFFFF` | `#0C1330` | Cards, panels |
| `--v-surface-2` | `#F1F5F9` | `#111A3A` | Inset / muted fills, skeleton base |
| `--v-sidebar` | `#FFFFFF` | `#0A0F1F` | AppShell rail |
| `--v-topbar` | `rgba(255,255,255,.82)` | `rgba(10,15,31,.72)` | Glass topbar base |
| `--v-ink` | `#1F2937` | `#FFFFFF` | Primary text |
| `--v-ink-2` | `#64748B` | `rgba(255,255,255,.66)` | Secondary text |
| `--v-ink-3` | `#94A3B8` | `rgba(255,255,255,.5)` | Tertiary / captions |
| `--ink-disabled` | `#B4BCC7` | `rgba(255,255,255,.34)` | 4th text step (de-emphasis via colour, never opacity) |
| `--v-line` | `#E5E7EB` | `rgba(255,255,255,.12)` | Hairline (legacy scale) |
| `--v-line-2` | `#E9EDF2` | `rgba(255,255,255,.16)` | Slightly stronger line (used by `.v-neu`) |
| `--border` | `#E6E8EC` | `rgba(255,255,255,.12)` | Default hairline (redesign scale) |
| `--border-strong` | `#D6DAE0` | `rgba(255,255,255,.20)` | Hover / emphasis border |

**Accent** — deepened for WCAG AA (line 37: old `#6495ED` failed at ~2.6:1 for text/white-on-fill):

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `--v-accent` | `#4F63D2` | `#8ECDF8` | Primary action, links, active |
| `--v-accent-2` | `#334EAC` | `#6495ED` | Accent deep / gradient end |
| `--v-accent-soft` | `#ECEFFC` | `rgba(100,149,237,.16)` | Accent tint bg |
| `--v-accent-ink` | `#FFFFFF` | `#FFFFFF` | Text on accent fill |

**Semantic status** — status only, never decoration (line 44):

| Token | Value (light) | Dark override | Usage |
| --- | --- | --- | --- |
| `--v-green` | `#22C55E` | — | Success |
| `--v-green-soft` | `#E7F8EE` | `rgba(34,197,94,.16)` | Success tint |
| `--v-amber` / `--warn` | `#B45309` | — | Warning (amber is AA-dark on tint) |
| `--v-blue` / `--info` | `#2E9BE0` | — | Info |
| `--v-red` / `--danger` | `#DC2626` | — | Error / destructive |
| `--v-chat-out` | `#EAF1FE` | — | Outgoing chat bubble |

**Radii, elevation, motion:**

| Token | Value | Usage |
| --- | --- | --- |
| `--v-r` / `--v-r-sm` / `--v-r-lg` | `12` / `10` / `16px` | Legacy radius scale |
| `--r-sm` / `--r-md` / `--r-lg` | `6` / `8` / `12px` | Redesign radius scale |
| `--v-r-pill` / `--r-pill` | `999px` / `999px` | **Duplicate** pill |
| `--v-shadow-sm` | `0 1px 2px rgba(16,24,40,.04)` | Resting card |
| `--v-shadow` | `…, 0 12px 28px -16px rgba(51,78,172,.18)` | Raised (indigo-tinted); dark → `0 12px 34px rgba(0,0,0,.5)` |
| `--v-shadow-lg` | `0 20px 44px -26px rgba(51,78,172,.28)` | Overlay / popover |
| `--v-ease` | `cubic-bezier(.22,1,.36,1)` | Standard ease-out |
| `--v-spring` | `cubic-bezier(.34,1.56,.64,1)` | Overshoot / spring |

Keyframes `v-rise` / `v-pulse` / `v-shimmer` / `vspin`; utilities `.v-skeleton`, `.v-live`; `prefers-reduced-motion` guard neutralizes all `.v-app` animation to `.01ms`. **Durations are hardcoded** (`.18s`, `1.4s`, `1.6s`) — not tokens.

**Typography & spacing:**

| Token | Value | Usage |
| --- | --- | --- |
| `--font-display` | `var(--font-bricolage), …` | Every heading, app + marketing |
| `--font-sans` | `var(--font-inter), …` | Body / UI |
| `--font-mono` | `"JetBrains Mono", ui-monospace, …` | Code / keys |
| `--v-serif` / `--v-sans` | aliases → display / sans | Back-compat aliases |
| `--sp-1…16` | `4/8/12/16/24/32/48/64px` | 4px-base spacing scale |
| `--fs-display` | `clamp(2.5rem, 6vw + 1rem, 5.5rem)` | Hero |
| `--fs-h1` | `clamp(1.75rem, 3vw + .5rem, 2.75rem)` | Page title |
| `--fs-h2` | `clamp(1.25rem, 1.4vw + .55rem, 1.7rem)` | Section |
| `--fs-h3` | `clamp(1.05rem, .6vw + .5rem, 1.2rem)` | Subsection |
| `--fs-body` | `clamp(0.95rem, 0.9rem + 0.2vw, 1.05rem)` | Body |
| `--fs-sm` | `clamp(0.8rem, .78rem + .1vw, .875rem)` | Caption / meta |

### 3.3 Gaps, collisions & legacy namespaces (must-fix before adoption)

1. **Self-duplication inside the canonical file.** Two hairline scales (`--v-line`/`-2` vs `--border`/`-strong`), two radius scales (`--v-r*` 10/12/16 vs `--r-*` 6/8/12), and a duplicate pill (`--v-r-pill` == `--r-pill`). Authors cannot tell which to use, and `AstroCard` proves the confusion — it inlines literal radii `16/14/999` instead of either scale.
2. **Third, colliding namespace in `styles/globals.css`.** A separate `:root` (lines 3–18) defines `--ink #0A0A0F`, `--ink2/3`, `--surface/2/3`, `--accent #0F0A1E`, `--electric #6495ED`, **`--border rgba(0,0,0,0.07)`** (collides with `--border #E6E8EC`), and **`--radius 14` / `--radius-sm 8` / `--radius-pill 999`** (a *fourth* radius scale). `globals.css` also sets `body { font-family: -apple-system… }` — Inter only applies inside `.v-app`, so any surface outside the shell renders in the system font. `home.css` further consumes an undefined-in-scope `--paper`.
3. **No z-index scale.** Stacking is raw literals: `home.css` `z-index:50` (sticky) / `100` (skip-link); `navbar.module.css` `99`/`100`. Drawer, modal, command palette, AI dock, and toast have no shared ceiling — collisions are a matter of time.
4. **No breakpoint tokens.** Media queries use nine ad-hoc widths across module CSS — `380, 560, 640, 768, 820, 860, 900, 1000, 1024px`. No named scale; the odd values (820/860/900/1000) are one-offs.
5. **No motion-duration tokens** and **no tokenized focus ring.** Focus is defined twice with raw cornflower: `.v-app :focus-visible` → `0 0 0 3px rgba(100,149,237,.35)`; form controls → `border-color:#6495ED` + `0 0 0 3px rgba(100,149,237,.25)`. Both use the **pre-AA** cornflower `#6495ED`, not `--v-accent`.
6. **No opacity scale** and **no high-contrast / `forced-colors` handling.**
7. **Raw-hex debt in pages:** ~**1,312 six-digit hex literals across 75 `app/**/*.tsx` files** (e.g. `mail/page.tsx` 39, `account/page.tsx` 61, `settings/page.tsx` 43) — tokens stop at the component boundary. Legacy teal-green survivors from the pre-cornflower rebrand persist in `AdminShell`, `NotificationBell`, `navbar.module.css` (`#0F6E56`/`#9FD4C3`/`rgba(15,110,86,*)`).

### 3.4 Target token set (prescriptive)

**Decisions (pick-one, retire the rest):** keep the **redesign scales** — radius `--r-sm/md/lg` (6/8/12) and hairline `--border`/`--border-strong`; **alias** `--v-r* → --r*` and `--v-line* → --border*` for one release, then delete. Retire the entire `globals.css` `:root` and `home.css` `--ink/--paper`; migrate marketing pages onto `--v-*`. One pill: `--r-pill`. Text de-emphasis stays **colour-based** (`--v-ink-2/-3`, `--ink-disabled`) — no text-opacity tokens.

**Color** — as documented in §3.2 (brand ramp fixed; surfaces/ink/lines/accent/status flip per the light/dark columns). Additions:

| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `--v-scrim` | `rgba(11,17,38,.48)` | `rgba(0,0,0,.62)` | Modal/drawer backdrop |
| `--v-selection` | `var(--brand-100)` | `rgba(100,149,237,.28)` | `::selection` bg |
| `--v-focus` | `rgba(79,99,210,.40)` | `rgba(142,205,248,.50)` | **Tokenized** focus ring (replaces raw `rgba(100,149,237,*)`, moves to AA `--v-accent`) |

**Typography** — Inter (UI/body) + Bricolage (display). Roles: display/h1–h3 → `--font-display`; body/label/caption → `--font-sans`; keys/code → `--font-mono`. Weights: body 400, medium 500, strong 600 (legacy); display 400/500 only. Add line-height tokens (currently absent):

| Token | Value | Usage |
| --- | --- | --- |
| `--lh-tight` | `1.15` | Display / h1–h2 |
| `--lh-snug` | `1.35` | h3 / labels |
| `--lh-body` | `1.6` | Body copy |
| `--tracking-tight` | `-0.01em` | Display headings |

Sizes reuse `--fs-display…--fs-sm` unchanged.

**Spacing** — keep `--sp-1…16` (4px base). No change; enforce that pages use it instead of literal px.

**Radius / border / elevation** — canonical: `--r-sm/md/lg/pill` and `--border`/`--border-strong`; shadows `--v-shadow-sm/-/-lg` unchanged.

**Opacity (non-text only):**

| Token | Value | Usage |
| --- | --- | --- |
| `--o-scrim` | `.48` (dark `.62`) | Overlay dim |
| `--o-hover` | `.06` | Ghost-button hover wash |
| `--o-disabled-surface` | `.5` | Disabled *control* (never text) |

**Z-index scale (new):**

| Token | Value | Usage |
| --- | --- | --- |
| `--z-base` | `0` | In-flow |
| `--z-sticky` | `50` | Sticky headers (matches `home.css`) |
| `--z-nav` | `100` | Topbar / skip-link |
| `--z-dropdown` | `600` | Menus, `NotificationBell`, `CommandPalette` list |
| `--z-drawer` | `800` | Mobile drawer |
| `--z-modal` | `900` | Dialogs + `--v-scrim` |
| `--z-toast` | `1000` | Transient notifications |

**Motion (add durations; keep eases):**

| Token | Value | Usage |
| --- | --- | --- |
| `--dur-1` | `120ms` | Micro (hover, press) |
| `--dur-2` | `180ms` | Standard (was hardcoded `.18s`) |
| `--dur-3` | `280ms` | Enter / layout |
| `--dur-loop` | `1.4s` | Shimmer/pulse loops |
| `--v-ease` | `cubic-bezier(.22,1,.36,1)` | Standard |
| `--v-spring` | `cubic-bezier(.34,1.56,.64,1)` | Overshoot |

`prefers-reduced-motion` guard stays and must gate all new duration usage.

**Focus (tokenized, AA):**

```css
.v-app :focus-visible,
.v-app input:focus-visible,
.v-app textarea:focus-visible,
.v-app select:focus-visible {
  outline: none;
  border-radius: var(--r-sm);
  box-shadow: 0 0 0 3px var(--v-focus);   /* was raw rgba(100,149,237,*) */
}
```

**Breakpoints (documented scale — not runtime `var()`):** CSS custom properties are invalid inside `@media` feature queries, so breakpoints ship as a fixed, lint-enforced constant scale plus container queries for components:

| Name | Width | Replaces (retire) |
| --- | --- | --- |
| `sm` | `640px` | 560, 640 |
| `md` | `768px` | 768 |
| `lg` | `1024px` | 820, 860, 900, 1000, 1024 |
| `xl` | `1280px` | — (new) |
| `xs` (exception) | `380px` | keep for smallest-phone `mobile.css` only |

**High-contrast (new):** support Windows/High-Contrast via `@media (forced-colors: active)` (preserve borders with `border-color: CanvasText`, never remove focus outlines) and expose an opt-in `:root[data-contrast="high"]` hook that darkens `--v-ink-2/-3` toward `--v-ink` and swaps `--border` for `--border-strong`.

> **Adoption gate:** documentation is not enough — land a Stylelint rule banning six-digit hex in `app/**/*.tsx` and `styles/*.module.css` (allowlist marks/art: `Logo.tsx`, `IllustrationSlot.tsx`, `PipelineDonut` data colours, per-tenant `CareersSite`), plus a codemod to convert the ~1,312 page-level literals and delete the `globals.css`/`home.css` legacy namespace. Until then the token system is authoritative only inside the ~10 fully-tokenized components (§(c)), not across the ~78 routes.


## 4. Component Library

Vrittih today has **shells and features but no primitive layer**. `components/ui/` contains only `Icons.tsx` (56 glyphs), the legacy `DuotoneIcons.tsx` (9 glyphs), `NotificationBell.tsx`, and `QRCode.tsx` — **zero** `Button`, `Card`, `Field`, `Table`, `Badge`, `Meter`, `Dialog`, `Toast`. Every surface, chip, bar, CTA, and form field is re-declared inline in each file's local `const S`. The result is measurable duplication: ~15 hand-rolled card surfaces, status-colour hex maps re-declared across 6 career panels, ~5 divergent button implementations, and raw `<table>` markup in 11 route files. The three canonical, fully-tokenized components to build *around* are `AppShell.tsx`, `CommandPalette.tsx`, and `Icons.tsx`; almost everything else needs either extraction into `ui/` or a token pass.

**Two structural cleanups gate the whole library** and must land first:

1. **Standardize on the redesign token scale.** `AppShell.tsx` already uses `--r-sm/md/lg` (6/8/12), `--border`/`--border-strong`, `--v-accent-soft`, and `--sp-*`. The legacy `--v-r` (12/10/16) and `--v-line`/`--v-line-2` scales are the *older* generation and must be deprecated so every primitive draws its radius and hairline from one place. Duplicate `--v-r-pill`/`--r-pill` collapse to one.
2. **Purge legacy teal-green.** `#0F6E56`/`#9FD4C3`/`rgba(15,110,86,*)` survive in `AdminShell` (active state), `NotificationBell` (unread bg), and `navbar.module.css` — pre-cornflower relics that must not be carried into any primitive.

**Status legend:** **Missing** (no implementation) · **Partial** (behaviour exists but inline/not extracted) · **Exists** (real reusable component).

### 4.1 Actions & inputs

| Component | Status (where) | Props / variants | States | A11y | Consolidation action |
|---|---|---|---|---|---|
| **Button** | **Missing** — ~5 divergent CTAs: `layout/Navbar` `btnPrimary`/`btnOutline` (module CSS), `FeatureGate` `S.primary`/`S.ghost`, `MatchPanel`/`EmptyState` `S.cta`, `AstroCard` `#fff` CTA | `variant` (primary/secondary/ghost/danger/link), `size` (sm/md/lg), `leadingIcon`/`trailingIcon`, `loading`, `disabled`, `fullWidth`, `as`/`href` | default · hover · active · `:focus-visible` · loading · disabled | Real `<button>`; `aria-busy` on loading; global focus ring; ≥44px tap target on mobile | Create `ui/Button.tsx` as sole source. Primary = `--v-accent` fill + `--v-accent-ink`; ghost = `--v-ink-2` on transparent. Delete `btnPrimary`/`btnOutline` from `navbar.module.css`; replace every inline `S.cta`/`S.primary` |
| **IconButton** | **Partial** — `AppShell` `S.iconBtn`/`S.iconBtnPlain`, NotificationBell trigger inline | `icon` (from `Icons.tsx`), `label` (required), `variant`, `size`, `badge` | default · hover · active · focus · disabled | **Required** `aria-label`; badge count needs `aria-live` | Extract from `AppShell`; use for topbar bell/messages/search |
| **Input / Field** | **Missing** — label+input+error re-declared ~5× across `developers/*` + `DocumentUpload` (e.g. `KeysPanel` `label` input) | `label`, `hint`, `error`, `required`, `prefix`/`suffix`, `size` | default · focus · error · disabled · readonly | `<label htmlFor>`; `aria-invalid`; `aria-describedby` links hint + error | Build `ui/Field.tsx` (label + control + message wrapper) + `ui/Input.tsx`. Border `--border`, focus `--brand-400`, error `--danger` |
| **Textarea** | **Missing** — inline in `DocumentUpload`/`BrandPanel` | `rows`, `autoResize`, + Field props | (same as Input) | (same as Input) | Same Field family; shared `ui/Textarea.tsx` |
| **Search** | **Partial** — topbar `S.search` is a *button* dispatching `vrittih:open-command`; the real search input lives inside `CommandPalette` | `value`, `onChange`, `placeholder`, `clearable`, `size` | default · focus · has-value · loading | `role="searchbox"`; clear button `aria-label` | Build in-page `ui/SearchInput.tsx` for job/table/list filters; keep topbar as the command trigger it already is |
| **Select / Combobox** | **Missing** — native `<select>` scattered in routes | `options`, `value`, `multiple`, `searchable`, `renderOption` | closed · open · focused-option · disabled | In-house listbox: `role="combobox"`/`listbox`, `aria-activedescendant`, full keyboard nav | Build accessible listbox (no libs, per project rule); Filters depend on it |
| **Checkbox / Radio / Switch** | **Missing** | `checked`, `indeterminate` (checkbox), `name`/`value` (radio), `label`, `disabled` | unchecked · checked · indeterminate · focus · disabled | Native input under styled control; `role="switch"` + `aria-checked` for Switch | Build three primitives; checked = `--v-accent`, track = `--border` |
| **DatePicker** | **Missing** — native date inputs only | `value`, `range`, `min`/`max`, `disabledDates` | closed · open · selecting · disabled | Keyboard grid nav, `aria-label` per day, announced selection | In-house calendar (no libs); needed by HRMS/payroll/interview scheduling |
| **Form + Validation** | **Missing framework** — every panel hand-rolls `fetch` + local `err`/`busy` (e.g. `KeysPanel.generate`) | `<Form>` + `useForm`: field-level + submit-level errors, `onSubmit`, `disabled-while-submitting` | idle · validating · submitting · error · success | `aria-live` error summary; disable submit + `aria-busy` while pending | **One Form framework** in `ui/`; retire the per-panel fetch/error boilerplate across `developers/*` + `career/*` |

### 4.2 Overlays & feedback

| Component | Status (where) | Props / variants | States | A11y | Consolidation action |
|---|---|---|---|---|---|
| **Dialog / Modal** | **Missing** — no modal primitive anywhere | `title`, `size`, `dismissable`, `footer`, `onClose` | closed · opening · open · closing | Focus trap, `role="dialog"` + `aria-modal`, ESC to close, restore focus on close | Build `ui/Dialog.tsx`; scrim `rgba(15,17,21,.4)` (reuse `AppShell` `S.scrim`) |
| **Drawer** | **Partial** — `AppShell` mobile nav drawer (`S.drawer` 288px, `translateX`, scrim, ESC handler, reduced-motion guard) | `side` (left/right), `width`, `dismissable` | closed · open (transform) | Focus trap; ESC; `aria-hidden` on inert background | Extract Drawer primitive from `AppShell`; keep its transform + `prefers-reduced-motion` guard |
| **Sheet** | **Missing** — no mobile bottom sheet | `snapPoints`, `dismissable` | closed · open · dragging | Same trap/ESC as Drawer | Build on Drawer for mobile action menus |
| **Tooltip** | **Missing** | `content`, `placement`, `delay` | hidden · shown | `role="tooltip"`; show on hover **and** focus; never `title` attr | Build `ui/Tooltip.tsx` |
| **Popover** | **Missing** — `NotificationBell` dropdown is a bespoke popover | `anchor`, `placement`, `open`, `onOpenChange` | closed · open | Outside-click + ESC close; return focus to anchor | Build `ui/Popover.tsx`; refactor `NotificationBell` onto it |
| **Toast** | **Missing** — success/copy feedback via local state (`KeysPanel.copied`) | `tone` (info/success/warn/danger), `duration`, `action` | entering · shown · exiting | `aria-live="polite"` region; not focus-stealing | `ToastProvider` + `useToast`; tones map to `--v-green-soft`/`--warn`/`--danger` |
| **Alert / Banner** | **Missing** — inline error banners (`S.err`) per panel; `ImpersonationBanner` bespoke | `tone`, `title`, `dismissable`, `icon` | static · dismissed | `role="alert"` for errors; `role="status"` otherwise | Build `ui/Alert.tsx`; tones → `--info`/`--v-green`/`--warn`/`--danger` + `-soft` bg. Rebuild `ImpersonationBanner`/`InstallPrompt` on it |

### 4.3 Data display

| Component | Status (where) | Props / variants | States | A11y | Consolidation action |
|---|---|---|---|---|---|
| **Badge / Chip** | **Missing** — re-declared everywhere: `AppShell` `S.badge` (count), career-panel difficulty chips via `diffColor` hex maps, `.v-gold` (Verified) | `tone` (neutral/accent/success/warn/danger/gold), `variant` (soft/solid/count), `size` | static | Colour never sole signal — pair tone with label | Build `ui/Badge.tsx`; tones map to semantic tokens. **Deletes the `diffColor`/`tierColor` hex maps** duplicated across 6 career panels; keep `.v-gold` reserved for Verified |
| **Avatar** | **Partial** — `AppShell` `S.avatar` (initials, 30px, `--v-accent`); `CompanyLogo` (monogram/image) | `src`, `name` (→ initials), `size`, `shape` | image · fallback-initials | `alt` from name; decorative when adjacent to visible name | Promote to `ui/Avatar.tsx` + `AvatarGroup`; keep `CompanyLogo` for company marks |
| **Card** | **Missing** — ~15 re-inlined `S.card`/`S.section`; `MatchPanel` `S.card` re-inlines raw `#E5E7EB` + literal shadow | `padding`, `header`/`footer` slots, `interactive`, `as`/`href` | static · hover (interactive) | Interactive card = real link/button, not `onClick` div | Build `ui/Card.tsx` on `--v-surface`/`--border`/`--r-lg`/`--v-shadow-sm`. Migrate `AstroCard`, `AstroJobCard`, all `career/*` + `developers/*` panels onto it |
| **MetricCard** | **Missing** — dashboard KPIs inline in routes | `label`, `value`, `delta`, `spark`, `tone` | static · loading (skeleton) | `delta` direction announced textually, not by colour alone | Build on Card; pairs with `PipelineDonut` + Sparkline |
| **Table / DataGrid** | **Missing** — raw `<table>` in **11 route files** (`admin/*`, `developers`, `settings`, `hrms`, `analytics`) | `columns`, `data`, `sortable`, `selectable`, `pagination`, `empty`/`loading` slots | idle · loading · empty · error · sorted · selected | `<caption>`, `scope` on `<th>`, sortable header `aria-sort`, keyboard row nav | **One DataTable framework** in `ui/`; migrate all 11 route tables. Ships with Pagination |
| **Charts** | **Exists** — `PipelineDonut.tsx`, `PipelineRail.tsx` (tokenized; colours via data/props); sparkline inline in `ProgressPanel` | `data`, `size`, colour-by-data | static · animated-in | `role="img"` + `aria-label` describing the series | Keep as chart family; extract shared `Sparkline`; document colour-by-data as the sanctioned raw-hex exemption |
| **Kanban** | **Missing** — pipeline board inline in routes | `columns`, `cards`, `onMove` | idle · dragging · drop-target | Keyboard move (not drag-only); `aria-grabbed`/live announce | Build on Card + `PipelineRail` stage semantics for `/dashboard/pipeline` |
| **Timeline** | **Missing** — `RoadmapPanel` phases + application status ad-hoc | `items` (label/date/status), `orientation` | static | Ordered list semantics; status as text + icon | Build `ui/Timeline.tsx`; refactor `RoadmapPanel` |
| **List / ListRow** | **Missing** — list rows inline per route | `leading`/`trailing` slots, `interactive`, `divided` | static · hover · selected | Semantic `<ul>`/`<li>`; interactive rows are links/buttons | Build `ui/List.tsx`; standard for messages/candidates/jobs lists |
| **Progress / Meter / Bar** | **Partial** — bars re-inlined per career panel (`MatchPanel.Bar`, `DnaPanel` meters, `.v-live` utility) | `value`, `max`, `tone`, `size`, `showLabel` | static · animated · indeterminate | `role="progressbar"` + `aria-valuenow`/`min`/`max` | Build `ui/Meter.tsx`/`ProgressBar`; **eliminates per-panel bar code** across all career panels |
| **Skeleton** | **Partial** — `.v-skeleton` utility + `v-shimmer` keyframe exist in CSS; no component (panels show "Analysing…" text) | `variant` (text/rect/circle), `lines`, `width` | shimmering | `aria-hidden`; container `aria-busy` | Build `ui/Skeleton.tsx` on `.v-skeleton`; use as loading state in Card/Table/MetricCard |
| **EmptyState** | **Exists** — `vrittih/EmptyState.tsx` (`title`/`reason`/`ctaLabel`/`ctaHref`/`onCta`/`aiTip`/`icon`) but **raw hex** (`#334EAC`, keystone gradient) | (as built) | static | CTA is real link/button; illustration `aria-hidden` | Keep API; tokenize hex → `--v-accent-2`/brand ramp; route its CTA through `Button` |
| **ErrorState** | **Missing** — `MatchPanel` silently `return null` on error | `title`, `reason`, `onRetry` | static | `role="alert"`; actionable retry | Build as EmptyState sibling; **stop returning null** on fetch errors |

### 4.4 Navigation & structure

| Component | Status (where) | Props / variants | States | A11y | Consolidation action |
|---|---|---|---|---|---|
| **Navigation shells** | **Fragmented — 4 surfaces:** `AppShell` (canonical, full tokens) · `AdminShell` (off-system, legacy teal-green active) · `CrmShell` (8-line redundant alias) · `layout/Navbar` (legacy public) | shell: `title`, capability-driven `buildNav`, mobile drawer, bottom tabs | — | Landmarks (`<header>`/`<nav>`/`<main>`), `aria-current="page"` on active | **Merge into one `AppShell`.** Fold admin into it as a capability-gated section (`admin.access` — AppShell already links `/admin`); **delete `CrmShell`** (import `AppShell` directly — it's already a pass-through); retire `layout/Navbar` or rebuild as a thin token-based marketing header. Kill `AdminShell`'s `#0B1126`/`rgba(15,110,86,.2)`/`#9FD4C3` |
| **Tabs** | **Missing** — `ResumeReviewPanel` + `InterviewPanel` roll their own tab strips | `tabs`, `value`, `onChange`, `variant` | active · inactive · focus · disabled | `role="tablist"`/`tab`/`tabpanel`; arrow-key roving `tabindex` | Build `ui/Tabs.tsx`; refactor both panels |
| **Accordion** | **Missing** | `items`, `multiple`, `defaultOpen` | collapsed · expanded | Disclosure: `aria-expanded` + `aria-controls` | Build `ui/Accordion.tsx` (FAQ, filter groups) |
| **Menu (dropdown)** | **Missing** — `NotificationBell` + account chip bespoke | `items`, `anchor`, `onSelect` | closed · open · focused-item | `role="menu"`/`menuitem`; roving focus; ESC | Build on Popover; refactor bell + account menus onto it |
| **ContextMenu** | **Missing** | `items`, `onContextMenu` target | closed · open | `role="menu"`; keyboard invocation, not right-click only | Build on Menu (lower priority) |
| **Pagination** | **Missing** — route tables paginate inline | `page`, `pageCount`, `onChange`, `pageSize` | idle · disabled ends | `nav` landmark; `aria-label` per control; current `aria-current` | Ships **with DataTable**; also standalone `ui/Pagination.tsx` |
| **Filters** | **Missing** — jobs/candidates filters inline in routes | `filters` (chips + Select + Search), `onChange`, `onClear` | idle · active · applied | Group labelled; clear-all reachable by keyboard | Filter bar composing SearchInput + Select + Badge primitives |
| **CommandPalette** | **Exists** — `vrittih/CommandPalette.tsx`, ⌘K, capability-aware (`isEmployer`/`canCrm`/`canMail`/`canInterviews`/`canApi`) | (as built) | closed · open · searching | `role="dialog"` + listbox results; full keyboard | Keep canonical; move the actions registry to `lib/` so nav + palette share one source |
| **Widget** | **Missing** — dashboard widgets inline in routes | `title`, `action` slot, `size` (grid span) | static · loading · empty | Heading per widget; landmark region | Build on Card (header + action slot) for the dashboard grid |

**Primitive layer to create (net-new in `components/ui/`):** `Button`, `IconButton`, `Field`, `Input`, `Textarea`, `SearchInput`, `Select`, `Checkbox`, `Radio`, `Switch`, `DatePicker`, `Form`/`useForm`, `Dialog`, `Drawer`, `Sheet`, `Tooltip`, `Popover`, `Toast`, `Alert`, `Badge`, `Avatar`, `Card`, `MetricCard`, `DataTable`, `Sparkline`, `Kanban`, `Timeline`, `List`, `Meter`, `Skeleton`, `ErrorState`, `Tabs`, `Accordion`, `Menu`, `Pagination`, `Filters`, `Widget`. All in-house, no third-party libs (patent goal), each driven exclusively by the redesign token scale.

---

## 5. Component Inventory & Classification

Every real file under `components/`, classified. **Classification** ∈ *reusable/canonical · reusable · reusable (tokenize) · needs-refactor · duplicate/legacy*. Token adoption cites what the file actually draws from.

| File | Type | Token adoption (ground truth) | Classification | Recommended action |
|---|---|---|---|---|
| `vrittih/AppShell.tsx` | App nav shell | **Full tokens** (`--border`, `--r-md/lg`, `--v-accent-soft`, `--sp-*`) | reusable · **canonical** | Canonical app chrome; extract `Drawer`/`Avatar`/`IconButton` primitives from it |
| `admin/AdminShell.tsx` | Admin nav shell | **Raw hex, off-system**; legacy teal-green active `rgba(15,110,86,.2)`/`#9FD4C3`; brand mark `#6495ED`; slab `#0B1126` | needs-refactor · **legacy** | Fold into `AppShell` as a capability-gated admin section; delete the legacy palette |
| `crm/CrmShell.tsx` | Nav wrapper | Inherits (renders `AppShell`) | **duplicate / legacy alias** | Delete; import `AppShell` directly |
| `layout/Navbar.tsx` (+ `styles/navbar.module.css`) | Public nav | Off-brand `#0F0A1E`, legacy green `#9FD4C3`, own `btnPrimary`/`btnOutline` | legacy · **duplicate** | Retire or rebuild as a token marketing header; delete `btnPrimary`/`btnOutline` |
| `vrittih/AstroCard.tsx` | Content card | Mostly tokens; **literal radii** 16/14/999 + `#fff` CTA | reusable · **tokenize** | Rebuild on `Card` + `Button`; radii → `--r-lg` |
| `vrittih/AstroJobCard.tsx` | Teaser card | **Full redesign tokens** (`--border`/`--r-lg`/`--v-accent`) | reusable | Keep; reconcile duplicate astro-card concept with `AstroCard` |
| `career/MatchPanel.tsx` | Feature panel | Mixed; card re-inlines `#E5E7EB` + literal shadow; `tierColor` uses `#16A34A` — **diverges from `--v-green #22C55E`** | needs-refactor | `Card` + `Meter` + `Badge`; replace `tierColor`/`diffColor` with semantic tokens; add `ErrorState` (stops `return null`) |
| `career/ResumeReviewPanel.tsx` | Feature panel (tabs) | Mixed; hex tone maps | needs-refactor | `Card` + `Tabs` + `Badge` |
| `career/RoadmapPanel.tsx` | Feature panel | Mixed | needs-refactor | `Card` + `Timeline` |
| `career/InterviewPanel.tsx` | Feature panel (tabs) | Mixed | needs-refactor | `Card` + `Tabs` + `Meter` |
| `career/DnaPanel.tsx` | Feature panel (meters) | Mixed | needs-refactor | `Card` + `Meter` |
| `career/PathSimulatorPanel.tsx` | Feature panel | Mixed; diff hex tones (CHF salary) | needs-refactor | `Card` + `Badge` tones |
| `career/ProgressPanel.tsx` | Feature panel (sparkline) | Mixed | needs-refactor | `Card` + `Sparkline` + `Meter` |
| `career/FrontierPanel.tsx` | Feature panel | Mixed; diff hex tones | needs-refactor | `Card` + `Badge` |
| `career/DocumentUpload.tsx` | Upload form | Mixed | needs-refactor | `Field`/`Form` + `Button` + `Alert` |
| `developers/KeysPanel.tsx` | CRUD form panel | Raw-hex heavy; local `err`/`busy`/`copied` state | needs-refactor | `Card` + `Field` + `Button` + `Toast` + `DataTable` |
| `developers/DomainsPanel.tsx` | CRUD form panel | Raw-hex heavy | needs-refactor | Same form/panel family |
| `developers/WebhooksPanel.tsx` | CRUD form panel | Raw-hex heavy | needs-refactor | Same form/panel family |
| `developers/BrandPanel.tsx` | Editor form | Raw-hex heavy | needs-refactor | Same form/panel family |
| `vrittih/PipelineDonut.tsx` | Chart | Colours via props (legit) | reusable | Keep; chart family |
| `vrittih/PipelineRail.tsx` | Chart / stage tracker | Tokens | reusable · **signature** | Keep; basis for `Kanban`/`Timeline` semantics |
| `vrittih/Logo.tsx` | Brand mark | Literal brand gradient (legit for a mark) | reusable · **canonical** | Keep |
| `vrittih/CompanyLogo.tsx` | Brand / avatar | Tokens + dynamic colour | reusable | Keep; sibling to `Avatar` |
| `vrittih/IllustrationSlot.tsx` | Illustration frame | Brand gradient (art) | reusable | Keep |
| `vrittih/EmptyState.tsx` | Empty state | **Raw hex** (`#334EAC`, keystone gradient) despite DS role | needs-refactor | Tokenize; keep API; CTA → `Button`; add `ErrorState` sibling |
| `vrittih/CommandPalette.tsx` | Command palette | Tokens; capability-aware | reusable · **canonical** | Keep; move actions registry to `lib/` |
| `vrittih/FeatureGate.tsx` | Plan gate | Tokens | reusable | Keep; upgrade CTA → `Button` |
| `ui/Icons.tsx` | Icon set (56 glyphs) | `currentColor` (24×24, 1.75 stroke) | reusable · **canonical** | Canonical; extend here only |
| `ui/DuotoneIcons.tsx` | Icon set (9-glyph starter) | `currentColor` (1.7 stroke) | **duplicate / legacy** | Deprecate; migrate any refs to `Icons.tsx` |
| `ui/NotificationBell.tsx` | Popover + 30s poll | Raw hex incl **legacy green** `rgba(15,110,86,.04)` | needs-refactor | Rebuild on `Popover`/`Menu` + `Badge`; drop legacy green |
| `ui/QRCode.tsx` | In-house QR renderer | n/a (no libs) | reusable | Keep |
| `admin/ImpersonationBanner.tsx` | Banner | Raw hex | needs-refactor (minor) | Rebuild on `Alert` |
| `InstallPrompt.tsx` | PWA install banner | Mostly hex | needs-refactor (minor) | Tokenize; `Card` + `Button` |
| `PWARegister.tsx` | SW register (no UI) | n/a | reusable | Keep |
| `brand/CareersSite.tsx` | White-label careers page | Mostly hex + **intentional per-tenant brand colour** | needs-refactor | Tokenize chrome; keep the per-tenant brand colour as a runtime var |

**Roll-up:** 3 canonical (`AppShell`, `CommandPalette`, `Icons`) · 9 reusable/keep (`AstroJobCard`, `PipelineDonut`, `PipelineRail`, `Logo`, `CompanyLogo`, `IllustrationSlot`, `FeatureGate`, `QRCode`, `PWARegister`) · 1 reusable-tokenize (`AstroCard`) · 18 needs-refactor (all `career/*`, all `developers/*`, `EmptyState`, `NotificationBell`, `AdminShell`, `ImpersonationBanner`, `InstallPrompt`, `CareersSite`) · 3 duplicate/legacy to retire (`CrmShell`, `DuotoneIcons`, `layout/Navbar`). The single highest-leverage move is building the missing `ui/` primitive layer, because it collapses the ~18 needs-refactor files at once — each is duplicated card/form/bar/status code, not net-new design.

## 6. Implementation Tracker

Work is ordered by **dependency**, not by visible pain: token consolidation unblocks the primitive layer, which unblocks every migration. Do not start a migration phase before the primitive it depends on exists — that is how the current ~15 inline card definitions were born.

**Status legend:** ✅ done · 🟡 partial (token exists, unenforced) · ⬜ not started

### Phase 0 — Token consolidation *(foundational; blocks all primitives)*

| # | Item | Why | Files | Status |
|---|------|-----|-------|--------|
| 0.1 | Pick canonical **radius** scale = `--r-sm 6 / --r-md 8 / --r-lg 12`; alias legacy `--v-r-sm/--v-r/--v-r-lg → var(--r-*)` | `var(--v-r*)` has **0** consumers today; `var(--r-*)` has 5. Legacy scale is dead weight. | `styles/vrittih.css:53-56, 77` | ⬜ |
| 0.2 | Pick canonical **hairline** = `--border` + `--border-strong`; alias `--v-line → var(--border)`, `--v-line-2 → var(--border-strong)` | Real adoption is inverted (`--v-line*` 27 files vs `--border*` 6). Alias, don't rename — protects the 27 files. | `styles/vrittih.css:34-35, 78-79` | ⬜ |
| 0.3 | Delete duplicate `--v-r-pill`; keep single `--r-pill: 999px` | Two identical pill tokens (`:56` and `:77`). | `styles/vrittih.css:56, 77` | ⬜ |
| 0.4 | Publish **semantic tone tokens** as the only status source: map success/warn/info/danger to `--v-green/#22C55E`, `--warn/#B45309`, `--info/#2E9BE0`, `--danger/#DC2626` | Panels invent off-token greens (`#16A34A` ≠ `--v-green #22C55E`). | `styles/vrittih.css:44-50` | 🟡 |
| 0.5 | Add stylelint/eslint **no-raw-hex** rule (warn → error) with allowlist for dataviz + brand marks | Enforcement is the only thing that stops regression. | new `.stylelintrc` | ⬜ |

### Phase 1 — Primitive layer `components/ui/*` *(blocks every migration below)*

The single biggest gap: `components/ui/` holds only `Icons`, `DuotoneIcons`, `NotificationBell`, `QRCode`. Build the missing eight.

| # | Primitive | Replaces (duplication killed) | Notes |
|---|-----------|-------------------------------|-------|
| 1.1 | `ui/Button.tsx` (`primary`/`secondary`/`ghost`/`danger`) | ~5 CTA variants: `#6495ED`, `var(--brand-600)`, `var(--v-accent)`, module `btnPrimary`/`btnOutline` | **Primary fill MUST be `--v-accent #4F63D2`**, never `#6495ED` (fails AA, see §8) |
| 1.2 | `ui/Card.tsx` + `ui/Section.tsx` | ~15 inline `card`/`section` surfaces (`surface + border + radius + shadow`) | Uses `--v-surface` / `--border` / `--r-lg` / `--v-shadow` |
| 1.3 | `ui/Field.tsx` + `ui/Input.tsx` + `ui/Label.tsx` | ~5 form scaffolds across all `developers/*` + `DocumentUpload` | One focus-ring, one error state |
| 1.4 | `ui/Badge.tsx` + `ui/Chip.tsx` | per-panel chip styles; folds in `.v-gold` Verified badge | tone prop → semantic token |
| 1.5 | `ui/Meter.tsx` (bar / score / segmented) | hand-rolled bars in every `career/*` panel (`MatchPanel:149`) | value + tone, no hex |
| 1.6 | `ui/Tone.ts` (helper: `tone(score) → token`) | `tierColor`/`diffColor`/`scoreTone`/`diffTone` hex maps re-declared in ~6 panels | returns `var(--v-*)`, kills the maps |
| 1.7 | `ui/DataTable.tsx` | list/table markup currently living in `app/` route files | see DDR-05 |
| 1.8 | `ui/Modal.tsx` + `ui/Toast.tsx` | none yet (net-new; needed by revoke/verify flows in `developers/*`) | uses `.v-glass` |

### Phase 2 — Migrate `career/*` *(highest ROI: kills the AA defect + the hex maps)*

| # | Item | Files | Status |
|---|------|-------|--------|
| 2.1 | Swap card surfaces → `<Card>`; delete local `S.card` (`background:"#fff"`, `border:"1px solid #E5E7EB"`, `borderRadius:16`) | `MatchPanel:139`, all 9 `career/*` | ⬜ |
| 2.2 | Swap CTAs (`background:"#6495ED"`, `MatchPanel:144`) → `<Button variant="primary">` (`--v-accent`) — **a11y fix** | `MatchPanel`, all panels with a CTA | ⬜ |
| 2.3 | Replace `tierColor`/`diffColor`/`scoreTone`/`diffTone` → `tone()` | `MatchPanel:19-21`, `PathSimulatorPanel`, `FrontierPanel`, `DnaPanel`, `ProgressPanel`, `ResumeReviewPanel` | ⬜ |
| 2.4 | Bars → `<Meter>` | `MatchPanel:149`, `DnaPanel`, `ProgressPanel` | ⬜ |

### Phase 3 — Migrate `developers/*` + tables

| # | Item | Files | Status |
|---|------|-------|--------|
| 3.1 | Adopt `Field`/`Input`/`Button` across the duplicate panel/form family | `KeysPanel`, `DomainsPanel`, `WebhooksPanel`, `BrandPanel` | ⬜ |
| 3.2 | Lift table markup out of `app/` route files into `<DataTable>` | route files under `app/` | ⬜ |

### Phase 4 — Nav consolidation *(collapse 4 nav surfaces → 1)*

| # | Item | Files | Status |
|---|------|-------|--------|
| 4.1 | Delete `CrmShell` (7-line pass-through to `AppShell`); inline `AppShell` at call sites | `components/crm/CrmShell.tsx` | ⬜ |
| 4.2 | Tokenize `AdminShell`: remove all raw hex, replace **legacy teal-green** active state | `admin/AdminShell.tsx:70` (`rgba(15,110,86,.2)`/`#9FD4C3`), hardcoded `#6495ED` mark | ⬜ |
| 4.3 | Retire `layout/Navbar` + `navbar.module.css` (off-brand `#0F0A1E`, legacy green, own buttons) → drive marketing top nav from tokens | `components/layout/Navbar.tsx`, `styles/navbar.module.css` | ⬜ |

### Phase 5 — Remaining raw-hex components + dark-mode audit

| # | Item | Files | Status |
|---|------|-------|--------|
| 5.1 | Tokenize the DS empty-state (ironic that it is off-system) | `vrittih/EmptyState.tsx:66-67` (`#6495ED` CTA, `#EAF1FE`, `#475569`) | ⬜ |
| 5.2 | Fix `NotificationBell` unread bg (**legacy green** `rgba(15,110,86,.04)`) | `ui/NotificationBell.tsx:127` | ⬜ |
| 5.3 | Tokenize chrome (keep intentional per-tenant brand colour) | `brand/CareersSite.tsx` | ⬜ |
| 5.4 | Minor hex cleanups | `InstallPrompt.tsx`, `admin/ImpersonationBanner.tsx` | ⬜ |
| 5.5 | Delete superseded icon set | `ui/DuotoneIcons.tsx` (superseded by `ui/Icons.tsx`) | ⬜ |
| 5.6 | Reconcile the two astro cards (`AstroCard` v1 tokens + literal radii vs `AstroJobCard` redesign tokens) | `vrittih/AstroCard.tsx`, `vrittih/AstroJobCard.tsx` | ⬜ |

---

## 7. Design Decision Records

Each record is binding. "Superseded by" is the only way to overturn one.

### DDR-01 — One application shell
**Decision:** `vrittih/AppShell.tsx` is the *only* app chrome (topbar + 216px island sidebar + mobile drawer + bottom tabs + `CommandPalette` + AI Coach dock, capability-driven `buildNav`). `CrmShell` is deleted; `AdminShell` is refactored onto tokens (not replaced — admin needs its dark-slab density); `layout/Navbar` is retired for marketing.
**Status:** Accepted. **Rationale:** four nav surfaces = four bugs, three palettes, two token generations. **Consequence:** admin keeps a distinct *skin* but must consume tokens; no fourth nav may be introduced.

### DDR-02 — Tokens only; raw hex is a lint error
**Decision:** No literal colours in component/route code. The **only** exemptions: (a) dataviz where colour encodes data (`PipelineDonut` props, chart series), (b) brand-identity marks (`Logo`, `IllustrationSlot`, `EmptyState` hero gradient art), (c) intentional per-tenant brand colour (`CareersSite`).
**Status:** Accepted. **Rationale:** ~15 card surfaces and ~6 status maps drifted precisely because hex was allowed inline. **Consequence:** enforced by Phase 0.5 lint gate.

### DDR-03 — One radius scale: `--r-sm 6 / --r-md 8 / --r-lg 12`
**Decision:** Canonical scale is the redesign `--r-*`. Legacy `--v-r 12 / --v-r-sm 10 / --v-r-lg 16` are kept **only** as aliases (`--v-r → var(--r-lg)` etc.) for one migration cycle, then removed.
**Status:** Accepted. **Evidence:** `var(--v-r*)` has **0** consumers; radii are hardcoded magic numbers (`16`/`14`/`13`/`11` in `AstroCard`, `MatchPanel`). **Consequence:** a codemod snaps raw radii to the nearest token (16/14/13 → `--r-lg`, 11/10 → `--r-md`).

### DDR-04 — One hairline scale: `--border` + `--border-strong`
**Decision:** Canonical hairline is the redesign pair. `--v-line`/`--v-line-2` become aliases (`--v-line → var(--border)`), never renamed.
**Status:** Accepted. **Evidence:** adoption is inverted — `--v-line*` (27 files) vs `--border*` (6) — so a rename would break 27 files; an alias breaks none. Redesign brief mandates *one* hairline + *one* strong, so the redesign names win as canonical. **Consequence:** de-emphasis is by colour step (`--v-ink-2/3`, `--ink-disabled`), never opacity (see DDR-10).

### DDR-05 — One table framework
**Decision:** All tabular/list rendering goes through `ui/DataTable.tsx`. No table/`<tr>` markup in `app/` route files.
**Status:** Accepted. **Rationale:** tables are the last un-componentized surface and live in routes today. **Consequence:** sorting/empty/loading states standardize via `EmptyState` + `.v-skeleton`.

### DDR-06 — Type system: Inter + Bricolage Grotesque
**Decision:** Body/UI = Inter (`--font-sans`); **every** heading (app + marketing) = Bricolage via `--font-display`. Fluid scale `--fs-display…--fs-sm` only; no ad-hoc `fontSize` for headings.
**Status:** Accepted (`styles/vrittih.css:65-88`). **Consequence:** `--v-serif` is an alias of `--font-display`, not a real serif — do not introduce a serif.

### DDR-07 — Accent `#4F63D2` for all interactive fills; `#6495ED` is decoration only
**Decision:** Every button/link/active fill uses `--v-accent #4F63D2` (or `--v-accent-2`). `#6495ED` (`--brand-600`) is reserved for the brand ramp, gradients, and non-text decoration — **never** as a CTA fill or on-white text colour.
**Status:** Accepted. **Evidence:** the token file itself notes old `#6495ED` failed at ~2.6:1 (`:37-38`); yet CTAs still ship it (`MatchPanel:144`, `EmptyState:66`). **Consequence:** Phase 2.2 / 5.1 are a11y fixes, not cosmetics.

### DDR-08 — Semantic colour via tokens; per-panel hex maps are banned
**Decision:** Status/tone colour comes from `--v-green/--warn/--info/--danger` through `ui/Tone.ts`. `tierColor`/`diffColor`/`scoreTone`/`diffTone` are deleted.
**Status:** Accepted. **Evidence:** maps re-declared in ~6 `career/*` panels and don't even match tokens (`#16A34A` vs `--v-green #22C55E`). **Consequence:** one place to tune the whole status palette.

### DDR-09 — Depth jurisdiction
**Decision:** `.v-glass` = floating chrome only; `.v-neu` = tactile controls (always bordered); 3D = exactly one landing hero. Elevation via `--v-shadow-sm/--v-shadow/--v-shadow-lg`, not custom shadows.
**Status:** Accepted (`styles/vrittih.css:6-7`). **Consequence:** the literal shadow re-inlined in `MatchPanel:139` is replaced by `--v-shadow`.

### DDR-10 — De-emphasis by colour step, never opacity
**Decision:** Four ink steps (`--v-ink`, `--v-ink-2`, `--v-ink-3`, `--ink-disabled`). No `opacity` for muting text.
**Status:** Accepted (`styles/vrittih.css:80`). **Consequence:** disabled states use `--ink-disabled`, keeping dark-mode legibility (opacity double-dims on dark surfaces).

### DDR-11 — One icon set
**Decision:** `ui/Icons.tsx` (duotone, `currentColor`, 24×24, 1.75 stroke) is canonical. `ui/DuotoneIcons.tsx` is deleted.
**Status:** Accepted. **Consequence:** `currentColor` means icons inherit token colour — no icon ever carries hex.

---

## 8. Known Gaps

1. **No shared primitive layer.** Zero `Button`/`Card`/`Table`/`Input`/`Field`/`Badge`/`Chip`/`Modal`/`Meter` exist. Every surface, CTA, chip, bar and form is re-declared in each file's local `const S`. *(Closed by Phase 1.)*
2. **Accessibility defect in production.** CTAs use `#6495ED` (documented ~2.6:1, fails WCAG AA) instead of `--v-accent #4F63D2` — e.g. `MatchPanel:144`, `EmptyState:66`. Ships today.
3. **Radius tokens are aspirational.** `var(--v-r*)` = 0 consumers; radii are magic numbers (`16`/`14`/`13`/`11`). Even the "good" `AstroCard` inlines `borderRadius:999/14/13`.
4. **Two overlapping token scales.** Radius (`--v-r*` vs `--r-*`) and hairline (`--v-line*` vs `--border*`), plus a duplicate `--r-pill`/`--v-r-pill`. *(DDR-03/04, Phase 0.)*
5. **Off-token status palettes.** `tierColor`/`diffColor`/`scoreTone`/`diffTone` hex maps in ~6 career panels, using greens/ambers that don't match `--v-green`/`--warn`.
6. **Legacy teal-green survivors** (pre-cornflower rebrand): `AdminShell:70` (`rgba(15,110,86,.2)`/`#9FD4C3`), `NotificationBell:127` (`rgba(15,110,86,.04)`), and `navbar.module.css` wordmark/mobile links. Flag for removal.
7. **Tables not componentized** — markup lives in `app/` routes.
8. **Four nav surfaces** (`AppShell`/`AdminShell`/`CrmShell`/`layout Navbar`) with three palettes.
9. **Dark mode is token-gated.** Only token-driven files flip via `:root[data-theme="dark"]`. Every raw-hex file (all `developers/*`, `EmptyState`, `AdminShell`, `Navbar`) renders wrong in dark. This is the hidden cost of DDR-02 violations.
10. **Duplicate concepts:** two astro cards (`AstroCard` v1 tokens vs `AstroJobCard` redesign tokens); `DuotoneIcons` superseded by `Icons`; `CrmShell` redundant.
11. **Missing primitives with no home yet:** `Modal`, `Toast`, `Tooltip`, `Tabs`, `Pagination`, `Skeleton` wrapper (only the raw `.v-skeleton` class exists).
12. **No visual regression / component gallery.** Nothing renders the DS in isolation; drift is invisible until production.

---

## 9. Roadmap

| Version | Theme | Exit criteria |
|---------|-------|---------------|
| **v0.1** *(this doc)* | Inventory + decisions | §1–12 written; every DDR grounded in a real file/token |
| **v0.2** | Token consolidation | Phase 0 done; legacy scales are aliases; duplicate pill gone; lint gate at `warn` |
| **v0.3** | Primitive layer | Phase 1 shipped; `Button`/`Card`/`Field`/`Badge`/`Meter`/`Tone`/`DataTable`/`Modal` in `components/ui/` |
| **v0.4** | Career migration | Phase 2 done → AA defect closed, all `career/*` hex maps deleted |
| **v0.5** | Developers + tables | Phase 3 done; no table markup in `app/` |
| **v0.6** | Nav consolidation | Phase 4 done → one shell; `CrmShell`/`Navbar` gone; `AdminShell` tokenized |
| **v0.7** | Long tail + dark audit | Phase 5 done; every screen verified in light **and** dark |
| **v1.0** | Enforced & documented | lint gate at `error` (no raw hex outside allowlist); component gallery live; a11y sign-off; legacy alias tokens removed |

---

## 10. Migration Notes

**Strangler-fig, never big-bang.** The codebase reached ~15 duplicate cards because refactors were deferred; we replace surface-by-surface with primitives while the old `const S` keeps working until its file is migrated.

### Step 1 — Alias, don't rename *(zero file edits)*
Add aliases so legacy token names resolve to canonical values. Nothing breaks, and every future file naturally lands on the canonical scale.

```css
:root{
  /* radius: legacy → canonical */
  --v-r-sm: var(--r-sm); --v-r: var(--r-lg); --v-r-lg: var(--r-lg);
  /* hairline: legacy → canonical */
  --v-line: var(--border); --v-line-2: var(--border-strong);
}
/* delete the duplicate --v-r-pill; keep --r-pill */
```

### Step 2 — Introduce primitives alongside `const S`
Land Phase-1 primitives. A file can import `<Card>` for its main surface while still using its local `S` for the rest — partial migration is allowed and encouraged.

### Step 3 — Per-file recipe (repeat until a file has no `const S`)
Legacy → canonical mapping for the common offenders:

| Legacy pattern (real example) | Replace with |
|-------------------------------|--------------|
| `S.card = { background:"#fff", border:"1px solid #E5E7EB", borderRadius:16, boxShadow:"…" }` (`MatchPanel:139`) | `<Card>` |
| `S.cta = { background:"#6495ED", color:"#fff", borderRadius:11 }` (`MatchPanel:144`, `EmptyState:66`) | `<Button variant="primary">` (fill = `--v-accent`) |
| `tierColor(n)`/`diffColor`/`scoreTone` hex maps | `tone(n)` from `ui/Tone.ts` |
| hand-rolled bar rows (`MatchPanel:149`) | `<Meter value tone>` |
| `developers/*` form blocks | `<Field><Input/></Field>` |
| `borderRadius: 16/14/13` · `11/10` | `--r-lg` · `--r-md` |
| `border:"1px solid #E5E7EB"` | `1px solid var(--border)` |
| `#16A34A` / `#B45309` / `#DC2626` | `var(--v-green)` / `var(--warn)` / `var(--danger)` |

### Step 4 — Codemod raw radii
One-shot AST/regex codemod maps numeric `borderRadius` to the nearest token per DDR-03. Review the diff — snapping `16→12` is intentional (the DS has no 16 radius).

### Step 5 — Ratchet the lint gate
`no-raw-hex` starts at `warn` (v0.2) so it never blocks unrelated work, flips to `error` at v1.0 once every file is migrated. Allowlist: `PipelineDonut`, chart series, `Logo`, `IllustrationSlot`, `EmptyState` hero gradient, `CareersSite` tenant colour.

### Order of migration
Follow the **§6 tracker order** exactly — it is dependency-sorted. Migrating `career/*` (Phase 2) before the primitives exist (Phase 1) just recreates the duplication we are removing.

### Nav-specific notes
- `CrmShell` deletion is a find-replace: `import CrmShell` → `import AppShell` (it already only renders `<AppShell>`).
- `AdminShell` is *tokenized in place*, not merged into `AppShell` — admin retains its dark-slab density; only the palette changes (kill `rgba(15,110,86,.2)`/`#9FD4C3` → `--v-accent-soft`/`--v-accent`).
- `layout/Navbar` retirement is last; marketing pages must be re-verified against tokens before deleting `navbar.module.css`.

---

## 11. Verification checklist

Run before merging any UI PR. Grep commands are the enforceable ones.

**Tokens & colour**
- [ ] No raw hex in component/route code — `grep -rnE "#[0-9A-Fa-f]{3,6}" components/ app/` returns only allowlisted files (dataviz, brand marks, tenant colour).
- [ ] No legacy teal-green — `grep -rnE "0F6E56|9FD4C3|15,110,86" components/ app/` returns **nothing**.
- [ ] No `#6495ED` used as a CTA fill or on-white text colour (decoration/gradient only) — DDR-07.
- [ ] Radii use `--r-sm/md/lg`; no numeric `borderRadius` — `grep -rnE "borderRadius:\s*[0-9]" components/`.
- [ ] Hairlines use `--border`/`--border-strong` (or aliases), not literal `#E5E7EB`.
- [ ] Status colour comes from `tone()` / semantic tokens; no local `*Color`/`*Tone` hex map.

**Structure**
- [ ] New surfaces use `<Card>`; new CTAs use `<Button>`; new forms use `<Field>/<Input>`; new lists use `<DataTable>` — no new `const S`.
- [ ] No new nav surface; app pages render inside `AppShell` (admin inside tokenized `AdminShell`).
- [ ] Icons imported from `ui/Icons.tsx` (not `DuotoneIcons`), colour via `currentColor`.

**Theme & motion**
- [ ] Verified in **light and dark** (`data-theme="dark"` and OS `prefers-color-scheme`); no hardcoded surface/ink.
- [ ] De-emphasis via ink step, not `opacity` — DDR-10.
- [ ] Respects `prefers-reduced-motion`; animations use `--v-ease`/`--v-spring`, elevation uses `--v-shadow*`.

**Accessibility**
- [ ] Interactive fills = `--v-accent` (AA verified); text/contrast ≥ 4.5:1 (≥ 3:1 large).
- [ ] Visible global focus ring on every interactive element.
- [ ] Empty/loading/error states present (`EmptyState` + `.v-skeleton`), never a blank surface.

**Type**
- [ ] Headings use `--font-display` (Bricolage) + `--fs-*`; body uses `--font-sans`.

---

## 12. Changelog

### v0.1 — *created*
- First formal Vrittih Design System document. Grounded entirely in the live codebase (`styles/vrittih.css`, `components/**`) — every claim cites a real file/token/line.
- Captured the **§6 Implementation Tracker** (dependency-ordered Phases 0–5), from token consolidation → eight new primitives → career/developers/nav/long-tail migration.
- Recorded **11 Design Decision Records** (DDR-01 one-shell, -02 tokens-only, -03 single radius scale, -04 single hairline scale, -05 one table framework, -06 Inter+Bricolage, -07 AA accent `#4F63D2`, -08 semantic-tokens-not-hex-maps, -09 depth jurisdiction, -10 colour-step de-emphasis, -11 one icon set).
- Documented **12 Known Gaps**, including a shipping WCAG-AA CTA defect (`#6495ED` at ~2.6:1) and the finding that `--v-r*` radius tokens have **zero** consumers.
- Defined the **v0.1 → v1.0 roadmap** and a **strangler-fig migration** with an alias-first token step and a per-file replacement recipe.
- Added an enforceable **verification checklist** with grep commands wired to the DDRs.
