# Kernel Interface Specification

**Status:** Accepted — approved by Evan 2026-04-28. Phase 1 implementation may begin.

This document defines the TypeScript interface contracts for `src/game-kernel/`. It is the load-bearing contract that every downstream module depends on.

---

## Core Types (`types.ts`)

```typescript
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
export type Board = ReadonlyArray<ReadonlyArray<Tile>>;

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
  readonly events: ReadonlyArray<GameEvent>;
}

// ─── Actions ───────────────────────────────────────────────────────────────

export type ActionKind = 'commit-chain' | 'new-game';

export interface CommitChainAction {
  readonly kind: 'commit-chain';
  /** Ordered list of cells in the chain, start to end. Minimum length: 2. */
  readonly chain: ReadonlyArray<Cell>;
}

export interface NewGameAction {
  readonly kind: 'new-game';
  readonly config: GameConfig;
}

export type Action = CommitChainAction | NewGameAction;

// ─── Events ────────────────────────────────────────────────────────────────

export interface ChainResolvedEvent {
  readonly kind: 'chain-resolved';
  readonly chain: ReadonlyArray<Cell>;
  readonly resultValue: TileValue;
  readonly resultCell: Cell;
  readonly sameExtensions: number;
  readonly doublingExtensions: number;
}

export interface TilesSpawnedEvent {
  readonly kind: 'tiles-spawned';
  readonly spawned: ReadonlyArray<{ cell: Cell; value: TileValue }>;
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
```

---

## Public API (`index.ts` re-exports)

```typescript
// ─── Exported from game-kernel/index.ts ────────────────────────────────────

/**
 * Create the initial game state for a new game.
 * Populates the board with tiles using the config's spawn weights + PRNG.
 */
export function createGame(config: GameConfig): GameState;

/**
 * The core state machine. Apply an action to a state, return the next state.
 * Pure function — no side effects. Returns a new GameState object.
 * The new state includes any events produced by this transition in state.events.
 */
export function applyAction(state: GameState, action: Action): GameState;

/**
 * Validate whether a proposed chain is legal given the current board.
 * Returns an object with `valid: boolean` and an optional `reason` string.
 * Used by the UI to highlight valid/invalid cells as the player traces a path.
 */
export function validateChain(
  board: Board,
  chain: ReadonlyArray<Cell>
): { valid: boolean; reason?: string };

/**
 * Check if any legal chain start exists on the current board.
 * Used to detect the game-over condition.
 * Returns true if at least one pair of adjacent same-value tiles exists.
 */
export function hasLegalChainStart(board: Board): boolean;

/**
 * Compute the result value for a chain without modifying state.
 * Useful for preview display and testing.
 * chain must be at least 2 cells; all cells must have non-zero values.
 */
export function computeChainResult(
  board: Board,
  chain: ReadonlyArray<Cell>,
  config: GameConfig
): TileValue;
```

---

## Internal Modules

These are NOT exported from `index.ts`. They are implementation details.

### `chain.ts`
```typescript
// Validates chain extension rules (same-value or doubled-adjacent).
// Counts same-value extensions (s) and doubling extensions.
export function validateChainExtension(
  currentTile: Tile,
  candidateTile: Tile
): { valid: boolean; extensionType: 'same' | 'double' | 'invalid' };

// Returns the ordered list of adjacent cells (8-way) for a given cell.
export function getAdjacentCells(cell: Cell, rows: number, cols: number): Cell[];
```

### `rules.ts`
```typescript
// Rule D, k=2: result = lastValue × 2 × 2^⌊s/k⌋
// where s = same-value extensions beyond the initial pair, k = config.ruleK
export function computeResultValue(
  lastValue: TileValue,
  sameExtensions: number,
  config: GameConfig
): TileValue;
```

### `board.ts`
```typescript
// Apply gravity: tiles fall down to fill empty cells in each column.
// Returns new board with tiles settled.
export function applyGravity(board: Board): Board;

// Spawn L-1 new tiles at the top of columns that have empty cells.
// Uses seeded PRNG from state.prngState.
export function spawnTiles(
  board: Board,
  chainLength: number,
  config: GameConfig,
  prngState: number
): { board: Board; prngState: number; spawned: Array<{ cell: Cell; value: TileValue }> };

// Place a tile at a cell, returning a new board.
export function setTile(board: Board, cell: Cell, tile: Tile): Board;

// Remove tiles at the given cells, returning a new board with those cells empty.
export function removeTiles(board: Board, cells: ReadonlyArray<Cell>): Board;
```

### `retirement.ts`
```typescript
// Check whether a retirement should fire given the current max tile ever reached.
// Returns the retiring tier value, or null if no retirement fires.
export function checkRetirement(
  maxTileEver: TileValue,
  currentSpawnPoolMax: TileValue
): TileValue | null;

// Advance the spawn pool window by one tier.
export function advanceSpawnPool(
  config: GameConfig,
  retiredTier: TileValue
): Pick<GameConfig, 'spawnPoolMin' | 'spawnPoolMax' | 'spawnWeights'>;
```

---

## Mandatory Test Vectors (T1-T8b)

These are from `docs/Merge_Game_Design_Journal.md`. All must pass before Phase 1 gate.

| ID | Chain | Expected result | Notes |
|---|---|---|---|
| T1 | [2, 2] | 4 | Minimal chain, no extensions |
| T2 | [2, 2, 2] | 4 | 1 same-ext, ⌊1/2⌋=0, no bonus |
| T3 | [2, 2, 2, 2] | 8 | 2 same-ext, ⌊2/2⌋=1, one bonus doubling |
| T4 | [2, 2, 4, 8] | 16 | 2 doubling-ext, 0 same-ext |
| T5 | [2, 2, 4, 4, 8] | 16 | 2 doubling-ext, 1 same-ext, ⌊1/2⌋=0 |
| T6 | [2, 2, 2, 2, 4, 4, 8] | 32 | 2 doubling-ext, 3 same-ext, ⌊3/2⌋=1 |
| T7 | [4, 4, 8] | 16 | last=8, s=0, 1 doubling-ext → 8×2×1=16 |
| T8a | [2, 2, 2, 2, 2, 2] | 16 | last=2, s=4, ⌊4/2⌋=2 → 2×2×4=16 |
| T8b | [2, 2, 4, 4, 4, 4, 8] | 64 | last=8, s=4, ⌊4/2⌋=2 → 8×2×4=64 |

**Formula checks:**
- T6: last=8, s=3, k=2 → 8 × 2 × 2^⌊3/2⌋ = 8 × 2 × 2 = 32 ✓
- T7: last=8, s=0, 1 doubling → 8 × 2 × 2^0 = 16 ✓
- T8a: last=2, s=4 → 2 × 2 × 2^2 = 16 ✓
- T8b: last=8, s=4 → 8 × 2 × 2^2 = 64 ✓ (not 32 — corrected from earlier draft)

**⚠️ Note:** T7 and T8b values were wrong in the session brief for the Test Agent. The correct values per the formula are T7=16 and T8b=64. Verify against the Design Journal's exact chain examples before writing the test vectors.

---

## Confirmed Mechanics (Evan, 2026-04-28)

These were open design gaps, now resolved:

| Question | Answer |
|---|---|
| Minimum chain length | **2 tiles** (two adjacent same-value tiles is a complete valid move) |
| Result tile placement | **The last tile the player ends the chain on** gets the new value; all other chain tiles vanish |
| Board fill on new game | **Completely full board** (all 42 cells filled at game start) |
| Initial board guarantee | **Yes** — board must have at least 1 valid move (≥1 adjacent same-value pair) at start |
| Post-chain spawn count | **L−1 new tiles** spawn from the top (chain removes L tiles, 1 result placed back → L−1 needed to refill completely) |
| L=1 chain spawn count | **Moot** — minimum chain is 2, so L≥2 always; minimum spawn = 1 |

## Remaining Open Questions (file as design-question issues before Phase 1 gate)

| Question | Conservative default to use if blocked |
|---|---|
| Gravity: when multiple columns drop simultaneously, is order defined? | Left-to-right (cosmetic only; game correctness unaffected) |
| Can the player's traced path revisit the same column (but not the same cell)? | Yes — only cell reuse is forbidden, not column reuse |
