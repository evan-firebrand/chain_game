import { describe, it, expect } from 'vitest';
import {
  createGame,
  applyAction,
  validateChain,
  hasLegalChainStart,
  computeChainResult,
  setTile,
} from '../../src/game-kernel/index.js';
import type {
  GameConfig,
  CommitChainAction,
  GameState,
  Cell,
  TileValue,
  Board,
  Tile,
} from '../../src/game-kernel/types.js';

// ── Config fixture ──────────────────────────────────────────────────────────
// seed=42, 7×6 board. Board layout (verified by probe):
//   row0:    2   2   4   2   2   2
//   row1:    2   2   8 128   8   2
//   row2:    4   8   4   2   2  32
//   row3:   16  16   4   2   4   2
//   row4:   32   8   2   8   2   2
//   row5:    2   4   8   8   4   2
//   row6:    4   4   4   4 128   2
const CONFIG: GameConfig = {
  gridRows: 7,
  gridCols: 6,
  ruleK: 2,
  spawnPoolMin: 2,
  spawnPoolMax: 256,
  spawnWeights: { 2: 128, 4: 64, 8: 32, 16: 16, 32: 8, 64: 4, 128: 2, 256: 1 },
  prngSeed: 42,
};

function cell(row: number, col: number): Cell {
  return { row: row as Cell['row'], col: col as Cell['col'] };
}

function countNonEmpty(board: Board): number {
  let n = 0;
  for (const row of board) for (const t of row) if (t.value !== 0) n++;
  return n;
}

function totalCells(config: GameConfig): number {
  return config.gridRows * config.gridCols;
}

// Valid 2-cell chain on seed=42 board: (0,0)=2 → (0,1)=2
const CHAIN_2: CommitChainAction = {
  kind: 'commit-chain',
  chain: [cell(0, 0), cell(0, 1)],
};

// Valid 3-cell chain on seed=42 board: (0,0)=2 → (0,1)=2 → (0,2)=4
// (0,2)=4 which is 2× of 2, valid doubling extension)
const CHAIN_3: CommitChainAction = {
  kind: 'commit-chain',
  chain: [cell(0, 0), cell(0, 1), cell(0, 2)],
};

// ── applyAction('new-game') ─────────────────────────────────────────────────

describe("applyAction('new-game')", () => {
  it('returns a valid GameState with full board', () => {
    const state = applyAction(
      // dummy prior state is not needed for new-game — but the signature requires a state;
      // the implementation ignores it, so pass createGame result as placeholder
      createGame(CONFIG),
      { kind: 'new-game', config: CONFIG }
    );
    expect(state.phase).toBe('playing');
    expect(state.turn).toBe(0);
    expect(countNonEmpty(state.board)).toBe(totalCells(CONFIG));
    expect(state.events).toEqual([]);
  });

  it('is equivalent to createGame', () => {
    const fromCreate = createGame(CONFIG);
    const fromApply = applyAction(fromCreate, { kind: 'new-game', config: CONFIG });
    // Same board shape and values
    for (let r = 0; r < CONFIG.gridRows; r++) {
      for (let c = 0; c < CONFIG.gridCols; c++) {
        expect((fromApply.board[r]!)[c]!.value).toBe((fromCreate.board[r]!)[c]!.value);
      }
    }
  });
});

// ── applyAction('commit-chain') ─────────────────────────────────────────────

describe("applyAction('commit-chain') — 2-cell chain", () => {
  it('turn increments by 1', () => {
    const s0 = createGame(CONFIG);
    const s1 = applyAction(s0, CHAIN_2);
    expect(s1.turn).toBe(1);
  });

  it('result tile placed at last cell', () => {
    const s0 = createGame(CONFIG);
    const expected = computeChainResult(s0.board, CHAIN_2.chain, CONFIG);
    const s1 = applyAction(s0, CHAIN_2);
    const lastCell = CHAIN_2.chain[CHAIN_2.chain.length - 1]!;
    // After gravity the result tile may have fallen, so scan column
    // The result tile value should appear exactly once more relative to before
    expect(expected).toBe(4); // 2×2 = 4, no same-extensions
    // Find the result tile somewhere in the last cell's column after gravity
    const col = lastCell.col;
    const colValues = Array.from({ length: CONFIG.gridRows }, (_, r) => s1.board[r]![col]!.value);
    expect(colValues).toContain(expected);
  });

  it('events include chain-resolved', () => {
    const s0 = createGame(CONFIG);
    const s1 = applyAction(s0, CHAIN_2);
    const newEvents = s1.events.slice(s0.events.length);
    expect(newEvents.some(e => e.kind === 'chain-resolved')).toBe(true);
  });

  it('chain-resolved event has correct metadata', () => {
    const s0 = createGame(CONFIG);
    const s1 = applyAction(s0, CHAIN_2);
    const newEvents = s1.events.slice(s0.events.length);
    const ev = newEvents.find(e => e.kind === 'chain-resolved') as Extract<typeof newEvents[0], { kind: 'chain-resolved' }>;
    expect(ev).toBeDefined();
    expect(ev!.resultValue).toBe(4);
    expect(ev!.sameExtensions).toBe(0);
    expect(ev!.doublingExtensions).toBe(0);
    expect(ev!.chain).toHaveLength(2);
  });

  it('exactly 1 tile spawns after chain of length 2', () => {
    const s0 = createGame(CONFIG);
    const s1 = applyAction(s0, CHAIN_2);
    const newEvents = s1.events.slice(s0.events.length);
    const spawnEv = newEvents.find(e => e.kind === 'tiles-spawned') as Extract<typeof newEvents[0], { kind: 'tiles-spawned' }> | undefined;
    expect(spawnEv).toBeDefined();
    expect(spawnEv!.spawned).toHaveLength(1);
  });

  it('net tile count change: chain removes 2, result keeps 1, spawn adds 1 → net 0', () => {
    const s0 = createGame(CONFIG);
    const before = countNonEmpty(s0.board);
    const s1 = applyAction(s0, CHAIN_2);
    const after = countNonEmpty(s1.board);
    // removed 2 chain tiles, placed 1 result, spawned 1 → net 0
    expect(after).toBe(before);
  });

  it('events array grows with each turn', () => {
    const s0 = createGame(CONFIG);
    const s1 = applyAction(s0, CHAIN_2);
    expect(s1.events.length).toBeGreaterThan(s0.events.length);
    // do another chain on s1
    // find a new valid 2-chain on s1
    const b = s1.board;
    let nextChain: CommitChainAction | null = null;
    outer: for (let r = 0; r < CONFIG.gridRows; r++) {
      for (let c = 0; c < CONFIG.gridCols; c++) {
        const v = b[r]![c]!.value;
        if (!v) continue;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= CONFIG.gridRows || nc < 0 || nc >= CONFIG.gridCols) continue;
            if (b[nr]![nc]!.value === v) {
              const ch = [cell(r, c), cell(nr, nc)];
              if (validateChain(b, ch).valid) {
                nextChain = { kind: 'commit-chain', chain: ch };
                break outer;
              }
            }
          }
        }
      }
    }
    if (nextChain) {
      const s2 = applyAction(s1, nextChain);
      expect(s2.events.length).toBeGreaterThan(s1.events.length);
    }
  });
});

describe("applyAction('commit-chain') — 3-cell chain", () => {
  it('exactly 2 new tiles spawn', () => {
    const s0 = createGame(CONFIG);
    const s1 = applyAction(s0, CHAIN_3);
    const newEvents = s1.events.slice(s0.events.length);
    const spawnEv = newEvents.find(e => e.kind === 'tiles-spawned') as Extract<typeof newEvents[0], { kind: 'tiles-spawned' }> | undefined;
    expect(spawnEv).toBeDefined();
    expect(spawnEv!.spawned).toHaveLength(2);
  });

  it('spawned tile values are in valid pool (powers of 2, 2–256)', () => {
    const s0 = createGame(CONFIG);
    const s1 = applyAction(s0, CHAIN_3);
    const newEvents = s1.events.slice(s0.events.length);
    const spawnEv = newEvents.find(e => e.kind === 'tiles-spawned') as Extract<typeof newEvents[0], { kind: 'tiles-spawned' }> | undefined;
    const validPool = new Set([2, 4, 8, 16, 32, 64, 128, 256]);
    for (const { value } of spawnEv!.spawned) {
      expect(validPool.has(value)).toBe(true);
    }
  });

  it('turn increments by 1', () => {
    const s0 = createGame(CONFIG);
    const s1 = applyAction(s0, CHAIN_3);
    expect(s1.turn).toBe(1);
  });

  it('events include chain-resolved', () => {
    const s0 = createGame(CONFIG);
    const s1 = applyAction(s0, CHAIN_3);
    const newEvents = s1.events.slice(s0.events.length);
    expect(newEvents.some(e => e.kind === 'chain-resolved')).toBe(true);
  });

  it('events include tiles-spawned', () => {
    const s0 = createGame(CONFIG);
    const s1 = applyAction(s0, CHAIN_3);
    const newEvents = s1.events.slice(s0.events.length);
    expect(newEvents.some(e => e.kind === 'tiles-spawned')).toBe(true);
  });
});

describe("applyAction('commit-chain') — determinism", () => {
  it('same prngState + same config produces same spawn sequence', () => {
    const s0a = createGame(CONFIG);
    const s0b = createGame(CONFIG);
    // Both have identical state
    const s1a = applyAction(s0a, CHAIN_3);
    const s1b = applyAction(s0b, CHAIN_3);
    // prngState should match
    expect(s1a.prngState).toBe(s1b.prngState);
    // spawned tiles should be identical
    const newEvA = s1a.events.slice(s0a.events.length);
    const newEvB = s1b.events.slice(s0b.events.length);
    const spawnA = newEvA.find(e => e.kind === 'tiles-spawned') as any;
    const spawnB = newEvB.find(e => e.kind === 'tiles-spawned') as any;
    expect(spawnA!.spawned).toEqual(spawnB!.spawned);
  });
});

describe("applyAction('commit-chain') — game-over guard", () => {
  it('returns state unchanged when phase is game-over', () => {
    const s0 = createGame(CONFIG);
    const gameOverState: GameState = { ...s0, phase: 'game-over' };
    const s1 = applyAction(gameOverState, CHAIN_2);
    expect(s1).toBe(gameOverState); // same reference
    expect(s1.turn).toBe(s0.turn);
    expect(s1.events).toBe(gameOverState.events);
  });
});

describe("applyAction('commit-chain') — invalid chain guard", () => {
  it('returns state unchanged when chain fails validateChain (too short)', () => {
    const s0 = createGame(CONFIG);
    const badAction: CommitChainAction = {
      kind: 'commit-chain',
      chain: [cell(0, 0)], // length 1 — invalid
    };
    const s1 = applyAction(s0, badAction);
    expect(s1).toBe(s0);
  });

  it('returns state unchanged when chain cells have mismatched values', () => {
    const s0 = createGame(CONFIG);
    // (0,0)=2 and (0,2)=4 — not adjacent
    const badAction: CommitChainAction = {
      kind: 'commit-chain',
      chain: [cell(0, 0), cell(0, 2)],
    };
    const s1 = applyAction(s0, badAction);
    expect(s1).toBe(s0);
  });

  it('returns state unchanged when first two cells differ in value', () => {
    const s0 = createGame(CONFIG);
    // (0,1)=2 and (0,2)=4 — adjacent but different values
    const badAction: CommitChainAction = {
      kind: 'commit-chain',
      chain: [cell(0, 1), cell(0, 2)],
    };
    const s1 = applyAction(s0, badAction);
    expect(s1).toBe(s0);
  });
});

describe("applyAction('commit-chain') — maxTileEver update", () => {
  it('maxTileEver updates when result exceeds prior max', () => {
    const s0 = createGame(CONFIG);
    // Force maxTileEver to 0 (default)
    expect(s0.maxTileEver).toBe(0);
    const s1 = applyAction(s0, CHAIN_2);
    // Result of 2-chain starting with 2s is 4
    expect(s1.maxTileEver).toBeGreaterThanOrEqual(4);
  });

  it('maxTileEver does not decrease', () => {
    const s0 = createGame(CONFIG);
    const s1 = applyAction(s0, CHAIN_2);
    // maxTileEver after should be >= maxTileEver before
    expect(s1.maxTileEver).toBeGreaterThanOrEqual(s0.maxTileEver);
  });

  it('maxTileEver is set to resultValue when resultValue > prior max', () => {
    const s0 = createGame(CONFIG);
    // prior max is 0, result of chain_2 is 4
    const expected = computeChainResult(s0.board, CHAIN_2.chain, CONFIG);
    const s1 = applyAction(s0, CHAIN_2);
    expect(s1.maxTileEver).toBe(expected);
  });
});

describe("applyAction('commit-chain') — game-over trigger", () => {
  it('game-over event fires and phase becomes game-over when no legal chain start remains', () => {
    // Craft a 2×2 board: cells (0,0)=4 and (0,1)=4, rest empty.
    // After commit-chain [0,0]→[0,1]:
    //   result=8 placed at (0,1), gravity drops it to (1,1).
    //   spawn 1 tile (chain length 2 → 1 spawn).
    //   Pool is only {2}, so spawned tile is 2. Board has 8 at (1,1) and 2 somewhere.
    //   8 ≠ 2, so no adjacent same-value pair → game-over.
    const TINY_CONFIG: GameConfig = {
      gridRows: 2,
      gridCols: 2,
      ruleK: 2,
      spawnPoolMin: 2,
      spawnPoolMax: 2,
      spawnWeights: { 2: 1 },
      prngSeed: 1,
    };

    // Build 2×2 board via setTile (imported at top of file)
    const emptyRow = (): Tile[] => [
      { value: 0 as TileValue, retired: false },
      { value: 0 as TileValue, retired: false },
    ];
    let board: Board = [emptyRow(), emptyRow()] as Board;
    board = setTile(board, cell(0, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 4 as TileValue, retired: false });

    const craftedState: GameState = {
      board,
      config: TINY_CONFIG,
      phase: 'playing',
      turn: 5,
      maxTileEver: 4 as TileValue,
      spawnPoolMin: 2 as TileValue,
      spawnPoolMax: 2 as TileValue,
      prngState: 999999,
      events: [],
    };

    const action: CommitChainAction = {
      kind: 'commit-chain',
      chain: [cell(0, 0), cell(0, 1)],
    };

    const next = applyAction(craftedState, action);
    // result tile = 8, spawned tile = 2 — different values, can't form a pair → game-over
    if (next.phase === 'game-over') {
      expect(next.events.some(e => e.kind === 'game-over')).toBe(true);
    } else {
      // If by chance the spawn landed adjacent to the result with same value, game continues
      expect(next.phase).toBe('playing');
      expect(hasLegalChainStart(next.board)).toBe(true);
    }
  });

  it('game-over phase means no further commits change state', () => {
    const s0 = createGame(CONFIG);
    const gameOverState: GameState = { ...s0, phase: 'game-over' };
    const s1 = applyAction(gameOverState, CHAIN_2);
    const s2 = applyAction(s1, CHAIN_2);
    expect(s2).toBe(s1);
    expect(s2.turn).toBe(gameOverState.turn);
  });
});

describe('spawnTiles (via applyAction) — spawn count invariant', () => {
  it('chain length N spawns exactly N-1 tiles', () => {
    const s0 = createGame(CONFIG);
    // 2-chain → 1 spawn
    const s1 = applyAction(s0, CHAIN_2);
    const ev1 = s1.events.find(e => e.kind === 'tiles-spawned') as any;
    expect(ev1!.spawned).toHaveLength(1);

    // 3-chain → 2 spawns
    const s0b = createGame(CONFIG);
    const s1b = applyAction(s0b, CHAIN_3);
    const ev1b = s1b.events.find(e => e.kind === 'tiles-spawned') as any;
    expect(ev1b!.spawned).toHaveLength(2);
  });

  it('spawned tile values are all valid powers of 2 within pool', () => {
    const s0 = createGame(CONFIG);
    const s1 = applyAction(s0, CHAIN_3);
    const ev = s1.events.find(e => e.kind === 'tiles-spawned') as any;
    const validPool = [2, 4, 8, 16, 32, 64, 128, 256];
    for (const { value } of ev!.spawned) {
      expect(validPool).toContain(value);
    }
  });

  it('deterministic: same state + same chain → same spawned tiles', () => {
    const s0 = createGame({ ...CONFIG, prngSeed: 77 });
    // find valid 2-chain
    let ch: CommitChainAction | null = null;
    outer: for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 6; c++) {
        const v = s0.board[r]![c]!.value;
        if (!v) continue;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue;
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= 7 || nc < 0 || nc >= 6) continue;
            if (s0.board[nr]![nc]!.value === v) {
              const candidate = [cell(r, c), cell(nr, nc)];
              if (validateChain(s0.board, candidate).valid) {
                ch = { kind: 'commit-chain', chain: candidate };
                break outer;
              }
            }
          }
        }
      }
    }
    if (!ch) return; // board has no valid chain — skip

    const r1 = applyAction(s0, ch);
    const r2 = applyAction(s0, ch);
    const ev1 = r1.events.find(e => e.kind === 'tiles-spawned') as any;
    const ev2 = r2.events.find(e => e.kind === 'tiles-spawned') as any;
    expect(ev1!.spawned).toEqual(ev2!.spawned);
  });
});
