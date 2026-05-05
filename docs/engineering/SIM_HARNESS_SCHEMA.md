# Simulation Harness Schema

**Status:** Approved for Phase 5 implementation
**Owner:** Simulation Agent
**Approved:** 2026-04-28

The simulation harness output is designed for forward batch analysis now and inverse querying later. Each run keeps enough raw per-game data to answer design questions without replaying every game, while aggregate rows stay compact for sweeps.

## Row Shape

```typescript
interface SweepResultRow {
  readonly inputs: SimulationInputs;
  readonly outputs: SimulationOutputs;
  readonly games: readonly GameRunResult[];
}
```

## Inputs

- `config`: full `GameConfig`
- `strategyId`: `random`, `greedy`, or `heuristic`
- `runCount`: number of games
- `baseSeed`: first seed used for the batch
- `maxTurns`: safety cap per game
- `maxChainLength`: strategy search cap
- `retirementMode`: label for the implemented retirement policy, currently `cascade`

## Per-Game Result

- `runIndex`
- `seed`
- `strategyId`
- `finalTurn`
- `finalPhase`
- `deathCause`
- `maxTileReached`
- `activeSpawnPoolAtDeath`
- `events`
- `turns`

Each `turns` entry records:

- turn number
- committed chain
- chain length
- result value
- legal chain-start count before and after the action
- active spawn pool before and after the action
- retired tile count before and after the action
- isolated retired tile count before and after the action
- events produced by that turn

## Outputs

Aggregate outputs include:

- game length p10, median, p90
- max tile distribution
- chain length distribution
- result value distribution
- death cause distribution
- retirement metrics

## Retirement Metrics

The schema preserves the Phase 4 follow-up questions:

- turn of first retirement
- turn of each retirement milestone
- number of retirement events per game
- number of cascade retirements per transition
- whether a cascade retirement is followed by immediate game-over
- max tile reached before death
- active spawn pool at death
- retired tile count over time
- isolated retired tile count over time
- legal chain-start count before and after each retirement
- chain length and result value that triggered each retirement

## Determinism Requirement

For a fixed config, seed, run count, strategy, max turn cap, and max chain length, the result object must be deeply identical across runs.
