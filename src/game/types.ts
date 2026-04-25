export type TileModifier =
  | { kind: "wildcard" }
  | { kind: "lock"; clearsRemaining: number }
  | { kind: "bomb"; radius: number }
  | { kind: "ice"; thawIn: number }
  | { kind: "anchor" }
  | { kind: "splitter" }
  | { kind: "multiplier"; factor: number };

export type Tile = {
  id: number;
  value: number;
  boost?: boolean;
  // Moves remaining before the boost expires (Boost mode only). When 0, the boost
  // flag is stripped and the tile becomes a regular tile at its current value.
  expiresIn?: number;
  // Wilds mode: matches any value when extending a chain. Max 1 per chain.
  wild?: boolean;
  // Wilds mode: predator tile that stalks neighbors and rampages on a timer.
  beast?: boolean;
  dangerCounter?: number;
  modifier?: TileModifier;
};

// Board dimensions and spawn pool size are mutable module-level state so we
// can A/B test different configurations from the Dev Panel and CLI sweep
// harness without rewiring every game-logic call site. ES module `let`
// exports are live bindings — importers always see the current value.
// Use `configureBoard()` to change them; call before `newGame()`.
export const DEFAULT_ROWS = 7;
export const DEFAULT_COLS = 5;
export const DEFAULT_POOL_SIZE = 4;
export let ROWS = DEFAULT_ROWS;
export let COLS = DEFAULT_COLS;
export let POOL_SIZE = DEFAULT_POOL_SIZE;
export const QUEUE_LEN = 3;

export type BoardConfig = {
  rows?: number;
  cols?: number;
  poolSize?: number;
};

export function configureBoard(cfg: BoardConfig = {}): void {
  if (cfg.rows !== undefined) ROWS = Math.max(2, Math.floor(cfg.rows));
  if (cfg.cols !== undefined) COLS = Math.max(2, Math.floor(cfg.cols));
  if (cfg.poolSize !== undefined) POOL_SIZE = Math.max(1, Math.floor(cfg.poolSize));
}

export function getBoardConfig(): Required<BoardConfig> {
  return { rows: ROWS, cols: COLS, poolSize: POOL_SIZE };
}

export function resetBoardConfig(): void {
  ROWS = DEFAULT_ROWS;
  COLS = DEFAULT_COLS;
  POOL_SIZE = DEFAULT_POOL_SIZE;
}

export type SpawnAlgo = "weighted" | "antiPair" | "adversarial";

export const ALL_ALGOS: SpawnAlgo[] = ["weighted", "antiPair", "adversarial"];

export function queueLenFor(algo: SpawnAlgo): number {
  return algo === "weighted" ? QUEUE_LEN : 1;
}

export function algoUsesStrength(algo: SpawnAlgo): boolean {
  return algo === "antiPair";
}

export function algoUsesSoftness(algo: SpawnAlgo): boolean {
  return algo === "adversarial";
}

export type GameMode = "classic" | "risingFloor" | "boost" | "movesLimited" | "wilds";

export const ALL_MODES: GameMode[] = ["classic", "risingFloor", "boost", "movesLimited", "wilds"];

export const MODE_LABELS: Record<GameMode, string> = {
  classic: "Classic",
  risingFloor: "Rising Floor",
  boost: "Boost Tiles",
  movesLimited: "Moves Limited",
  wilds: "Wilds",
};

export type WildsStats = {
  beastsDefeated: number;
  maxBeastValueDefeated: number;
  wildsConsumed: number;
  frenziesActivated: number;
};

export type ModeState =
  | { kind: "classic" }
  | { kind: "risingFloor"; floor: number; movesToRaise: number; lastStrandedIds?: number[] }
  | { kind: "boost" }
  | { kind: "movesLimited"; movesRemaining: number }
  | {
      kind: "wilds";
      spirit: number;
      frenzyRemaining: number;
      movesUntilBeast: number;
      beastInterval: number;
      beastDangerStart: number;
      activeBeastIds: number[];
      freshBeastIds: number[];
      stats: WildsStats;
      lastTrophyFlash: { value: number; movesAt: number } | null;
      levelsClearedSnapshot: number;
    };

export type Grid = (Tile | null)[][];

export type Coord = { r: number; c: number };

export type ChainState = {
  path: Coord[];
} | null;

export type LastMerge = {
  chainValues: number[];
  sum: number;
  result: number;
  landing: Coord;
  combo?: boolean;
  comboBonus?: number;
};

export type Telemetry = {
  peak: number;
  spawnPool: number[];
  spawnWeights: number[];
  histogram: Record<number, number>;
  chainStarts: number;
  chainExtensions: number;
  pairBreakdown: Record<string, number>;
  lastMerge: LastMerge | null;
  recentStartCounts: number[];
};

export type GameState = {
  grid: Grid;
  spawnQueue: number[][];
  score: number;
  moves: number;
  merges: number;
  peak: number;
  seed: number;
  rngState: number;
  gameOver: boolean;
  startedAt: number;
  lastMerge: LastMerge | null;
  recentStartCounts: number[];
  nextTileId: number;
  algo: SpawnAlgo;
  strength: number;
  softness: number;
  mode: GameMode;
  modeState: ModeState;
  currentTarget: number;
  levelsCleared: number;
  lastLevelUp: { level: number; target: number } | null;
  targetsEnabled: boolean;
  ratchetEnabled: boolean;
  ratchetFloor: number;
  ratchetInterval: number;
  undoStack: UndoSnapshot[];
  undoCharges: number;
  levelGoal: LevelGoal | null;
  levelGoalMet: boolean;
};

export type UndoSnapshot = Omit<GameState, "undoStack" | "undoCharges">;

export type LevelGoal =
  | { kind: "chain-length"; target: number; best: number }
  | { kind: "produce-value"; target: number; met: boolean };

export const INITIAL_TARGET = 512;
export const TARGET_PROGRESSION: number[] = [512, 768, 1024, 1536, 2048, 3072, 4096, 6144, 8192, 12288];
export const RATCHET_INITIAL_FLOOR = 2;
export const RATCHET_DEFAULT_INTERVAL = 1;
export const UNDO_INITIAL_CHARGES = 3;
export const UNDO_MAX_CHARGES = 3;
export const UNDO_STACK_SIZE = 3;
