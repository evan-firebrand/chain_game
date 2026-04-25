import { neighbors8 } from "../chain";
import { applyGravity, cloneGrid } from "../grid";
import { rngStep } from "../rng";
import { COLS, ROWS } from "../types";
import type { GameState, Grid, ModeState, Tile } from "../types";
import type { ModeBehavior } from "./types";

const INITIAL_BEAST_INTERVAL = 12;
const MIN_BEAST_INTERVAL = 5;
const INITIAL_DANGER = 6;
const MIN_DANGER = 3;
const BASE_WILD_RATE = 0.05;
const MAX_WILD_RATE = 0.08;
const WILD_RATE_PER_LEVEL = 0.005;
const SPIRIT_CAP = 10;
const SPIRIT_FRENZY_THRESHOLD = 10;
const SPIRIT_WAVE_COST = 5;
const FRENZY_DURATION = 5;
const RAMPAGE_PENALTY = 100;
const BEAST_VALUE_MULT = 2;
const MIN_CHAIN_FOR_BEAST = 3;
const SPIRIT_FROM_BEAST = 3;
const SPIRIT_FROM_BIG_CHAIN = 1;
const BIG_CHAIN_THRESHOLD = 6;
const SPIRIT_WAVE_TILE_COUNT = 3;

function ms(state: GameState) {
  return state.modeState as Extract<ModeState, { kind: "wilds" }>;
}

export const wilds: ModeBehavior = {
  id: "wilds",
  label: "Wilds",
  initState: () => ({
    kind: "wilds",
    spirit: 0,
    frenzyRemaining: 0,
    movesUntilBeast: INITIAL_BEAST_INTERVAL,
    beastInterval: INITIAL_BEAST_INTERVAL,
    beastDangerStart: INITIAL_DANGER,
    activeBeastIds: [],
    freshBeastIds: [],
    stats: {
      beastsDefeated: 0,
      maxBeastValueDefeated: 0,
      wildsConsumed: 0,
      frenziesActivated: 0,
    },
    lastTrophyFlash: null,
    levelsClearedSnapshot: 0,
  }),

  decorateSpawn: (state, ctx) => {
    const cur = ms(state);
    const wildRate =
      cur.frenzyRemaining > 0
        ? 1
        : Math.min(MAX_WILD_RATE, BASE_WILD_RATE + WILD_RATE_PER_LEVEL * state.levelsCleared);
    const roll = rngStep(ctx.rngState);
    if (roll.value < wildRate) {
      return { flags: { wild: true }, rngState: roll.state };
    }
    return { flags: {}, rngState: roll.state };
  },

  injectSpawns: (state, grid, rngState, nextTileId) => {
    const cur = ms(state);
    if (cur.movesUntilBeast > 1) {
      return { spawns: [], rngState, nextState: {} };
    }
    // Beast must land in a column that has at least one empty row post-gravity.
    // After gravity, only columns where tiles got cleared have empties.
    const eligibleCols: number[] = [];
    for (let c = 0; c < COLS; c++) {
      if (grid[0][c] === null) eligibleCols.push(c);
    }
    if (eligibleCols.length === 0) {
      // No column has room — defer the spawn one move so the next chain frees space.
      return {
        spawns: [],
        rngState,
        nextState: { modeState: { ...cur, movesUntilBeast: 1 } },
      };
    }
    const roll = rngStep(rngState);
    const col = eligibleCols[Math.floor(roll.value * eligibleCols.length) % eligibleCols.length];
    const beastValue = Math.max(state.peak * BEAST_VALUE_MULT, 4);
    const dangerCounter = Math.floor(cur.beastDangerStart);
    return {
      spawns: [
        {
          col,
          value: beastValue,
          flags: { beast: true, dangerCounter },
        },
      ],
      rngState: roll.state,
      nextState: {
        modeState: {
          ...cur,
          freshBeastIds: [...cur.freshBeastIds, nextTileId],
        },
      },
    };
  },

  chainMultiplier: (_chain, state) => {
    if (state.modeState.kind !== "wilds") return 1;
    return state.modeState.frenzyRemaining > 0 ? 1.5 : 1;
  },

  validateCommit: (_state, chainTiles) => {
    const hasBeast = chainTiles.some((t) => t.beast);
    if (hasBeast && chainTiles.length < MIN_CHAIN_FOR_BEAST) {
      return { valid: false, reason: `Beasts need a chain of ${MIN_CHAIN_FOR_BEAST}+` };
    }
    return { valid: true };
  },

  onChainResolved: (state, chainTiles) => {
    if (state.modeState.kind !== "wilds") return {};
    const cur = state.modeState;
    let spirit = cur.spirit;
    const stats = { ...cur.stats };
    let lastTrophyFlash = cur.lastTrophyFlash;
    let frenziesActivated = stats.frenziesActivated;
    let frenzyRemaining = cur.frenzyRemaining;

    const wildsInChain = chainTiles.filter((t) => t.wild).length;
    if (wildsInChain > 0) {
      spirit += wildsInChain;
      stats.wildsConsumed += wildsInChain;
    }

    let activeBeastIds = cur.activeBeastIds;
    const beastsInChain = chainTiles.filter((t) => t.beast);
    if (beastsInChain.length > 0) {
      const slainIds = new Set(beastsInChain.map((b) => b.id));
      activeBeastIds = activeBeastIds.filter((id) => !slainIds.has(id));
      for (const beast of beastsInChain) {
        spirit += SPIRIT_FROM_BEAST;
        stats.beastsDefeated++;
        if (beast.value > stats.maxBeastValueDefeated) {
          stats.maxBeastValueDefeated = beast.value;
          lastTrophyFlash = { value: beast.value, movesAt: state.moves };
        }
      }
    }

    if (chainTiles.length >= BIG_CHAIN_THRESHOLD) {
      spirit += SPIRIT_FROM_BIG_CHAIN;
    }

    if (spirit >= SPIRIT_FRENZY_THRESHOLD && frenzyRemaining === 0) {
      spirit = 0;
      frenzyRemaining = FRENZY_DURATION;
      frenziesActivated++;
    } else {
      spirit = Math.min(SPIRIT_CAP, spirit);
    }
    stats.frenziesActivated = frenziesActivated;

    return {
      modeState: {
        ...cur,
        spirit,
        frenzyRemaining,
        activeBeastIds,
        stats,
        lastTrophyFlash,
      },
    };
  },

  onMoveComplete: (state) => {
    if (state.modeState.kind !== "wilds") return {};
    const cur = state.modeState;
    let grid = state.grid;
    let scoreDelta = 0;

    const eligibleStalkers = new Set(cur.activeBeastIds);

    const beasts: { r: number; c: number; tile: Tile }[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = grid[r][c];
        if (t?.beast && eligibleStalkers.has(t.id)) {
          beasts.push({ r, c, tile: t });
        }
      }
    }

    if (beasts.length > 0) {
      grid = cloneGrid(grid);
      for (const { r, c, tile } of beasts) {
        const dc = (tile.dangerCounter ?? cur.beastDangerStart) - 1;
        if (dc <= 0) {
          for (const [nr, nc] of neighbors8(r, c, ROWS, COLS)) {
            grid[nr][nc] = null;
          }
          grid[r][c] = null;
          scoreDelta -= RAMPAGE_PENALTY;
        } else {
          const orth: Array<[number, number]> = [
            [r - 1, c],
            [r + 1, c],
            [r, c - 1],
            [r, c + 1],
          ].filter(
            ([rr, cc]) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS
          ) as Array<[number, number]>;
          let target: { r: number; c: number; v: number } | null = null;
          for (const [rr, cc] of orth) {
            const t2 = grid[rr][cc];
            if (t2 === null || t2.beast) continue;
            if (target === null || t2.value < target.v) {
              target = { r: rr, c: cc, v: t2.value };
            }
          }
          if (target) grid[target.r][target.c] = null;
          grid[r][c] = { ...tile, dangerCounter: dc };
        }
      }
      grid = applyGravity(grid);
    }

    let beastInterval = cur.beastInterval;
    let beastDangerStart = cur.beastDangerStart;
    let levelsClearedSnapshot = cur.levelsClearedSnapshot;
    if (state.levelsCleared > cur.levelsClearedSnapshot) {
      const delta = state.levelsCleared - cur.levelsClearedSnapshot;
      beastInterval = Math.max(MIN_BEAST_INTERVAL, beastInterval - delta);
      const prevDangerBucket = Math.floor(cur.levelsClearedSnapshot / 3);
      const nextDangerBucket = Math.floor(state.levelsCleared / 3);
      if (nextDangerBucket > prevDangerBucket) {
        const dangerSteps = nextDangerBucket - prevDangerBucket;
        beastDangerStart = Math.max(MIN_DANGER, beastDangerStart - 0.5 * dangerSteps);
      }
      levelsClearedSnapshot = state.levelsCleared;
    }

    const movesUntilBeast =
      cur.movesUntilBeast <= 1 ? beastInterval : cur.movesUntilBeast - 1;
    const frenzyRemaining = Math.max(0, cur.frenzyRemaining - 1);

    const activeBeastIds: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = grid[r][c];
        if (t?.beast) activeBeastIds.push(t.id);
      }
    }

    const trophyAge = cur.lastTrophyFlash
      ? state.moves - cur.lastTrophyFlash.movesAt
      : Infinity;
    const lastTrophyFlash = trophyAge > 1 ? null : cur.lastTrophyFlash;

    const updates: Partial<GameState> = {
      modeState: {
        ...cur,
        movesUntilBeast,
        beastInterval,
        beastDangerStart,
        frenzyRemaining,
        activeBeastIds,
        freshBeastIds: [],
        levelsClearedSnapshot,
        lastTrophyFlash,
      },
    };
    if (scoreDelta !== 0) updates.score = state.score + scoreDelta;
    if (grid !== state.grid) updates.grid = grid;
    return updates;
  },

  hudLabel: (state) => {
    if (state.modeState.kind !== "wilds") return "";
    const cur = state.modeState;
    if (cur.frenzyRemaining > 0) return `FRENZY · ${cur.frenzyRemaining} spawns left`;
    return `Beast in ${cur.movesUntilBeast} · Spirit ${cur.spirit}/${SPIRIT_CAP}`;
  },
};

// Player-triggered: spends 5 spirit; converts up to 3 random low-value tiles into wilds.
export function applySpiritWave(state: GameState): GameState {
  if (state.modeState.kind !== "wilds") return state;
  const cur = state.modeState;
  if (cur.spirit < SPIRIT_WAVE_COST) return state;

  const candidates: { r: number; c: number; value: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = state.grid[r][c];
      if (t && !t.wild && !t.beast) candidates.push({ r, c, value: t.value });
    }
  }
  if (candidates.length === 0) return state;

  candidates.sort((a, b) => a.value - b.value);
  const lowestValue = candidates[0].value;
  const lowest = candidates.filter((cd) => cd.value <= lowestValue * 2);

  let rngState = state.rngState;
  const picks: { r: number; c: number }[] = [];
  const pool = [...lowest];
  for (let i = 0; i < SPIRIT_WAVE_TILE_COUNT && pool.length > 0; i++) {
    const roll = rngStep(rngState);
    rngState = roll.state;
    const idx = Math.floor(roll.value * pool.length) % pool.length;
    picks.push(pool[idx]);
    pool.splice(idx, 1);
  }

  const newGrid: Grid = state.grid.map((row) => row.slice());
  for (const { r, c } of picks) {
    const t = newGrid[r][c];
    if (t) newGrid[r][c] = { ...t, wild: true };
  }

  const newSpirit = cur.spirit - SPIRIT_WAVE_COST;
  const newUndoStack = [...state.undoStack, snapshotForUndo(state)].slice(-3);

  return {
    ...state,
    grid: newGrid,
    rngState,
    modeState: { ...cur, spirit: newSpirit },
    undoStack: newUndoStack,
  };
}

function snapshotForUndo(state: GameState) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { undoStack, undoCharges, ...rest } = state;
  return rest;
}

export const WILDS_CONSTANTS = {
  SPIRIT_CAP,
  SPIRIT_WAVE_COST,
  SPIRIT_FRENZY_THRESHOLD,
  FRENZY_DURATION,
  MIN_CHAIN_FOR_BEAST,
};
