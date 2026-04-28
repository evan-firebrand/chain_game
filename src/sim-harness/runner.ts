import {
  applyAction,
  computeChainResult,
  createGame,
} from '../game-kernel/index.js';
import type { GameConfig, GameState, TileValue } from '../game-kernel/index.js';
import {
  countIsolatedRetiredTiles,
  countLegalChainStarts,
  countRetiredTiles,
} from './strategies/common.js';
import type {
  GameRunResult,
  RunSimulationOptions,
  SimulationInputs,
  SimulationResultRow,
  StrategyContext,
  TurnRecord,
} from './types.js';
import { analyzeGames } from './analyzer.js';

const DEFAULT_MAX_TURNS = 10_000;
const DEFAULT_MAX_CHAIN_LENGTH = 5;

function lcgNext(state: number): number {
  return (Math.imul(1664525, state) + 1013904223) >>> 0;
}

function lcgFloat(state: number): number {
  return state / 0x100000000;
}

function withSeed(config: GameConfig, seed: number): GameConfig {
  return { ...config, prngSeed: seed };
}

function maxTileOnBoard(state: GameState): TileValue {
  let max = state.maxTileEver;
  for (const row of state.board) {
    for (const tile of row) {
      if (tile.value > max) max = tile.value;
    }
  }
  return max;
}

function createStrategyContext(maxChainLength: number, initialSeed: number): StrategyContext {
  let state = initialSeed >>> 0;
  return {
    maxChainLength,
    random: (): number => {
      state = lcgNext(state);
      return lcgFloat(state);
    },
  };
}

function runOneGame(
  options: Required<Pick<RunSimulationOptions, 'maxTurns' | 'maxChainLength'>> & RunSimulationOptions,
  runIndex: number,
  seed: number
): GameRunResult {
  let state = createGame(withSeed(options.config, seed));
  const turns: TurnRecord[] = [];
  const context = createStrategyContext(options.maxChainLength, seed ^ 0x9e3779b9);
  let deathCause: GameRunResult['deathCause'] = 'max-turns';

  while (state.phase === 'playing' && state.turn < options.maxTurns) {
    const decision = options.strategy.chooseAction(state, context);
    const { action } = decision;
    if (action === null) {
      deathCause = 'strategy-null';
      break;
    }

    const resultValue = computeChainResult(state.board, action.chain, state.config);
    const legalChainStartsBefore = countLegalChainStarts(state.board);
    const retiredTileCountBefore = countRetiredTiles(state.board);
    const isolatedRetiredTileCountBefore = countIsolatedRetiredTiles(state.board);
    const spawnPoolBefore = [state.spawnPoolMin, state.spawnPoolMax] as const;
    const previousEventCount = state.events.length;

    const nextState = applyAction(state, action);
    const newEvents = nextState.events.slice(previousEventCount);
    const legalChainStartsAfter = countLegalChainStarts(nextState.board);

    const turnRecord: TurnRecord = {
      turn: nextState.turn,
      chain: action.chain,
      chainLength: action.chain.length,
      resultValue,
      legalChainStartsBefore,
      legalChainStartsAfter,
      spawnPoolBefore,
      spawnPoolAfter: [nextState.spawnPoolMin, nextState.spawnPoolMax],
      retiredTileCountBefore,
      retiredTileCountAfter: countRetiredTiles(nextState.board),
      isolatedRetiredTileCountBefore,
      isolatedRetiredTileCountAfter: countIsolatedRetiredTiles(nextState.board),
      events: newEvents,
    };

    turns.push(decision.diagnostics === undefined
      ? turnRecord
      : { ...turnRecord, strategyDiagnostics: decision.diagnostics });

    state = nextState;
  }

  if (state.phase === 'game-over') {
    deathCause = 'no-legal-chain-start';
  }

  return {
    runIndex,
    seed,
    strategyId: options.strategy.id,
    finalTurn: state.turn,
    finalPhase: state.phase,
    deathCause,
    maxTileReached: maxTileOnBoard(state),
    activeSpawnPoolAtDeath: [state.spawnPoolMin, state.spawnPoolMax],
    events: state.events,
    turns,
  };
}

export function runSimulation(options: RunSimulationOptions): SimulationResultRow {
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const maxChainLength = options.maxChainLength ?? DEFAULT_MAX_CHAIN_LENGTH;
  const normalized = { ...options, maxTurns, maxChainLength };
  const games: GameRunResult[] = [];

  for (let i = 0; i < options.runs; i++) {
    games.push(runOneGame(normalized, i, options.seed + i));
  }

  const inputs: SimulationInputs = {
    config: options.config,
    strategyId: options.strategy.id,
    runCount: options.runs,
    baseSeed: options.seed,
    maxTurns,
    maxChainLength,
    retirementMode: 'cascade',
  };

  return {
    inputs,
    outputs: analyzeGames(games),
    games,
  };
}
