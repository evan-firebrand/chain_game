import { applyGravity, computePeak, makeEmptyGrid } from "./grid";
import { makeSpawnQueue } from "./spawn";
import { hasAnyValidMove, countPairs } from "./rules";
import { getMode } from "./modes";
import {
  COLS,
  ROWS,
  INITIAL_TARGET,
  RATCHET_INITIAL_FLOOR,
  RATCHET_DEFAULT_INTERVAL,
  UNDO_INITIAL_CHARGES,
  queueLenFor,
} from "./types";
import type { GameMode, GameState, Grid, ModeState, SpawnAlgo, TileModifier } from "./types";

const SCENARIO_SEED = 0xdeadbeef;
const _ = null;

type GridCell =
  | number
  | {
      v: number;
      boost?: true;
      wild?: true;
      beast?: true;
      dangerCounter?: number;
      modifier?: TileModifier;
    }
  | null;

export type ScenarioCategory =
  | "animations"
  | "health"
  | "tile_states"
  | "rising_floor"
  | "boost"
  | "moves_limited"
  | "wilds"
  | "game_events";

export type ScenarioBlueprint = {
  id: string;
  name: string;
  category: ScenarioCategory;
  desc: string;
  grid: GridCell[][];
  mode?: GameMode;
  modeState?: ModeState;
  currentTarget?: number;
  moves?: number;
  score?: number;
};

export type ScenarioSettings = {
  algo: SpawnAlgo;
  strength: number;
  softness: number;
};

export const SCENARIO_CATEGORIES: { id: ScenarioCategory; label: string }[] = [
  { id: "animations", label: "Animations" },
  { id: "health", label: "Board Health" },
  { id: "tile_states", label: "Tile States" },
  { id: "rising_floor", label: "Mode: Rising Floor" },
  { id: "boost", label: "Mode: Boost" },
  { id: "moves_limited", label: "Mode: Moves Limited" },
  { id: "wilds", label: "Mode: Wilds" },
  { id: "game_events", label: "Game Events" },
];

// Reused for last_moves (movesLimited, no floor — peak=32, pool=[2,4,8,16], all in pool)
const NORMAL_GRID: GridCell[][] = [
  [_,  _,  _,  _,  _],
  [_,  _,  _,  _,  _],
  [2,  4,  2,  4,  2],
  [4,  8,  4,  8,  4],
  [8,  16, 8,  16, 8],
  [16, 32, 16, 32, 16],
  [32, 16, 32, 16, 32],
];

// Reused for floor_warning / floor_critical (risingFloor floor=8, pool=[8,16,32,64])
const FLOOR_GRID: GridCell[][] = [
  [_,   _,   _,   _,   _],
  [_,   _,   _,   _,   _],
  [8,   16,  8,   16,  8],
  [16,  32,  16,  32,  16],
  [32,  64,  32,  64,  32],
  [64,  32,  64,  32,  64],
  [32,  64,  32,  64,  32],
];

export const SCENARIOS: ScenarioBlueprint[] = [
  // ── Animations ──────────────────────────────────────────────────────────────
  {
    id: "combo_ready",
    name: "Combo Ready",
    category: "animations",
    desc: "ComboOverlay — 5 equal tiles staged for a 5-chain at the bottom",
    // peak=16, pool=[2,4,8,16] — all values in pool, no dead tiles
    grid: [
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [2,  4,  2,  4,  2],
      [4,  8,  4,  8,  4],
      [8,  16, 8,  16, 8],
      [4,  4,  4,  4,  4],  // drag all 5 fours → combo fires
    ],
  },
  {
    id: "level_up_trigger",
    name: "Level Up Trigger",
    category: "animations",
    desc: "LevelUpOverlay — merge the two 256s to hit the 512 target",
    currentTarget: 512,
    // peak=256, pool=[16,32,64,128] — filler in pool; 256s are adjacent partners
    grid: [
      [_,   _,   _,   _,   _],
      [_,   _,   _,   _,   _],
      [16,  32,  16,  32,  16],
      [32,  64,  32,  64,  32],
      [64,  128, 64,  128, 64],
      [128, 64,  128, 64,  128],
      [256, 256, 64,  32,  16],  // merge 256+256 → 512 → level up
    ],
  },
  {
    id: "big_merge_shake",
    name: "Big Merge Shake",
    category: "animations",
    desc: "Max-intensity shake — merge the two 512s to produce 1024",
    currentTarget: 2048,
    // peak=512, pool=[32,64,128,256] — filler in pool; 512s are adjacent partners
    grid: [
      [_,   _,   _,   _,   _],
      [_,   _,   _,   _,   _],
      [32,  64,  32,  64,  32],
      [64,  128, 64,  128, 64],
      [128, 256, 128, 256, 128],
      [256, 128, 256, 128, 256],
      [512, 512, 128, 64,  32],  // merge 512+512 → 1024, maximum shake intensity
    ],
  },

  // ── Board Health ─────────────────────────────────────────────────────────────
  {
    id: "health_green",
    name: "Health: Green",
    category: "health",
    desc: "Green board tint — 20 chain-start pairs (well above the 16 threshold)",
    // peak=32, pool=[2,4,8,16]. Row-of-32s have horizontal partners → not dead
    grid: [
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [2,  2,  2,  2,  2],
      [4,  4,  4,  4,  4],
      [8,  8,  8,  8,  8],
      [16, 16, 16, 16, 16],
      [32, 32, 32, 32, 32],
    ],
  },
  {
    id: "health_yellow",
    name: "Health: Yellow",
    category: "health",
    desc: "Yellow board tint — ~12 chain-start pairs (6–15 range)",
    // peak=128, pool=[8,16,32,64]. 128s have diagonal partners across the alternating rows
    grid: [
      [_,   _,   _,   _,   _],
      [_,   _,   _,   _,   _],
      [_,   _,   _,   _,   _],
      [64,  128, 64,  128, 64],
      [128, 64,  128, 64,  128],
      [32,  64,  32,  64,  32],
      [16,  16,  16,  16,  16],
    ],
  },
  {
    id: "health_red",
    name: "Health: Red",
    category: "health",
    desc: "Red pulsing board tint — ≤5 chain-start pairs",
    // peak=512, pool=[32,64,128,256] — all values in pool; 512s partner each other
    grid: [
      [_,    _,    _,    _,    _],
      [_,    _,    _,    _,    _],
      [_,    _,    _,    _,    _],
      [_,    _,    _,    _,    _],
      [_,    _,    _,    _,    _],
      [256,  512,  128,  128,  256],
      [128,  256,  512,  256,  128],
    ],
  },

  // ── Tile States ──────────────────────────────────────────────────────────────
  {
    id: "fragile_tiles",
    name: "Fragile Tiles",
    category: "tile_states",
    desc: "Pulsing orange borders — isolated 4s about to be pushed out by floor rise",
    mode: "risingFloor",
    // floor=4 → nextFloor=8. pool=[4,8,16,32]. 4s have value<8 and no col±1 partner → fragile, not dead
    modeState: { kind: "risingFloor", floor: 4, movesToRaise: 5 },
    grid: [
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [4,  16, 4,  16, 4],  // isolated 4s: value < nextFloor(8), no col±1 partner → fragile
      [16, 32, 16, 32, 16],
      [32, 16, 32, 16, 32],
    ],
  },
  {
    id: "dead_tiles",
    name: "Dead Tiles",
    category: "tile_states",
    desc: "Faded tiles — low-value tiles with no partner and not in the spawn pool",
    // peak=512, pool=[32,64,128,256]. 2 and 4 are not in pool and have no board partners → dead
    grid: [
      [_,   _,   _,   _,   _],
      [_,   _,   _,   _,   _],
      [_,   _,   _,   _,   _],
      [2,   256, 4,   256, 2],  // 2s and 4 not in pool, no col±1 match → dead (faded)
      [256, 512, 256, 512, 256],
      [512, 256, 512, 256, 512],
      [256, 512, 256, 512, 256],
    ],
  },
  {
    id: "trophy_tile",
    name: "Trophy Tile",
    category: "tile_states",
    desc: "Trophy crown — a lone peak tile (2048) when only one exists on the board",
    currentTarget: 4096,
    // peak=2048, pool=[128,256,512,1024]. Filler in pool; lone 2048 shows as trophy
    grid: [
      [_,    _,    _,    _,    _],
      [_,    _,    _,    _,    _],
      [_,    _,    _,    _,    _],
      [128,  256,  128,  256,  128],
      [256,  512,  256,  512,  256],
      [512,  256,  512,  256,  512],
      [256,  512,  2048, 512,  256],  // lone 2048 = trophy crown
    ],
  },

  // ── Mode: Rising Floor ───────────────────────────────────────────────────────
  {
    id: "floor_warning",
    name: "Floor: Warning",
    category: "rising_floor",
    desc: "Orange status bar — floor rises in 3 moves",
    mode: "risingFloor",
    modeState: { kind: "risingFloor", floor: 8, movesToRaise: 3 },
    grid: FLOOR_GRID,
  },
  {
    id: "floor_critical",
    name: "Floor: Critical",
    category: "rising_floor",
    desc: "Red pulsing status bar — floor rises next move",
    mode: "risingFloor",
    modeState: { kind: "risingFloor", floor: 8, movesToRaise: 1 },
    grid: FLOOR_GRID,
  },

  // ── Mode: Boost ──────────────────────────────────────────────────────────────
  {
    id: "boost_chain_ready",
    name: "Boost Chain Ready",
    category: "boost",
    desc: "Boost tile visuals + 2x multiplier — 5-chain with two gold boost tiles staged",
    mode: "boost",
    // peak=16, pool=[2,4,8,16] — same safe values as combo_ready
    grid: [
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [2,  4,  2,  4,  2],
      [4,  8,  4,  8,  4],
      [8,  16, 8,  16, 8],
      [{ v: 4, boost: true }, { v: 4, boost: true }, 4, 4, 4],
    ],
  },

  // ── Mode: Moves Limited ──────────────────────────────────────────────────────
  {
    id: "last_moves",
    name: "Last 5 Moves",
    category: "moves_limited",
    desc: "Moves-remaining urgency display — only 5 moves left in the budget",
    mode: "movesLimited",
    modeState: { kind: "movesLimited", movesRemaining: 5 },
    grid: NORMAL_GRID,
  },

  // ── Mode: Wilds ──────────────────────────────────────────────────────────────
  {
    id: "wild_chain",
    name: "Wild Chain",
    category: "wilds",
    desc: "A wildcard tile (✦) bridges mismatched values — drag through it",
    mode: "wilds",
    grid: [
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [2,  4,  2,  4,  2],
      [4,  8,  4,  8,  4],
      [4,  { v: 2, wild: true }, 8, 16, 8],
      [16, 32, 16, 32, 16],
    ],
  },
  {
    id: "beast_imminent",
    name: "Beast Imminent",
    category: "wilds",
    desc: "Next move spawns a beast at the top of a column",
    mode: "wilds",
    modeState: {
      kind: "wilds",
      spirit: 0,
      frenzyRemaining: 0,
      movesUntilBeast: 1,
      beastInterval: 12,
      beastDangerStart: 6,
      activeBeastIds: [],
      freshBeastIds: [],
      stats: { beastsDefeated: 0, maxBeastValueDefeated: 0, wildsConsumed: 0, frenziesActivated: 0 },
      lastTrophyFlash: null,
      levelsClearedSnapshot: 0,
    },
    grid: [
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [2,  4,  2,  4,  2],
      [4,  8,  4,  8,  4],
      [8,  16, 8,  16, 8],
      [16, 32, 16, 32, 16],
      [32, 16, 32, 16, 32],
    ],
  },
  {
    id: "beast_stalking",
    name: "Beast Stalking",
    category: "wilds",
    desc: "Beast on the prowl — danger counter ticks each turn (chain 3+ to defeat)",
    mode: "wilds",
    modeState: {
      kind: "wilds",
      spirit: 4,
      frenzyRemaining: 0,
      movesUntilBeast: 8,
      beastInterval: 12,
      beastDangerStart: 6,
      activeBeastIds: [12],
      freshBeastIds: [],
      stats: { beastsDefeated: 0, maxBeastValueDefeated: 0, wildsConsumed: 0, frenziesActivated: 0 },
      lastTrophyFlash: null,
      levelsClearedSnapshot: 0,
    },
    grid: [
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [_,  _,  { v: 64, beast: true, dangerCounter: 3 }, _, _],
      [4,  8,  16, 8,  4],
      [8,  16, 8,  16, 8],
      [16, 32, 16, 32, 16],
      [32, 16, 32, 16, 32],
    ],
  },
  {
    id: "frenzy_active",
    name: "Wild Frenzy Active",
    category: "wilds",
    desc: "Frenzy is on — every spawn is wild, all chains × 1.5 for 5 moves",
    mode: "wilds",
    modeState: {
      kind: "wilds",
      spirit: 0,
      frenzyRemaining: 5,
      movesUntilBeast: 9,
      beastInterval: 12,
      beastDangerStart: 6,
      activeBeastIds: [],
      freshBeastIds: [],
      stats: { beastsDefeated: 0, maxBeastValueDefeated: 0, wildsConsumed: 0, frenziesActivated: 1 },
      lastTrophyFlash: null,
      levelsClearedSnapshot: 0,
    },
    grid: [
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [4,  8,  4,  8,  4],
      [8,  16, 8,  16, 8],
      [16, 32, 16, 32, 16],
      [32, 16, 32, 16, 32],
    ],
  },
  {
    id: "spirit_ready",
    name: "Spirit Wave Ready",
    category: "wilds",
    desc: "Spirit at 5 — click 'Spirit Wave' to convert 3 low tiles into wilds",
    mode: "wilds",
    modeState: {
      kind: "wilds",
      spirit: 5,
      frenzyRemaining: 0,
      movesUntilBeast: 9,
      beastInterval: 12,
      beastDangerStart: 6,
      activeBeastIds: [],
      freshBeastIds: [],
      stats: { beastsDefeated: 1, maxBeastValueDefeated: 64, wildsConsumed: 2, frenziesActivated: 0 },
      lastTrophyFlash: null,
      levelsClearedSnapshot: 0,
    },
    grid: [
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [_,  _,  _,  _,  _],
      [2,  4,  2,  4,  2],
      [4,  8,  4,  8,  4],
      [8,  16, 8,  16, 8],
      [16, 32, 16, 32, 16],
    ],
  },

  // ── Game Events ──────────────────────────────────────────────────────────────
  {
    id: "near_game_over",
    name: "Near Game Over",
    category: "game_events",
    desc: "End-state tension — only 5 valid chain-start pairs remain",
    // peak=1024, pool=[64,128,256,512] — all values in pool; 1024s partner each other
    grid: [
      [_,    _,    _,    _,    _],
      [_,    _,    _,    _,    _],
      [_,    _,    _,    _,    _],
      [_,    _,    _,    _,    _],
      [_,    _,    _,    _,    _],
      [256,  512,  1024, 256,  128],
      [512,  1024, 256,  1024, 256],
    ],
  },
];

function nextTargetFor(peak: number): number {
  let t = INITIAL_TARGET;
  while (t <= peak) t *= 2;
  return t;
}

export function buildScenarioState(bp: ScenarioBlueprint, settings: ScenarioSettings): GameState {
  const raw: Grid = makeEmptyGrid();
  let nextId = 1;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = bp.grid[r]?.[c] ?? null;
      if (cell === null) {
        raw[r][c] = null;
      } else if (typeof cell === "number") {
        raw[r][c] = { id: nextId++, value: cell };
      } else {
        raw[r][c] = {
          id: nextId++,
          value: cell.v,
          ...(cell.boost ? { boost: true, expiresIn: 15 } : {}),
          ...(cell.wild ? { wild: true } : {}),
          ...(cell.beast ? { beast: true } : {}),
          ...(cell.dangerCounter !== undefined ? { dangerCounter: cell.dangerCounter } : {}),
          ...(cell.modifier ? { modifier: cell.modifier } : {}),
        };
      }
    }
  }

  const grid = applyGravity(raw);
  const peak = computePeak(grid);
  const mode = bp.mode ?? "classic";
  const modeBehavior = getMode(mode);
  const modeState: ModeState = bp.modeState ?? modeBehavior.initState();

  const stubState = { modeState } as unknown as GameState;
  const floor = modeBehavior.spawnFloor?.(stubState);

  const { queue, rngState: s2 } = makeSpawnQueue(
    COLS,
    queueLenFor(settings.algo),
    peak,
    SCENARIO_SEED,
    settings.algo,
    grid,
    settings.strength,
    settings.softness,
    floor
  );

  const { starts } = countPairs(grid);

  return {
    grid,
    spawnQueue: queue,
    score: bp.score ?? 0,
    moves: bp.moves ?? 0,
    merges: bp.moves ?? 0,
    peak,
    seed: SCENARIO_SEED,
    rngState: s2,
    gameOver: !hasAnyValidMove(grid),
    startedAt: Date.now(),
    lastMerge: null,
    recentStartCounts: [starts],
    nextTileId: nextId,
    algo: settings.algo,
    strength: settings.strength,
    softness: settings.softness,
    mode,
    modeState,
    currentTarget: bp.currentTarget ?? nextTargetFor(peak),
    levelsCleared: 0,
    lastLevelUp: null,
    targetsEnabled: true,
    ratchetEnabled: false,
    ratchetFloor: RATCHET_INITIAL_FLOOR,
    ratchetInterval: RATCHET_DEFAULT_INTERVAL,
    undoStack: [],
    undoCharges: UNDO_INITIAL_CHARGES,
    levelGoal: null,
    levelGoalMet: false,
  };
}
