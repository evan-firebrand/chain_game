## What this PR does

<!-- One paragraph. What changed, why it changed, and what problem it solves.
     "What" is in the diff — write the "why" and the "so that". -->

## Agent / author

<!-- Which agent role wrote this? Game Logic Agent / Test Agent / UI Agent / etc.
     Link the session brief that scoped this work if one exists. -->
- **Role:**
- **Session brief:** `docs/engineering/session-briefs/`

## Spec sections implemented

<!-- Cite the exact doc and section. Reviewers use this to verify correctness. -->

| Section | Doc | Notes |
|---|---|---|
|   | `docs/engineering/KERNEL_INTERFACE.md` | |
|   | `docs/Merge_Game_Specification.md` | |

## What is NOT in this PR

<!-- Explicit out-of-scope declaration. Prevents scope creep and reviewer confusion. -->
- 

## Ambiguities encountered

<!-- Any spec gap you hit. Either link the design-question issue you filed,
     or explain the conservative default you implemented + TODO comment left. -->
- None / see #___

## Test evidence

<!-- Paste the vitest run summary. Don't summarize — show the output. -->

```
Test Files  X passed (X)
Tests       X passed (X)
Type Errors no errors
```

Coverage on files changed:
```
file.ts  | % Stmts | % Branch | % Funcs | % Lines
```

- [ ] T1-T8b spec vectors pass (required for all kernel work)
- [ ] Coverage meets phase threshold (Phase 1: 100% funcs; Phase 2+: per ARCHITECTURE.md)
- [ ] Property tests pass if chain math was touched

## Boundary check

<!-- Paste the literal output of: node scripts/check-boundaries.js -->

```
Boundary check passed.
```

- [ ] No imports outside this module's allowed dependencies
- [ ] No game logic added outside `src/game-kernel/`
- [ ] `game-kernel/index.ts` public API unchanged — OR — breaking change with ADR filed at #___

## Docs updated

- [ ] `CLAUDE.md` phase/gate status updated if this closes or opens a phase
- [ ] Engineering doc updated if API or folder structure changed (`KERNEL_INTERFACE.md`, `ARCHITECTURE.md`, etc.)
- [ ] ADR filed if an architectural decision was made (any boundary change, new module, new dependency)

## Phase gate (fill if this PR closes a phase)

<!-- Delete this section if not a phase-closing PR. -->

Phase ___ gate criteria — all must be checked before Phase ___ can begin:

- [ ] 
- [ ] 
- [ ] 

## Open questions / follow-up issues

<!-- Anything you punted on, noticed but didn't fix, or want Evan to decide. -->
- 

## Ready for review by

<!-- "Evan" for anything touching game-kernel/index.ts, top-level docs, or merging to main.
     Otherwise name the agent role that should review. -->
