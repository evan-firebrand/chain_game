import { describe, it, expect } from 'vitest';
import {
  applyGravity,
  createGame,
  DEFAULT_CONFIG,
} from '../../../src/game-kernel/index.js';
import {
  applyGravityInPlace,
  removeTilesInPlace,
  setTileInPlace,
} from '../../../src/game-kernel/fast/board.js';
import {
  PACKED_EMPTY,
  packTile,
  unpackTile,
  unpackValue,
} from '../../../src/game-kernel/fast/encoding.js';
import {
  fromPure,
  readCell,
  toPure,
} from '../../../src/game-kernel/fast/state.js';
import type {
  Board,
  Cell,
  GameConfig,
  Row,
  Col,
  Tile,
  TileValue,
} from '../../../src/game-kernel/types.js';

const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42 };

function cell(r: number, c: number): Cell {
  return { row: r as Row, col: c as Col };
}

function emptyTile(): Tile {
  return { value: 0 as TileValue, retired: false };
}

describe('setTileInPlace', () => {
  it('writes a packed byte at (row, col)', () => {
    const fast = fromPure(createGame(CONFIG));
    setTileInPlace(fast, 2, 3, packTile(64 as TileValue, false));
    expect(unpackValue(readCell(fast, 2, 3))).toBe(64);
  });
});

describe('removeTilesInPlace', () => {
  it('clears every cell in the chain', () => {
    const fast = fromPure(createGame(CONFIG));
    removeTilesInPlace(fast, [cell(0, 0), cell(0, 1)]);
    expect(readCell(fast, 0, 0)).toBe(PACKED_EMPTY);
    expect(readCell(fast, 0, 1)).toBe(PACKED_EMPTY);
  });

  it('leaves cells outside the chain unchanged', () => {
    const pure = createGame(CONFIG);
    const fast = fromPure(pure);
    removeTilesInPlace(fast, [cell(3, 3)]);
    // every cell other than (3,3) should still match the pure value
    for (let r = 0; r < CONFIG.gridRows; r++) {
      for (let c = 0; c < CONFIG.gridCols; c++) {
        if (r === 3 && c === 3) continue;
        expect(unpackValue(readCell(fast, r, c))).toBe(pure.board[r]![c]!.value);
      }
    }
  });
});

describe('applyGravityInPlace', () => {
  // Build a 7x6 board with one column of mixed empty/non-empty cells; verify
  // the in-place result matches the pure applyGravity result byte-for-byte.

  const ROWS = DEFAULT_CONFIG.gridRows;
  const COLS = DEFAULT_CONFIG.gridCols;

  function emptyBoard(): Tile[][] {
    return Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => emptyTile()),
    );
  }

  function pureToFastBoardEqual(pureBoard: Board, fast: { board: Uint8Array; cols: number }): boolean {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const expected = pureBoard[r]![c]!;
        const got = unpackTile(fast.board[r * fast.cols + c] ?? PACKED_EMPTY);
        if (got.value !== expected.value || got.retired !== expected.retired) return false;
      }
    }
    return true;
  }

  it('column with one tile at top falls to the bottom', () => {
    const grid = emptyBoard();
    grid[0]![0] = { value: 4 as TileValue, retired: false };

    const pureResult = applyGravity(grid as Board);
    const fast = fromPure({
      ...createGame(CONFIG),
      board: grid as Board,
    });
    applyGravityInPlace(fast);

    expect(pureToFastBoardEqual(pureResult, fast)).toBe(true);
    expect(unpackValue(readCell(fast, ROWS - 1, 0))).toBe(4);
  });

  it('column with holes settles correctly', () => {
    // Col 0: [4, 0, 2, 0, 8, 0, 0] → after gravity [0, 0, 0, 0, 4, 2, 8]
    const grid = emptyBoard();
    grid[0]![0] = { value: 4 as TileValue, retired: false };
    grid[2]![0] = { value: 2 as TileValue, retired: false };
    grid[4]![0] = { value: 8 as TileValue, retired: false };

    const pureResult = applyGravity(grid as Board);
    const fast = fromPure({ ...createGame(CONFIG), board: grid as Board });
    applyGravityInPlace(fast);

    expect(pureToFastBoardEqual(pureResult, fast)).toBe(true);
  });

  it('already-settled column unchanged', () => {
    // Col 1: bottom slot has a tile, others empty.
    const grid = emptyBoard();
    grid[ROWS - 1]![1] = { value: 16 as TileValue, retired: false };

    const pureResult = applyGravity(grid as Board);
    const fast = fromPure({ ...createGame(CONFIG), board: grid as Board });
    applyGravityInPlace(fast);

    expect(pureToFastBoardEqual(pureResult, fast)).toBe(true);
  });

  it('matches pure applyGravity on the createGame board byte-for-byte', () => {
    const pure = createGame(CONFIG);
    const pureResult = applyGravity(pure.board);
    const fast = fromPure(pure);
    applyGravityInPlace(fast);
    expect(pureToFastBoardEqual(pureResult, fast)).toBe(true);
  });

  it('matches pure applyGravity after randomly clearing cells (10 seeds)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const pure = createGame({ ...CONFIG, prngSeed: seed });
      const grid: Tile[][] = pure.board.map((row) => row.map((t) => ({ ...t })));
      // Clear ~6 random cells
      for (let i = 0; i < 6; i++) {
        const r = (seed * 7 + i * 3) % ROWS;
        const c = (seed * 5 + i * 2) % COLS;
        grid[r]![c] = emptyTile();
      }
      const pureResult = applyGravity(grid as Board);
      const fast = fromPure({ ...pure, board: grid as Board });
      applyGravityInPlace(fast);
      expect(pureToFastBoardEqual(pureResult, fast), `seed ${seed}`).toBe(true);
    }
  });
});

describe('round-trip via toPure', () => {
  it('after a remove + gravity sequence the toPure board matches a pure equivalent', () => {
    // Pure path: createGame → removeTiles → applyGravity (using existing imports)
    const pure = createGame(CONFIG);

    const chain: Cell[] = [cell(0, 0), cell(0, 1)];

    // Compute the pure expected result manually using the existing pure
    // primitives (imported via game-kernel index).
    const pureBoardAfter = ((): Board => {
      const grid: Tile[][] = pure.board.map((row) =>
        row.map((t) => ({ ...t })),
      );
      for (const c of chain) grid[c.row]![c.col] = emptyTile();
      return applyGravity(grid as Board);
    })();

    // Fast path: same operations, in-place
    const fast = fromPure(pure);
    removeTilesInPlace(fast, chain);
    applyGravityInPlace(fast);
    const round = toPure(fast);

    for (let r = 0; r < CONFIG.gridRows; r++) {
      for (let c = 0; c < CONFIG.gridCols; c++) {
        expect(round.board[r]![c]!.value).toBe(pureBoardAfter[r]![c]!.value);
      }
    }
  });
});
