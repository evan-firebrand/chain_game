# Sim-Harness Output Schema

**Status:** Architecture-Agent draft — pending Evan approval per CLAUDE.md.

The Design Intent Solver (Stage E) will be built on this data. **Schema changes after Stage E exists are breaking.** Lock the shape here before any runner code lands.

---

## Three layers

The harness produces three nested kinds of result:

1. **`GameResult`** — one individual game's outcome. The atomic unit.
2. **`AggregateResult`** — statistics across N games run with a single config + strategy.
3. **`SweepResult`** — a series of `AggregateResult`s across varying values of one config key.

Every layer carries its own `inputs` and `outputs`. Inverse queries (the Design Intent Solver) operate by scanning rows and matching `outputs` against criteria, then reporting the corresponding `inputs`.

All shapes are plain JSON-serializable values: no class instances, no functions, no `undefined` fields, no `bigint`s. `JSON.stringify(result)` round-trips.

---

## `GameResult` — one game

```ts
interface GameResult {
  readonly inputs: {
    /** Full game config in effect. Includes prngSeed. */
    readonly config: GameConfig;
    /** Strategy name. Stable string so sweeps can compare across runs. */
    readonly strategy: StrategyName;
    /**
     * Strategy's own RNG seed (independent of config.prngSeed). Lets the
     * harness reproduce a specific game exactly: same kernel seed +
     * same strategy seed → byte-identical outcome.
     */
    readonly strategySeed: number;
  };
  readonly outputs: {
    /** Total turns committed before game-over (or hitting maxTurns cap). */
    readonly turns: number;
    /** Highest tile value the board ever held. */
    readonly maxTile: number;
    /** Final phase. 'game-over' for a completed game; 'playing' if maxTurns hit. */
    readonly finalPhase: 'playing' | 'game-over';
    /** Reason the game ended; null if the game hit the maxTurns cap instead. */
    readonly deathCause: 'no-legal-chain-start' | null;
    /**
     * chainLengthHistogram[L] = number of chains of length L committed
     * during the game. Dense array indexed by length; index 0 and 1 are
     * always 0. Length is bounded by gridRows × gridCols (42 by default).
     */
    readonly chainLengthHistogram: readonly number[];
    /**
     * chainResultHistogram[k] = number of chains whose result value was
     * 2^k (log2-indexed). Dense array. Length is bounded by 16 (matches
     * the fast-surface 4-bit value field; covers up to 2^15 = 32768).
     */
    readonly chainResultHistogram: readonly number[];
  };
}
```

**Notes:**
- No per-event log. Dropping the cumulative event array is the O(T²) → O(T) win baked into Phase 1.8; encoding events here would re-introduce that cost.
- Histograms (not full sequences) keep result size constant per game regardless of length.
- `config.prngSeed` together with `strategySeed` is the full reproduction key.

---

## `AggregateResult` — N games, one config

```ts
interface AggregateResult {
  readonly inputs: {
    /** Config that was held constant across the N games. */
    readonly config: GameConfig;
    readonly strategy: StrategyName;
    /** Number of games run. */
    readonly n: number;
    /**
     * Strategy seed range used: games i in [0, n) ran with
     * strategySeed = startStrategySeed + i. Re-running with the same
     * (config, strategy, n, startStrategySeed) reproduces every game
     * byte-for-byte.
     */
    readonly startStrategySeed: number;
  };
  readonly outputs: {
    /** Games that completed (reached game-over). May be < n if some hit maxTurns. */
    readonly completedGames: number;

    // Game-length stats (over completedGames; ignores maxTurns-capped games)
    readonly meanGameLength: number;
    readonly medianGameLength: number;
    readonly p10GameLength: number;
    readonly p90GameLength: number;

    // Max-tile stats
    readonly meanMaxTile: number;
    readonly medianMaxTile: number;
    /** maxTileDistribution[v] = count of games whose maxTile was exactly v. */
    readonly maxTileDistribution: Readonly<Record<string, number>>;

    /** Sum of per-game chainLengthHistogram across all games. Dense array. */
    readonly chainLengthDistribution: readonly number[];
    /** Sum of per-game chainResultHistogram across all games. Dense array. */
    readonly chainResultDistribution: readonly number[];

    /** Death-cause counts. Key 'none' = games that hit maxTurns. */
    readonly deathCauseDistribution: Readonly<Record<string, number>>;
  };
}
```

**Notes:**
- All stats are computed from the per-game `GameResult`s in one pass; the harness throws away the per-game results once aggregated unless the caller asks for `keepGames: true`.
- `Record<string, number>` (rather than `Record<number, number>`) for `maxTileDistribution` because `Record<number, ...>` JSON-serializes numeric keys as strings anyway — make the type honest about what survives the round-trip.
- Game-length percentiles ignore games that hit `maxTurns` (those are right-censored). `completedGames` lets the caller weigh accordingly.

---

## `SweepResult` — many configs

```ts
interface SweepResult {
  readonly inputs: {
    /**
     * Which config key varied across the sweep. Restricted to a
     * type-safe union of the GameConfig keys we'll allow sweeping.
     * Currently: 'ruleK' | 'gridRows' | 'gridCols' | 'spawnPoolMin'
     *          | 'spawnPoolMax' | 'prngSeed'
     * spawnWeights is NOT sweepable as a single-axis sweep (it's an
     * object); a separate `weight-sweep` schema may be added later.
     */
    readonly sweepKey: SweepableConfigKey;
    /** Values the sweep iterated over, in run order. */
    readonly sweepValues: readonly number[];
    /** Strategy held constant across the sweep. */
    readonly strategy: StrategyName;
    /** N held constant across the sweep. */
    readonly n: number;
    /** startStrategySeed held constant across the sweep. */
    readonly startStrategySeed: number;
    /** The base config; the value of sweepKey was overridden per row. */
    readonly baseConfig: GameConfig;
  };
  readonly outputs: {
    /**
     * One row per sweepValue. rows[i].inputs.config has sweepKey set
     * to sweepValues[i]; everything else mirrors baseConfig.
     */
    readonly rows: readonly AggregateResult[];
  };
}
```

**Notes:**
- Cross-axis sweeps (vary two keys at once) are out of scope for the v1 schema — they'd be a separate `MatrixSweepResult` with a 2D `rows[][]`. The Design Intent Solver typically scans one-axis sweeps, then constructs a 2D scan from a series of one-axis runs.
- Reproducing a sweep: same (`sweepKey`, `sweepValues`, `strategy`, `n`, `startStrategySeed`, `baseConfig`) → byte-identical `rows`.

---

## Strategy names

```ts
type StrategyName = 'random' | 'greedy' | 'heuristic';
```

A strategy's behavior is encoded by its name. Adding a new strategy requires:
1. A new entry in this union (Evan-approved schema change — not breaking unless old data is re-run).
2. A new file in `src/sim-harness/strategies/`.
3. Documented behavior in `strategies/README.md`.

---

## What the harness does NOT record

Deliberate omissions, with reasons:

| Field | Why omitted |
|---|---|
| Per-turn event log | O(T²) cost; fundamentally incompatible with the 1000-game gate |
| Per-turn board snapshots | Memory blowup; replays should re-run from `(config.prngSeed, strategySeed)` |
| Wall-clock timings | Use the bench harness for perf data; harness output is for game-mechanic stats |
| Strategy-internal state | Implementation detail; not portable across strategy versions |

---

## Determinism contract

For any `(config, strategy, strategySeed)` triple:
- The `GameResult` is byte-for-byte identical across runs.
- This is gated by `tests/sim-harness/determinism.test.ts` (added in Phase 3.3).

For any `(config, strategy, n, startStrategySeed)` quadruple:
- The `AggregateResult.outputs` is byte-for-byte identical across runs.

For any `SweepResult`:
- The full `outputs` is byte-for-byte identical across runs given the same input quadruple.

Determinism is a hard contract — a property test in Phase 3 will detect any divergence.

---

## File location

The schema lives in this document AND in `src/sim-harness/types.ts` (Phase 3.1 makes them match). Keep them in lockstep. If a divergence is needed, update both in one PR.

---

## Revisit conditions

Revisit when:
- A new strategy is added (extend `StrategyName`).
- The Design Intent Solver discovers it needs a stat the harness doesn't compute (extend `AggregateResult.outputs`).
- A future spec change requires per-game state we currently throw away (carefully — re-think before adding).

Do NOT revisit lightly. Schema changes after Stage E exists are breaking.
