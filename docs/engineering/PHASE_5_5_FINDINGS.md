# Phase 5.5 Findings: Initial Design Lab Smoke

**Status:** Initial implementation smoke  
**Created:** 2026-04-28  
**Scope:** Validate the Phase 5.5 design-lab tooling and run a scaled experiment pass.

## Target Used

Recommended target from the requirements doc:

- cap: 300 turns
- natural death rate: 20-30%
- median final turn: 240-300
- first retirement median: 50-100
- games with retirement: >= 80%
- cascade immediate game-over: <= 5%

The smoke run used lower caps and run counts to verify instrumentation and runtime behavior before broad sweeps.

## Matrix Actually Run

Attempted broad run:

- 12 profiles
- random, greedy, longRandomWalk
- 50 runs each
- cap 300

Result: timed out after 10 minutes. This confirms the runtime risk called out in the requirements. The design-lab interfaces work, but the broad matrix needs either smaller staged batches, worker parallelism, or additional strategy/runtime optimization before routine use.

Completed scaled run:

- Pass 1 sanity:
  - 2 profiles
  - random, greedy, longRandomWalk
  - 5 runs each
  - cap 80
- Pass 2 coarse smoke:
  - 4 profiles
  - random, longRandomWalk
  - 10 runs each
  - cap 120
- Pass 3 skill smoke:
  - 2 selected profiles
  - random, longGreedyWalk, strategicHumanLike
  - 10 runs each
  - cap 120

## Top Smoke Results

| Profile | Strategy | Death Rate | Median Turn | First Retirement | Labels |
|---|---:|---:|---:|---:|---|
| tight-5x6-k2-power | longRandomWalk | 20% | 120 | 6 | promising |
| baseline-6x7-k2-power | longRandomWalk | 10% | 120 | 3 | too-forgiving |
| baseline-6x7-k3-power | longRandomWalk | 0% | 120 | 47 | too-forgiving |
| baseline-6x7-k1-power | random | 0% | 120 | 77 | too-forgiving |
| baseline-6x7-k1-power | longRandomWalk | 90% | 89 | 1 | promising |

The `baseline-6x7-k1-power` / `longRandomWalk` result is not truly promising in feel terms; it is likely a harsh length-reward stress case. Its label shows that the classifier should gain a stronger "retirement-cliff / too-volatile" read for extreme early-retirement cases.

## Strategy Comparison Smoke

Selected profiles:

- `tight-5x6-k2-power`
- `baseline-6x7-k2-power`

| Profile | Strategy | Death Rate | Median Turn | First Retirement | Labels |
|---|---:|---:|---:|---:|---|
| tight-5x6-k2-power | longGreedyWalk | 40% | 120 | 1 | too-random |
| tight-5x6-k2-power | strategicHumanLike | 10% | 120 | 1 | too-forgiving |
| tight-5x6-k2-power | random | 0% | 120 | 78 | too-forgiving |
| baseline-6x7-k2-power | strategicHumanLike | 0% | 120 | 21 | too-forgiving |
| baseline-6x7-k2-power | longGreedyWalk | 0% | 120 | 8 | too-forgiving |
| baseline-6x7-k2-power | random | 0% | 120 | 100 | too-forgiving |

Mode distribution for `strategicHumanLike`:

- tight 5x6: recovery 794, cleanup 144, setup 149, milestone 55, build 5
- baseline 6x7: recovery 859, cleanup 165, setup 106, milestone 54, build 16

This confirms strategy diagnostics are flowing through the runner and analyzer. It also suggests the current human-like policy may over-enter recovery because any isolated retired tile keeps recovery active. That is useful but needs refinement before treating it as a strong human proxy.

## Lever Read

**Board size**

- Tight 5x6 produced the first non-trivial natural death rate under long-chain play.
- It also created very early retirements for long-chain strategies.
- Early read: tighter boards can create pressure, but may over-compress milestone timing when paired with aggressive long-chain play.

**RuleK**

- `ruleK: 1` with longRandomWalk produced a 90% death rate by cap 120 and first retirement on turn 1.
- This supports the original concern that fully rewarding length can create unstable progression.
- `ruleK: 3` delayed first retirement under longRandomWalk to turn 47 and stayed forgiving at this smoke size.

**Long chains**

- longRandomWalk and longGreedyWalk produced medium and long chain buckets that capped random/greedy did not.
- Long-chain strategies can trigger very early retirement, which means they are now exercising the relevant design risk.
- The current data does not prove long chains are healthy; it proves the tooling can now measure their pressure.

**Retirement**

- Retirement is frequent under long-chain strategies.
- Early retirement can be harsh or irrelevant depending on profile and strategy.
- Baseline 6x7 still looks too forgiving in short smoke runs, especially for random.

## Replay Seeds

Useful seeds from smoke runs:

- `tight-5x6-k2-power` / longRandomWalk:
  - shortest natural death: 5607
  - largest cascade / overshoot / isolated retired tiles: 5603
  - strongest recovery: 5602
- `baseline-6x7-k2-power` / longRandomWalk:
  - shortest natural death: 5603
  - largest cascade / overshoot / isolated retired tiles: 5600
  - strongest recovery: 5604
- `tight-5x6-k2-power` / strategicHumanLike:
  - shortest natural death: 5707
  - largest cascade / overshoot: 5700
  - most isolated retired tiles: 5703
  - strongest recovery: 5702

## Current Conclusion

The Phase 5.5 design-lab tooling is now capable of measuring the right things:

- strategy diagnostics
- choice richness
- chain length buckets
- retirement damage
- target scores
- candidate labels
- notable replay seeds

The first smoke suggests:

- baseline 6x7 remains forgiving at short caps
- tighter boards are a viable pressure lever
- `ruleK: 1` is likely too volatile under long-chain play
- long-chain strategies are essential because they expose retirement behavior that capped strategies miss
- `strategicHumanLike` needs tuning before it can be treated as a faithful human proxy

## Recommended Next Action

Do not move to Phase 6 yet.

Next engineering/design step:

1. Optimize broad matrix runtime.
2. Refine `strategicHumanLike` so recovery does not dominate simply because one isolated retired tile exists.
3. Run the full 12-profile coarse sweep with at least 50 runs per strategy once runtime is acceptable.
4. Use replay seeds from the best and worst profiles for manual feel validation.

Decision state:

- Current kernel is not disproven.
- Retirement pressure is measurable but not yet validated as fun.
- Long-chain play is now testable and clearly changes pacing.
- More data is required before changing defaults.
