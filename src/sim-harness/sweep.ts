import type { GameConfig } from '../game-kernel/index.js';
import { analyze } from './analyzer.js';
import { runGames } from './runner.js';
import type {
  StrategyName,
  SweepResult,
  SweepableConfigKey,
} from './types.js';

export interface SweepOptions {
  readonly baseConfig: GameConfig;
  readonly sweepKey: SweepableConfigKey;
  readonly sweepValues: readonly number[];
  readonly strategy: StrategyName;
  readonly n: number;
  readonly startStrategySeed: number;
  /** Max turns per game; defaults to runner's DEFAULT_MAX_TURNS. */
  readonly maxTurns?: number;
}

/**
 * Run a sweep: for each sweepValue, override baseConfig[sweepKey] with the
 * value, run N games with that config, aggregate, append to rows. Returns
 * the SweepResult shape from SIM_HARNESS_SCHEMA.md.
 *
 * Determinism: identical (baseConfig, sweepKey, sweepValues, strategy, n,
 * startStrategySeed) → byte-identical SweepResult.
 */
export function sweep(options: SweepOptions): SweepResult {
  const rows = options.sweepValues.map((value) => {
    const config: GameConfig = { ...options.baseConfig, [options.sweepKey]: value };
    const runOpts = options.maxTurns !== undefined
      ? { n: options.n, startStrategySeed: options.startStrategySeed, maxTurns: options.maxTurns }
      : { n: options.n, startStrategySeed: options.startStrategySeed };
    const games = runGames(config, options.strategy, runOpts);
    return analyze(games, {
      config,
      strategy: options.strategy,
      n: options.n,
      startStrategySeed: options.startStrategySeed,
    });
  });

  return {
    inputs: {
      sweepKey: options.sweepKey,
      sweepValues: options.sweepValues,
      strategy: options.strategy,
      n: options.n,
      startStrategySeed: options.startStrategySeed,
      baseConfig: options.baseConfig,
    },
    outputs: { rows },
  };
}
