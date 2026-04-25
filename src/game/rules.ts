import { COLS, ROWS } from "./types";
import type { Grid } from "./types";
import { neighbors4 } from "./chain";
import { spawnPool } from "./spawn";
import { getModifier } from "./modifiers";

function canStart(tile: { value: number } & Record<string, unknown>): boolean {
  const mod = getModifier(tile as never);
  return mod?.canChainStart ? mod.canChainStart(tile as never) : true;
}
function canThrough(tile: { value: number } & Record<string, unknown>): boolean {
  const mod = getModifier(tile as never);
  return mod?.canChainThrough ? mod.canChainThrough(tile as never) : true;
}

// Pairs of adjacent tiles, split by how they can be used in a chain:
// - starts: adjacent tiles with equal values. These can BEGIN a chain.
//           When starts === 0, the game is over (you can't start anything).
// - extensions: adjacent tiles where one is exactly double the other.
//           Only usable after a chain is already started.
export function countPairs(grid: Grid): {
  starts: number;
  extensions: number;
  breakdown: Record<string, number>;
} {
  let starts = 0;
  let extensions = 0;
  const breakdown: Record<string, number> = {};
  const seen = new Set<string>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (t === null) continue;
      if (!canStart(t) && !canThrough(t)) continue;
      const v = t.value;
      for (const [nr, nc] of neighbors4(r, c, ROWS, COLS)) {
        const nt = grid[nr][nc];
        if (nt === null) continue;
        if (!canStart(nt) && !canThrough(nt)) continue;
        const nv = nt.value;
        const equal = nv === v;
        const doubled = nv === v * 2 || v === nv * 2;
        if (!equal && !doubled) continue;
        const k = [
          Math.min(r * COLS + c, nr * COLS + nc),
          Math.max(r * COLS + c, nr * COLS + nc),
        ].join("-");
        if (seen.has(k)) continue;
        seen.add(k);
        if (equal) {
          starts++;
          breakdown[`${v}=${v}`] = (breakdown[`${v}=${v}`] ?? 0) + 1;
        } else {
          extensions++;
          breakdown[`${Math.min(v, nv)}x2`] =
            (breakdown[`${Math.min(v, nv)}x2`] ?? 0) + 1;
        }
      }
    }
  }
  return { starts, extensions, breakdown };
}

// Tiles with no equal-value orthogonal neighbor: they can't start a chain on their own.
export function findIsolatedTiles(grid: Grid): Set<number> {
  const isolated = new Set<number>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (!t) continue;
      const hasPartner = neighbors4(r, c, ROWS, COLS).some(([nr, nc]) => grid[nr][nc]?.value === t.value);
      if (!hasPartner) isolated.add(t.id);
    }
  }
  return isolated;
}

// Game over when no two adjacent tiles are equal — you can't start a chain.
export function hasAnyValidMove(grid: Grid): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (t === null) continue;
      if (!canStart(t)) continue;
      for (const [nr, nc] of neighbors4(r, c, ROWS, COLS)) {
        const nt = grid[nr][nc];
        if (nt !== null && canStart(nt) && nt.value === t.value) return true;
      }
    }
  }
  return false;
}

// True if a tile of `resultValue` landing on the board (with `chainPath` removed)
// would have no chainable partner anywhere — no other tile with equal, double, or
// half value. Surfaced during chain preview to warn about "chain overshoot" moves
// that create an orphan.
export function willResultBeOrphan(
  grid: Grid,
  chainPath: Array<{ r: number; c: number }>,
  resultValue: number
): boolean {
  const excluded = new Set(chainPath.map(({ r, c }) => r * COLS + c));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (excluded.has(r * COLS + c)) continue;
      const t = grid[r][c];
      if (t === null) continue;
      if (
        t.value === resultValue ||
        t.value === resultValue * 2 ||
        resultValue === t.value * 2
      ) {
        return false;
      }
    }
  }
  return true;
}

// Adjacent column range clamped to board bounds. Used wherever logic depends
// on column-distance ≤ 1 (gravity is vertical-only, so columns ≥ 2 apart can
// never become adjacent).
function colRange(c: number): [number, number] {
  return [Math.max(0, c - 1), Math.min(COLS - 1, c + 1)];
}

function hasBoardMatchInColRange(grid: Grid, r: number, c: number, value: number): boolean {
  const [cMin, cMax] = colRange(c);
  for (let r2 = 0; r2 < ROWS; r2++) {
    for (let c2 = cMin; c2 <= cMax; c2++) {
      if (r2 === r && c2 === c) continue;
      const other = grid[r2][c2];
      if (other && other.value === value) return true;
    }
  }
  return false;
}

// Fragile tiles — tiles at real risk of being stranded by the next floor rise.
// A tile is fragile iff (a) its value will be pushed out of the spawn pool at the
// next rise (value < nextFloor), AND (b) it has no equal-value partner within
// column-distance 1 right now. Tiles that already have a nearby partner will
// pair up normally — they're not fragile even if their value is low.
export function findFragileTiles(grid: Grid, nextFloor: number): Set<number> {
  const fragile = new Set<number>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (t === null) continue;
      if (t.value >= nextFloor) continue;
      if (!hasBoardMatchInColRange(grid, r, c, t.value)) fragile.add(t.id);
    }
  }
  return fragile;
}

// Truly dead tiles — tiles that can never leave the board no matter what the
// player does. A tile of value V is truly dead when ALL of these hold:
//   1. V is not in the current spawn pool — no future spawn produces V.
//   2. V does not appear in the visible queue for any column within distance 1
//      of this tile's column.
//   3. No other tile on the board has value V within column-distance ≤ 1 (the
//      column constraint exists because gravity is vertical-only — tiles in
//      columns ≥ 2 apart can never become adjacent).
//
// This is the K=1 check. K=2 rescue detection (extension paths, blocker clears)
// lives in the lookahead module and runs only for K=1 "dead" candidates.
export function findDeadTiles(
  grid: Grid,
  spawnFloor: number | undefined,
  peak: number,
  queue: number[][]
): Set<number> {
  const dead = new Set<number>();
  const pool = new Set(spawnPool(peak, spawnFloor));

  // Precompute queue values per column for cheap column-range lookup.
  const queueByCol: Array<Set<number>> = queue.map((col) => new Set(col));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (t === null) continue;
      const V = t.value;

      // (1) Future spawns can produce V → not dead.
      if (pool.has(V)) continue;

      // (2) Queue contains V within column-distance 1 → not dead.
      const [cMin, cMax] = colRange(c);
      let queueRescue = false;
      for (let qc = cMin; qc <= cMax; qc++) {
        if (queueByCol[qc].has(V)) {
          queueRescue = true;
          break;
        }
      }
      if (queueRescue) continue;

      // (3) Another board tile of value V within column-distance 1 → not dead.
      if (hasBoardMatchInColRange(grid, r, c, V)) continue;

      dead.add(t.id);
    }
  }
  return dead;
}
