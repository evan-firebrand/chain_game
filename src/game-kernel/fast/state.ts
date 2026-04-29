import type {
  Board,
  GameConfig,
  GameEvent,
  GamePhase,
  GameState,
  Tile,
  TileValue,
} from '../types.js';
import { EMPTY_EVENTS } from '../_internal.js';
import { packTileObj, unpackTile } from './encoding.js';

// ─── FastState ───────────────────────────────────────────────────────────────
//
// The mutable counterpart to GameState. Board cells live in a single flat
// Uint8Array (rows * cols bytes). Other fields are scalars or small
// references; the FastState object itself is reused across turns by the
// sim-harness — only the board buffer is mutated in place.
//
// FastState is NOT exported from src/game-kernel/index.ts. It's an internal
// representation for sim-harness and the post-2.7 pure-API adapter.

export interface FastState {
  /** Bit-packed board: byte at index r*cols+c. Mutable. */
  readonly board: Uint8Array;
  readonly rows: number;
  readonly cols: number;
  readonly config: GameConfig;
  phase: GamePhase;
  turn: number;
  maxTileEver: TileValue;
  spawnPoolMin: TileValue;
  spawnPoolMax: TileValue;
  prngState: number;
}

// ─── Conversion ──────────────────────────────────────────────────────────────

/** Pack a pure GameState into a fresh FastState. Allocates one Uint8Array. */
export function fromPure(state: GameState): FastState {
  const rows = state.config.gridRows;
  const cols = state.config.gridCols;
  const board = new Uint8Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    const rowArr = state.board[r];
    /* v8 ignore next 1 */
    if (rowArr === undefined) continue;
    for (let c = 0; c < cols; c++) {
      const tile = rowArr[c];
      /* v8 ignore next 1 */
      if (tile === undefined) continue;
      board[r * cols + c] = packTileObj(tile);
    }
  }

  return {
    board,
    rows,
    cols,
    config: state.config,
    phase: state.phase,
    turn: state.turn,
    maxTileEver: state.maxTileEver,
    spawnPoolMin: state.spawnPoolMin,
    spawnPoolMax: state.spawnPoolMax,
    prngState: state.prngState,
  };
}

/**
 * Decode a FastState back into an immutable GameState. Allocates a fresh
 * frozen `Tile[][]` board. Used by the post-2.7 adapter and by tests that
 * compare fast-surface output against the pure surface.
 *
 * `events` and `lastEvents` are populated from the supplied arguments —
 * the FastState itself doesn't carry events.
 */
export function toPure(
  fast: FastState,
  options: {
    events?: readonly GameEvent[];
    lastEvents?: readonly GameEvent[];
  } = {},
): GameState {
  const { rows, cols, board } = fast;
  const grid = new Array<Tile[]>(rows);
  for (let r = 0; r < rows; r++) {
    const row = new Array<Tile>(cols);
    for (let c = 0; c < cols; c++) {
      const byte = board[r * cols + c] as number;
      row[c] = Object.freeze(unpackTile(byte));
    }
    Object.freeze(row);
    grid[r] = row;
  }
  Object.freeze(grid);

  return {
    board: grid as Board,
    config: fast.config,
    phase: fast.phase,
    turn: fast.turn,
    maxTileEver: fast.maxTileEver,
    spawnPoolMin: fast.spawnPoolMin,
    spawnPoolMax: fast.spawnPoolMax,
    prngState: fast.prngState,
    events: options.events ?? EMPTY_EVENTS,
    lastEvents: options.lastEvents ?? EMPTY_EVENTS,
  };
}

// ─── Branching ───────────────────────────────────────────────────────────────

/** Branch a FastState for lookahead: copies the board buffer; shares the config reference. */
export function cloneFast(fast: FastState): FastState {
  return {
    board: fast.board.slice(),
    rows: fast.rows,
    cols: fast.cols,
    config: fast.config,
    phase: fast.phase,
    turn: fast.turn,
    maxTileEver: fast.maxTileEver,
    spawnPoolMin: fast.spawnPoolMin,
    spawnPoolMax: fast.spawnPoolMax,
    prngState: fast.prngState,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Read a single cell as a packed byte. */
export function readCell(fast: FastState, row: number, col: number): number {
  return fast.board[row * fast.cols + col] as number;
}

/** Write a single cell as a packed byte. */
export function writeCell(
  fast: FastState,
  row: number,
  col: number,
  byte: number,
): void {
  fast.board[row * fast.cols + col] = byte;
}
