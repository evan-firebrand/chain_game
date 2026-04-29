// Tests that close coverage gaps introduced by Phase 1 (validateAndResolveChain
// fused walk) and Phase 2 (fast surface). These are not exhaustive
// behavioural tests — they exercise specific branches the kernel coverage
// script (scripts/check-kernel-coverage.js, 100% threshold per Phase 1 gate)
// would otherwise flag.

import { describe, it, expect } from 'vitest';
import {
  applyAction,
  createGame,
  DEFAULT_CONFIG,
} from '../../src/game-kernel/index.js';
import { validateAndResolveChain } from '../../src/game-kernel/chain.js';
import {
  packTile,
  unpackValue,
} from '../../src/game-kernel/fast/encoding.js';
import {
  fromPure,
  hasLegalChainStartFast,
  resolveChainInPlace,
} from '../../src/game-kernel/fast/index.js';
import type {
  Board,
  Cell,
  CommitChainAction,
  GameConfig,
  Row,
  Col,
  Tile,
  TileValue,
} from '../../src/game-kernel/types.js';

const ROWS = DEFAULT_CONFIG.gridRows;
const COLS = DEFAULT_CONFIG.gridCols;
const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42 };

function makeBoard(layout: { row: number; col: number; value: number }[]): Board {
  const grid: Tile[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ value: 0 as TileValue, retired: false })),
  );
  for (const { row, col, value } of layout) {
    grid[row]![col] = { value: value as TileValue, retired: false };
  }
  return grid as Board;
}

function cell(r: number, c: number): Cell {
  return { row: r as Row, col: c as Col };
}

// ─── validateAndResolveChain — every reject path ────────────────────────────

describe('validateAndResolveChain — reject paths', () => {
  const board = makeBoard([
    { row: 0, col: 0, value: 4 },
    { row: 0, col: 1, value: 4 },
    { row: 0, col: 2, value: 4 },
    { row: 0, col: 3, value: 8 },
    { row: 1, col: 0, value: 4 },
  ]);

  it('chain shorter than 2 → invalid', () => {
    const r = validateAndResolveChain(board, [cell(0, 0)], CONFIG);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/at least 2/);
  });

  it('cell out of bounds → invalid', () => {
    const r = validateAndResolveChain(
      board,
      [cell(0, 0), { row: ROWS as Row, col: 0 as Col }],
      CONFIG,
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/out of bounds/);
  });

  it('empty cell in chain → invalid', () => {
    const r = validateAndResolveChain(board, [cell(0, 0), cell(3, 3)], CONFIG);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/empty/);
  });

  it('cell reuse → invalid', () => {
    const r = validateAndResolveChain(
      board,
      [cell(0, 0), cell(0, 1), cell(0, 0)],
      CONFIG,
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/reuse/);
  });

  it('first pair not adjacent → invalid', () => {
    const r = validateAndResolveChain(
      board,
      [cell(0, 0), { row: 5 as Row, col: 5 as Col }],
      CONFIG,
    );
    expect(r.valid).toBe(false);
  });

  it('first pair different values → invalid', () => {
    const r = validateAndResolveChain(board, [cell(0, 0), cell(0, 3)], CONFIG);
    expect(r.valid).toBe(false);
  });

  it('extension cell not adjacent to previous → invalid', () => {
    // Need a board where third cell exists but isn't adjacent to second.
    const farBoard = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
      { row: 5, col: 5, value: 4 }, // not adjacent to (0,1)
    ]);
    const r = validateAndResolveChain(
      farBoard,
      [cell(0, 0), cell(0, 1), { row: 5 as Row, col: 5 as Col }],
      CONFIG,
    );
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/not adjacent/);
  });

  it('extension cell value not same nor double → invalid', () => {
    // Build a board where a 3-chain extension is neither same nor double.
    const b2 = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
      { row: 0, col: 2, value: 16 }, // 4 → 16 is quadruple, not same/double
    ]);
    const r = validateAndResolveChain(b2, [cell(0, 0), cell(0, 1), cell(0, 2)], CONFIG);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toMatch(/extension rule/);
  });
});

describe('validateAndResolveChain — accept paths', () => {
  it('same-value extension increments sameExtensions', () => {
    const b = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
      { row: 0, col: 2, value: 4 },
    ]);
    const r = validateAndResolveChain(b, [cell(0, 0), cell(0, 1), cell(0, 2)], CONFIG);
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.sameExtensions).toBe(1);
      expect(r.doublingExtensions).toBe(0);
    }
  });

  it('doubling extension increments doublingExtensions', () => {
    const b = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
      { row: 0, col: 2, value: 8 },
    ]);
    const r = validateAndResolveChain(b, [cell(0, 0), cell(0, 1), cell(0, 2)], CONFIG);
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.sameExtensions).toBe(0);
      expect(r.doublingExtensions).toBe(1);
    }
  });
});

// ─── applyAction reject paths (covers the integration side) ────────────────

describe('applyAction — invalid chains return state unchanged', () => {
  it('chain with cell reuse → no-op', () => {
    const s0 = createGame(CONFIG);
    const action: CommitChainAction = {
      kind: 'commit-chain',
      chain: [cell(0, 0), cell(0, 1), cell(0, 0)],
    };
    expect(applyAction(s0, action)).toBe(s0);
  });

  it('chain with empty cell → no-op', () => {
    // Build a state with an empty cell at (3,3)
    const s0 = createGame(CONFIG);
    const board = s0.board.map((row, r) =>
      row.map((t, c) =>
        r === 3 && c === 3 ? { value: 0 as TileValue, retired: false } : t,
      ),
    ) as Board;
    const stateWithHole = { ...s0, board };
    const action: CommitChainAction = {
      kind: 'commit-chain',
      chain: [cell(0, 0), cell(3, 3)],
    };
    expect(applyAction(stateWithHole, action)).toBe(stateWithHole);
  });
});

// ─── packTile out-of-range value (fast/encoding.ts:40-41) ──────────────────

describe('packTile — out-of-range', () => {
  it('throws on power-of-2 value beyond log2 15', () => {
    // 65536 = 2^16, log2 > 15 → out of encodable range.
    expect(() => packTile(65536 as TileValue, false)).toThrow(/encodable range/);
  });

  it('throws on value 1 (log2 = 0, below minimum 1)', () => {
    expect(() => packTile(1 as TileValue, false)).toThrow(/encodable range/);
  });
});

// ─── unpackValue defensive — exercised via every legal nibble ──────────────

describe('unpackValue — every legal nibble decodes without throwing', () => {
  it('nibbles 0..15 all decode', () => {
    for (let n = 0; n <= 15; n++) {
      expect(() => unpackValue(n)).not.toThrow();
    }
  });
});

// ─── pickTileValue / spawn config edge cases ───────────────────────────────

describe('createGame with degenerate spawnWeights covers _internal defensive path', () => {
  it('config with single-tile spawn pool produces a board', () => {
    // Single-tile spawn pool: minimum weight diversity. Exercises the
    // weight-table iteration with only one entry.
    const cfg: GameConfig = {
      ...CONFIG,
      spawnPoolMin: 2,
      spawnPoolMax: 2,
      spawnWeights: { 2: 1 },
      prngSeed: 1,
    };
    const s = createGame(cfg);
    // Every cell should be 2.
    for (let r = 0; r < cfg.gridRows; r++) {
      for (let c = 0; c < cfg.gridCols; c++) {
        expect(s.board[r]![c]!.value).toBe(2);
      }
    }
  });
});

// ─── resolveChainInPlace empty-chain defensive (fast/chain.ts:41-42) ───────

describe('resolveChainInPlace — empty chain defensive return', () => {
  it('returns zero-result when first cell is undefined-shaped', () => {
    const fast = fromPure(createGame(CONFIG));
    // Use an empty array — chain[0] === undefined triggers the defensive path.
    const r = resolveChainInPlace(fast, [], fast.config);
    expect(r.resultValue).toBe(0);
    expect(r.sameExtensions).toBe(0);
    expect(r.doublingExtensions).toBe(0);
  });
});

// ─── hasLegalChainStartFast empty-cell branch (fast/board.ts:104) ──────────

describe('hasLegalChainStartFast — empty cells in board', () => {
  it('skips empty cells while scanning for legal pairs', () => {
    // Build a FastState with several empty cells; the inner-loop
    // `valueBits === 0 → continue` branch should be hit.
    const fast = fromPure(createGame(CONFIG));
    // Wipe the entire first row so its cells are empty.
    for (let c = 0; c < fast.cols; c++) {
      fast.board[c] = 0;
    }
    // The remaining rows still have legal chain starts (createGame
    // guarantees that), so the function must still return true.
    expect(hasLegalChainStartFast(fast)).toBe(true);
  });
});
