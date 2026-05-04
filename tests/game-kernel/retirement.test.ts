import { describe, it, expect } from 'vitest';
import {
  advanceSpawnPool,
  checkRetirement,
  markRetiredTiles,
} from '../../src/game-kernel/retirement.js';
import { applyAction, setTile, spawnTiles, validateChain } from '../../src/game-kernel/index.js';
import type {
  Board,
  Cell,
  CommitChainAction,
  GameConfig,
  GameState,
  RetirementFiredEvent,
  Tile,
  TilesSpawnedEvent,
  TileValue,
} from '../../src/game-kernel/types.js';

const CONFIG: GameConfig = {
  gridRows: 3,
  gridCols: 3,
  ruleK: 2,
  spawnPoolMin: 2,
  spawnPoolMax: 256,
  spawnWeights: {
    2: 0,
    4: 1,
    8: 0,
    16: 0,
    32: 0,
    64: 0,
    128: 0,
    256: 0,
  },
  prngSeed: 1,
};

function cell(row: number, col: number): Cell {
  return { row: row as Cell['row'], col: col as Cell['col'] };
}

function emptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ value: 0 as TileValue, retired: false, critical: false }))
  ) as Board;
}

function makeState(board: Board, overrides: Partial<GameState> = {}): GameState {
  return {
    board,
    config: CONFIG,
    phase: 'playing',
    turn: 0,
    maxTileEver: 256 as TileValue,
    spawnPoolMin: 2 as TileValue,
    spawnPoolMax: 256 as TileValue,
    prngState: 123,
    events: [],
    ...overrides,
  };
}

function tileAt(board: Board, row: number, col: number): Tile {
  return board[row]![col]!;
}

function makeRetirementTriggerBoard(): Board {
  let board = emptyBoard(3, 3);
  board = setTile(board, cell(0, 0), { value: 256 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(0, 1), { value: 256 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(0, 2), { value: 2 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(1, 0), { value: 2 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(1, 1), { value: 4 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(1, 2), { value: 8 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(2, 0), { value: 16 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(2, 1), { value: 32 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(2, 2), { value: 64 as TileValue, retired: false, critical: false });
  return board;
}

function makeOvershootBoard(): Board {
  let board = emptyBoard(3, 3);
  board = setTile(board, cell(0, 0), { value: 1024 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(0, 1), { value: 1024 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(0, 2), { value: 2 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(1, 0), { value: 4 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(1, 1), { value: 8 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(1, 2), { value: 16 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(2, 0), { value: 32 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(2, 1), { value: 64 as TileValue, retired: false, critical: false });
  board = setTile(board, cell(2, 2), { value: 128 as TileValue, retired: false, critical: false });
  return board;
}

describe('checkRetirement', () => {
  it('does not fire below the next tier above the current spawn ceiling', () => {
    expect(checkRetirement(256 as TileValue, 256 as TileValue)).toBeNull();
  });

  it('fires when player first creates a tile at next tier above spawn ceiling', () => {
    expect(checkRetirement(512 as TileValue, 256 as TileValue)).toBe(2);
  });

  it('uses the shifted ceiling for later milestones', () => {
    expect(checkRetirement(1024 as TileValue, 512 as TileValue)).toBe(4);
  });

  it('does not fire when the configured pool is narrower than the retirement window', () => {
    expect(checkRetirement(4 as TileValue, 2 as TileValue)).toBeNull();
  });

  it('continues retirement beyond the original early tile value range', () => {
    expect(checkRetirement(16384 as TileValue, 8192 as TileValue)).toBe(64);
  });

  it('treats an invalid runtime ceiling as non-retiring', () => {
    expect(checkRetirement(4 as TileValue, 3 as TileValue)).toBeNull();
  });
});

describe('advanceSpawnPool', () => {
  it('spawn pool min advances by one tier after retirement', () => {
    const advanced = advanceSpawnPool(CONFIG, 2 as TileValue);
    expect(advanced.spawnPoolMin).toBe(4);
  });

  it('spawn pool max advances by one tier after retirement', () => {
    const advanced = advanceSpawnPool(CONFIG, 2 as TileValue);
    expect(advanced.spawnPoolMax).toBe(512);
  });

  it('adds a derived weight for the new top tier when missing', () => {
    const advanced = advanceSpawnPool(
      { ...CONFIG, spawnWeights: { ...CONFIG.spawnWeights, 256: 2 } },
      2 as TileValue
    );
    expect(advanced.spawnWeights[512]).toBe(1);
  });

  it('preserves an explicit configured weight for the new top tier', () => {
    const advanced = advanceSpawnPool(
      { ...CONFIG, spawnWeights: { ...CONFIG.spawnWeights, 512: 7 } },
      2 as TileValue
    );
    expect(advanced.spawnWeights[512]).toBe(7);
  });

  it('derives the new top weight from 1 when the old top weight is missing', () => {
    const advanced = advanceSpawnPool({ ...CONFIG, spawnWeights: {} }, 2 as TileValue);
    expect(advanced.spawnWeights[512]).toBe(0.5);
  });

  it('advances beyond the original early tile value range', () => {
    const maxedConfig: GameConfig = {
      ...CONFIG,
      spawnPoolMin: 1024 as TileValue,
      spawnPoolMax: 8192 as TileValue,
    };
    expect(advanceSpawnPool(maxedConfig, 8192 as TileValue)).toEqual({
      spawnPoolMin: 16384,
      spawnPoolMax: 16384,
      spawnWeights: { ...maxedConfig.spawnWeights, 16384: 0.5 },
    });
  });
});

describe('markRetiredTiles', () => {
  it('retired tiles remain on board with retired=true flag', () => {
    const board = makeRetirementTriggerBoard();
    const marked = markRetiredTiles(board, 2 as TileValue);
    expect(tileAt(marked, 0, 2)).toEqual({ value: 2, retired: true, critical: false });
    expect(tileAt(marked, 1, 0)).toEqual({ value: 2, retired: true, critical: false });
    expect(tileAt(marked, 1, 1)).toEqual({ value: 4, retired: false, critical: false });
  });

  it('adjacent retired tiles remain mechanically chainable', () => {
    let board = emptyBoard(2, 2);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: true, critical: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: true, critical: false });
    expect(validateChain(board, [cell(0, 0), cell(0, 1)]).valid).toBe(true);
  });
});

describe("applyAction('commit-chain') retirement integration", () => {
  it('fires retirement, advances runtime pool, marks old tier, then spawns from new pool', () => {
    const state = makeState(makeRetirementTriggerBoard());
    const action: CommitChainAction = {
      kind: 'commit-chain',
      chain: [cell(0, 0), cell(0, 1)],
    };

    const next = applyAction(state, action);
    const retirement = next.events.find(
      (e): e is RetirementFiredEvent => e.kind === 'retirement-fired'
    );
    const spawned = next.events.find(
      (e): e is TilesSpawnedEvent => e.kind === 'tiles-spawned'
    );

    expect(retirement).toEqual({
      kind: 'retirement-fired',
      retiredTier: 2,
      newSpawnPoolMin: 4,
      newSpawnPoolMax: 512,
    });
    expect(next.spawnPoolMin).toBe(4);
    expect(next.spawnPoolMax).toBe(512);
    expect(next.maxTileEver).toBe(512);
    expect(next.config.spawnPoolMin).toBe(2);
    expect(next.config.spawnPoolMax).toBe(256);
    expect(spawned?.spawned.every(s => s.value !== 2)).toBe(true);
    expect(spawned?.spawned[0]?.value).toBe(4);
    expect(next.events.map(e => e.kind)).toEqual([
      'chain-resolved',
      'retirement-fired',
      'tiles-spawned',
    ]);
  });

  it('cascades retirements until the spawn ceiling catches up to an overshoot result', () => {
    const state = makeState(makeOvershootBoard());
    const action: CommitChainAction = {
      kind: 'commit-chain',
      chain: [cell(0, 0), cell(0, 1)],
    };

    const next = applyAction(state, action);
    const retirements = next.events.filter(
      (e): e is RetirementFiredEvent => e.kind === 'retirement-fired'
    );

    expect(retirements).toEqual([
      { kind: 'retirement-fired', retiredTier: 2, newSpawnPoolMin: 4, newSpawnPoolMax: 512 },
      { kind: 'retirement-fired', retiredTier: 4, newSpawnPoolMin: 8, newSpawnPoolMax: 1024 },
      { kind: 'retirement-fired', retiredTier: 8, newSpawnPoolMin: 16, newSpawnPoolMax: 2048 },
    ]);
    expect(next.spawnPoolMin).toBe(16);
    expect(next.spawnPoolMax).toBe(2048);
    expect(next.maxTileEver).toBe(2048);
    expect(next.events.map(e => e.kind)).toEqual([
      'chain-resolved',
      'retirement-fired',
      'retirement-fired',
      'retirement-fired',
      'tiles-spawned',
      'game-over',
    ]);
  });
});

describe('retirement-aware spawning', () => {
  it('can spawn the new top tier on later turns even when config lacks its weight', () => {
    const config: GameConfig = {
      ...CONFIG,
      spawnPoolMin: 4 as TileValue,
      spawnPoolMax: 512 as TileValue,
      spawnWeights: {},
    };
    const { spawned } = spawnTiles(emptyBoard(1, 1), 2, config, 1);
    expect(spawned).toEqual([{ cell: cell(0, 0), value: 512 }]);
  });
});
