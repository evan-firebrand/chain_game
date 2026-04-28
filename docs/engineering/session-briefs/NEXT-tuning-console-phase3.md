# Session Brief: UI Agent — Phase 3 Tuning Console

**Date:** 2026-04-28
**Agent role:** UI Agent (cross-team co-author with Game Logic Agent for the session.ts change)
**Assigned by:** Evan
**Status:** IN PROGRESS — branch `feat/phase3-tuning-console` (base `develop`)

---

## Context

Phases 1 and 2 are complete on `develop` (game-kernel + playable v1; UAT passed). Phase 3 adds the **Tuning Console** — the hero tool of this project per `docs/Merge_Game_Tooling_Specification.md`. It lets Evan adjust live tunables (`ruleK`, spawn weights) mid-game and restart-required tunables (`gridRows`, `gridCols`, `prngSeed`) via a `[New Game]` button.

The plan is documented at `C:\Users\eluck\.claude\plans\start-phase-3-stateless-garden.md`. Read that, then this brief.

---

## Phase 3 gate (verbatim from CLAUDE.md)

- [ ] All Tier 1 parameters exposed (`ruleK`, spawn weights per tier)
- [ ] Changing `k` mid-game produces correct results on next chain
- [ ] Config exportable as JSON
- [ ] Evan uses it in a real play session

---

## Task

Implement `src/tuning-console/` (3 files) and add a single `updateConfig` method to `GameSession`. Backfill the game-session unit tests deferred from Phase 2.

### Stage A — Docs (Evan-gated)
1. `docs/engineering/PARAMETER_TIERS.md` — DONE.
2. `docs/engineering/adr/0002-session-update-config.md` — DONE.
3. This brief — DONE.

### Stage B — game-session
4. Add `GameSession.updateConfig(patch: Partial<GameConfig>): void` per ADR 0002. Tier 1 keys merge live; Tier 2 keys throw.
5. `tests/game-session/session.test.ts` (Phase 2 backfill: initial state, valid commit, invalid commit, listener subscribe/unsubscribe, multi-listener, new-game).
6. `tests/game-session/session-update-config.test.ts` (k change visible in next chain math; spawn-weight change visible in next spawn; Tier 2 throws).

### Stage C — tuning-console
7. `src/tuning-console/config-export.ts` — `exportConfig(config) → string`, `importConfig(json) → GameConfig` with field-by-field validation.
8. `tests/tuning-console/config-export.test.ts` — round-trip + validation.
9. `src/tuning-console/controls.ts` — `makeSlider`, `makeNumberInput`, `makeButton` factory functions.
10. `src/tuning-console/console.ts` — top-level panel with mount/destroy.

### Stage D — UI integration + wrap-up
11. `src/ui/app.ts` — wrap `#app` in flex-row container alongside `#tuning-console-host`. Mount console after session creation. Read config from `session.getState().config` (replace captured `config` variable).
12. `src/ui/hud.ts` — add `[⚙ Tuning]` button to top bar.
13. `index.html` — adjust container layout if needed.
14. `vitest.config.ts` — remove `src/game-session/**` exclude; add `tuning-console/{console,controls}.ts` exclude (DOM); keep `config-export.ts` covered.
15. `src/tuning-console/README.md` — update to reflect what shipped.
16. `CLAUDE.md` — Phase 3 status: 🟡 NEXT → 🟢 IN PROGRESS at branch start; → ✅ COMPLETE at gate sign-off.

---

## Acceptance criteria

1. All four Phase 3 gate boxes ticked (the fourth is Evan UAT — last).
2. `npm run typecheck && npm run lint && npm test && npm run check-boundaries` — all green.
3. Coverage thresholds (80%) hold on `src/game-session/**` and `src/tuning-console/config-export.ts`.
4. No imports from `game-kernel` inside `src/tuning-console/`.
5. ADR 0002 + PARAMETER_TIERS.md merged before code-only commits land.
6. PR template Phase 3 Gate Checklist filled out with vitest summary, boundary output, coverage delta.

---

## Files to read first

1. `CLAUDE.md`
2. `docs/engineering/PARAMETER_TIERS.md`
3. `docs/engineering/adr/0002-session-update-config.md`
4. `docs/engineering/KERNEL_INTERFACE.md` (`GameConfig` shape)
5. `src/game-kernel/types.ts`, `rules.ts`, `board.ts`, `index.ts` — to understand mid-game safety
6. `src/game-session/session.ts` + `events.ts` — extension point
7. `src/ui/app.ts` + `hud.ts` — mount integration

---

## Do NOT

- Import `game-kernel` from `tuning-console` (CI boundary will fail).
- Compute any game logic in tuning-console (Prime Directive — game-kernel only).
- Mutate `GameState` or `GameConfig` directly (immutability invariant from ADR 0001).
- Persist config to localStorage (decided: no persistence in Phase 3).
- Expose `spawnPoolMin`/`spawnPoolMax` as sliders in Phase 3 (JSON-only — defer to Phase 5+).
- Cap grid sliders above the `Row`/`Col` literal type ranges (gridRows ≤ 7, gridCols ≤ 6).
- Merge to `main` from this PR — Evan promotes develop → main separately.

---

## Open design questions (already answered by Evan)

- Tier 2 exposure → grid + prngSeed behind `[Show advanced]`.
- JSON UX → textarea + clipboard.
- Persistence → none (always start at DEFAULT_CONFIG).
- `updateConfig` ownership → UI Agent authors with co-review note in PR.

If new ambiguities arise, follow the design gap protocol (CLAUDE.md): file a `design-question` issue, implement conservative default, add `// TODO(design-question: #NNN)`.
