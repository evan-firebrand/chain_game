import { COLS, POOL_SIZE, ROWS } from "./types";
import type { Grid, SpawnAlgo, Tile } from "./types";
import { DEFAULT_SOFTNESS, DEFAULT_STRENGTH, sampleByAlgo, sampleFrom, spawnWeights, takeSpawn } from "./spawn";
import { getModifier } from "./modifiers";

export function makeEmptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));
}

// Seed the initial board bottom-up from 2, capped at 64, using the configured pool size.
// Pool size=4 → [2,4,8,16] (unchanged); pool size=10 → [2,4,8,16,32,64,64,64,64,64].
export function makeInitialGrid(
  rngState: number,
  startingTileId = 1
): { grid: Grid; rngState: number; nextTileId: number } {
  const grid = makeEmptyGrid();
  let state = rngState;
  let nextId = startingTileId;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const seedPool = Array.from({ length: POOL_SIZE }, (_, i) => Math.min(2 * 2 ** i, 64));
      const res = sampleFrom(seedPool, spawnWeights(POOL_SIZE), state);
      grid[r][c] = { id: nextId++, value: res.value };
      state = res.rngState;
    }
  }
  return { grid, rngState: state, nextTileId: nextId };
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.slice());
}

// Compact non-null tiles to the bottom of each column, preserving tile identity.
export function applyGravity(grid: Grid): Grid {
  const next = cloneGrid(grid);
  for (let c = 0; c < COLS; c++) {
    // Anchored tiles stay in place; non-anchored tiles fall around them.
    const anchored: Array<{ r: number; tile: Tile }> = [];
    const falling: Tile[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      const v = next[r][c];
      if (v === null) continue;
      if (getModifier(v)?.ignoresGravity?.(v)) anchored.push({ r, tile: v });
      else falling.push(v);
    }
    const anchorRows = new Set(anchored.map((a) => a.r));
    for (let r = 0; r < ROWS; r++) next[r][c] = null;
    for (const a of anchored) next[a.r][c] = a.tile;
    let idx = 0;
    for (let r = ROWS - 1; r >= 0 && idx < falling.length; r--) {
      if (anchorRows.has(r)) continue;
      next[r][c] = falling[idx++];
    }
  }
  return next;
}

export type SpawnRecord = { id: number; value: number; r: number; c: number; flags?: Partial<Tile> };

export type DecorateCallback = (ctx: {
  r: number;
  c: number;
  value: number;
  rngState: number;
}) => { flags: Partial<Tile>; rngState: number };

// After gravity, fill remaining nulls (always at the top) by taking from spawn queue.
// Stamps each new tile with a fresh id. For antiPair mode, re-buffers the queue tail
// against the post-refill grid so the visible preview stays accurate. The optional
// `decorate` callback lets the active mode flag fresh spawns (boost, wild, …).
export function refillFromQueue(
  grid: Grid,
  queue: number[][],
  peak: number,
  rngState: number,
  startingTileId: number,
  algo: SpawnAlgo = "weighted",
  strength: number = DEFAULT_STRENGTH,
  softness: number = DEFAULT_SOFTNESS,
  floor?: number,
  decorate?: DecorateCallback,
  pairingStrength: number = 0
): { grid: Grid; queue: number[][]; rngState: number; nextTileId: number; spawns: SpawnRecord[] } {
  const next = cloneGrid(grid);
  let q = queue;
  let state = rngState;
  let nextId = startingTileId;
  const spawns: SpawnRecord[] = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (next[r][c] === null) {
        const res = takeSpawn(q, c, peak, state, algo, next, strength, softness, floor, pairingStrength);
        state = res.rngState;
        let flags: Partial<Tile> = {};
        if (decorate) {
          const decorated = decorate({ r, c, value: res.value, rngState: state });
          flags = decorated.flags;
          state = decorated.rngState;
        }
        const id = nextId++;
        const tile: Tile = { id, value: res.value, ...flags };
        next[r][c] = tile;
        spawns.push({
          id,
          value: tile.value,
          r,
          c,
          ...(Object.keys(flags).length > 0 ? { flags } : {}),
        });
        q = res.queue;
      } else {
        break;
      }
    }
    if (algo === "antiPair") {
      const res = sampleByAlgo(algo, peak, state, next, c, strength, softness, floor, pairingStrength);
      q = q.map((col, i) => (i === c ? [res.value] : col));
      state = res.rngState;
    }
  }
  return { grid: next, queue: q, rngState: state, nextTileId: nextId, spawns };
}

export function computePeak(grid: Grid): number {
  let peak = 2;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (t !== null && t.value > peak) peak = t.value;
    }
  }
  return peak;
}

export function tileHistogram(grid: Grid): Record<number, number> {
  const hist: Record<number, number> = {};
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (t === null) continue;
      hist[t.value] = (hist[t.value] ?? 0) + 1;
    }
  }
  return hist;
}
