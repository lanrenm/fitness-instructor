# Design Token Migration (`:root` → `@theme`)

**Date:** 2026-07-23

## Goal

Migrate the design-token CSS custom properties in `apps/web/src/styles/index.css` from a plain `:root {}` block into Tailwind v4's `@theme {}` block so that semantic Tailwind utilities consumed by `@fitness/ui-components` (e.g. `bg-primary`, `text-primary-foreground`, `border-input`, `focus-visible:ring-ring`, `placeholder:text-muted-foreground`) get generated as actual CSS.

## Why this is a separate task

`d8eb0d1` previously expanded the `@source inline` class list in `apps/web/src/styles/index.css` from 94 to 155 classes to fix visible regressions in `StatsCard` and `Modal`. That fix restored "sizing / spacing" utilities (e.g. `px-6 py-6`, `py-4`, `py-5`, `mt-4`, `inline-flex`) but did **not** restore "semantic-token" utilities (`bg-primary`, `text-primary-foreground`, `border-input`, `focus-visible:ring-ring`, …).

Tailwind v4 only converts CSS custom properties declared inside `@theme {}` into utilities. Properties declared in a plain `:root {}` are still resolvable via `var(--color-*)` but **do not produce** Tailwind classes. With the current setup, the `@source inline` list marks these classes as needed, but Tailwind has no token to bind them to, so the generated CSS omits the rule entirely — the class string is present in the DOM but visually inert.

Affected consumers:

- `packages/ui-components/src/components/ui/button.tsx` — every `variant` (`bg-primary text-primary-foreground`, `bg-destructive text-destructive-foreground`, `bg-secondary text-secondary-foreground`, `bg-background border-input`, `text-primary`, …) and the shared base (`focus-visible:ring-ring`) is currently unstyled.
- `packages/ui-components/src/components/ui/input.tsx` — `border-input`, `bg-background`, `placeholder:text-muted-foreground`, `focus-visible:ring-ring`.

## Current state (`apps/web/src/styles/index.css` lines 11–17)

```css
:root {
  --color-primary: #FF6B35;
  --color-background: #FFFFFF;
  --color-surface: #F7FAFC;
  --color-text: #2D3748;
  --color-text-light: #718096;
}
```

Of these, only `--color-primary` and `--color-background` happen to coincide with Tailwind v4 theme-variable names. `--color-surface`, `--color-text`, `--color-text-light` are app-private vars used in the `body` block (`var(--color-text)`) and elsewhere — they are **not** used as Tailwind class names and must not be moved into `@theme`, otherwise Tailwind will mint orphan utilities (`bg-surface`, `text-text-light`).

## Tokens to add

Tailwind v4 generates utilities for any `--color-*` declared inside `@theme {}`. The set below is exactly the union of `@source inline` semantic-token classes used by `Button`, `Input`, and the migrated `Modal`/`StatsCard`:

| Token | Value | Rationale |
| --- | --- | --- |
| `--color-primary` | `#FF6B35` | Brand orange (existing) |
| `--color-primary-foreground` | `#FFFFFF` | White text on orange (matches Buttons's existing usage) |
| `--color-destructive` | `#E53E3E` | Same red used inline as `text-[#E53E3E]` |
| `--color-destructive-foreground` | `#FFFFFF` | White text on red |
| `--color-secondary` | `#F7FAFC` | Reuse existing surface tone |
| `--color-secondary-foreground` | `#2D3748` | Reuse existing text tone |
| `--color-background` | `#FFFFFF` | Existing app background |
| `--color-accent` | `#F7FAFC` | Matches secondary for hover bg on outline/ghost variants |
| `--color-accent-foreground` | `#2D3748` | Matches secondary-foreground |
| `--color-input` | `#E2E8F0` | Matches inline `border-[#E2E8F0]` |
| `--color-ring` | `#FF6B35` | Matches primary |
| `--color-muted-foreground` | `#718096` | Matches existing `--color-text-light` |

Total: 12 tokens. Tailwind will automatically emit `bg-*`, `text-*`, `border-*`, `ring-*`, `placeholder:*`, `hover:*`, `focus-visible:*` variants for each.

## What is intentionally **not** migrated

The following are app-only design tokens that should stay in `:root` (or be left as is). Adding them to `@theme` would mint unwanted utilities.

- `--color-surface` (private; consumed only as `var()` literals if at all)
- `--color-text` (used by `body { color: var(--color-text) }` — keep as private var)
- `--color-text-light` (private; may collide with future semantic-token names)

## File change (single)

`apps/web/src/styles/index.css` — replace the `:root {}` block (lines 11–17) with two blocks:

1. A `@theme {}` block declaring the 12 semantic tokens listed above.
2. A `:root {}` block keeping `--color-surface`, `--color-text`, `--color-text-light` as private vars.

The `body` rule is untouched. `var(--color-background)` keeps resolving because Tailwind v4 hoists `@theme` variables to `:root`.

## Ordering

The `@theme` directive must come **after** `@import "tailwindcss"` and **after** `@source inline(...)`. Tokens follow the order in the table above for diff readability.

## Roll-out

1. Edit `apps/web/src/styles/index.css`.
2. Clear Vite dep cache (`.pnpm/.../vite/.../.vite`, plus container's `node_modules/.vite/deps` because the dev server runs in Docker with the named volume).
3. Reload `http://localhost:5173/` and the runtime SSR style probe (the existing CDP harness covers layout, font, button visibility — extend with one explicit assertion that a generated CSS rule contains `.bg-primary { background-color: var(--color-primary) }`).
4. Spot-check `/login` (the only page that uses `Button` outside the dashboard and muscle-groups). Verify primary orange button, destructive red, outline border visible, focus ring visible.
5. No Tailwind v4 config file (`tailwind.config.*`) exists or is needed — v4 is configured purely in CSS.

## Risks and mitigations

- **Conflict with `packages/ui-components/src/styles/globals.css`.** That file is a Tailwind v3-era remnant (`@tailwind base/components/utilities`, HSL channel values, `border-border` `@apply`). It is not imported by the web app and never was under v4. **No conflict** — leave it untouched and unused. If a future cleanup deletes it, the migration is unaffected.
- **Value drift between app body rule and primary class.** `body` uses `var(--color-text)` (private, dark gray); `text-primary` will resolve to `#FF6B35`. These are independent and intended.
- **`@source inline` already lists the classes.** No edit needed there. Verification is purely whether Tailwind emits the utility rules.

## Verification checklist

- [ ] `index.css` has one `@theme {}` block containing exactly the 12 tokens above and a `:root {}` block containing exactly the 3 private vars.
- [ ] Generated stylesheet (`/src/styles/index.css?direct` in dev) contains `.bg-primary`, `.text-primary-foreground`, `.border-input`, `.focus-visible\:ring-ring`, `.placeholder\:text-muted-foreground` rules resolving to the expected CSS variables.
- [ ] `/login` page renders primary orange button + outline border + visible focus ring on tab.
- [ ] `/training/muscle-groups` continues to render the 4 stats cards with padding/spacing (regression guard from `d8eb0d1`).
- [ ] No console errors, no hydration mismatches.
- [ ] Single-commit: `fix(web): migrate design tokens from :root to @theme`.
