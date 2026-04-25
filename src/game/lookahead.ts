import { neighbors8 } from "./chain";
import { planCommit } from "./engine";
import { COLS, ROWS } from "./types";
import type { Coord, GameState, Grid } from "./types";

// Caps on enumeration to keep the lookahead tractable on dense same-value boards.
// Real gameplay rarely approaches these limits — they're a safety valve.
const MAX_CHAIN_LEN = 8;
const MAX_CHAINS = 500;

// Enumerate legal chains on `grid` up to the caps above. Each prefix of length ≥ 2
// is emitted (player could commit at that length). Bails out cleanly once the
// chain cap is hit; callers treat the returned list as "a sample" in that case.
export function enumerateLegalChains(grid: Grid): Coord[][] {
  const out: Coord[][] = [];
  outer: for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (t === null) continue;
      for (const [nr, nc] of neighbors8(r, c, ROWS, COLS)) {
        const nt = grid[nr][nc];
        if (nt === null || nt.value !== t.value) continue;
        const path: Coord[] = [{ r, c }, { r: nr, c: nc }];
        out.push(path.slice());
        if (out.length >= MAX_CHAINS) break outer;
        extend(grid, path, out);
        if (out.length >= MAX_CHAINS) break outer;
      }
    }
  }
  return out;
}

function extend(grid: Grid, path: Coord[], out: Coord[][]): void {
  if (out.length >= MAX_CHAINS) return;
  if (path.length >= MAX_CHAIN_LEN) return;
  const tip = path[path.length - 1];
  const tipVal = (grid[tip.r][tip.c] as { value: number }).value;
  const visited = new Set(path.map((p) => p.r * COLS + p.c));
  for (const [nr, nc] of neighbors8(tip.r, tip.c, ROWS, COLS)) {
    if (visited.has(nr * COLS + nc)) continue;
    const nt = grid[nr][nc];
    if (nt === null) continue;
    if (nt.value !== tipVal && nt.value !== tipVal * 2) continue;
    path.push({ r: nr, c: nc });
    out.push(path.slice());
    if (out.length >= MAX_CHAINS) return;
    extend(grid, path, out);
    path.pop();
  }
}

function tileOnGrid(grid: Grid, tileId: number): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c]?.id === tileId) return true;
    }
  }
  return false;
}

// Can the tile with `tileId` be consumed by some sequence of at most `depth`
// legal chain commits starting from `state`? Consumption just means "tile
// disappears from the board" — in the chain rules, every tile in a committed
// path is consumed (the result tile has a fresh id at the landing position).
//
// K=1: true iff the tile is in any legal chain path right now.
// K=2: also true if there's a chain we can commit first that creates a new
// chain which then consumes the tile.
//
// Caller is responsible for bounding depth (2 is the sweet spot — see plan).
export function canBeConsumed(state: GameState, tileId: number, depth: number): boolean {
  if (depth <= 0) return false;
  if (!tileOnGrid(state.grid, tileId)) return true;

  const chains = enumerateLegalChains(state.grid);
  for (const path of chains) {
    const consumes = path.some(({ r, c }) => state.grid[r][c]?.id === tileId);
    if (consumes) return true;
    if (depth > 1) {
      const plan = planCommit(state, path);
      if (plan && canBeConsumed(plan.finalState, tileId, depth - 1)) {
        return true;
      }
    }
  }
  return false;
}
