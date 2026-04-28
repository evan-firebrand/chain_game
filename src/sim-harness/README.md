# sim-harness

**Owner:** Simulation Agent
**Phase:** 5

Headless batch runner. Plays N games using automated strategies, outputs statistics. Data model designed for inverse querying from day one (Design Intent Solver, Stage E, depends on this schema).

**Imports from:** `game-kernel` only. Never from `game-session` or `ui`.

## Files

| File | Purpose | Phase |
|---|---|---|
| `types.ts` | Output schema — EVAN-APPROVED before runner code is written | 5 |
| `runner.ts` | Single-config runner: N games → results array | 5 |
| `sweep.ts` | Parameter sweep: varies one config key across a range | 5 |
| `analyzer.ts` | Statistics extraction from event logs | 5 |
| `strategies/random.ts` | Random-move strategy | 5 |
| `strategies/greedy.ts` | Greedy strategy (highest immediate result) | 5 |
| `strategies/heuristic.ts` | Heuristic strategy (designed-intent play) | 5 |

## Critical constraint

`types.ts` schema must be designed and approved by Evan BEFORE any runner code. The Design Intent Solver (Stage E) will be built on this data. Schema changes after Stage E exists are breaking.

Schema row shape: `{ inputs: { k, gridW, gridH, spawnWeights, ... }, outputs: { medianGameLength, p10/p90, maxTileDistribution, chainLengthDistribution, retirementEvents, deathCause, ... } }`
