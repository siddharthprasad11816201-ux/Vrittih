# Vrittih Design System

**"Every industry. Every professional. One network."**
One brand, every screen. Built fully in-house — no Tailwind, Framer, shadcn, Three.js, or icon library. Tokens live in [`styles/vrittih.css`](../styles/vrittih.css) and are the single source of truth.

## Palette (light + dark)

| Token | Light | Role |
|---|---|---|
| `--brand-900` | `#04342C` | ink green — display text, dark slabs |
| `--brand-700` | `#0B5A46` | pressed/active |
| `--brand-600` / `--v-accent` | `#0F6E56` | primary actions |
| `--brand-400` | `#1D9E75` | hover, focus ring, live indicators |
| `--brand-100` / `--v-accent-soft` | `#E1F5EE` | tints, selected rows, badges |
| `--cream-0` / `--v-bg` | `#FAF8F2` | page canvas |
| `--v-ink` | `#101311` | body text |
| **`--gold`** | `#C8A24B` | **RESERVED: the Verified badge only** — verification must read as precious |
| `--warn` `--danger` `--info` | `#BA7517` `#A32D2D` `#185FA5` | **status only, never decoration** |

Dark mode flips at the token level via `:root[data-theme="dark"]` / `prefers-color-scheme`. Screens built on tokens follow automatically.

## Type

- **Display** — `--font-display` (Fraunces, serif fallback): hero, greetings, section titles only.
- **UI/body** — `--font-sans` (Inter): 400/500 only.
- **Data** — `--font-mono` (JetBrains Mono): IDs, timestamps, salary/CHF figures.
- All sizes fluid: `--fs-display`, `--fs-h1/2/3`, `--fs-body`, `--fs-sm` (`clamp()`, no breakpoint jumps).
- Fonts self-hosted from `/public/fonts` via `@font-face` (no CDN). Until the woff2 files are added, the stack falls back to the system serif/sans/mono.

## Depth language — strict jurisdiction (never mix)

1. **Glass** (`.v-glass`) — floating chrome ONLY: sticky navbar, ⌘K palette, toasts, the live pipeline widget. Never on content cards (text must sit on solid surfaces).
2. **Neumorphic** (`.v-neu`) — tactile controls ONLY: toggles, sliders, segmented controls, progress ring, search field. **Hard rule: always a visible 1px border + a state color change** (`[data-on="true"]`/`:active`) — shadow-only affordances fail accessibility. Never on text surfaces.
3. **3D** — ONE landing hero moment (in-house `<canvas>` node-lattice, pauses off-viewport, static fallback). Elsewhere only a ≤4° mouse-tilt on non-form cards.

Borders do structure (1px hairlines at 10–14% ink), shadows do elevation — never both heavy at once. Corners: 16px cards, 10px controls, 999px pills.

## Motion grammar

- Springs for interactive elements (`--v-spring`); eases (`--v-ease`) for surfaces.
- Micro: magnetic primary buttons (≤6px), checkmark draw-on, count-up once on first view, `.v-live` pulse only while live.
- Sections rise+fade 12px on scroll, 60ms stagger, once.
- `.v-skeleton` shimmer shaped like final content; no generic gray boxes.
- `prefers-reduced-motion` collapses everything to instant opacity.

## Quality floor

WCAG AA on every pair (test glass + neu surfaces); visible 2px `--brand-400` focus ring; responsive to 360px (sidebar → bottom sheet, tables → stacked cards < 720px); sentence case; buttons are verbs; empty/loading/error states designed for every view; **currency is CHF, never ₹**; no fabricated stats.

## Signature element per screen

| Screen | Signature |
|---|---|
| Landing `/` | live Application-pipeline glass widget over the node-lattice |
| Login `/login` | passkey-first + topographic brand panel |
| Dashboard `/dashboard` | "Needs your attention" leads (zeros never lead) + 7-tier kanban |
| Admin `/admin/jobs` | bulk-select glass action bar + side detail drawer + audit log |
| Tracker `/applications` | the 7-step live pipeline card ("first click to offer letter") |
