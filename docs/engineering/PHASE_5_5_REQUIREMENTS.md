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

Phase 5.5 is not only a balance pass. It is a design-learning phase. The output should help answer which parts of the current game create:

- meaningful choices
- escalating pressure
- recoverable failure states
- visible skill expression
- satisfying progression milestones

Example target:

- approximately 25% natural death rate by turn 300
- average run length in a chosen range, e.g. 220-260 turns under cap-based measurement
- first retirement median around turn 50-100
- at least 80% of games reach one retirement
- cascade retirement immediate game-over rate below 5%
- stronger strategy outperforms random in progression and/or survival
- long-chain human-like strategies can trigger overshoot/cascade cases at realistic frequency

The exact targets are adjustable. The important requirement is that tuning is evaluated against explicit desired outcomes, not subjective inspection alone.

## Design Hypotheses To Test

Phase 5.5 should treat the current design as a set of testable hypotheses.

### Hypothesis A: Retirement Creates Strategic Pressure

Expected behavior:

- before retirement, players can clean up soon-to-retire tiers
- after retirement, isolated retired tiles reduce board health
- skilled play reduces retired blockers and survives longer after milestones
- bad timing creates a visible, explainable path to death

Evidence that supports it:

- legal chain starts drop after retirement, but not usually to zero
- isolated retired tile count predicts future death risk
- strategic cleanup improves survival after first and second retirement
- recovery play restores some board health after a retirement event

Evidence against it:

- retirement does not materially change legal starts or death risk
- retirement instantly kills too often
- retirement creates permanent blockers that skilled play cannot manage
- strong players simply ignore retirement and still survive indefinitely

### Hypothesis B: Long Chains Are Powerful But Should Not Collapse Skill

Expected behavior:

- long chains create exciting progression spikes
- long chains sometimes overshoot retirement thresholds
- careless long chains increase future pressure
- short tactical chains remain valuable for cleanup, setup, and recovery

Evidence that supports it:

- human-like strategy uses both short and long chains
- pure long-chain strategies progress quickly but create more retirement risk
- strategicHumanLike outperforms pure long-chain play on survival or board health

Evidence against it:

- longest-available-chain dominates every other policy
- long chains skip the intended retirement tension without meaningful cost
- chain score/result growth makes board management irrelevant

### Hypothesis C: Spawn Algorithm Controls Skill Curve

Expected behavior:

- flatter spawns reduce same-value density and increase scan difficulty
- steeper spawns increase chain availability but may make the board too forgiving
- volatile upper-tier spawns create excitement but may distort fairness
- narrower pools may create cleaner strategy at the cost of variety

Evidence that supports it:

- spawn profiles produce distinct death rates and chain length distributions
- harder profiles increase deaths without making games feel random or forced
- stronger strategies separate more clearly from random under some profiles

Evidence against it:

- all spawn profiles converge to endless survivability
- death rate changes only by making the game feel arbitrary
- random strategy performs nearly as well as strategicHumanLike

### Hypothesis D: RuleK Shapes The Core Incentive

Expected behavior:

- `ruleK: 2` rewards long same-value chains strongly
- `ruleK: 3` should reduce runaway long-chain progression
- `ruleK: 1` should demonstrate the danger of over-rewarding length

Evidence that supports it:

- `ruleK: 3` preserves long-chain usefulness while increasing tactical cleanup value
- `ruleK: 2` creates exciting growth without eliminating pressure
- `ruleK: 1` produces clear length-hunting dominance, validating why it should not be baseline

Evidence against it:

- changing `ruleK` has little measurable effect
- `ruleK: 2` makes long-chain play obviously dominant
- `ruleK: 3` makes long chains feel unrewarding or slows progression too much

## Feature And Knob Impact Map

Every experiment profile should be traceable to a design question. Do not add variants just because they are easy to sweep.

| Lever | Gameplay Question | Primary Metrics | Risk To Watch |
|---|---|---|---|
| Board size | How much space does the player need for expressive chains? | death rate, legal starts, chain length p90, blocker density | too tight becomes forced, too loose becomes endless |
| Spawn weights | How does tile density shape chain availability and difficulty? | legal starts, chain length buckets, death rate, strategy separation | arbitrary deaths or trivial abundance |
| Initial / active pool width | Does variety help or hurt readable planning? | scan complexity proxy, legal starts, max tile distribution | too many tiers dilute starts, too few tiers flatten choices |
| `ruleK` | Does length reward create depth or dominant length-hunting? | chain length, result value, overshoot, strategy separation | long-chain dominance |
| Retirement pacing | Is cascade retirement exciting, fair, or punishing? | cascade size, post-retirement legal starts, immediate game-over | unreadable punishment |
| Retired tile behavior diagnostic | Are blockers the real pressure source? | isolated retired tiles, deaths by stage, recovery success | special-case rules may be needed |
| Strategy model | Does better play matter? | survival, max tile, mode distribution, board-health recovery | sim policy may not represent human play |

## Player Skill Models

The phase must compare multiple player models because "is the game hard?" depends on who is playing.

Required ladder:

- `random`
  - baseline floor
  - answers whether the system kills unskilled play
- `greedy`
  - simple immediate-value player
  - answers whether obvious value chasing works too well
- constructive long-chain strategy
  - progression-focused player
  - answers whether long chains bypass the pressure system
- `strategicHumanLike`
  - mode-switching player using cleanup, setup, build, milestone, and recovery
  - answers whether the intended skill curve exists

Useful interpretation:

- If random and strategicHumanLike perform similarly, the game has weak skill expression.
- If greedy dominates strategicHumanLike, immediate value may be too strong.
- If long-chain strategy dominates everything, chain length reward or board compatibility may be too generous.
- If strategicHumanLike survives longer but progresses slower, the game may have a real risk/reward choice.
- If strategicHumanLike progresses faster and survives longer, the intended mastery curve is likely working.

## Fun And Engagement Proxies

Simulation cannot prove fun, but it can flag systems likely to produce or undermine fun.

Report these proxies in addition to target scoring:

- **choice richness**
  - legal chain starts per turn
  - viable chain length variety
  - percent of forced or near-forced turns
- **pressure curve**
  - legal starts over time
  - isolated retired blockers over time
  - death hazard after each retirement stage
- **mastery curve**
  - performance gap between random, greedy, long-chain, and strategicHumanLike
  - survival after mistakes or overshoots
  - recovery success after retirement
- **pacing**
  - turns to first/second/third retirement
  - max tile distribution
  - chain length distribution
  - frequency of dramatic long-chain pushes
- **fairness**
  - immediate game-over after retirement
  - deaths with many apparent legal starts shortly before loss
  - variance between seeds under the same strategy/config

These are not final product metrics. They are design proxies that decide where manual playtest attention should go next.

## Non-Goals

- Do not begin Phase 6 Layer 2 content yet.
- Do not add special tiles, wilds, blockers, multipliers, or new objectives.
- Do not change top-level design docs until Evan settles a design decision.
- Do not optimize the full Design Intent Solver yet. This phase is a lightweight precursor.

## Required Work

### 0. Produce A Design Learning Report

Phase 5.5 must produce a short design report in `docs/engineering/` after experiments run.

The report should include:

- the target used for scoring
- the experiment matrix actually run
- the top candidate configs by target score
- the best config for each strategy model
- what each major lever appeared to do to gameplay
- whether retirement pressure was supported, weakened, or disproven by the data
- whether long-chain play looked healthy, dominant, or dangerous
- recommended next design action

The report should avoid raw data dumps. Raw CSV/JSON output is useful, but Evan needs a readable synthesis that turns the data into design decisions.

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

### 7. Add Choice-Richness Metrics

The original concern is not only whether players die. It is whether turns create meaningful choices.

Add metrics that describe the decision space available each turn:

- legal chain-start count
- estimated legal chain count by length bucket if practical
- max available constructive chain length using a bounded walk heuristic
- number of distinct result tiers available from plausible chains
- percent of turns with only 1 legal start
- percent of turns with 2-3 legal starts
- percent of turns with 4+ legal starts

Use these to identify whether a config is:

- too dry: few legal starts, many forced turns
- too rich: too many compatible paths, easy long chains every turn
- healthy: multiple plausible moves without making long chains automatic

### 8. Add Seed Replay Support For Interesting Runs

The batch runner should preserve enough data to replay or inspect notable runs.

At minimum, record seeds for:

- shortest natural death per profile
- longest capped survival per profile
- largest retirement cascade
- largest long-chain overshoot
- most isolated retired tiles
- strongest strategicHumanLike recovery after retirement

This matters because Phase 5.5 is not purely statistical. The best candidates should be manually replayed after the data narrows the field.

### 9. Add Candidate Classification

Classify each profile after scoring so the results are easier to reason about.

Suggested labels:

- `too-forgiving`
  - low death rate, high legal starts, weak retirement pressure
- `too-random`
  - high death rate, weak strategy separation, high seed variance
- `too-forced`
  - high percent of 1-start turns, low chain variety
- `long-chain-dominant`
  - long-chain strategy outperforms strategicHumanLike and creates large overshoots without cost
- `retirement-cliff`
  - deaths cluster immediately after retirement or cascade
- `promising`
  - target-adjacent, readable pressure, meaningful strategy separation

The labels do not replace the numeric score. They make the result useful for design conversation.

## Experiment Protocol

Run Phase 5.5 in passes instead of one giant matrix.

### Pass 1: Instrumentation Sanity

Purpose:

- prove the new metrics are populated
- verify strategy diagnostics are readable
- find obvious performance bottlenecks

Recommended size:

- 2-3 configs
- 20-30 runs each
- cap 150-200 turns

Exit criteria:

- output table is readable
- chain length and mode distributions look plausible
- no single profile takes so long that broader sweeps are impractical

### Pass 2: Coarse Tuning Sweep

Purpose:

- identify the broad region where pressure exists
- discard obviously bad profiles

Recommended size:

- 12-20 configs
- random, greedy, one long-chain strategy
- 50-100 runs each
- cap 300 turns

Exit criteria:

- 3-5 promising profiles identified
- each rejected profile has a reason label
- at least one profile shows non-trivial natural deaths without immediate unfairness

### Pass 3: Skill-Curve Comparison

Purpose:

- compare random, greedy, long-chain, and strategicHumanLike on the promising profiles
- determine whether better play changes survival, progression, board health, or all three

Recommended size:

- 3-5 promising configs
- all required strategy models
- 100-200 runs each
- cap 300 turns

Exit criteria:

- strategy separation is clear enough to interpret
- long-chain dominance is either ruled out or confirmed
- retirement pressure is evaluated by before/after board-health metrics

### Pass 4: Manual Replay Selection

Purpose:

- select specific seeds for Evan to play or inspect
- connect simulation findings to felt gameplay

Recommended seed set:

- best promising config, typical run
- best promising config, early death
- best promising config, strong recovery
- long-chain-dominant run if any
- retirement-cliff run if any

Exit criteria:

- Evan has a small set of concrete boards/runs to validate against human feel

## Decision Rules

Use these rules to turn the data into a next action.

### Proceed With Tuned Current Kernel

Choose this if:

- at least one profile lands near the target pressure curve
- strategicHumanLike meaningfully outperforms random
- long chains are useful but not strictly dominant
- retirement reduces board health in a recoverable way
- deaths are not mostly immediate post-retirement cliffs

Next action:

- promote the candidate config for manual playtest
- update engineering defaults only after Evan approves the feel

### Tune Existing Knobs More

Choose this if:

- results are close but miss one major target
- changing spawn profile, board size, or `ruleK` has clear directional effects
- strategy separation exists but pacing is slightly off

Next action:

- run a narrower second 5.5 sweep around the best region

### Change A Kernel Rule Before Content

Choose this if:

- long-chain dominance persists across reasonable spawn profiles
- `ruleK: 2` consistently removes tension
- retirement pressure is either irrelevant or always cliff-like
- no tuning profile creates recoverable pressure

Possible follow-up design questions:

- should `ruleK` move to 3?
- should retirement be capped at one tier per turn?
- should spawn compatibility be reduced?
- should retired tiles have a different interaction rule?

### Add Companion Pressure Mechanic Before Phase 6

Choose this if:

- retirement is useful but too weak by itself
- the core chain mechanic remains fun and skillful
- death pressure needs a second source that does not undermine chain play

Possible follow-up mechanics should be designed separately. Phase 5.5 should identify the need, not solve it fully.

### Keep Endless Forgiving And Move Pressure Elsewhere

Choose this if:

- Endless is most fun when durable and expressive
- pressure tuning makes the game less enjoyable or too forced
- retirement works better as pacing/progression than as a death engine

Next action:

- define Endless as a long-form mastery/chill mode
- move harsher pressure targets to Ascension

## Acceptance Criteria

Phase 5.5 is complete when:

- a design learning report is written after the experiment runs
- every tested profile maps back to a stated design question
- at least 12 pressure variants are tested across random depth 5 and greedy depth 3
- at least one constructive long-chain strategy is included in every serious pressure comparison
- `strategicHumanLike` is included in the final comparison against baseline random and greedy
- each variant has at least 100 runs per strategy
- results are ranked against an explicit target
- results are also labeled as `too-forgiving`, `too-random`, `too-forced`, `long-chain-dominant`, `retirement-cliff`, or `promising`
- at least one candidate config is identified as closer to the target than baseline, or the report concludes that current kernel knobs are insufficient
- retirement pressure is evaluated using before/after legal-start metrics
- long-chain overshoot and cascade risk are evaluated separately from short-chain exhaustive strategies
- choice richness is evaluated, including forced or near-forced turn frequency
- notable seeds are preserved for manual replay or inspection
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

## Implementation Risks And Watch Items

### Runtime Cost

The first experiment attempt showed that naive broad simulation can run too long. Phase 5.5 should prefer staged passes, bounded samples, and constructive strategies that avoid exhaustive chain enumeration.

Do not start with a giant matrix. Start with instrumentation sanity, then broaden only after runtime is understood.

### Strategy Realism

Early capped strategies do not represent strong human play because Evan can create 15-20 tile chains on real boards. Long-chain and strategicHumanLike strategies are required before making design claims.

However, pure "always longest chain" play is also not a realistic final model. Human play uses short chains for cleanup, setup, freeing tiles, and post-retirement recovery. The strategy ladder must preserve this distinction.

### Tile Value Range

Simulation can reach values above the current early-game range. Before relying on high-progression results, verify that game-kernel typing and retirement logic correctly support powers of two beyond the initially listed tiers.

If `TileValue` is too narrow or runtime casts hide out-of-range values, fix that before drawing conclusions about late-game retirement behavior.

### Metrics Versus Feel

Phase 5.5 can narrow the design space, but it cannot prove fun by itself. The correct output is a small set of candidate configs and replayable seeds for human inspection.

Simulation should answer:

- what changed?
- in which direction?
- under which strategy model?
- with what failure mode?

Manual playtest should still answer:

- does it feel fair?
- does it feel tense?
- does it invite another run?
