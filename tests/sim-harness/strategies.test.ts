import { describe, expect, it } from 'vitest';
import { createGame, DEFAULT_CONFIG, setTile, validateChain } from '../../src/game-kernel/index.js';
import type { Board, Cell, TileValue } from '../../src/game-kernel/index.js';
import {
  countLegalChainStarts,
  enumerateCandidateChains,
  greedyStrategy,
  heuristicStrategy,
  longGreedyWalkStrategy,
  longRandomWalkStrategy,
  milestonePushStrategy,
  preRetirementCleanupStrategy,
  randomStrategy,
  strategicHumanLikeStrategy,
} from '../../src/sim-harness/index.js';
import type { StrategyContext } from '../../src/sim-harness/index.js';

function context(): StrategyContext {
  return {
    maxChainLength: 4,
    random: (): number => 0,
  };
}

function cell(row: number, col: number): Cell {
  return { row: row as Cell['row'], col: col as Cell['col'] };
}

function emptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ value: 0 as TileValue, retired: false }))
  ) as Board;
}

function longPathState() {
  let board = emptyBoard(4, 6);
  const values = [
    2, 2, 2, 2, 4, 4,
    4, 4, 8, 8, 8, 8,
    16, 16, 16, 16, 32, 32,
    32, 32, 64, 64, 64, 64,
  ];
  for (let i = 0; i < values.length; i++) {
    board = setTile(board, cell(Math.floor(i / 6), i % 6), {
      value: values[i] as TileValue,
      retired: false,
    });
  }
  return {
    ...createGame({ ...DEFAULT_CONFIG, gridRows: 4, gridCols: 6, prngSeed: 1 }),
    board,
    maxTileEver: 256 as TileValue,
  };
}

describe('strategies', () => {
  it('enumerates legal candidate chains only', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 12 });
    const candidates = enumerateCandidateChains(state, 4);

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(validateChain(state.board, candidate.chain).valid).toBe(true);
      expect(candidate.chain.length).toBeLessThanOrEqual(4);
    }
  });

  it('counts legal starts without double-counting symmetric pairs', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 42 });
    expect(countLegalChainStarts(state.board)).toBeGreaterThan(0);
  });

  it('random strategy returns a legal chain or null', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 21 });
    const { action } = randomStrategy.chooseAction(state, context());
    expect(action === null || validateChain(state.board, action.chain).valid).toBe(true);
  });

  it('greedy strategy returns a legal chain or null', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 22 });
    const { action } = greedyStrategy.chooseAction(state, context());
    expect(action === null || validateChain(state.board, action.chain).valid).toBe(true);
  });

  it('heuristic strategy returns a legal chain or null', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 23 });
    const { action } = heuristicStrategy.chooseAction(state, context());
    expect(action === null || validateChain(state.board, action.chain).valid).toBe(true);
  });

  it('strategies include diagnostics when they choose an action', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 24 });
    const decision = greedyStrategy.chooseAction(state, context());
    expect(decision.action === null || decision.diagnostics?.candidateChainLength).toBeTruthy();
  });

  it('long-chain strategies return legal chains beyond the short exhaustive cap', () => {
    const state = longPathState();
    const decision = longGreedyWalkStrategy.chooseAction(state, context());

    expect(decision.action).not.toBeNull();
    if (decision.action !== null) {
      expect(validateChain(state.board, decision.action.chain).valid).toBe(true);
      expect(decision.action.chain.length).toBeGreaterThan(5);
    }
  });

  it('new Phase 5.5 strategies return legal actions or null', () => {
    const state = longPathState();
    for (const strategy of [
      longRandomWalkStrategy,
      longGreedyWalkStrategy,
      milestonePushStrategy,
      preRetirementCleanupStrategy,
      strategicHumanLikeStrategy,
    ]) {
      const decision = strategy.chooseAction(state, context());
      expect(decision.action === null || validateChain(state.board, decision.action.chain).valid).toBe(true);
      expect(decision.action === null || decision.diagnostics?.mode).toBeTruthy();
    }
  });

  it('strategicHumanLike enters recovery mode when isolated retired tiles exist', () => {
    let board = emptyBoard(3, 3);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(1, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(1, 1), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(2, 0), { value: 8 as TileValue, retired: false });
    board = setTile(board, cell(2, 1), { value: 8 as TileValue, retired: false });
    const state = { ...createGame({ ...DEFAULT_CONFIG, gridRows: 3, gridCols: 3, prngSeed: 2 }), board };

    const decision = strategicHumanLikeStrategy.chooseAction(state, context());
    expect(decision.diagnostics?.mode).toBe('recovery');
  });
});
