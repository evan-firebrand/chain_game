# Skill-Depth Study — Backlog

Forward-looking research questions and design variants that are **out of scope** for v2 of the skill-depth study but worth capturing so they don't evaporate. Anything in this file is a candidate for a future study, ADR, or design exploration — not a current commitment.

Items are grouped by concern, not priority. Each item has a one-sentence rationale.

---

## Game mechanics — variants beyond v2

### Bricking-retirement variant
When pool advancement fires, tiles of the retiring tier on the board do **not** auto-dissolve — they remain as locked/dead tiles that block adjacent merges. Adds skill pressure: the player must merge tier N before retirement of N fires, or accept permanent obstacles. Compare against v2's neutral baseline (auto-dissolve) to measure how much depth the bricking layer adds beyond pool-advancement alone.

### Soft-bricking variants
Sub-variants of bricking worth comparing if bricking proper is tested:
- Retired tiles are unmovable but still block (default bricking)
- Retired tiles only block specific directions (e.g. block gravity but not chains across them)
- Retired tiles count toward game-over conditions (e.g. "if any retired tile remains for K turns, game ends")
- Retired tiles can be cleared by special chains (e.g. a chain that ends on a retired tile clears it)

### Board-aware spawning
Spawn distribution depends on current board state, not just static pool weights.

- **Friendly spawn**: spawn tiles likely to enable a merge (same-value or doubling neighbor of an existing tile)
- **Adversarial spawn**: spawn tiles least likely to enable a merge — anti-merge stress test
- **Hybrid spawn**: switch between friendly/adversarial based on board fullness, max tile reached, or chain-availability count
- **Always-playable invariant**: spawn whatever guarantees ≥1 legal chain on the next turn — the "you can never lose to RNG" rule

These are independent of weight shape and pool ceiling, so each can be added as an axis once the static-spawn cases are characterized.

### Win conditions
Currently the game has no win state — only game-over (no legal chains) or right-censored (turn cap). Worth defining:
- "Win" at tile N (e.g. 2048 reached → success state, game continues or ends)
- Score-based win (cumulative score over a game)
- Time-trial mode (highest tile in K turns)

---

## Strategies — beyond the v2 ladder

### Player-emulating strategy
A heuristic shaped to match how humans actually play: bounded look-ahead (1–2 chains), local greediness, mistake injection (e.g. 5% random chains). Distinct from optimal-search bots; serves as a "realistic skill" reference point. Requires playtest data to calibrate.

### Adversarial strategy
A bot that plays *badly* on purpose — picks the worst available chain by some metric. Bounds the lower envelope of game performance; the spread between adversarial and chainBuilder gives the *full* skill range, not just the random→optimal gap.

### Trained agent
Reinforcement-learning agent trained on the kernel. Useful as an upper-bound reference for "best possible play given infinite practice." Probably not before v3.

### Strategy-vs-strategy tournaments
Beyond per-strategy-vs-baseline measurement: pair strategies head-to-head on identical seeds and measure relative win rates. May surface non-transitive performance (rock-paper-scissors among strategies) which would itself be an interesting design signal.

---

## Metrics — beyond max-tile

### Time-to-tier-N
Turns elapsed before the first tile of value N appears. Different N values (64, 256, 1024) bracket different phases of play. Less right-censoring sensitivity than max-tile.

### Sustainability curve
Fraction of games still in `playing` state at each turn. Captures game-length distribution as a smooth curve rather than a single mean. Independent of max-tile metric.

### Distinct-tile-types-present
At any turn snapshot, how many distinct tile values appear on the board. A board entropy proxy — high entropy = saturating (no merges possible), low entropy = stack-up phase (active merging). Could distinguish "saturated game over" from "merge-ladder game over."

### Chain-length distribution per strategy
The kernel records `chainLengthHistogram` per game; v2 should aggregate this per-strategy-per-cell to surface what chain lengths each strategy actually produces. (v1 collected this data but didn't analyze it.)

### Score
A cumulative score metric layered on top of max-tile, e.g. sum of all chain result values across the game. Different optimum than max-tile (which is a single-event metric); some plays maximize one but not the other.

---

## Engineering — deferred capabilities

### Worker parallelism for sim
Run cells in parallel across CPU cores. Currently single-threaded; a 60-cell grid takes minutes. Worker pool would scale near-linearly. Was deferred from the original perf plan as Phase 4.

### Pure↔fast surface adapter
Replumb the public kernel API to use the fast surface internally so external callers (UI, tuning console) automatically get the perf gain. Was deferred as Phase 2.7.

### Generalize Row/Col literal types
`src/game-kernel/types.ts` defines `Row = 0..6` and `Col = 0..5` as literal unions; larger boards are cast at runtime. Either generalize to `number` or generate the union from a max-board-size constant. Cosmetic; no runtime effect.

### Streaming results to disk during long sweeps
Long study runs (>30 min) should stream per-cell results as they complete, so partial data survives crashes/timeouts. The `phase15` runner does this; the v2 runner should too.

---

## Design questions — open for Evan

### Default-config evolution
- What's the right default board size for v1 retail play?
- What's the right default weight shape under the new parameterization?
- What's the right retirement trigger threshold for default?

These are spec questions, not engineering. ADRs once decided.

### Player chain-length data
Is there playtest data on what chain lengths real players actually produce? Calibrating chainBuilder's `maxLen` to match player ceilings would make the strategy more representative.

### Primary metric choice
v1 used max-tile reached. v2 should reconsider given the new metrics available (time-to-tier-N, sustainability). Possibly pick a primary plus 2–3 secondaries rather than max-tile alone.

### Saturation handling
With flat × pool=12 cells saturating in <10 turns, "depth" measurement is meaningless there. Should those cells be excluded from grids, or are they themselves a finding (i.e. "this config is broken")? v2 should handle this explicitly.

### Tuning Console scope
Phase 3 (Tuning Console) on the CLAUDE.md gate sequence is between v2 of this study and Phase 4 (retirement). Should the Tuning Console expose the new parameters introduced in v2 (weight shape templates, retirement on/off)? Probably yes, but worth deciding before Phase 3 starts.
