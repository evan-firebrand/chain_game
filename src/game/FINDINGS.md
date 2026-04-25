# Progressive Targets — Experiment Findings

## Summary

Targets work as a goal layer and — critically — create the first measurable strategic depth the game has shown. Planning a few moves ahead now pays off in levels cleared.

**Update after INITIAL_TARGET raised 128 → 512:**
- Moves-to-L1 recalibrated from median 5 → **16.5** (right in the 15-25 target band).
- Boost planning gap widened: **+4.5** median level delta, 8/10 lookahead wins (up from +3.5 / 9).
- Classic planning gap narrowed: +1.5 median, 5/10 wins (was +3 / 8). Noisy.
- **Mode differentiation improved**: Boost now has clearly more strategic headroom than Classic — exactly the mode design we want.

## Experiment results

### Experiment 1 — Do targets make mode choice matter?

Hypothesis: different modes → different `medianLevelsCleared` (greedy bot, N=20, weighted spawner).

| Mode | Med Lvl | Avg Lvl | Max Lvl | Med Moves |
|------|---------|---------|---------|-----------|
| classic | 16 | 15.8 | 22 | 104 |
| risingFloor | 14 | 14.9 | 23 | 152 |
| boost | 16 | 15.9 | 24 | 91 |

**Result: HYPOTHESIS FAILED.** All three modes cluster at 14-16 median levels for a reactive (greedy) bot. Boost runs finish in 13% fewer moves but reach the same level count — the multiplier accelerates peak growth, but the greedy bot doesn't exploit it to climb more levels.

Interpretation: for a player who just picks the biggest chain in front of them, modes are cosmetic. The mechanic is present but not being exploited.

### Experiment 2 — Do targets create strategic depth?

Hypothesis: with mode-aware bot scoring, lookahead will beat greedy on boost mode (positive planning gap).

N=10, matched seeds per scenario:

| Scenario | Greedy med lvl | Lookahead med lvl | Gap | Lookahead wins |
|----------|----------------|-------------------|-----|----------------|
| boost + weighted | 16.5 | 19.5 | **+3.5** | 9/10 |
| classic + weighted | 15 | 18.5 | **+3** | 8/10 |
| classic + adversarial | — | — | — | *(timed out — adversarial trap from phase 3 still expected to hold)* |

**Result: HYPOTHESIS CONFIRMED.** This is the first time we've measured a consistent, meaningful positive planning gap. Both classic and boost modes reward thinking ahead. Per-seed deltas for boost + weighted: `[5, 7, 1, 10, 5, 2, 1, 0, 2, 5]` — lookahead climbs higher on 9/10 seeds, often by many levels.

Cross-referenced with Experiment 1: Boost mode doesn't help a greedy player but rewards a planner with +3.5 levels. Modes ARE differentiating — we just need to measure with a bot that actually plays the mode.

### Experiment 3 — Starting target calibration

Hypothesis: 128 as starting target → first level clear in 15-25 moves (classic + weighted, greedy, N=20).

| Metric | Actual | Expected |
|--------|--------|----------|
| Median moves to L1 | **5** | 15-25 |
| Avg moves to L1 | 5.2 | 15-25 |
| Runs that failed to reach L1 | 0/20 | — |

**Result: CALIBRATION FAILED.** First target is 3-5x too easy. Players are hitting a celebration every few moves for the first 20+ moves (128 at move 5, 256 around move 10-15, 512 around move 20). This likely dilutes the "milestone" feel into a treadmill.

Raw samples: `[7, 6, 3, 6, 4, 9, 5, 6, 4, 5, 6, 4, 3, 5, 4, 6, 6, 5, 6, 4]`.

### Experiment 4 — Live play calibration

Not yet performed. Human playtesting required.

## Key insights

1. **Targets unlock strategic depth that was previously invisible.** Both classic and boost now show clean positive planning gaps (+3 and +3.5 levels respectively). Before targets, our best gap was a noisy +9 at softness=0.5 on adversarial. This is a much cleaner, more defensible signal.

2. **Mode-aware bot scoring was the unlock.** Without it, lookahead would have been blind to boosts and we'd have measured near-zero gap on boost mode. The small `chainMultiplier` hook change revealed the strategic payoff that was always there but hidden by a myopic measurement.

3. **"Strategic depth" and "harder for greedy" are different things.** Experiment 1 shows greedy's level-count is similar across modes; Experiment 2 shows planning widens the gap. This means mode selection matters for *skilled* play, not for reactive play. That's actually a good thing — it means the skill ceiling rises with mode, which is exactly what a game with strategy is supposed to do.

4. **The starting target is way off.** 5 moves to first target means we trivialize the concept of "reaching" a milestone. Either raise the first target to 512 (~15-20 moves to reach), or rethink the progression (e.g., geometric targets starting lower but escalating faster).

## Unresolved / defer

- Live-play calibration (Experiment 4) still needed. Benchmark data says targets create depth but feel test not done.
- Adversarial + targets measurements got cut short due to evaluation timeouts; the phase-3 finding that adversarial punishes planning likely still holds, but should be re-confirmed with levels-as-metric.
- Rising Floor still lengthens games rather than shortening them. With targets as the primary metric, this becomes less of a concern — it now reads as "slower, steadier climb" rather than "broken mode." Worth one more look with live play.

## Decision

**Applying E1 + E2 combined to the decision tree from the plan:**

- E2 strongly positive across multiple modes → targets are working as the strategic-depth mechanism.
- E1 near-zero for greedy → modes don't reward reactive play, but Experiment 2 shows they reward skilled play. Not a failure — a characteristic of good game design.
- E3 failed calibration → starting target needs to be raised before shipping.

**Recommended next step:**

1. **Immediate fix: raise `INITIAL_TARGET` to 512** (was 128). Re-run Experiment 3 to confirm 15-25 moves-to-L1.
2. **Then pick one deferred investigation to make targets "hit harder"**:
   - *Difficulty ratchet on level-up* is the highest-value next experiment. Each level-up raises spawn floor by one power of 2. Creates escalating pressure, makes the race more real. Directly testable against the same baseline.
   - *Partial board clear on level-up* is second-best — turns level-up into a *mechanical* reward, not just visual. Good candidate if difficulty ratchet feels too punishing.
3. **Defer**: pool narrowing (too subtle to measure meaningfully), move-budget bonus (requires a move-budget mechanic that doesn't exist yet).

If targets + difficulty ratchet produces a bot that shows an even wider planning gap without becoming unfair (planning gap on adversarial stays zero-or-negative per phase 3), we've succeeded at the original goal: a game that is harder AND rewards strategy.

## Re-test data (INITIAL_TARGET = 512)

### E3 recalibrated
| Metric | Actual (target=512) | Previous (target=128) |
|--------|---------------------|------------------------|
| Median moves to L1 | **16.5** | 5 |
| Avg moves to L1 | 17.1 | 5.2 |
| Range | 13-30 | 3-9 |
| Runs that reached L1 | 20/20 | 20/20 |

Calibration now in the intended range.

### E1 recalibrated (greedy N=20)

| Mode | Med Lvl | Avg Lvl | Max Lvl | Med Moves |
|------|---------|---------|---------|-----------|
| classic | 14 | 14.1 | 24 | 98 |
| risingFloor | 12 | 12.7 | 25 | 151 |
| boost | 14 | 13.8 | 20 | 93 |

Modes still don't differentiate for a reactive bot (same finding as before, just with fewer total levels because each level is now worth more tile growth). Boost reaches fewer max levels (20) than classic (24) under greedy — the shorter games cap the ceiling.

### E2 recalibrated (N=10 matched seeds)

| Scenario | Greedy med | Lookahead med | Gap | Wins |
|----------|-----------|----------------|-----|------|
| boost + weighted | 14 | 19 | **+4.5** | 8/10 |
| classic + weighted | 16 | 17.5 | +1.5 | 5/10 |

Per-seed deltas:
- boost: `[4, 15, 5, 5, -3, -2, 8, 2, 13, 2]`
- classic: `[-1, -7, -2, 21, 0, 3, 7, 12, -11, 3]`

**Key shift in the data story:** with the harder starting target, modes now differentiate on strategic depth. Boost still rewards planning strongly; classic has mostly noise. This is the "skill ceiling varies by mode" signal we wanted — a skilled player's advantage in boost mode is much larger than in classic, which is exactly what makes mode choice meaningful.

## Difficulty Ratchet experiment

Added optional ratchet: each target cleared raises the spawn floor by one power of 2 (starts at 2, becomes 4, then 8, 16, ...). Independent of mode — combinable with classic/boost/risingFloor. Hypothesis: ratchet adds a race against rising baseline, forcing the player to keep peak growing faster than the floor.

### Matched-seed comparison (N=20 greedy, N=10 for planning gap, target=512)

| Scenario | Med Lvl | Med Moves | Effort/Lvl | Plan Gap | Look Wins |
|----------|--------:|----------:|-----------:|---------:|----------:|
| classic | 13 | 97 | **7.4** | +1.5 | 5/10 |
| **classic + RATCHET** | 11 | 272 | **23.8** | **+4.0** | **8/10** |
| boost | 14.5 | 96 | 6.7 | +4.5 | 8/10 |
| **boost + RATCHET** | 10.5 | 219 | 19.5 | +1.0 | 9/10 |

*Effort/Lvl = moves ÷ levelsCleared = how many moves it takes to earn a level on average.*

### What the numbers tell us

**Ratchet makes each level ~3× harder to earn.** Effort-per-level jumps from 7.4 → 23.8 on classic, 6.7 → 19.5 on boost. Games last ~3× longer because progress is slower per level, not because the bot survives more chains. That's the floor pressure working as intended.

**Ratchet + classic is a real strategy mode.** Planning gap widens from +1.5 to **+4.0** with 8/10 per-seed wins. Ratchet adds the cross-move structure that vanilla classic was missing — you *must* plan for the floor to keep up with peak. This is the first scenario where Classic mode has real strategic depth.

**Ratchet + boost paradoxically *narrows* the median planning gap** (4.5 → 1.0), but lookahead still wins 9/10 seeds. Per-seed deltas: `[1, 8, 4, 11, 15, 1, 1, 1, 0, 1]` — mostly small wins with occasional huge ones. Interpretation: ratchet caps how far either bot can climb, so the median difference shrinks, but when a seed allows breathing room, a planner extracts a LOT more.

### Unexpected findings

1. **Games get *longer*, not shorter, under ratchet.** I expected ratchet to shorten games by making the spawn pool more hostile. Instead, bigger spawn values mean bigger chains when they do happen, which sustains play. The game becomes a grind of occasional big chains rather than a flurry of small ones. Whether that feels rewarding or exhausting is an open playtest question.

2. **Ratchet has asymmetric effects on modes.** Classic gains strategic depth (+4 planning gap from +1.5). Boost *loses* median depth (+1 from +4.5) but keeps its consistency advantage (9/10 wins). Ratchet and Boost are both "depth layers" — stacking them doesn't compound, it flattens. Suggests they're competing strategic channels.

3. **Effort-per-level is the clearest narrative metric.** 7.4 → 23.8 tells the story of "earning" a level far better than raw level count. A single scalar that differentiates modes AND tunes. Recommend keeping it prominent in any future Lab dashboard.

### Ratchet interval — milder is NOT gentler

Tested `ratchetInterval=2` and `ratchetInterval=3` on classic (N=20 greedy):

| Scenario | Med Lvl | Med Moves | Effort/Lvl |
|----------|--------:|----------:|-----------:|
| classic (no ratchet) | 13 | 101 | 7.4 |
| classic + RATCHET@1 | 11 | 283 | 24.4 |
| classic + RATCHET@2 | 7.5 | 871 | **134.8** |
| classic + RATCHET@3 | 7 | 1231 | **204.6** |

**Counterintuitive finding.** Mild ratchet is drastically *worse*. Games explode in length (871 → 1231 moves), levels crater (11 → 7), effort-per-level shoots to 200+. Why? The ratchet isn't a "difficulty lever" — it's actually a **peak-growth accelerator**. Every level-up lifts the spawn floor, which forces bigger tiles into play, which pushes peak toward the next target. Remove that acceleration (by firing ratchet less often) and peak growth stalls. Games become endless grinds of 2s, 4s, 8s that chain easily but don't advance toward the target.

**Implication:** ratchet's interval should stay at 1. This also retroactively suggests the "ratchet adds strategic pressure" framing was misleading — ratchet *helps* progress more than it hinders, which is why longer-interval ratchet hurts so much.

### Boost + ratchet at interval 2 (N=10, maxMoves=500 cap)

| Scenario | Greedy | Lookahead | Gap | Wins |
|----------|-------:|----------:|----:|-----:|
| boost alone | 14 | 19 | +4.5 | 8/10 |
| boost + RATCHET@1 | 12.5 | 14.5 | +1.0 | 9/10 |
| boost + RATCHET@2 | 7 | 9 | +2.0 | **10/10** |

Deltas at ratchet@2: `[2, 2, 2, 2, 5, 2, 2, 3, 2, 1]` — absurdly consistent. Lookahead wins every single seed by small amounts. Ratchet@2 compresses the game into a shorter window where planning matters consistently but the ceiling is low.

No "best of both worlds" emerges — boost's strategic depth and ratchet's difficulty pressure seem to be genuinely competing levers, not stackable ones.

### Ratchet recommendation

Ship ratchet as an optional toggle:
- **Default off.** Baseline classic/boost already work; ratchet is for players who want a harder mode.
- **Pair with Classic for maximum strategic payoff.** Classic + ratchet is the clearest "strategy mode" we've built.
- **Don't pair with Boost in the default experience.** The two compete rather than compose — pick one.
- **Further experiment (not now): milder ratchet** — raise the floor only every 2 or 3 levels instead of every level. May reintroduce Boost's strategic ceiling while keeping the pressure.

## Honest step-back — are we on the right path?

After 8+ iterations of "run a test → interpret → run the next test," it's worth asking: are we doing the right thing?

### What we've proven
- **Targets are a real win.** They turned strategy from invisible into measurable. Level-count is the right north-star metric.
- **Mode-aware bot scoring was a critical unlock.** Without it, everything we measured about Boost was noise.
- **Classic + Ratchet@1 has genuine strategic depth.** Planning gap +4, 8/10 wins. The cleanest "thinking pays off" signal for the baseline mode we've ever seen.

### What's suspicious

1. **We've never actually played the game.** Every finding rests on a 1-ply lookahead bot vs a greedy bot. That's a proxy, not truth. A human player is neither bot — probably closer to lookahead but with strategic insight the bot lacks entirely.

2. **The user asked for "harder," and we made games *longer*.** 107 moves casual → 272 moves (ratchet@1) → 871 moves (ratchet@2). That's not harder — it's grindier. Whether long games feel like "earned struggle" or "slog" is exactly the question benchmarks can't answer.

3. **Ratchet's framing was wrong.** We said "difficulty ratchet adds pressure that forces strategy." The interval test shows ratchet is actually an accelerator — it *helps* progress, which is why softer intervals hurt so badly. That means "classic + ratchet has planning gap +4" may not be measuring what we thought it was measuring.

4. **Boost's signal keeps flipping.** +4.5 alone, +1 with ratchet@1, +2 with ratchet@2. Either Boost is highly sensitive to other settings, or the small N is hiding noise.

5. **The product has 7 knobs for a 2248 fork.** Targets, ratchet, ratchet interval, mode, algo, strength, softness, queue depth. The original ask was "make it harder and more strategic." We've built a research platform.

### Recommendation — stop adding mechanics

The next action that changes the game is **human playtest**, not another benchmark. Concretely:

1. **Play 10 games each of:**
   - Classic (baseline for feel)
   - Classic + Ratchet@1 (best-measured strategy mode)
   - Boost (measured strategic depth)
2. **Record in a notebook, per session:**
   - Did level-up feel like a reward or a tick in a grind?
   - Did any move feel like a *decision* vs a reflex?
   - Was the game length tolerable?
   - Which mode would you want to play again in a week?
3. **Make a product call based on felt experience.** Commit to ONE primary mode + an optional ratchet toggle. Hide everything else behind a dev flag.

Things **NOT** to do next:
- Don't add another mechanic (partial clear, pool narrowing, move budget). We already have enough levers to evaluate.
- Don't build the "Lab page." Measurement infra in DevPanel is sufficient; a polished Lab is effort that doesn't change the game.
- Don't keep tuning constants. We're past the point where more tuning returns useful signal.

### Why this is the honest call

The pattern so far: "run a test, find an interesting anomaly, hypothesize a fix, run another test." That loop feels productive but each iteration's signal weakens as we tune against our own proxy. We're over-fitting to bot-vs-bot metrics that don't map cleanly to player experience.

Every product decision from here should be answerable with "I played it, this is how it felt" — not "the planning gap went from +3.5 to +4.0 with N=10 at P<0.xx." The benchmark tells us the mechanic has *potential*. It can't tell us whether the mechanic is *fun*.

## Data provenance

All experiments run with:
- Bot version: mode-aware scoring (greedy + lookahead1)
- Target doubling, `INITIAL_TARGET = 128`
- Matched seeds within each scenario
- Game ver: `targets` branch, post-mode-aware-bot fix

See `src/game/bot.ts` for bot scoring logic, `src/game/engine.ts` for target detection loop in `planCommit`.
