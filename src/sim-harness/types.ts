import type { GameConfig } from '../game-kernel/index.js';

// ─── Schema ──────────────────────────────────────────────────────────────────
// Mirrors docs/engineering/SIM_HARNESS_SCHEMA.md. Keep in lockstep — any
// change here requires a matching change to that document, and vice versa.

/** Stable name of an automated playing strategy. */
export type StrategyName =
  | 'random'
  | 'greedy'
  | 'heuristic'
  | 'search-d1'
  | 'search-d2'
  | 'search-d3';

/**
 * GameConfig keys whose value is a single number that one-axis sweeps can
 * vary. spawnWeights is excluded — it's an object; use a separate
 * weight-sweep schema if needed.
 */
export type SweepableConfigKey =
  | 'ruleK'
  | 'gridRows'
  | 'gridCols'
  | 'spawnPoolMin'
  | 'spawnPoolMax'
  | 'prngSeed';

// ─── GameResult ──────────────────────────────────────────────────────────────

export interface GameResultInputs {
  readonly config: GameConfig;
  readonly strategy: StrategyName;
  readonly strategySeed: number;
}

export interface GameResultOutputs {
  readonly turns: number;
  readonly maxTile: number;
  readonly finalPhase: 'playing' | 'game-over';
  readonly deathCause: 'no-legal-chain-start' | null;
  readonly chainLengthHistogram: readonly number[];
  readonly chainResultHistogram: readonly number[];
  /** turns / log2(maxTile). Lower = more efficient. 0 if maxTile <= 1. */
  readonly chainsPerLevel: number;
  /** Mean chain length committed in this game. 0 if no chains landed. */
  readonly avgChainLength: number;
  /** True if the game stopped at the maxTurns cap rather than no-legal-chain. */
  readonly endedByTurnCap: boolean;
  /** Per-turn metric trends, length = turns. Index t = value after turn t+1. */
  readonly metricsByTurn: {
    readonly maxTile: readonly number[];
    readonly chainLength: readonly number[];
  };
  /** Encoded board (rows*cols bytes) at turn 30 completion, or null if game ended earlier. */
  readonly boardSnapshotTurn30: readonly number[] | null;
}

export interface GameResult {
  readonly inputs: GameResultInputs;
  readonly outputs: GameResultOutputs;
}

// ─── AggregateResult ─────────────────────────────────────────────────────────

export interface AggregateResultInputs {
  readonly config: GameConfig;
  readonly strategy: StrategyName;
  readonly n: number;
  readonly startStrategySeed: number;
}

export interface AggregateResultOutputs {
  readonly completedGames: number;
  readonly meanGameLength: number;
  readonly medianGameLength: number;
  readonly p10GameLength: number;
  readonly p90GameLength: number;
  readonly meanMaxTile: number;
  readonly medianMaxTile: number;
  readonly maxTileDistribution: Readonly<Record<string, number>>;
  readonly chainLengthDistribution: readonly number[];
  readonly chainResultDistribution: readonly number[];
  readonly deathCauseDistribution: Readonly<Record<string, number>>;
  /** Mean of per-game chainsPerLevel. */
  readonly meanChainsPerLevel: number;
  /** Mean of per-game avgChainLength. */
  readonly meanChainLength: number;
  /** Fraction of games (in [0,1]) that ended at the turn cap rather than naturally. */
  readonly pctEndedByCap: number;
}

export interface AggregateResult {
  readonly inputs: AggregateResultInputs;
  readonly outputs: AggregateResultOutputs;
}

// ─── SweepResult ─────────────────────────────────────────────────────────────

export interface SweepResultInputs {
  readonly sweepKey: SweepableConfigKey;
  readonly sweepValues: readonly number[];
  readonly strategy: StrategyName;
  readonly n: number;
  readonly startStrategySeed: number;
  readonly baseConfig: GameConfig;
}

export interface SweepResultOutputs {
  readonly rows: readonly AggregateResult[];
}

export interface SweepResult {
  readonly inputs: SweepResultInputs;
  readonly outputs: SweepResultOutputs;
}

// ─── Strategy interface ──────────────────────────────────────────────────────
// Strategies are pure functions of (FastState, RNG) → chain. Decoupled from
// the kernel internals so a strategy can be unit-tested with a hand-built
// FastState.

import type { Cell } from '../game-kernel/index.js';
import type { FastState } from '../game-kernel/fast/index.js';

/** A deterministic float source seeded by the strategy's own seed. */
export interface StrategyRng {
  /** Returns the next float in [0, 1). */
  next(): number;
  /** Returns an integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

/**
 * A strategy picks the next chain to commit, or returns null when no legal
 * move exists (game is effectively over from the strategy's perspective).
 *
 * Trusted-move contract: returned chain MUST be legal on the supplied
 * FastState. The fast surface is trusted-move and won't validate; the
 * harness will assert in DEBUG mode.
 */
export type Strategy = (state: FastState, rng: StrategyRng) => readonly Cell[] | null;
