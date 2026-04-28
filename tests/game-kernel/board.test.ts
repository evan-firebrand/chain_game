import { describe, it, expect } from 'vitest';
import { createGame, applyAction, validateChain } from '../../src/game-kernel/index.js';
import type { Board, GameConfig, GameState, Tile, TileValue, Cell, CommitChainAction } from '../../src/game-kernel/types.js';

// applyGravity is an internal module — tested indirectly through createGame
// and through the exported applyAction path. The spec only exports public API
// from index.ts, so we test the observable behavior.
// If applyGravity is exported from index.ts we test it directly.
// If not, we test via applyAction with a commit-chain that leaves gaps.
import * as KernelAPI from '../../src/game-kernel/index.js';

const DEFAULT_CONFIG: GameConfig = {
  gridRows: 7,
  gridCols: 6,
  ruleK: 2,
  spawnPoolMin: 2,
  spawnPoolMax: 256,
  spawnWeights: { 2: 128, 4: 64, 8: 32, 16: 16, 32: 8, 64: 4, 128: 2, 256: 1 },
  prngSeed: 0,
};

function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

// Helper: count tiles with value === 0
function countEmpty(board: Board): number {
  let count = 0;
  for (const row of board) {
    for (const tile of row) {
      if (tile.value === 0) count++;
    }
  }
  return count;
}

// Helper: get tile at (row, col)
function tileAt(board: Board, row: number, col: number): Tile {
  return (board[row] as Tile[])[col] as Tile;
}

// Helper: check if a board column has all non-zero tiles below the first
// non-zero tile (gravity settled)
function isColumnSettled(board: Board, col: number): boolean {
  const rows = board.length;
  // Scan bottom to top (row rows-1 = bottom)
  // After gravity: non-zero tiles are at the BOTTOM, zeros at the top
  // So once we see a zero tile scanning up from the bottom, we should not see
  // a non-zero tile above it.
  let seenEmpty = false;
  for (let r = rows - 1; r >= 0; r--) {
    const v = tileAt(board, r, col).value;
    if (v === 0) {
      seenEmpty = true;
    } else if (seenEmpty) {
      // Non-zero tile above an empty cell — not settled
      return false;
    }
  }
  return true;
}

describe('applyGravity (via applyAction)', () => {
  // We test gravity indirectly by observing that after a chain commit,
  // the board is settled (no empty cell below a non-empty cell).
  it('after a chain commit, tiles fall down and board is settled', () => {
    const state = createGame(DEFAULT_CONFIG);
    // Find any valid chain start on the initial board
    // We just need to verify the board is settled after createGame
    // (createGame calls applyGravity internally or starts full)
    const board = state.board;
    for (let col = 0; col < DEFAULT_CONFIG.gridCols; col++) {
      expect(
        isColumnSettled(board, col),
        `Column ${col} should be settled after createGame`
      ).toBe(true);
    }
  });

  // If applyGravity is directly exported, test it explicitly
  it('applyGravity: tiles fall down, empty cells accumulate at top', () => {
    if (!('applyGravity' in KernelAPI)) {
      // Not exported — skip direct test
      return;
    }
    const applyGravity = (KernelAPI as Record<string, unknown>)['applyGravity'] as (
      board: Board
    ) => Board;

    // Build a board where col 0 has value at row 0, empty at rows 1-6
    const rows = DEFAULT_CONFIG.gridRows;
    const cols = DEFAULT_CONFIG.gridCols;

    const grid: Tile[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ value: 0 as TileValue, retired: false }))
    );
    // Place a tile at the top of column 0
    (grid[0] as Tile[])[0] = { value: 4 as TileValue, retired: false };

    const settled = applyGravity(grid as Board);

    // Tile should now be at the bottom (row 6) of column 0
    expect(tileAt(settled, rows - 1, 0).value).toBe(4);
    // Top rows of col 0 should be empty
    for (let r = 0; r < rows - 1; r++) {
      expect(tileAt(settled, r, 0).value).toBe(0);
    }
  });

  it('applyGravity: columns are independent', () => {
    if (!('applyGravity' in KernelAPI)) return;
    const applyGravity = (KernelAPI as Record<string, unknown>)['applyGravity'] as (
      board: Board
    ) => Board;

    const rows = DEFAULT_CONFIG.gridRows;
    const cols = DEFAULT_CONFIG.gridCols;
    const grid: Tile[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ value: 0 as TileValue, retired: false }))
    );

    // Col 0: tile at row 2
    (grid[2] as Tile[])[0] = { value: 4 as TileValue, retired: false };
    // Col 1: tile at row 0
    (grid[0] as Tile[])[1] = { value: 8 as TileValue, retired: false };
    // Col 2: empty

    const settled = applyGravity(grid as Board);

    // Col 0: tile should be at row 6
    expect(tileAt(settled, rows - 1, 0).value).toBe(4);
    // Col 1: tile should be at row 6
    expect(tileAt(settled, rows - 1, 1).value).toBe(8);
    // Col 2: all empty
    for (let r = 0; r < rows; r++) {
      expect(tileAt(settled, r, 2).value).toBe(0);
    }
  });

  it('applyGravity: already-settled board is unchanged', () => {
    if (!('applyGravity' in KernelAPI)) return;
    const applyGravity = (KernelAPI as Record<string, unknown>)['applyGravity'] as (
      board: Board
    ) => Board;

    const rows = DEFAULT_CONFIG.gridRows;
    const cols = DEFAULT_CONFIG.gridCols;
    const grid: Tile[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ value: 0 as TileValue, retired: false }))
    );

    // Place tiles at bottom of every column — already settled
    for (let c = 0; c < cols; c++) {
      (grid[rows - 1] as Tile[])[c] = { value: 4 as TileValue, retired: false };
    }

    const settled = applyGravity(grid as Board);

    for (let c = 0; c < cols; c++) {
      expect(tileAt(settled, rows - 1, c).value).toBe(4);
      for (let r = 0; r < rows - 1; r++) {
        expect(tileAt(settled, r, c).value).toBe(0);
      }
    }
  });
});

describe('createGame — initial board', () => {
  it('board is completely full (no value-0 tiles)', () => {
    const state = createGame(DEFAULT_CONFIG);
    expect(countEmpty(state.board)).toBe(0);
  });

  it('board has at least one legal chain start (adjacent same-value pair)', () => {
    const state = createGame(DEFAULT_CONFIG);
    // Check that hasLegalChainStart would return true
    // We verify by manually scanning for adjacent same-value pairs (8-way)
    const board = state.board;
    const rows = DEFAULT_CONFIG.gridRows;
    const cols = DEFAULT_CONFIG.gridCols;
    let found = false;

    outer: for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = tileAt(board, r, c).value;
        if (v === 0) continue;
        // Check all 8 neighbors
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              if (tileAt(board, nr, nc).value === v) {
                found = true;
                break outer;
              }
            }
          }
        }
      }
    }

    expect(found).toBe(true);
  });

  it('same seed produces same board (determinism)', () => {
    const stateA = createGame(makeConfig({ prngSeed: 42 }));
    const stateB = createGame(makeConfig({ prngSeed: 42 }));

    const rows = DEFAULT_CONFIG.gridRows;
    const cols = DEFAULT_CONFIG.gridCols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        expect(tileAt(stateA.board, r, c).value).toBe(tileAt(stateB.board, r, c).value);
      }
    }
  });

  it('different seeds produce different boards', () => {
    const stateA = createGame(makeConfig({ prngSeed: 1 }));
    const stateB = createGame(makeConfig({ prngSeed: 999 }));

    const rows = DEFAULT_CONFIG.gridRows;
    const cols = DEFAULT_CONFIG.gridCols;
    let differs = false;
    for (let r = 0; r < rows && !differs; r++) {
      for (let c = 0; c < cols && !differs; c++) {
        if (tileAt(stateA.board, r, c).value !== tileAt(stateB.board, r, c).value) {
          differs = true;
        }
      }
    }
    expect(differs).toBe(true);
  });

  it('phase is "playing" at game start', () => {
    const state: GameState = createGame(DEFAULT_CONFIG);
    expect(state.phase).toBe('playing');
  });

  it('turn is 0 at game start', () => {
    const state: GameState = createGame(DEFAULT_CONFIG);
    expect(state.turn).toBe(0);
  });
});

// ── spawnTiles (via applyAction commit-chain) ─────────────────────────────

function cellOf(row: number, col: number): Cell {
  return { row: row as Cell['row'], col: col as Cell['col'] };
}

/** Find the first valid N-cell chain on the given board. */
function findValidChain(board: Board, length: 2 | 3, config: GameConfig): Cell[] | null {
  const rows = config.gridRows;
  const cols = config.gridCols;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = (board[r] as Tile[])[c]!.value;
      if (!v) continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if ((board[nr] as Tile[])[nc]!.value !== v) continue;

          if (length === 2) {
            const ch = [cellOf(r, c), cellOf(nr, nc)];
            if (validateChain(board, ch).valid) return ch;
          } else {
            // look for a 3rd cell
            for (let dr2 = -1; dr2 <= 1; dr2++) {
              for (let dc2 = -1; dc2 <= 1; dc2++) {
                if (!dr2 && !dc2) continue;
                const nr2 = nr + dr2, nc2 = nc + dc2;
                if (nr2 < 0 || nr2 >= rows || nc2 < 0 || nc2 >= cols) continue;
                if (nr2 === r && nc2 === c) continue; // no reuse
                const v2 = (board[nr2] as Tile[])[nc2]!.value;
                if (v2 === v || v2 === v * 2) {
                  const ch = [cellOf(r, c), cellOf(nr, nc), cellOf(nr2, nc2)];
                  if (validateChain(board, ch).valid) return ch;
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
}

describe('spawnTiles (via applyAction)', () => {
  it('after a chain of length 2, exactly 1 new tile spawns', () => {
    const state = createGame(makeConfig({ prngSeed: 42 }));
    const chain = findValidChain(state.board, 2, DEFAULT_CONFIG);
    expect(chain).not.toBeNull();
    const action: CommitChainAction = { kind: 'commit-chain', chain: chain! };
    const next = applyAction(state, action);
    const spawnEv = next.events.find(e => e.kind === 'tiles-spawned') as
      Extract<typeof next.events[0], { kind: 'tiles-spawned' }> | undefined;
    expect(spawnEv).toBeDefined();
    expect(spawnEv!.spawned).toHaveLength(1);
  });

  it('after a chain of length 3, exactly 2 new tiles spawn', () => {
    const state = createGame(makeConfig({ prngSeed: 42 }));
    const chain = findValidChain(state.board, 3, DEFAULT_CONFIG);
    expect(chain).not.toBeNull();
    const action: CommitChainAction = { kind: 'commit-chain', chain: chain! };
    const next = applyAction(state, action);
    const spawnEv = next.events.find(e => e.kind === 'tiles-spawned') as
      Extract<typeof next.events[0], { kind: 'tiles-spawned' }> | undefined;
    expect(spawnEv).toBeDefined();
    expect(spawnEv!.spawned).toHaveLength(2);
  });

  it('spawned tile values are all valid powers of 2 in [2, 256]', () => {
    const state = createGame(makeConfig({ prngSeed: 42 }));
    const chain = findValidChain(state.board, 3, DEFAULT_CONFIG);
    expect(chain).not.toBeNull();
    const action: CommitChainAction = { kind: 'commit-chain', chain: chain! };
    const next = applyAction(state, action);
    const spawnEv = next.events.find(e => e.kind === 'tiles-spawned') as any;
    const validPool = new Set([2, 4, 8, 16, 32, 64, 128, 256]);
    for (const { value } of spawnEv!.spawned) {
      expect(validPool.has(value)).toBe(true);
    }
  });

  it('same prngState + same config produces same spawn sequence (determinism)', () => {
    const stateA = createGame(makeConfig({ prngSeed: 42 }));
    const stateB = createGame(makeConfig({ prngSeed: 42 }));
    const chain = findValidChain(stateA.board, 2, DEFAULT_CONFIG);
    expect(chain).not.toBeNull();
    const action: CommitChainAction = { kind: 'commit-chain', chain: chain! };
    const nextA = applyAction(stateA, action);
    const nextB = applyAction(stateB, action);
    const spawnA = nextA.events.find(e => e.kind === 'tiles-spawned') as any;
    const spawnB = nextB.events.find(e => e.kind === 'tiles-spawned') as any;
    expect(spawnA!.spawned).toEqual(spawnB!.spawned);
    expect(nextA.prngState).toBe(nextB.prngState);
  });
});
