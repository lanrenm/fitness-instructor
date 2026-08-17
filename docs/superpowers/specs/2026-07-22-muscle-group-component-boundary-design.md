# Muscle Group Component Boundary Migration Design

**Date:** 2026-07-22

## Goal

Move muscle-group-specific UI out of `packages/ui-components` and into web-local components so Module Federation shares only generic UI primitives and cannot break the whole web app when business exports change.

## Approved boundary

`packages/ui-components` retains reusable primitives and cross-page components: `Modal`, `Button`, `Input`, `StatsCard`, `StatsCardGroup`, `SectionCard`, `SessionRecordItem`, `IntensityChart`, and shared utilities.

`apps/web/src/components/muscle-groups/` owns `MuscleGroupCard`, `MuscleGroupDetailDialog`, `MuscleGroupFormDialog`, and `accentFor`. These components retain their current behavior and visual design; this is a module-location change, not a feature redesign.

`MuscleGroups.tsx` imports generic components from `@fitness/ui-components` and muscle-group components from the local web directory. The API, services, hooks, CRUD behavior, parent-child drill-down, and data contracts remain unchanged.

## File changes

- Move `packages/ui-components/src/components/ui/muscle-group-card.tsx` to `apps/web/src/components/muscle-groups/MuscleGroupCard.tsx`.
- Move `packages/ui-components/src/components/ui/muscle-group-detail-dialog.tsx` to `apps/web/src/components/muscle-groups/MuscleGroupDetailDialog.tsx`.
- Move `packages/ui-components/src/components/ui/muscle-group-form-dialog.tsx` to `apps/web/src/components/muscle-groups/MuscleGroupFormDialog.tsx`.
- Move `packages/ui-components/src/lib/accent.ts` to `apps/web/src/components/muscle-groups/accent.ts`.
- Add `apps/web/src/components/muscle-groups/index.ts` for local exports.
- Remove the four business exports from `packages/ui-components/src/index.ts`.
- Update `MuscleGroups.tsx` imports and any local component imports to use the web path.
- Update `apps/web` Tailwind source scanning only if the moved files require it.
- Keep `Modal` imported from `@fitness/ui-components` by local dialog components.

## Compatibility and verification

The shared package's ESM entry remains the canonical import entry. The migration must not add a new shared export. Verify the shared package build, web TypeScript/build checks, and the generated Federation shared module. The generated module must not require any muscle-group export, while generic exports such as `StatsCardGroup` remain available. Run the existing CDP verification against the Docker-served web page after rebuilding the relevant web runtime environment.

## Scope exclusions

Do not change API behavior, hooks, service functions, visual requirements, CRUD semantics, Docker architecture, or unrelated shared components.
