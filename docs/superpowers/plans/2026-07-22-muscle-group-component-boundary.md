# Muscle Group Component Boundary Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move muscle-group-specific UI from the shared UI package into web-local components so Module Federation shares only generic UI primitives.

**Architecture:** Keep `Modal` and generic layout/stat components in `packages/ui-components`. Move the three muscle-group components and the accent utility into `apps/web/src/components/muscle-groups/`, then update the page imports and shared package barrel. Preserve all current props and behavior.

**Tech Stack:** React 19, TypeScript, Vite, Module Federation, tsup, Tailwind CSS, pnpm workspace, Docker Compose.

---

### Task 1: Copy business components into web-local modules

**Files:**
- Create: `apps/web/src/components/muscle-groups/MuscleGroupCard.tsx`
- Create: `apps/web/src/components/muscle-groups/MuscleGroupDetailDialog.tsx`
- Create: `apps/web/src/components/muscle-groups/MuscleGroupFormDialog.tsx`
- Create: `apps/web/src/components/muscle-groups/accent.ts`
- Create: `apps/web/src/components/muscle-groups/index.ts`
- Read source: `packages/ui-components/src/components/ui/muscle-group-card.tsx`
- Read source: `packages/ui-components/src/components/ui/muscle-group-detail-dialog.tsx`
- Read source: `packages/ui-components/src/components/ui/muscle-group-form-dialog.tsx`
- Read source: `packages/ui-components/src/lib/accent.ts`

- [ ] **Step 1: Copy each implementation without changing behavior**

Copy each source implementation into the web-local directory. Preserve the existing public props and replace only package-relative imports as needed. The dialog components must continue importing the generic `Modal` and `cn` from `@fitness/ui-components`; `accent.ts` must remain dependency-free.

- [ ] **Step 2: Add a local barrel**

Create `apps/web/src/components/muscle-groups/index.ts` with:

```ts
export { MuscleGroupCard } from './MuscleGroupCard'
export type { MuscleGroupCardProps } from './MuscleGroupCard'
export { MuscleGroupDetailDialog } from './MuscleGroupDetailDialog'
export type { ChildMuscleEntry, MuscleGroupDetailDialogProps } from './MuscleGroupDetailDialog'
export { MuscleGroupFormDialog } from './MuscleGroupFormDialog'
export type { MuscleGroupFormDialogProps, ParentOption } from './MuscleGroupFormDialog'
export { accentFor } from './accent'
export type { AccentPalette } from './accent'
```

- [ ] **Step 3: Run web type-check to expose import or path issues**

Run:

```bash
pnpm --filter web exec tsc -b --pretty false
```

Expected: The new local files compile; any remaining failure must be limited to pre-existing errors and recorded before continuing.

- [ ] **Step 4: Commit the local component move**

```bash
git add apps/web/src/components/muscle-groups
git commit -m "refactor(web): move muscle group UI local"
```

### Task 2: Remove business exports from shared UI package

**Files:**
- Modify: `packages/ui-components/src/index.ts:12-15`

- [ ] **Step 1: Remove only muscle-group exports**

Delete the exports for `MuscleGroupCard`, `MuscleGroupDetailDialog`, `MuscleGroupFormDialog`, and `accentFor`. Keep `Modal`, `StatsCardGroup`, and every other generic export unchanged.

The resulting tail of the barrel should be:

```ts
export { Modal, type ModalProps } from './components/ui/modal'
```

- [ ] **Step 2: Build the shared package**

Run:

```bash
pnpm --filter @fitness/ui-components build
```

Expected: tsup and declaration generation pass, and `dist/index.mjs` contains generic exports but no `MuscleGroupCard`, `MuscleGroupDetailDialog`, `MuscleGroupFormDialog`, or `accentFor`.

- [ ] **Step 3: Commit the shared boundary change**

```bash
git add packages/ui-components/src/index.ts packages/ui-components/dist
 git commit -m "refactor(ui-components): remove muscle group business exports"
```

### Task 3: Update the muscle groups page imports and preserve behavior

**Files:**
- Modify: `apps/web/src/pages/Layout/Training/MuscleGroups.tsx:5-14`

- [ ] **Step 1: Split generic and local imports**

Replace the current combined import with:

```ts
import { StatsCardGroup } from '@fitness/ui-components'
import {
  MuscleGroupCard,
  MuscleGroupDetailDialog,
  MuscleGroupFormDialog,
  accentFor,
} from '../../../components/muscle-groups'
```

Keep the hooks, stats calculations, detail stack, CRUD mutation calls, parent filtering, and JSX unchanged.

- [ ] **Step 2: Run web build**

Run:

```bash
pnpm --filter web build
```

Expected: The new page import resolves. If the existing unused `login` error in `apps/web/src/pages/App.tsx` remains, fix only that pre-existing unused function or document it separately; do not alter unrelated page behavior.

- [ ] **Step 3: Verify generated Federation shared module**

Start the web dev server and inspect the virtual shared module:

```bash
rm -rf apps/web/node_modules/.vite
pnpm --filter web dev --host 0.0.0.0 --port 5175
curl -sS 'http://localhost:5175/@id/__x00__virtual:mf:__mfe_internal__web__loadShare___mf_0_fitness_mf_1_ui_mf_2_components__loadShare__.js'
```

Expected: The module exports generic names such as `StatsCardGroup` and does not contain any `MuscleGroupCard` export or reference.

- [ ] **Step 4: Commit page import changes**

```bash
git add apps/web/src/pages/Layout/Training/MuscleGroups.tsx
git commit -m "refactor(web): import muscle group components locally"
```

### Task 4: Verify Docker runtime uses the corrected boundary

**Files:**
- Inspect: `.docker/docker-compose.yml`
- Inspect: `apps/web/Dockerfile`
- No source changes unless the runtime cannot consume the current workspace mount.

- [ ] **Step 1: Clear only the web runtime cache**

Run:

```bash
docker exec fi-web sh -lc 'rm -rf /app/node_modules/.vite /app/node_modules/.vite-temp'
```

- [ ] **Step 2: Restart the web container**

Run:

```bash
docker restart fi-web
```

- [ ] **Step 3: Inspect the live federation module**

Run:

```bash
curl -sS 'http://localhost:5173/@id/__x00__virtual:mf:__mfe_internal__web__loadShare___mf_0_fitness_mf_1_ui_mf_2_components__loadShare__.js'
```

Expected: The generated module contains generic exports only and no `MuscleGroupCard` export. The page no longer imports the business components through this module.

- [ ] **Step 4: Run the existing CDP E2E check**

Run:

```bash
node scripts-tmp/muscle-groups-verify.mjs
```

Expected: Login, seed injection, page rendering, detail dialog, add, delete, cleanup, and all assertions pass.

### Task 5: Final regression verification

**Files:** None.

- [ ] **Step 1: Verify shared package exports**

Run:

```bash
node -e "import('./packages/ui-components/dist/index.mjs').then(m=>console.log(Object.keys(m).sort().join(',')))"
```

Expected: Generic UI exports are present; muscle-group business exports are absent.

- [ ] **Step 2: Verify repository state**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: Only intentionally untracked pre-existing debug scripts remain; no generated cache or dependency artifacts are staged.

- [ ] **Step 3: Push the completed branch**

```bash
git push origin feature/lijm
```

Expected: The branch updates successfully without force-push.
