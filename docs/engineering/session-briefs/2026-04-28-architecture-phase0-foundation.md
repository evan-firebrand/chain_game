# Session Brief: Architecture Agent — Phase 0 Foundation

**Date:** 2026-04-28
**Agent role:** Architecture Agent
**Assigned by:** Evan (head engineer review)
**Status:** COMPLETE — this session produced the Phase 0 deliverables

---

## Context

The game design phase is complete. Five core design docs exist in `docs/` (plus `swarm_framework.md` and `swarm_prompts.md`). No code exists. The engineering team (AI agents + 2-3 human collaborators) is starting Phase 0 — establishing the contracts and scaffolding that all future phases depend on.

This is the first agent session on the engineering side of the project.

---

## Task

Create all Phase 0 foundation artifacts:
1. `CLAUDE.md` — agent orientation file (root level)
2. `docs/engineering/ARCHITECTURE.md` — module diagram, phase sequence, CI pipeline
3. `docs/engineering/KERNEL_INTERFACE.md` — TypeScript interface contracts (load-bearing, Evan-approved)
4. `docs/engineering/FOLDER_STRUCTURE.md` — canonical path map with ownership
5. `docs/engineering/adr/0000-tech-stack.md` — tech stack decision
6. `docs/engineering/adr/0001-pure-kernel-module.md` — pure kernel architecture decision
7. Project scaffolding: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.eslintrc.json`, `vite.config.ts`
8. `index.html` — browser entry point (Phase 0 placeholder only)
9. CI: `.github/workflows/ci.yml`
10. Issue templates: `design-question.md`, `bug.md`, `phase-gate.md`
11. PR template: `.github/pull_request_template.md`
12. Folder skeleton: `src/game-kernel/`, `src/game-session/`, `src/ui/`, `src/tuning-console/`, `src/sim-harness/strategies/`, `tests/game-kernel/`, `tests/game-session/`, `tests/sim-harness/` — README stubs only, no implementation code
13. Boundary check scripts: `scripts/check-boundaries.js`, `scripts/check-kernel-coverage.js`
14. This session brief

---

## Acceptance criteria

1. Every agent who reads `CLAUDE.md` + the session brief for their first task can orient without reading source code
2. `KERNEL_INTERFACE.md` contains complete TypeScript type definitions for `GameState`, `GameConfig`, `Action`, `GameEvent`, and all public kernel functions
3. `KERNEL_INTERFACE.md` is marked "Proposed — awaiting Evan approval"
4. Both ADRs are in accepted state with full context/options/rationale sections
5. `package.json` has zero runtime dependencies; only devDependencies
6. `tsconfig.json` has `strict: true` and `noImplicitAny: true`
7. CI workflow covers: typecheck, lint, test+coverage, boundary check, build
8. All five `src/` module directories have README stubs explaining ownership and constraints
9. All three `tests/` directories have README stubs
10. No implementation code exists (stubs only — READMEs and placeholder files)

---

## Files read first

1. `docs/Merge_Game_Specification.md`
2. `docs/Merge_Game_Design_Journal.md`
3. `docs/Merge_Game_Tooling_Specification.md`
4. `docs/Game_Design_Concepts.md`

---

## Do NOT

- Write any game logic (that is Phase 1)
- Write any UI rendering code (that is Phase 2)
- Make any decisions about special tile types or Layer 2 content (deferred to Phase 6+)
- Decide the visual design or aesthetics (Phase 7)
- Add any runtime dependencies to `package.json`

---

## Open questions filed during this session

File GitHub `design-question` issues for these before Phase 1 starts:
1. L=1 chain spawn count: L-1=0 or minimum 1?
2. "Last position" when chain path revisits a column
3. Gravity order for simultaneous column drops
4. Board fill on new game: full 42 cells or partial?
5. Initial board: guarantee at least one legal chain start?
