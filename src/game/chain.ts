import type { Tile } from "./types";
import { getModifier } from "./modifiers";

// Smallest power of 2 >= sum of chain values. Used to compute the merge result.
export function mergeValue(chain: number[]): number {
  const sum = chain.reduce((a, b) => a + b, 0);
  if (sum <= 1) return 2;
  const exp = Math.ceil(Math.log2(sum));
  return 2 ** exp;
}

// Resolve each chain tile to the value it contributes to the merge sum. For
// wilds, the effective value is determined by its neighbors. Falls back to the
// tile's own value when a wild has no neighbors to anchor it.
export function effectiveChainValues(chain: Tile[]): number[] {
  return chain.map((tile, i) => {
    if (!tile.wild) return tile.value;
    if (chain.length === 1) return 2;
    if (i === 0) {
      const next = chain[1];
      return next.wild ? 2 : next.value;
    }
    const prevTile = chain[i - 1];
    const prev = prevTile.wild ? 2 : prevTile.value;
    if (i === chain.length - 1) {
      return prev;
    }
    const nextTile = chain[i + 1];
    const next = nextTile.wild ? prev : nextTile.value;
    if (next === 4 * prev) return 2 * prev;
    return prev;
  });
}

function countWilds(chain: Tile[]): number {
  let n = 0;
  for (const t of chain) if (t.wild) n++;
  return n;
}

// Can `nextTile` be appended to the current chain?
// - Step 1 (extending a 1-tile chain): next must EQUAL the starting tile.
// - Step 2+: next must equal OR be exactly double the PREVIOUS tile.
// Wilds substitute for any value the rule allows; only one wild per chain.
export function isValidAppend(chain: Tile[], nextTile: Tile): boolean {
  if (chain.length === 0) {
    const mod = getModifier(nextTile);
    if (mod?.canChainStart && !mod.canChainStart(nextTile)) return false;
    return true;
  }
  const nextMod = getModifier(nextTile);
  if (nextMod?.canChainThrough && !nextMod.canChainThrough(nextTile)) return false;
  if (nextTile.wild && countWilds(chain) >= 1) return false;

  const lastTile = chain[chain.length - 1];

  if (chain.length === 1) {
    if (lastTile.wild || nextTile.wild) return true;
    return nextTile.value === lastTile.value;
  }

  if (lastTile.wild) {
    const wildPos = chain.length - 1;
    if (wildPos === 1) {
      const V = chain[0].value;
      return nextTile.value === V || nextTile.value === 2 * V;
    }
    const prev = chain[wildPos - 1].value;
    return (
      nextTile.value === prev ||
      nextTile.value === 2 * prev ||
      nextTile.value === 4 * prev
    );
  }

  if (nextTile.wild) return true;

  const last = lastTile.value;
  return nextTile.value === last || nextTile.value === 2 * last;
}

export function neighbors8(r: number, c: number, rows: number, cols: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc]);
    }
  }
  return out;
}

// Orthogonal-only adjacency. Used by the game-over gate so the terminal state
// fires when no horizontal/vertical pair exists, even if diagonal chains remain
// possible. Tighter than neighbors8 — the intent is to make games actually end.
export function neighbors4(r: number, c: number, rows: number, cols: number): [number, number][] {
  const out: [number, number][] = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < rows - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < cols - 1) out.push([r, c + 1]);
  return out;
}
