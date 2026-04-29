import { bench, describe } from 'vitest';
import {
  applyGravity,
  computeChainResult,
  createGame,
  getAdjacentCells,
  hasLegalChainStart,
  removeTiles,
  resolveChain,
  setTile,
  spawnTiles,
  validateChain,
  type Board,
  type Cell,
  type Col,
  type Row,
  type Tile,
  type TileValue,
} from '../../src/game-kernel/index.js';
import { BENCH_CONFIG, enumerateLegalPairs, playRandomGame } from '../_helpers.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────
// We bench against:
//   (a) FRESH_BOARD: the board produced by createGame(BENCH_CONFIG) — all 42
//       cells full, deterministic.
//   (b) MID_BOARD: a board after ~50 random-legal turns — represents typical
//       mid-game state with sparse holes after spawns/gravity.

const FRESH_STATE = createGame(BENCH_CONFIG);
const FRESH_BOARD: Board = FRESH_STATE.board;

const MID_STATE = playRandomGame(BENCH_CONFIG, /* walkerSeed */ 1, /* maxTurns */ 50).finalState;
const MID_BOARD: Board = MID_STATE.board;

const SAMPLE_CELL: Cell = { row: 0 as Row, col: 0 as Col };
const REPLACEMENT_TILE: Tile = { value: 4 as TileValue, retired: false };

const SAMPLE_PAIRS = enumerateLegalPairs(FRESH_BOARD);
const SAMPLE_CHAIN: readonly Cell[] = SAMPLE_PAIRS[0] ?? [SAMPLE_CELL, SAMPLE_CELL];

// ─── Benchmarks ──────────────────────────────────────────────────────────────

describe('setTile', () => {
  bench('setTile (full board, single replacement)', () => {
    setTile(FRESH_BOARD, SAMPLE_CELL, REPLACEMENT_TILE);
  });
});

describe('removeTiles', () => {
  bench('removeTiles (2-cell chain)', () => {
    removeTiles(FRESH_BOARD, SAMPLE_CHAIN);
  });
});

describe('applyGravity', () => {
  bench('applyGravity (mid-game board with holes)', () => {
    applyGravity(MID_BOARD);
  });
});

describe('spawnTiles', () => {
  bench('spawnTiles (chain length 3 → 2 spawns)', () => {
    spawnTiles(MID_BOARD, 3, BENCH_CONFIG, MID_STATE.prngState);
  });
});

describe('hasLegalChainStart', () => {
  bench('hasLegalChainStart (full fresh board)', () => {
    hasLegalChainStart(FRESH_BOARD);
  });
});

describe('validateChain', () => {
  bench('validateChain (2-cell chain)', () => {
    validateChain(FRESH_BOARD, SAMPLE_CHAIN);
  });
});

describe('resolveChain', () => {
  bench('resolveChain (2-cell chain)', () => {
    resolveChain(FRESH_BOARD, SAMPLE_CHAIN, BENCH_CONFIG);
  });
});

describe('computeChainResult', () => {
  bench('computeChainResult (2-cell chain)', () => {
    computeChainResult(FRESH_BOARD, SAMPLE_CHAIN, BENCH_CONFIG);
  });
});

describe('getAdjacentCells', () => {
  bench('getAdjacentCells (interior cell, 7x6 board)', () => {
    getAdjacentCells({ row: 3 as Row, col: 3 as Col }, 7, 6);
  });
});

describe('createGame', () => {
  bench('createGame (default config)', () => {
    createGame(BENCH_CONFIG);
  });
});
