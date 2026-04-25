import { rngStep } from "./rng";
import { neighbors8, neighbors4 } from "./chain";
import { countPairs } from "./rules";
import { COLS, POOL_SIZE, ROWS } from "./types";
import type { Grid, SpawnAlgo, Tile } from "./types";

export const DEFAULT_WEIGHTS = [0.4, 0.3, 0.2, 0.1];

// Default antiPair strength. Now a per-game value (state.strength), but kept as a
// constant default for callers that don't want to thread it through.
export const DEFAULT_STRENGTH = 2.5;
export const DEFAULT_SOFTNESS = 0;
// Adversarial sampler: how many top-hostility candidates compete in the softmax.
// K=3 keeps the spawn focused on punishing values without becoming deterministic.
export const DEFAULT_TOPK = 3;

export function spawnPool(peak: number, floor?: number, size: number = POOL_SIZE): number[] {
  const n = Math.max(1, Math.floor(size));
  if (floor !== undefined) {
    const bottom = Math.max(2, floor);
    // Cap the pool apex at the same level as the non-floor path so peak governs
    // the maximum spawnable value — not floor × 2^(size-1). This prevents
    // runaway million-value tiles from appearing before the player has earned them.
    const max = Math.max(bottom * 2, Math.max(16, peak / 2));
    const top = Math.floor(Math.log2(max));
    const pool: number[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const v = 2 ** (top - i);
      pool.push(Math.max(v, bottom));
    }
    return pool;
  }
  // Default-4 behavior: top = log2(max(16, peak/2)) and pool = [top-3..top].
  // Generalised: keep the same `top` so apex stays peak-relative, and extend
  // downward as size grows (pool floors out at 2 if it would drop below).
  const max = Math.max(16, peak / 2);
  const top = Math.log2(max);
  const pool: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const v = 2 ** (top - i);
    pool.push(v >= 2 ? v : 2);
  }
  return pool;
}

// Weight curve. For size <= 4 we preserve the historical
// [0.4, 0.3, 0.2, 0.1] shape exactly. For larger pools we extend the geometric
// tail so additional smaller values get progressively lower weight, then
// renormalise. (Weight curves are intentionally a follow-up tuning concern;
// this just keeps things sensible while we measure.)
export function spawnWeights(size: number = POOL_SIZE): number[] {
  const n = Math.max(1, Math.floor(size));
  if (n <= DEFAULT_WEIGHTS.length) {
    const sliced = DEFAULT_WEIGHTS.slice(0, n);
    const total = sliced.reduce((a, b) => a + b, 0) || 1;
    return sliced.map((w) => w / total);
  }
  const raw = [...DEFAULT_WEIGHTS];
  let last = raw[raw.length - 1];
  while (raw.length < n) {
    last = last * 0.7;
    raw.push(last);
  }
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((w) => w / total);
}

function landingRow(grid: Grid, col: number): number {
  for (let r = 0; r < ROWS; r++) {
    if (grid[r][col] === null) return r;
  }
  return 0;
}

function pairMatchCount(grid: Grid, r: number, c: number, candidate: number): number {
  let matches = 0;
  for (const [nr, nc] of neighbors8(r, c, ROWS, COLS)) {
    const nt = grid[nr][nc];
    if (!nt) continue;
    const v = nt.value;
    if (v === candidate || v === candidate * 2 || v === candidate / 2) matches++;
  }
  return matches;
}

function singletonCount(grid: Grid, value: number): number {
  let n = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (!t || t.value !== value) continue;
      const hasPartner = neighbors4(r, c, ROWS, COLS).some(([nr, nc]) => grid[nr][nc]?.value === value);
      if (!hasPartner) n++;
    }
  }
  return n;
}

export function pairingBiasWeights(
  grid: Grid,
  col: number,
  peak: number,
  strength: number,
  floor?: number
): { pool: number[]; weights: number[]; landingRow: number } {
  const pool = spawnPool(peak, floor);
  const base = spawnWeights(pool.length);
  const r = landingRow(grid, col);
  const raw = pool.map((v, i) => base[i] * (1 + strength * singletonCount(grid, v)));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  return { pool, weights: raw.map((w) => w / sum), landingRow: r };
}

export function boardAwareWeights(
  grid: Grid,
  col: number,
  peak: number,
  strength: number = DEFAULT_STRENGTH,
  floor?: number
): { pool: number[]; weights: number[]; landingRow: number } {
  const pool = spawnPool(peak, floor);
  const base = spawnWeights(pool.length);
  const r = landingRow(grid, col);
  const raw: number[] = pool.map((v, i) =>
    base[i] / (1 + strength * pairMatchCount(grid, r, col, v))
  );
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const weights = raw.map((w) => w / sum);
  return { pool, weights, landingRow: r };
}

export function sampleFrom(
  pool: number[],
  weights: number[],
  rngState: number
): { value: number; rngState: number } {
  const { value: r, state } = rngStep(rngState);
  let acc = 0;
  for (let i = 0; i < pool.length; i++) {
    acc += weights[i];
    if (r < acc) return { value: pool[i], rngState: state };
  }
  return { value: pool[pool.length - 1], rngState: state };
}

export function sampleSpawn(
  peak: number,
  rngState: number,
  floor?: number
): { value: number; rngState: number } {
  return sampleFrom(spawnPool(peak, floor), spawnWeights(), rngState);
}

// Hostility score: lower = worse for the player. Weights `chainStarts` heavier than
// `extensions` because starts are the game-over gate (when they hit 0, you lose).
export function hostilityScore(grid: Grid): number {
  const { starts, extensions } = countPairs(grid);
  return starts + 0.5 * extensions;
}

// Given a landing cell, simulate each pool value and pick the one that minimizes
// the resulting hostility. Fully deterministic; consumes no RNG. Tiebreaks by pool order.
export function pickAdversarial(
  grid: Grid,
  col: number,
  peak: number,
  floor?: number
): { value: number; score: number; scores: number[] } {
  const pool = spawnPool(peak, floor);
  const r = landingRow(grid, col);
  const scores: number[] = [];
  let bestIdx = 0;
  let bestScore = Infinity;
  // Mutate in place for speed, restore after.
  const saved = grid[r][col];
  for (let i = 0; i < pool.length; i++) {
    const v = pool[i];
    grid[r][col] = { id: -1, value: v } as Tile;
    const s = hostilityScore(grid);
    scores.push(s);
    if (s < bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  grid[r][col] = saved;
  return { value: pool[bestIdx], score: bestScore, scores };
}

export function sampleByAlgo(
  algo: SpawnAlgo,
  peak: number,
  rngState: number,
  grid: Grid | null,
  col: number,
  strength: number = DEFAULT_STRENGTH,
  softness: number = DEFAULT_SOFTNESS,
  floor?: number,
  pairingStrength: number = 0
): { value: number; rngState: number } {
  if (algo === "weighted" && pairingStrength > 0 && grid) {
    const { pool, weights } = pairingBiasWeights(grid, col, peak, pairingStrength, floor);
    return sampleFrom(pool, weights, rngState);
  }
  if (algo === "antiPair" && grid) {
    const { pool, weights } = boardAwareWeights(grid, col, peak, strength, floor);
    return sampleFrom(pool, weights, rngState);
  }
  if (algo === "adversarial" && grid) {
    let state = rngState;
    if (softness > 0) {
      const roll = rngStep(state);
      state = roll.state;
      if (roll.value < softness) {
        return sampleSpawn(peak, state, floor);
      }
    }
    const { scores } = pickAdversarial(grid, col, peak, floor);
    const pool = spawnPool(peak, floor);
    // Softmax over the top-K candidates (lower hostility score = more punishing
    // = higher sampling weight). K=DEFAULT_TOPK; ties break deterministically.
    const ranked = scores
      .map((s, i) => ({ s, i }))
      .sort((a, b) => a.s - b.s)
      .slice(0, Math.min(DEFAULT_TOPK, pool.length));
    const minS = ranked[0].s;
    const raw = ranked.map((r) => Math.exp(-(r.s - minS)));
    const total = raw.reduce((a, b) => a + b, 0) || 1;
    const weights = raw.map((w) => w / total);
    const { value: r, state: nextState } = rngStep(state);
    state = nextState;
    let acc = 0;
    for (let k = 0; k < ranked.length; k++) {
      acc += weights[k];
      if (r < acc) return { value: pool[ranked[k].i], rngState: state };
    }
    return { value: pool[ranked[ranked.length - 1].i], rngState: state };
  }
  return sampleSpawn(peak, rngState, floor);
}

export function makeSpawnQueue(
  cols: number,
  queueLen: number,
  peak: number,
  rngState: number,
  algo: SpawnAlgo = "weighted",
  grid: Grid | null = null,
  strength: number = DEFAULT_STRENGTH,
  softness: number = DEFAULT_SOFTNESS,
  floor?: number,
  pairingStrength: number = 0
): { queue: number[][]; rngState: number } {
  let state = rngState;
  const queue: number[][] = [];
  for (let c = 0; c < cols; c++) {
    const col: number[] = [];
    for (let i = 0; i < queueLen; i++) {
      const r = sampleByAlgo(algo, peak, state, grid, c, strength, softness, floor, pairingStrength);
      col.push(r.value);
      state = r.rngState;
    }
    queue.push(col);
  }
  return { queue, rngState: state };
}

export function takeSpawn(
  queue: number[][],
  col: number,
  peak: number,
  rngState: number,
  algo: SpawnAlgo = "weighted",
  grid: Grid | null = null,
  strength: number = DEFAULT_STRENGTH,
  softness: number = DEFAULT_SOFTNESS,
  floor?: number,
  pairingStrength: number = 0
): { value: number; queue: number[][]; rngState: number } {
  const newQueue = queue.map((q, i) => (i === col ? q.slice() : q));
  let value: number;
  let state = rngState;
  if (newQueue[col].length > 0) {
    const popped = newQueue[col].shift() as number;
    // Pre-rolled queue values can become invalid if the floor has risen since
    // they were sampled (Rising Floor floor rise, Hard Mode ratchet). Drop any
    // popped value that's now below the floor and sample a fresh replacement.
    if (floor !== undefined && popped < floor) {
      const r = sampleByAlgo(algo, peak, state, grid, col, strength, softness, floor, pairingStrength);
      value = r.value;
      state = r.rngState;
    } else {
      value = popped;
    }
  } else {
    const r = sampleByAlgo(algo, peak, state, grid, col, strength, softness, floor, pairingStrength);
    value = r.value;
    state = r.rngState;
  }
  if (algo === "weighted") {
    const r = sampleByAlgo(algo, peak, state, grid, col, strength, softness, floor, pairingStrength);
    newQueue[col].push(r.value);
    state = r.rngState;
  }
  return { value, queue: newQueue, rngState: state };
}
