// ─── Value types ───────────────────────────────────────────────────────────

/** Powers of 2 on the board. 0 = empty cell. */
export type TileValue = 0 | 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 | 8192;

export type Row = 0 | 1 | 2 | 3 | 4 | 5 | 6;      // 0 = top
export type Col = 0 | 1 | 2 | 3 | 4 | 5;           // 0 = left

export interface Cell {
  readonly row: Row;
  readonly col: Col;
}

// ─── Tile ──────────────────────────────────────────────────────────────────

export interface Tile {
  readonly value: TileValue;
  /** True if this tile's tier has retired from the spawn pool. */
  readonly retired: boolean;
}

// ─── Board ─────────────────────────────────────────────────────────────────

/**
 * 2D grid: board[row][col]. Row 0 is the top row.
 * A cell with value 0 is empty.
 */
export type Board = readonly (readonly Tile[])[];

// ─── Game Config ───────────────────────────────────────────────────────────

export interface GameConfig {
  readonly gridRows: number;           // default: 7
  readonly gridCols: number;           // default: 6
  readonly ruleK: number;              // Rule D k parameter; default: 2
  /** Initial spawn pool, as min and max tier values. Default: [2, 256]. */
  readonly spawnPoolMin: TileValue;
  readonly spawnPoolMax: TileValue;
  /** Weights per tile value. Must cover all values in [spawnPoolMin, spawnPoolMax]. */
  readonly spawnWeights: Readonly<Partial<Record<TileValue, number>>>;
  /** Seeded PRNG state. All randomness flows through this. */
  readonly prngSeed: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  gridRows: 7,
  gridCols: 6,
  ruleK: 2,
  spawnPoolMin: 2,
  spawnPoolMax: 256,
  spawnWeights: { 2: 128, 4: 64, 8: 32, 16: 16, 32: 8, 64: 4, 128: 2, 256: 1 },
  prngSeed: 0,
};

// ─── Game State ────────────────────────────────────────────────────────────

export type GamePhase = 'playing' | 'game-over';

export interface GameState {
  readonly board: Board;
  readonly config: GameConfig;
  readonly phase: GamePhase;
  readonly turn: number;
  readonly maxTileEver: TileValue;
  /** Current spawn pool min (advances when retirement fires). */
  readonly spawnPoolMin: TileValue;
  /** Current spawn pool max (advances when retirement fires). */
  readonly spawnPoolMax: TileValue;
  /** PRNG state at this moment — deterministic, restorable. */
  readonly prngState: number;
  /** Accumulated event log for this game (used by sim harness). */
  readonly events: readonly GameEvent[];
  /**
   * Events produced by the *most recent* action only. Always populated;
   * empty array on the result of `createGame`. Consumers that only need
   * the per-turn delta (e.g. `game-session`) should read this rather
   * than slicing `events` — that pattern forces `events` to remain
   * cumulative and causes O(T²) growth in long games.
   */
  readonly lastEvents: readonly GameEvent[];
}

// ─── Actions ───────────────────────────────────────────────────────────────

export type ActionKind = 'commit-chain' | 'new-game';

export interface CommitChainAction {
  readonly kind: 'commit-chain';
  /** Ordered list of cells in the chain, start to end. Minimum length: 2. */
  readonly chain: readonly Cell[];
}

export interface NewGameAction {
  readonly kind: 'new-game';
  readonly config: GameConfig;
}

export type Action = CommitChainAction | NewGameAction;

// ─── Events ────────────────────────────────────────────────────────────────

export interface ChainResolvedEvent {
  readonly kind: 'chain-resolved';
  readonly chain: readonly Cell[];
  readonly resultValue: TileValue;
  readonly resultCell: Cell;
  readonly sameExtensions: number;
  readonly doublingExtensions: number;
}

export interface TilesSpawnedEvent {
  readonly kind: 'tiles-spawned';
  readonly spawned: readonly { cell: Cell; value: TileValue }[];
}

export interface RetirementFiredEvent {
  readonly kind: 'retirement-fired';
  readonly retiredTier: TileValue;
  readonly newSpawnPoolMin: TileValue;
  readonly newSpawnPoolMax: TileValue;
}

export interface GameOverEvent {
  readonly kind: 'game-over';
  readonly cause: 'no-legal-chain-start';
  readonly finalMaxTile: TileValue;
  readonly totalTurns: number;
}

export type GameEvent =
  | ChainResolvedEvent
  | TilesSpawnedEvent
  | RetirementFiredEvent
  | GameOverEvent;
