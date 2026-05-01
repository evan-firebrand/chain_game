// Depth-cap regression tests for archetype strategies.
//
// Before the fix, DEFAULT_MAX_CHAIN_LENGTH=5 silently excluded all chains > 5
// tiles. These tests verify that:
//   1. engaged/skilled/speedrunner find chains longer than 5 on boards where
//      they exist.
//   2. casual (depth 5) naturally caps out at or below 5 tiles.
//   3. All archetype decisions are legal chains.

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, createGame, setTile, validateChain } from '../../src/game-kernel/index.js';
import type { Board, Cell, GameState, TileValue } from '../../src/game-kernel/index.js';
import {
  casualStrategy,
  engagedStrategy,
  skilledStrategy,
  speedrunnerStrategy,
} from '../../src/sim-harness/index.js';

function cell(row: number, col: number): Cell {
  return { row: row as Cell['row'], col: col as Cell['col'] };
}

// 7×6 board with the first two rows filled with 2s — guarantees a 12-tile
// all-same path that any depth-12+ search will find.
function twelveTileUniformState(): GameState {
  let board: Board = Array.from({ length: 7 }, () =>
    Array.from({ length: 6 }, () => ({ value: 0 as TileValue, retired: false }))
  ) as Board;

  for (let c = 0; c < 6; c++) {
    board = setTile(board, cell(0, c), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(1, c), { value: 2 as TileValue, retired: false });
  }

  return {
    ...createGame({ ...DEFAULT_CONFIG, prngSeed: 1 }),
    board,
    maxTileEver: 2 as TileValue,
  };
}

describe('archetype depth caps', () => {
  it('engaged finds a chain longer than 5 when one exists', () => {
    const state = twelveTileUniformState();
    const { action } = engagedStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    if (action !== null) {
      expect(validateChain(state.board, action.chain).valid).toBe(true);
      expect(action.chain.length).toBeGreaterThan(5);
    }
  });

  it('skilled finds a chain longer than 5 when one exists', () => {
    const state = twelveTileUniformState();
    const { action } = skilledStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    if (action !== null) {
      expect(validateChain(state.board, action.chain).valid).toBe(true);
      expect(action.chain.length).toBeGreaterThan(5);
    }
  });

  it('speedrunner finds a chain longer than 5 when one exists', () => {
    const state = twelveTileUniformState();
    const { action } = speedrunnerStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    if (action !== null) {
      expect(validateChain(state.board, action.chain).valid).toBe(true);
      expect(action.chain.length).toBeGreaterThan(5);
    }
  });

  it('casual caps at 5 tiles on the uniform board', () => {
    const state = twelveTileUniformState();
    const { action } = casualStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    if (action !== null) {
      expect(validateChain(state.board, action.chain).valid).toBe(true);
      expect(action.chain.length).toBeLessThanOrEqual(5);
    }
  });

  it('skilled chain is at least as long as engaged on the uniform board', () => {
    const state = twelveTileUniformState();
    const engagedAction = engagedStrategy.chooseAction(state).action;
    const skilledAction = skilledStrategy.chooseAction(state).action;
    expect(engagedAction).not.toBeNull();
    expect(skilledAction).not.toBeNull();
    if (engagedAction !== null && skilledAction !== null) {
      expect(skilledAction.chain.length).toBeGreaterThanOrEqual(engagedAction.chain.length);
    }
  });

  it('all archetypes return valid chains or null on a random board', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 99 });
    for (const strategy of [casualStrategy, engagedStrategy, skilledStrategy, speedrunnerStrategy]) {
      const { action } = strategy.chooseAction(state);
      if (action !== null) {
        expect(validateChain(state.board, action.chain).valid).toBe(true);
        expect(action.chain.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
