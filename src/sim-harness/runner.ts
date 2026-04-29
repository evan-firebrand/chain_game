import type { Cell, GameConfig } from '../game-kernel/index.js';
import { createGame } from '../game-kernel/index.js';
import {
  applyChainInPlace,
  fromPure,
  type FastState,
} from '../game-kernel/fast/index.js';
import type { GameResult, Strategy, StrategyName } from './types.js';
import { makeStrategyRng, randomStrategy } from './strategies/random.js';
import { greedyStrategy } from './strategies/greedy.js';
import { heuristicStrategy } from './strategies/heuristic.js';
import { searchStrategy } from './strategies/search.js';

// ─── Strategy registry ───────────────────────────────────────────────────────

const STRATEGIES: Record<StrategyName, Strategy> = {
  random: randomStrategy,
  greedy: greedyStrategy,
  heuristic: heuristicStrategy,
  'search-d1': searchStrategy({ depth: 1 }),
  'search-d2': searchStrategy({ depth: 2 }),
  'search-d3': searchStrategy({ depth: 3 }),
};

export function registerStrategy(name: StrategyName, strategy: Strategy): void {
  STRATEGIES[name] = strategy;
}

// ─── playOneGame ─────────────────────────────────────────────────────────────

export interface PlayOneOptions {
  /** Hard cap on turns. Games that hit this are right-censored. */
  readonly maxTurns?: number;
}

const DEFAULT_MAX_TURNS = 100_000;
/** Histogram array length cap. Bounded by board area + buffer. */
const MAX_CHAIN_LENGTH = 64;
/** Histogram for log2(result) — covers values up to 2^15. */
const MAX_LOG2_RESULT = 16;
/** Turn at which boardSnapshotTurn30 is captured. */
const SNAPSHOT_TURN = 30;

/**
 * Play one game from createGame to game-over (or maxTurns). Returns the
 * GameResult for this single game. Deterministic given (config, strategy,
 * strategySeed).
 *
 * Forces config.recordEvents = false internally — the sim path never needs
 * the cumulative event log, and the GameResult already captures everything
 * the schema records.
 */
export function playOneGame(
  config: GameConfig,
  strategyName: StrategyName,
  strategySeed: number,
  options: PlayOneOptions = {},
): GameResult {
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const strategy = STRATEGIES[strategyName];

  // Force recordEvents:false — the harness never reads state.events.
  const simConfig: GameConfig = { ...config, recordEvents: false };
  const fast: FastState = fromPure(createGame(simConfig));
  const rng = makeStrategyRng(strategySeed);

  const chainLengthHistogram = new Array<number>(MAX_CHAIN_LENGTH).fill(0);
  const chainResultHistogram = new Array<number>(MAX_LOG2_RESULT).fill(0);
  const maxTileByTurn: number[] = [];
  const chainLengthByTurn: number[] = [];
  let chainsCommitted = 0;
  let totalChainLength = 0;
  let boardSnapshotTurn30: number[] | null = null;

  let turn = 0;

  while (fast.phase === 'playing' && turn < maxTurns) {
    const chain: readonly Cell[] | null = strategy(fast, rng);
    if (chain === null) break;

    const len = chain.length;
    if (len < MAX_CHAIN_LENGTH) chainLengthHistogram[len] = (chainLengthHistogram[len] ?? 0) + 1;

    const result = applyChainInPlace(fast, chain);
    if (result === null) break;

    if (result.resultValue > 0) {
      const log2 = Math.log2(result.resultValue);
      if (Number.isInteger(log2) && log2 >= 0 && log2 < MAX_LOG2_RESULT) {
        chainResultHistogram[log2] = (chainResultHistogram[log2] ?? 0) + 1;
      }
    }

    chainsCommitted++;
    totalChainLength += len;
    maxTileByTurn.push(fast.maxTileEver);
    chainLengthByTurn.push(len);

    if (fast.turn === SNAPSHOT_TURN && boardSnapshotTurn30 === null) {
      boardSnapshotTurn30 = Array.from(fast.board);
    }

    turn++;
  }

  const turns = fast.turn;
  const maxTile = fast.maxTileEver;
  const chainsPerLevel = maxTile > 1 ? turns / Math.log2(maxTile) : 0;
  const avgChainLength = chainsCommitted > 0 ? totalChainLength / chainsCommitted : 0;
  const endedByTurnCap = turn >= maxTurns && fast.phase === 'playing';

  return {
    inputs: {
      config,
      strategy: strategyName,
      strategySeed,
    },
    outputs: {
      turns,
      maxTile,
      finalPhase: fast.phase,
      deathCause: fast.phase === 'game-over' ? 'no-legal-chain-start' : null,
      chainLengthHistogram,
      chainResultHistogram,
      chainsPerLevel,
      avgChainLength,
      endedByTurnCap,
      metricsByTurn: { maxTile: maxTileByTurn, chainLength: chainLengthByTurn },
      boardSnapshotTurn30,
    },
  };
}

// ─── runGames ────────────────────────────────────────────────────────────────

export interface RunGamesOptions {
  readonly n: number;
  readonly startStrategySeed: number;
  readonly maxTurns?: number;
}

/**
 * Play N games for one config. Game i runs with strategySeed =
 * startStrategySeed + i. Returns the per-game results in order.
 *
 * Deterministic for (config, strategyName, n, startStrategySeed).
 */
export function runGames(
  config: GameConfig,
  strategyName: StrategyName,
  options: RunGamesOptions,
): GameResult[] {
  const results = new Array<GameResult>(options.n);
  const maxTurnsOpt = options.maxTurns;
  for (let i = 0; i < options.n; i++) {
    const playOptions: PlayOneOptions = maxTurnsOpt !== undefined ? { maxTurns: maxTurnsOpt } : {};
    results[i] = playOneGame(
      config,
      strategyName,
      options.startStrategySeed + i,
      playOptions,
    );
  }
  return results;
}
