import type {
  AggregateResult,
  GameResult,
  StrategyName,
} from './types.js';
import type { GameConfig } from '../game-kernel/index.js';

// ─── analyze ─────────────────────────────────────────────────────────────────

export interface AnalyzeOptions {
  readonly config: GameConfig;
  readonly strategy: StrategyName;
  readonly n: number;
  readonly startStrategySeed: number;
}

/**
 * Aggregate per-game results into a single AggregateResult. Shape matches
 * SIM_HARNESS_SCHEMA.md exactly; the runner emits per-game GameResults
 * and the analyzer is the only path that produces AggregateResults.
 *
 * Throws if `results.length !== options.n` — that would be a runner bug
 * and silent miscount would corrupt downstream sweep math.
 */
export function analyze(
  results: readonly GameResult[],
  options: AnalyzeOptions,
): AggregateResult {
  if (results.length !== options.n) {
    throw new Error(
      `analyze: results.length=${results.length} but options.n=${options.n}`,
    );
  }

  const completed: GameResult[] = [];
  const allLengths: number[] = [];
  const allMaxTiles: number[] = [];
  const completedLengths: number[] = [];
  const maxTileDistribution: Record<string, number> = {};
  const deathCauseDistribution: Record<string, number> = {};
  const chainsPerLevels: number[] = [];
  const avgChainLengths: number[] = [];
  let endedByCapCount = 0;

  // Sum dense histograms across games — width matches whatever the runner
  // produced (currently 64 / 16 from runner.ts constants).
  let chainLengthLen = 0;
  let chainResultLen = 0;
  for (const r of results) {
    if (r.outputs.chainLengthHistogram.length > chainLengthLen) {
      chainLengthLen = r.outputs.chainLengthHistogram.length;
    }
    if (r.outputs.chainResultHistogram.length > chainResultLen) {
      chainResultLen = r.outputs.chainResultHistogram.length;
    }
  }
  const chainLengthDistribution = new Array<number>(chainLengthLen).fill(0);
  const chainResultDistribution = new Array<number>(chainResultLen).fill(0);

  for (const r of results) {
    allLengths.push(r.outputs.turns);
    allMaxTiles.push(r.outputs.maxTile);

    const tileKey = String(r.outputs.maxTile);
    maxTileDistribution[tileKey] = (maxTileDistribution[tileKey] ?? 0) + 1;

    const deathKey = r.outputs.deathCause ?? 'none';
    deathCauseDistribution[deathKey] = (deathCauseDistribution[deathKey] ?? 0) + 1;

    if (r.outputs.finalPhase === 'game-over') {
      completed.push(r);
      completedLengths.push(r.outputs.turns);
    }

    for (let i = 0; i < r.outputs.chainLengthHistogram.length; i++) {
      chainLengthDistribution[i] = (chainLengthDistribution[i] ?? 0) + (r.outputs.chainLengthHistogram[i] ?? 0);
    }
    for (let i = 0; i < r.outputs.chainResultHistogram.length; i++) {
      chainResultDistribution[i] = (chainResultDistribution[i] ?? 0) + (r.outputs.chainResultHistogram[i] ?? 0);
    }

    chainsPerLevels.push(r.outputs.chainsPerLevel);
    avgChainLengths.push(r.outputs.avgChainLength);
    if (r.outputs.endedByTurnCap) endedByCapCount++;
  }

  return {
    inputs: {
      config: options.config,
      strategy: options.strategy,
      n: options.n,
      startStrategySeed: options.startStrategySeed,
    },
    outputs: {
      completedGames: completed.length,
      meanGameLength: mean(completedLengths),
      medianGameLength: percentile(completedLengths, 0.5),
      p10GameLength: percentile(completedLengths, 0.1),
      p90GameLength: percentile(completedLengths, 0.9),
      meanMaxTile: mean(allMaxTiles),
      medianMaxTile: percentile(allMaxTiles, 0.5),
      maxTileDistribution,
      chainLengthDistribution,
      chainResultDistribution,
      deathCauseDistribution,
      meanChainsPerLevel: mean(chainsPerLevels),
      meanChainLength: mean(avgChainLengths),
      pctEndedByCap: results.length > 0 ? endedByCapCount / results.length : 0,
    },
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const v of xs) s += v;
  return s / xs.length;
}

/**
 * Linear-interpolated percentile. p ∈ [0, 1]. Returns 0 for empty input
 * (consistent with mean's behavior — caller should check completedGames
 * before relying on these stats).
 */
function percentile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo] ?? 0;
  const frac = idx - lo;
  return (sorted[lo] ?? 0) * (1 - frac) + (sorted[hi] ?? 0) * frac;
}
