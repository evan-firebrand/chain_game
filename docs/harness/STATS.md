# Harness — Statistics Reference

## TL;DR

Every aggregate metric in the harness now reports a **mean ± 95% bootstrap CI half-width**.
Termination rates report **proportion + Wilson 95% CI**. Use `harness compare` for
delta CIs; it auto-detects whether two runs share seeds and uses paired bootstrap when they do.

## How to read the tables

```
algo            moves                 peak                score        chain        levels       gameOver       cap   g/s
weighted     221 ± 35  1.97e+27 ± 2.68e+27  8.76e+27 ± 1.28e+28  4.05 ± 0.03   99.2 ± 16.0    57% [39–73]   43% [27–61]  30.6
```

- **`221 ± 35`** = mean is 221 moves, 95% CI is roughly [186, 256]. The `± 35` is the
  bootstrap CI **half-width**. For asymmetric distributions (peak/score), it's the
  larger side of the asymmetric CI — conservative band.
- **`57% [39–73]`** = 57% of runs ended naturally (gameOver), with Wilson 95% CI
  spanning 39–73%. Wilson is preferred over the normal-approximation interval for
  rates near 0% or 100%.
- **`g/s`** has no CI: it's a single-shot wall-clock measurement, not an estimate of
  a population parameter.

**Significance shortcut:** if two CIs don't overlap, the difference is significant at
~95% confidence. (The reverse isn't true — overlapping CIs can still hide a
significant paired difference. Use `harness compare` for the rigorous version.)

## Why bootstrap, not t-intervals?

Game outcomes (peak, score) are heavily skewed. After 300 moves of paired chain
merges, peak tile values can span 1e6 to 1e120 across runs. A t-interval would assume
normality; bootstrap doesn't, and produces honest CIs even for log-normal tails.

We use **percentile bootstrap with B=1000 resamples** by default.
- *Reproducible:* the resampling RNG is seeded with a fixed value (1), so identical
  samples yield identical CIs across runs. Bootstrap CIs are part of the bit-exact
  replay guarantee.
- *Cost:* ~5% of total runtime at N=30, negligible at N≥100.

For the `avgChainLen` aggregate (a pooled ratio Σchain/Σmoves), the bootstrap
resamples **whole runs**, not individual moves — preserving the per-run pairing of
chainLenSum and moves so the resampled ratio is honest.

## Pairing — the most important thing to understand

When two runs use the *same seed list*, every game in run A has a corresponding
game in run B that started from the same RNG state. Differences between paired
games cancel a lot of noise: spawn variance, board-init variance, etc.

The harness pairs by default within a single `benchmark()` call (all algos share
seeds). Across calls, it pairs when you pass `--seed <master>` consistently — that
generates a deterministic seed list both times.

**`harness compare a.json b.json`** auto-detects pairing:

- Seeds match → **paired bootstrap on per-seed deltas** → tight CI.
- Seeds differ → **independent CIs combined via quadrature** → wider CI, plus a
  warning that the comparison is overstating uncertainty if the underlying samples
  were really paired.

### Worked example

In the wilds-launch study (`harness study wilds-launch --seed 42 --n 20`), section 5
prints paired-bootstrap deltas of Wilds − Classic, both run on the same 20 seeds:

```
algo                 avgMoves Δ
weighted                +10 ± 63
antiPair         *     -122 ± 54
adversarial      *      -33 ± 28
```

(`*` = CI excludes 0.) The paired delta CI for `antiPair` is ±54 — small enough that
the −122 mean is significantly below 0.

If we'd instead run Wilds and Classic with different seed lists and combined their
independent CIs by quadrature:
- Wilds antiPair moves: mean ≈ 132, hw ≈ 35
- Classic antiPair moves: mean ≈ 254, hw ≈ 33
- Independent delta hw = √(35² + 33²) ≈ **48**

Paired (54) vs independent (48) is not a dramatic difference *in this case* because
both are tight enough; but the *significance verdict* can flip when the paired
variance is small relative to the across-game variance. For move counts (where game
length depends heavily on which RNG seed you got), pairing is essential — without
it, the noise from "you got an easy seed" swamps the signal from "Wilds is harder."

**Rule of thumb:** if you're testing a code change that should affect *which moves
the bot picks* (not which board it starts from), paired comparison is right. If
you're sampling fresh universes each time (different cohorts of users, different
test-time data), independent is right.

## Confidence intervals on different aggregates

| Field | Method | Notes |
|---|---|---|
| `dists.<metric>.ciLow/.ciHigh/.ciHalfWidth` | Percentile bootstrap on the mean | Default for moves, peak, score, levelsCleared, modeMetric, runtimeMs |
| `avgChainLenStat` | Bootstrap on the pooled ratio Σchain/Σmoves | Resamples whole runs (preserves chainLen↔moves pairing) |
| `terminationRates.<reason>` | Wilson 95% CI for binomial proportion | Better than normal-approximation near 0/1 |
| Compare delta (paired) | Paired bootstrap on per-seed differences | Auto-selected when seeds match |
| Compare delta (independent) | Quadrature on per-side bootstrap CIs | Auto-selected when seeds differ; warns |

## Distribution outputs (P10/P90 etc.)

Every aggregate also exposes `p10`, `p25`, `p75`, `p90`, `iqr` for richer agent
analysis. Means hide skew; percentiles don't:

```bash
jq '.summaries[].dists.peak | {mean, p10, p50: .median, p90}' bench.json
```

For Wilds peak in particular, the gap between mean and median is huge (mean
dominated by a few enormous beast-kill games). Always check the distribution shape
before reporting "Wilds peak is X."

## Power analysis

```bash
harness power --manifest /tmp/bench.json --metric peak --mde 5
```

Given the variance observed in `bench.json`, computes the sample size N required
to detect a 5% change in mean `peak` at α=0.05, 80% power, two-sample test.

For the bot game's heavy-tailed metrics (peak, score), required N can be very large.
Useful for sanity-checking "is N=30 enough to detect a 10% change?" before running.

Manual mode if you have summary stats but no manifest:

```bash
harness power --mean 200 --stddev 50 --mde 5
```

## Reproducibility guarantee

Re-running with the same seeds produces:
- Bit-exact game results (moves, peak, score, levelsCleared, terminationReason)
- Bit-exact bootstrap CIs (the resampling RNG is seeded deterministically)

What varies between runs:
- `runtimeMs`, `botDecisionMs`, `gamesPerSec` (wall-clock; hardware-dependent)
- `timestamp`, `gitSha` (envelope metadata)

`harness replay <manifest>` exploits this to reproduce any past run from its
manifest alone.
