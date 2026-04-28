# Phase 5.5 Requirements: Target-Based Tuning Investigation

**Status:** Draft for Evan approval  
**Owner:** Simulation / Architecture  
**Created:** 2026-04-28  
**Purpose:** Determine whether the current Endless v1.5 core can produce the intended pressure curve before Phase 6 content is added.

## Background

Phase 5 delivered the simulation harness and confirmed that retirement is measurable. Early simulation results suggest retirement works as a milestone/progression system, but it is not yet proven as the primary pressure system.

Important playtest correction: human play can produce very long chains. The exhaustive search cap used by early sim strategies is a strategy implementation limit, not a game rule. Evan reports that 15-20 tile chains are not rare because many board tiles remain compatible. Phase 5.5 must therefore model constructive long-chain behavior before drawing conclusions about retirement pressure or cascade danger.

The original design hypothesis was:

- retirement removes low tiers from the spawn pool
- stranded retired tiles become emergent blockers
- blockers shrink the effective board
- shrinking board health creates fair late-game death pressure
- players learn to manage pre-retirement cleanup and post-retirement recovery

The next phase should test that hypothesis directly.

## Core Question

Can we tune the current Endless rules so that the game world produces a target pressure curve?

Example target:

- approximately 25% natural death rate by turn 300
- average run length in a chosen range, e.g. 220-260 turns under cap-based measurement
- first retirement median around turn 50-100
- at least 80% of games reach one retirement
- cascade retirement immediate game-over rate below 5%
- stronger strategy outperforms random in progression and/or survival
- long-chain human-like strategies can trigger overshoot/cascade cases at realistic frequency

The exact targets are adjustable. The important requirement is that tuning is evaluated against explicit desired outcomes, not subjective inspection alone.

## Non-Goals

- Do not begin Phase 6 Layer 2 content yet.
- Do not add special tiles, wilds, blockers, multipliers, or new objectives.
- Do not change top-level design docs until Evan settles a design decision.
- Do not optimize the full Design Intent Solver yet. This phase is a lightweight precursor.

## Required Work

### 1. Add Experiment Profiles

Create a small set of named experiment configs that vary pressure-relevant knobs.

Required dimensions:

- board size
  - baseline `6x7`
  - tighter `5x6`
- `ruleK`
  - baseline `2`
  - slower growth `3`
  - optional high-volatility `1`
- spawn profile
  - baseline `1/value`
  - flatter weights
  - steeper weights
  - volatile upper-pool weights
  - narrower initial pool, e.g. `2-64`

Optional diagnostic-only dimension:

- harsh retired behavior
  - retired tiles cannot be used in chains
  - this is for pressure diagnosis only, not a proposed design change unless results justify it

### 2. Add Spawn Profile Support

Implement reusable helpers for generating spawn weights.

At minimum:

- `baselinePowerLaw`
- `flat`
- `steepPowerLaw`
- `volatile`
- `narrowPool`

The helpers should produce valid `GameConfig` objects or config patches. They must not duplicate game logic.

### 3. Add Target Scoring

Add a lightweight ranking function that compares simulation outputs to desired target metrics.

Inputs:

- `SimulationResultRow`
- `TuningTarget`

Outputs:

- numeric distance score
- per-metric deltas
- pass/fail flags for hard constraints

Initial target metrics:

- natural death rate by cap
- average or median final turn
- first retirement median
- percent of games with at least one retirement
- cascade immediate game-over rate
- max tile distribution band

### 4. Add Batch Experiment Runner

Add a script or module that runs a matrix of experiment profiles and returns ranked results.

Initial recommended sample:

- strategies:
  - random, `maxChainLength: 5`
  - greedy, `maxChainLength: 3`
  - long-chain random walk, no hard 5-tile cap
  - milestone-push long-chain strategy
- runs per variant: 100-200
- max turns: 300

The runner should print a compact table suitable for design review:

- profile name
- strategy
- runs
- cap
- death rate
- median final turn
- first retirement median
- retirement games percent
- cascade immediate game-over percent
- max tile distribution summary
- target distance score

### 5. Optimize or Limit Heuristic Strategy

The current heuristic strategy is too slow for broad sweeps because it simulates candidate actions.

Phase 5.5 should either:

- optimize heuristic enough for 100-200 game batches, or
- exclude heuristic from broad matrix runs and use it only for spot checks.

Acceptable initial approach:

- score only top N greedy candidates
- avoid full `applyAction` scoring for every candidate
- keep `maxChainLength` at 3 for heuristic

### 5a. Add Constructive Long-Chain Strategies

Early exhaustive strategies cap chain length to keep search tractable. That is not representative of human play when the board has many compatible paths.

Add strategies that build one chain step-by-step instead of enumerating every possible chain:

- `longRandomWalk`
  - choose a legal start
  - repeatedly extend to a random legal compatible neighbor
  - stop using a probability curve, not a hard short cap
  - allow chains up to board capacity or a high safety cap such as 24
- `longGreedyWalk`
  - choose a legal start
  - repeatedly take the locally best extension
  - prefer extensions that increase projected result value
  - tie-break deterministically
- `milestonePush`
  - when near a retirement threshold, favor long chains that overshoot the next spawn ceiling
  - otherwise play cleanup or board-health-preserving chains
- `preRetirementCleanup`
  - when close to retirement, prioritize chains containing soon-to-retire tier tiles
  - measures whether the intended mastery behavior changes outcomes
- `strategicHumanLike`
  - mode-switching strategy that uses short chains tactically and long chains opportunistically
  - intended to approximate Evan's playtest behavior better than pure random/greedy strategies

These strategies must record actual chain length distribution. Phase 5.5 analysis should report p50/p90/max chain length per strategy.

Required diagnostic question:

> If a human-like long-chain strategy regularly creates 15-20 tile chains, does cascade retirement become a real danger, a fair pacing event, or still mostly harmless?

### 5b. Add Strategic Human-Like Strategy

Implement a `strategicHumanLike` strategy with explicit modes. This strategy should not always choose the longest chain and should not always choose the highest immediate result. It should switch between short tactical chains and long push chains based on board state.

Required modes:

- `cleanup`
  - uses short 2-4 tile chains
  - prioritizes clearing isolated low-tier or soon-to-retire tiles
  - goal: reduce future blocker risk
- `setup`
  - uses short or medium chains
  - prioritizes freeing trapped compatible tiles, creating adjacency, or improving legal chain-start count
  - goal: make a better future board rather than maximize current result
- `build`
  - constructs longer chains step-by-step when compatible paths are available
  - goal: produce meaningful tile growth without blindly overshooting retirement
- `milestone`
  - activates near the next retirement threshold
  - chooses between cleanup before crossing, controlled retirement, or deliberate overshoot
  - goal: test the intended pre-milestone planning rhythm
- `recovery`
  - activates immediately after retirement
  - prioritizes clearing, connecting, or reducing isolated retired tiles
  - goal: test whether skilled play can manage retirement fallout

Mode selection should be deterministic and inspectable. Each chosen action should include metadata in the sim-side turn analysis, or be recoverable through strategy diagnostics:

- selected mode
- reason code
- candidate chain length
- projected result value
- whether the action was intended as cleanup, setup, push, milestone, or recovery

Behavior metrics required for this strategy:

- percent of turns in each mode
- percent of short tactical chains, e.g. length 2-4
- percent of medium chains, e.g. length 5-9
- percent of long chains, e.g. length 10+
- median / p90 / max chain length
- board-health delta after short tactical chains
- board-health delta after long push chains
- retirements caused by long push chains
- cascade retirements caused by long push chains
- survival turns after milestone and recovery actions

Primary design question:

> Does a strategic player who uses short chains for cleanup/setup and long chains for milestone pushes survive longer, progress faster, or both?

This strategy is required before making final claims about the skill curve.

### 6. Add Focused Metrics For Retirement Pressure

The experiment summary must explicitly answer whether retirement damages board health.

Required metrics:

- legal chain starts before retirement
- legal chain starts after retirement
- delta in legal chain starts
- retired tile count after retirement
- isolated retired tile count after retirement
- turns survived after first retirement
- turns survived after second retirement
- natural deaths after each retirement stage
- chain length p50/p90/max
- chain length bucket distribution: 2-4, 5-9, 10+
- cascade size distribution caused by long chains
- overshoot amount, measured as how many retirement thresholds the chain result crosses
- strategy mode distribution for `strategicHumanLike`

## Acceptance Criteria

Phase 5.5 is complete when:

- at least 12 pressure variants are tested across random depth 5 and greedy depth 3
- at least one constructive long-chain strategy is included in every serious pressure comparison
- `strategicHumanLike` is included in the final comparison against baseline random and greedy
- each variant has at least 100 runs per strategy
- results are ranked against an explicit target
- at least one candidate config is identified as closer to the target than baseline, or the report concludes that current kernel knobs are insufficient
- retirement pressure is evaluated using before/after legal-start metrics
- long-chain overshoot and cascade risk are evaluated separately from short-chain exhaustive strategies
- performance is acceptable for iterative design use, ideally under 2 minutes per small matrix
- all code changes pass:
  - `npm run typecheck`
  - `npm test`
  - `npm run lint`
  - `npm run check-boundaries`

## Decision Outputs

At the end of Phase 5.5, Evan should be able to decide one of:

1. Current Endless tuning can create the desired pressure curve; proceed with the best candidate config.
2. Retirement is valuable but insufficient; add a companion pressure mechanic before Phase 6.
3. Endless should be intentionally forgiving; move pressure expectations to Ascension.
4. The kernel needs a deeper rule change before content is added.

## Recommended First Target

Use this as the first tuning target unless Evan changes it:

```text
cap: 300 turns
natural death rate: 20-30%
median final turn: 240-300
first retirement median: 50-100
games with retirement: >= 80%
cascade immediate game-over: <= 5%
```

This target keeps Endless durable but not frictionless. It also preserves retirement as a major pacing event instead of making it either irrelevant or instantly lethal.
