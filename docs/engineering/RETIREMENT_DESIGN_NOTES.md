# Retirement Design Notes

**Status:** Phase 4 working notes  
**Owner:** Engineering, for Evan review  
**Created:** 2026-04-28

## Validation Item: Overshoot Retirement Pacing

Phase 4 currently experiments with **cascade retirement within a committed chain**.
The spawn pool remains an 8-tier sliding window, so it does **not** grow wider:

| Retirement count | Active spawn pool |
|---|---|
| 0 | 2-256 |
| 1 | 4-512 |
| 2 | 8-1024 |
| 3 | 16-2048 |

The edge case to test is a chain result that jumps over more than one retirement threshold.
Example: active pool is `2-256`, and the player creates `2048` in one chain.

Current behavior:
- Same turn: `2`, `4`, and `8` retire in order.
- Pool becomes `16-2048`.
- The pool width stays fixed at 8 tiers, and the active ceiling catches up immediately to `maxTileEver`.

Alternative behavior:
- Cap retirement at one tier per committed chain.
- Example above would retire only `2`; pool becomes `4-512`.
- Later turns would retire additional tiers one at a time until the pool catches up.

## Implications to Playtest

One-retirement-per-turn is gentler and keeps milestone pressure paced, but it can create delayed retirement pressure: a later small chain may trigger a retirement caused by an earlier large overshoot. It also gives players extra cleanup time for soon-to-retire tiers.

Cascade retirement is more internally synchronized with player achievement, but it may feel punishing if one strong chain suddenly strands multiple tiers.

## Proposed Gate Check

During Phase 4 UAT, deliberately create or simulate at least one threshold overshoot and decide whether:

1. cascade retirement feels readable and fair, or
2. retirement should be capped at one tier per committed chain.

The current implementation emits one `retirement-fired` event per retired tier in the same transition.

## Phase 5 Simulation Follow-Up

Retirement pacing should be tested manually in Phase 4, then measured statistically in Phase 5 once the Simulation Harness exists.

The Phase 5 sim schema should include retirement-specific metrics before runner implementation begins:

- turn of first retirement
- turn of each retirement milestone
- number of retirement events per game
- number of cascade retirements per transition
- whether a cascade retirement is followed by immediate `game-over`
- max tile reached before death
- active spawn pool at death
- retired tile count on board over time
- isolated retired tile count on board over time
- legal chain-start count before and after each retirement
- chain length and result value that triggered each retirement

These metrics should be compared across at least:

- cascade retirement vs one-retirement-per-turn
- different `ruleK` values
- different spawn weight profiles
- different automated strategies

Goal: determine whether retirement adds strategic depth without creating an unfair difficulty cliff, and whether cascade retirement creates better pacing than delayed one-step retirement.
