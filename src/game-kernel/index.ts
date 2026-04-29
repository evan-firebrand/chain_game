import type {
  Board,
  Cell,
  GameConfig,
  GameState,
  GamePhase,
  Action,
  TileValue,
  Row,
  Col,
  GameEvent,
  ChainResolvedEvent,
  TilesSpawnedEvent,
  GameOverEvent,
} from './types.js';
import { applyGravity, setTile, removeTiles, spawnTiles } from './board.js';
import { getAdjacentCells, validateChainExtension, resolveChain } from './chain.js';
import { EMPTY_TILE, lcgFloat, lcgNext, pickTileValue } from './_internal.js';

// Re-export public types
export type {
  TileValue,
  Row,
  Col,
  Cell,
  Tile,
  Board,
  GameConfig,
  GameState,
  GamePhase,
  Action,
  CommitChainAction,
  NewGameAction,
  ActionKind,
  GameEvent,
  ChainResolvedEvent,
  TilesSpawnedEvent,
  RetirementFiredEvent,
  GameOverEvent,
} from './types.js';

export { DEFAULT_CONFIG } from './types.js';
export { computeResultValue } from './rules.js';
export { getAdjacentCells, validateChainExtension, resolveChain } from './chain.js';
export { applyGravity, setTile, removeTiles, spawnTiles } from './board.js';

// ─── Board initialization ─────────────────────────────────────────────────

function createEmptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () => {
    const row: typeof EMPTY_TILE[] = new Array(cols);
    for (let i = 0; i < cols; i++) row[i] = EMPTY_TILE;
    return row;
  }) as Board;
}

function fillBoard(
  rows: number,
  cols: number,
  config: GameConfig,
  prngState: number
): { board: Board; prngState: number } {
  let board: Board = createEmptyBoard(rows, cols);
  let currentPrng = prngState;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      currentPrng = lcgNext(currentPrng);
      const rand = lcgFloat(currentPrng);
      const value = pickTileValue(config, rand);
      board = setTile(board, { row: r as Row, col: c as Col }, { value, retired: false });
    }
  }

  return { board, prngState: currentPrng };
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Create the initial game state for a new game.
 * Populates the board with tiles using the config's spawn weights + PRNG.
 * Guarantees at least one valid chain start (adjacent pair of same-value tiles).
 */
export function createGame(config: GameConfig): GameState {
  let prngState = config.prngSeed;

  // Fill board, retry until at least one valid chain start exists
  let board: Board;
  let attempt = 0;
  for (;;) {
    const result = fillBoard(config.gridRows, config.gridCols, config, prngState);
    board = result.board;
    prngState = result.prngState;
    attempt++;

    if (hasLegalChainStart(board)) break;

    // If no legal start after many attempts, force a pair
    if (attempt >= 100) {
      const firstTile = board[0]?.[0];
      if (firstTile !== undefined && firstTile.value !== 0) {
        board = setTile(board, { row: 0 as Row, col: 1 as Col }, { value: firstTile.value, retired: false });
      }
      break;
    }
  }

  return {
    board,
    config,
    phase: 'playing',
    turn: 0,
    maxTileEver: 0 as TileValue,
    spawnPoolMin: config.spawnPoolMin,
    spawnPoolMax: config.spawnPoolMax,
    prngState,
    events: [],
  };
}

/**
 * Validate whether a proposed chain is legal given the current board.
 */
export function validateChain(
  board: Board,
  chain: readonly Cell[]
): { valid: boolean; reason?: string } {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  if (chain.length < 2) {
    return { valid: false, reason: 'Chain must have at least 2 cells' };
  }

  // Check all cells in bounds and non-zero
  for (const cell of chain) {
    if (cell.row < 0 || cell.row >= rows || cell.col < 0 || cell.col >= cols) {
      return { valid: false, reason: 'Cell out of bounds' };
    }
    const tile = board[cell.row]?.[cell.col];
    if (tile === undefined || tile.value === 0) {
      return { valid: false, reason: 'Cell is empty' };
    }
  }

  // Check no cell reuse — pack (row, col) into a single integer key
  // so the Set is keyed by number rather than allocating a string per cell.
  const seen = new Set<number>();
  for (const cell of chain) {
    const key = cell.row * cols + cell.col;
    if (seen.has(key)) {
      return { valid: false, reason: 'Cell reuse not allowed' };
    }
    seen.add(key);
  }

  // Check first two cells: adjacent and same-value
  const first = chain[0];
  const second = chain[1];
  if (first === undefined || second === undefined) {
    return { valid: false, reason: 'Chain too short' };
  }

  const firstTile = board[first.row]?.[first.col];
  const secondTile = board[second.row]?.[second.col];
  if (firstTile === undefined || secondTile === undefined) {
    return { valid: false, reason: 'Cell out of bounds' };
  }

  // Check adjacency of first pair
  const adjacentToFirst = getAdjacentCells(first, rows, cols);
  const isFirstAdj = adjacentToFirst.some(c => c.row === second.row && c.col === second.col);
  if (!isFirstAdj) {
    return { valid: false, reason: 'First two cells must be adjacent' };
  }

  if (firstTile.value !== secondTile.value) {
    return { valid: false, reason: 'First two cells must have the same value' };
  }

  // Validate each subsequent extension
  for (let i = 2; i < chain.length; i++) {
    const prev = chain[i - 1];
    const curr = chain[i];
    if (prev === undefined || curr === undefined) continue;

    // Check adjacency
    const adjCells = getAdjacentCells(prev, rows, cols);
    const isAdj = adjCells.some(c => c.row === curr.row && c.col === curr.col);
    if (!isAdj) {
      return { valid: false, reason: `Cell ${i} is not adjacent to previous cell` };
    }

    const prevTile = board[prev.row]?.[prev.col];
    const currTile = board[curr.row]?.[curr.col];
    if (prevTile === undefined || currTile === undefined) {
      return { valid: false, reason: 'Cell out of bounds' };
    }

    const { valid } = validateChainExtension(prevTile, currTile);
    if (!valid) {
      return { valid: false, reason: `Cell ${i} does not satisfy chain extension rule` };
    }
  }

  return { valid: true };
}

/**
 * Check if any legal chain start exists on the current board.
 */
export function hasLegalChainStart(board: Board): boolean {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = board[r]?.[c];
      if (tile === undefined || tile.value === 0) continue;

      const adj = getAdjacentCells({ row: r as Row, col: c as Col }, rows, cols);
      for (const neighbor of adj) {
        const neighborTile = board[neighbor.row]?.[neighbor.col];
        if (neighborTile !== undefined && neighborTile.value === tile.value) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Compute the result value for a chain without modifying state.
 */
export function computeChainResult(
  board: Board,
  chain: readonly Cell[],
  config: GameConfig
): TileValue {
  const { resultValue } = resolveChain(board, chain, config);
  return resultValue;
}

/**
 * The core state machine. Apply an action to a state, return the next state.
 */
export function applyAction(state: GameState, action: Action): GameState {
  switch (action.kind) {
    case 'new-game':
      return createGame(action.config);

    case 'commit-chain': {
      if (state.phase === 'game-over') {
        return state;
      }

      const { chain } = action;
      const validation = validateChain(state.board, chain);
      if (!validation.valid) {
        return state;
      }

      const { resultValue, sameExtensions, doublingExtensions } = resolveChain(
        state.board,
        chain,
        state.config
      );

      const lastCell = chain[chain.length - 1];
      if (lastCell === undefined) return state;

      const newEvents: GameEvent[] = [];

      // Remove chain tiles, place result at last cell
      let board = removeTiles(state.board, chain);
      board = setTile(board, lastCell, { value: resultValue, retired: false });

      // Apply gravity
      board = applyGravity(board);

      // Spawn L-1 tiles
      const { board: boardAfterSpawn, prngState: newPrng, spawned } = spawnTiles(
        board,
        chain.length,
        state.config,
        state.prngState
      );
      board = boardAfterSpawn;

      // Build chain-resolved event
      const chainResolvedEvent: ChainResolvedEvent = {
        kind: 'chain-resolved',
        chain,
        resultValue,
        resultCell: lastCell,
        sameExtensions,
        doublingExtensions,
      };
      newEvents.push(chainResolvedEvent);

      // Build tiles-spawned event
      if (spawned.length > 0) {
        const tilesSpawnedEvent: TilesSpawnedEvent = {
          kind: 'tiles-spawned',
          spawned,
        };
        newEvents.push(tilesSpawnedEvent);
      }

      // Update maxTileEver
      const newMaxTileEver = (
        resultValue > state.maxTileEver ? resultValue : state.maxTileEver
      );

      // Retirement stub — checkRetirement goes here in Phase 4
      const newSpawnPoolMin = state.spawnPoolMin;
      const newSpawnPoolMax = state.spawnPoolMax;

      // Check loss condition
      const legalStart = hasLegalChainStart(board);
      let newPhase: GamePhase = state.phase;

      if (!legalStart) {
        const gameOverEvent: GameOverEvent = {
          kind: 'game-over',
          cause: 'no-legal-chain-start',
          finalMaxTile: newMaxTileEver,
          totalTurns: state.turn + 1,
        };
        newEvents.push(gameOverEvent);
        newPhase = 'game-over';
      }

      return {
        board,
        config: state.config,
        phase: newPhase,
        turn: state.turn + 1,
        maxTileEver: newMaxTileEver,
        spawnPoolMin: newSpawnPoolMin,
        spawnPoolMax: newSpawnPoolMax,
        prngState: newPrng,
        events: [...state.events, ...newEvents],
      };
    }
  }
}
