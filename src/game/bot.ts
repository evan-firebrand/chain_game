import { newGame, planCommit } from "./engine";
import { neighbors8, isValidAppend, mergeValue } from "./chain";
import { COLS, ROWS, configureBoard, getBoardConfig } from "./types";
import type { Coord, GameMode, GameState, Grid, SpawnAlgo, Tile } from "./types";
import { DEFAULT_SOFTNESS, DEFAULT_STRENGTH } from "./spawn";
import { randomSeed } from "./rng";
import { getMode } from "./modes";
import { WILDS_CONSTANTS } from "./modes/wilds";

export type BotPolicy = "greedy" | "lookahead1" | "random" | "expectimax2";

// How a runBot loop terminated. Distinguishes a real game-over (engine said no
// valid moves) from running into the move cap, the bot finding no chain, or
// planCommit rejecting one — three things that older harness code conflated
// under "gameOver%".
export type TerminationReason =
  | "gameOver"      // engine said state.gameOver
  | "moveCapReached" // hit maxMoves
  | "noChainFound"  // bot returned null/<2 path
  | "invalidCommit"; // planCommit returned null

const MAX_DEPTH = 5;
const LOOKAHEAD_K = 8;
const LOOKAHEAD_DISCOUNT = 0.9;

function keyOf(r: number, c: number): number {
  return r * COLS + c;
}

type CandidateChain = { path: Coord[]; score: number };

type ScoreChain = (path: Coord[], values: number[], tiles: Tile[]) => number;

function defaultScorer(path: Coord[], values: number[]): number {
  return mergeValue(values) * path.length;
}

function dfsAll(
  grid: Grid,
  path: Coord[],
  values: number[],
  tiles: Tile[],
  used: Set<number>,
  out: CandidateChain[],
  score: ScoreChain
): void {
  if (path.length >= 2) {
    out.push({ path: path.slice(), score: score(path, values, tiles) });
  }
  if (path.length >= MAX_DEPTH) return;
  const last = path[path.length - 1];
  for (const [nr, nc] of neighbors8(last.r, last.c, ROWS, COLS)) {
    const k = keyOf(nr, nc);
    if (used.has(k)) continue;
    const nt = grid[nr][nc];
    if (!nt) continue;
    if (!isValidAppend(tiles, nt)) continue;
    used.add(k);
    path.push({ r: nr, c: nc });
    values.push(nt.value);
    tiles.push(nt);
    dfsAll(grid, path, values, tiles, used, out, score);
    used.delete(k);
    path.pop();
    values.pop();
    tiles.pop();
  }
}

function enumerateAll(grid: Grid, score: ScoreChain = defaultScorer): CandidateChain[] {
  const out: CandidateChain[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (!t) continue;
      const start: Coord = { r, c };
      const used = new Set<number>([keyOf(r, c)]);
      dfsAll(grid, [start], [t.value], [t], used, out, score);
    }
  }
  return out;
}

// Mode-aware scorer: bakes in the mode's chainMultiplier and beast urgency (Wilds).
function makeModeScorer(mode: GameMode, state?: GameState): ScoreChain {
  const behavior = getMode(mode);
  const mult = behavior.chainMultiplier;
  return (path, values, tiles) => {
    const base = mergeValue(values) * (mult ? mult(tiles, state as GameState) : 1) * path.length;
    if (mode === "wilds" && state) {
      const beastTiles = tiles.filter((t) => t.beast);
      if (beastTiles.length > 0 && path.length >= WILDS_CONSTANTS.MIN_CHAIN_FOR_BEAST) {
        // Urgency bonus: scales from 1× (danger=6) to 6× (danger=1) times 10×peak.
        const minDanger = Math.min(...beastTiles.map((t) => t.dangerCounter ?? 6));
        const urgencyFactor = Math.max(1, 7 - minDanger);
        return base + state.peak * 10 * urgencyFactor;
      }
    }
    return base;
  };
}

// Returns false for chains the mode would reject (e.g. beast in chain < 3).
function isChainCommittable(path: Coord[], tiles: Tile[], mode: GameMode): boolean {
  if (mode === "wilds" && tiles.some((t) => t.beast) && path.length < WILDS_CONSTANTS.MIN_CHAIN_FOR_BEAST) {
    return false;
  }
  return true;
}

export function pickBestChainGreedy(grid: Grid, mode: GameMode = "classic", state?: GameState): Coord[] | null {
  let best: CandidateChain | null = null;
  const all = enumerateAll(grid, makeModeScorer(mode, state));
  for (const c of all) {
    const tiles = c.path.map(({ r, c: col }) => grid[r][col] as Tile);
    if (!isChainCommittable(c.path, tiles, mode)) continue;
    if (!best || c.score > best.score) best = c;
  }
  return best?.path ?? null;
}

// Back-compat alias for anything that imported the old name.
export const pickBestChain = pickBestChainGreedy;

// One-ply lookahead: for each of the top-K immediate chains, simulate the commit
// and score the best follow-up on the resulting board. Pick the argmax of
// immediate + DISCOUNT * followup. A move that leaves gameOver scores 0 follow-up.
export function pickBestChainLookahead(state: GameState): Coord[] | null {
  const scorer = makeModeScorer(state.mode, state);
  const candidates = enumerateAll(state.grid, scorer).filter((c) => {
    const tiles = c.path.map(({ r, c: col }) => state.grid[r][col] as Tile);
    return isChainCommittable(c.path, tiles, state.mode);
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const topK = candidates.slice(0, LOOKAHEAD_K);

  let best: { path: Coord[]; total: number } | null = null;
  for (const cand of topK) {
    const plan = planCommit(state, cand.path);
    if (!plan) continue;
    let followup = 0;
    if (!plan.finalState.gameOver) {
      const followPath = pickBestChainGreedy(plan.finalState.grid, plan.finalState.mode, plan.finalState);
      if (followPath) {
        const followTiles = followPath.map(
          ({ r, c }) => plan.finalState.grid[r][c] as Tile
        );
        const vals = followTiles.map((t) => t.value);
        followup = scorer(followPath, vals, followTiles);
      }
    }
    const total = cand.score + LOOKAHEAD_DISCOUNT * followup;
    if (!best || total > best.total) {
      best = { path: cand.path, total };
    }
  }
  return best?.path ?? null;
}

// Bot-specific deterministic RNG (Mulberry32 variant). Seeded from the game
// seed but XOR'd with a constant so it never aliases the game's RNG sequence.
// Used by random and expectimax2 so bot decisions are reproducible without
// advancing the game's tile-spawn RNG.
function makeBotRng(gameSeed: number): () => number {
  let s = (gameSeed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Picks a valid chain uniformly at random. Skill floor — baseline for "does
// skill matter at all?" comparisons.
export function pickRandomChain(
  grid: Grid,
  mode: GameMode,
  rng: () => number
): Coord[] | null {
  const all = enumerateAll(grid);
  const valid = all.filter((c) => {
    const tiles = c.path.map(({ r, c: col }) => grid[r][col] as Tile);
    return isChainCommittable(c.path, tiles, mode);
  });
  if (valid.length === 0) return null;
  return valid[Math.floor(rng() * valid.length)].path;
}

const EXPECTIMAX_K = 8;
const EXPECTIMAX_SAMPLES = 8; // spawn-outcome samples at each chance node
const EXPECTIMAX_DISCOUNT = 0.9;

// Depth-2 expectimax: for each of the top-K immediate chains, average the
// best greedy follow-up score over S sampled spawn outcomes (chance node).
// Unlike lookahead1 (single realised draw), this properly marginalises over
// the spawn distribution by varying the RNG state before each commit.
export function pickBestChainExpectimax2(
  state: GameState,
  botRng: () => number
): Coord[] | null {
  const scorer = makeModeScorer(state.mode, state);
  const candidates = enumerateAll(state.grid, scorer).filter((c) => {
    const tiles = c.path.map(({ r, c: col }) => state.grid[r][col] as Tile);
    return isChainCommittable(c.path, tiles, state.mode);
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const topK = candidates.slice(0, EXPECTIMAX_K);

  let best: { path: Coord[]; value: number } | null = null;
  for (const cand of topK) {
    let totalFollowup = 0;
    let validSamples = 0;
    for (let s = 0; s < EXPECTIMAX_SAMPLES; s++) {
      // Perturb the game RNG state to sample a different spawn outcome.
      const bias = Math.floor(botRng() * 0x100000000) >>> 0;
      const sampledState: GameState = { ...state, rngState: (state.rngState ^ bias) >>> 0 };
      const plan = planCommit(sampledState, cand.path);
      if (!plan) continue;
      validSamples++;
      if (!plan.finalState.gameOver) {
        const followPath = pickBestChainGreedy(
          plan.finalState.grid,
          plan.finalState.mode,
          plan.finalState
        );
        if (followPath) {
          const followTiles = followPath.map(({ r, c }) => plan.finalState.grid[r][c] as Tile);
          totalFollowup += scorer(followPath, followTiles.map((t) => t.value), followTiles);
        }
      }
    }
    const avgFollowup = validSamples > 0 ? totalFollowup / validSamples : 0;
    const value = cand.score + EXPECTIMAX_DISCOUNT * avgFollowup;
    if (!best || value > best.value) best = { path: cand.path, value };
  }
  return best?.path ?? null;
}

export type RunOpts = {
  strength?: number;
  softness?: number;
  policy?: BotPolicy;
  maxMoves?: number;
  mode?: GameMode;
  ratchetEnabled?: boolean;
  ratchetInterval?: number;
  rows?: number;
  cols?: number;
  poolSize?: number;
};

export type BotResult = {
  seed: number;
  algo: SpawnAlgo;
  strength: number;
  softness: number;
  mode: GameMode;
  policy: BotPolicy;
  moves: number;
  peak: number;
  score: number;
  // Per-game mean chain length (chainLenSum / moves). Honest at the per-game
  // level. For aggregates across runs, use chainLenSum/moves summed across
  // runs — see summarize().
  avgChainLen: number;
  // Sum of chain lengths across all moves in this run. Exposed so aggregators
  // can compute Σchain/Σmoves (unbiased) instead of avg(per-game ratios).
  chainLenSum: number;
  peakByMove50: number;
  levelsCleared: number;
  highestTargetHit: number;
  // Mode-specific primary metric. movesLimited: moves remaining at game-over.
  // risingFloor: final floor. classic/boost/wilds: levelsCleared (already above).
  modeMetric: number;
  // Why the run loop ended. See TerminationReason.
  terminationReason: TerminationReason;
  // Wall-clock ms for the whole run.
  runtimeMs: number;
  // Wall-clock ms spent inside bot decision functions (greedy/lookahead).
  // Subtract from runtimeMs to estimate engine-step time.
  botDecisionMs: number;
};

export function runBot(seed: number, algo: SpawnAlgo, opts: RunOpts = {}): BotResult {
  const strength = opts.strength ?? DEFAULT_STRENGTH;
  const softness = opts.softness ?? DEFAULT_SOFTNESS;
  const policy = opts.policy ?? "greedy";
  const mode: GameMode = opts.mode ?? "classic";
  const ratchetEnabled = opts.ratchetEnabled ?? false;
  const ratchetInterval = opts.ratchetInterval ?? 1;
  const maxMoves = opts.maxMoves ?? 5000;

  // Snapshot board config so per-call rows/cols/poolSize don't leak into
  // subsequent runs that don't specify them. Restored in `finally`.
  const prevBoard = getBoardConfig();
  const overrideBoard =
    opts.rows !== undefined || opts.cols !== undefined || opts.poolSize !== undefined;
  if (overrideBoard) {
    configureBoard({ rows: opts.rows, cols: opts.cols, poolSize: opts.poolSize });
  }

  const t0 = performance.now();
  let botDecisionMs = 0;
  let terminationReason: TerminationReason;
  let result: BotResult;
  // Bot-specific RNG (random + expectimax2 only). Seeded from the game seed so
  // choices are reproducible without touching the game's tile-spawn RNG.
  const botRng = makeBotRng(seed);
  try {
    let state: GameState = newGame(seed, algo, strength, softness, mode, true, ratchetEnabled, ratchetInterval);
    let guard = 0;
    let chainLenSum = 0;
    let peakByMove50 = 0;
    terminationReason = "gameOver"; // overwritten below if loop exits other ways
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (state.gameOver) { terminationReason = "gameOver"; break; }
      if (guard >= maxMoves) { terminationReason = "moveCapReached"; break; }
      const tDec0 = performance.now();
      const path =
        policy === "lookahead1"  ? pickBestChainLookahead(state)
        : policy === "random"    ? pickRandomChain(state.grid, mode, botRng)
        : policy === "expectimax2" ? pickBestChainExpectimax2(state, botRng)
        : pickBestChainGreedy(state.grid, mode, state);
      botDecisionMs += performance.now() - tDec0;
      if (!path || path.length < 2) { terminationReason = "noChainFound"; break; }
      const plan = planCommit(state, path);
      if (!plan) { terminationReason = "invalidCommit"; break; }
      state = plan.finalState;
      chainLenSum += path.length;
      guard++;
      if (guard === 50) peakByMove50 = state.peak;
    }
    // Highest target hit = currentTarget / 2 (since target doubles after hit).
    // But only if levelsCleared > 0; otherwise no target was hit.
    const highestTargetHit = state.levelsCleared > 0 ? state.currentTarget / 2 : 0;
    let modeMetric = state.levelsCleared;
    if (state.modeState.kind === "movesLimited") modeMetric = state.modeState.movesRemaining;
    else if (state.modeState.kind === "risingFloor") modeMetric = state.modeState.floor;
    result = {
      seed,
      algo,
      strength,
      softness,
      mode,
      policy,
      moves: state.moves,
      peak: state.peak,
      score: state.score,
      avgChainLen: state.moves > 0 ? chainLenSum / state.moves : 0,
      chainLenSum,
      peakByMove50,
      levelsCleared: state.levelsCleared,
      highestTargetHit,
      modeMetric,
      terminationReason,
      runtimeMs: performance.now() - t0,
      botDecisionMs,
    };
  } finally {
    if (overrideBoard) configureBoard(prevBoard);
  }
  return result;
}

// Distribution + 95% bootstrap CI for one metric across runs.
export type DistributionStat = {
  n: number;
  mean: number;
  median: number;
  stddev: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  iqr: number;
  ciLow: number;
  ciHigh: number;
  ciHalfWidth: number;
};

// Wilson 95% CI for a binomial proportion (e.g. termination rate).
export type ProportionStat = { rate: number; low: number; high: number };

export type BenchmarkSummary = {
  algo: SpawnAlgo;
  strength: number;
  softness: number;
  mode: GameMode;
  policy: BotPolicy;
  runs: BotResult[];
  // Legacy point estimates (kept for back-compat). Prefer the `dists` block
  // below for anything new — it includes spread and CIs.
  avgMoves: number;
  medianMoves: number;
  avgPeak: number;
  avgScore: number;
  // Unbiased: Σ(chainLenSum across runs) / Σ(moves across runs).
  avgChainLen: number;
  avgPeakByMove50: number;
  medianLevels: number;
  avgLevels: number;
  maxLevels: number;
  // Runtime aggregates (ms unless noted).
  totalRuntimeMs: number;
  avgRuntimeMs: number;
  totalBotDecisionMs: number;
  gamesPerSec: number;
  // Termination breakdown — counts by reason. Sums to runs.length.
  terminationCounts: Record<TerminationReason, number>;

  // Phase 2 additions:
  // Per-metric distribution + 95% bootstrap CI (mean is the headline stat).
  // Use `dists.<metric>.ciHalfWidth` to render "value ± hw" cells.
  dists: {
    moves: DistributionStat;
    peak: DistributionStat;
    score: DistributionStat;
    levelsCleared: DistributionStat;
    modeMetric: DistributionStat;
    runtimeMs: DistributionStat;
  };
  // CI on the unbiased pooled avgChainLen, computed by bootstrapping
  // `Σchain / Σmoves` over runs.
  avgChainLenStat: { stat: number; low: number; high: number; ciHalfWidth: number };
  // Wilson 95% CIs on every termination reason (rate + CI bounds).
  terminationRates: Record<TerminationReason, ProportionStat>;
  // Seed list used (copied from the runs). Lets a downstream comparator
  // detect whether two summaries are paired without inspecting `runs`.
  seedList: number[];
};

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m];
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function summarize(
  algo: SpawnAlgo,
  strength: number,
  softness: number,
  mode: GameMode,
  policy: BotPolicy,
  runs: BotResult[]
): BenchmarkSummary {
  const totalMoves = runs.reduce((a, r) => a + r.moves, 0);
  const totalChainLen = runs.reduce((a, r) => a + r.chainLenSum, 0);
  const totalRuntimeMs = runs.reduce((a, r) => a + r.runtimeMs, 0);
  const totalBotDecisionMs = runs.reduce((a, r) => a + r.botDecisionMs, 0);
  const terminationCounts: Record<TerminationReason, number> = {
    gameOver: 0, moveCapReached: 0, noChainFound: 0, invalidCommit: 0,
  };
  for (const r of runs) terminationCounts[r.terminationReason]++;

  // Distribution + CI helpers. We import inside the function to keep bot.ts
  // free of "scripts/" code; instead, compute locally with a private impl.
  const dists = {
    moves: distStat(runs.map((r) => r.moves)),
    peak: distStat(runs.map((r) => r.peak)),
    score: distStat(runs.map((r) => r.score)),
    levelsCleared: distStat(runs.map((r) => r.levelsCleared)),
    modeMetric: distStat(runs.map((r) => r.modeMetric)),
    runtimeMs: distStat(runs.map((r) => r.runtimeMs)),
  };

  // Bootstrap CI on the unbiased pooled avgChainLen. We resample WHOLE runs
  // (not individual moves) so the resampled ratio honours the per-run pairing
  // of chainLenSum and moves.
  const avgChainLenStat = bootstrapPooledRatio(
    runs.map((r) => ({ num: r.chainLenSum, den: r.moves }))
  );

  // Wilson CI on each termination rate.
  const N = runs.length;
  const terminationRates: Record<TerminationReason, ProportionStat> = {
    gameOver: wilson(terminationCounts.gameOver, N),
    moveCapReached: wilson(terminationCounts.moveCapReached, N),
    noChainFound: wilson(terminationCounts.noChainFound, N),
    invalidCommit: wilson(terminationCounts.invalidCommit, N),
  };

  return {
    algo, strength, softness, mode, policy, runs,
    avgMoves: avg(runs.map((r) => r.moves)),
    medianMoves: median(runs.map((r) => r.moves)),
    avgPeak: avg(runs.map((r) => r.peak)),
    avgScore: avg(runs.map((r) => r.score)),
    avgChainLen: totalMoves > 0 ? totalChainLen / totalMoves : 0,
    avgPeakByMove50: avg(runs.map((r) => r.peakByMove50)),
    medianLevels: median(runs.map((r) => r.levelsCleared)),
    avgLevels: avg(runs.map((r) => r.levelsCleared)),
    maxLevels: runs.length ? Math.max(...runs.map((r) => r.levelsCleared)) : 0,
    totalRuntimeMs,
    avgRuntimeMs: runs.length ? totalRuntimeMs / runs.length : 0,
    totalBotDecisionMs,
    gamesPerSec: totalRuntimeMs > 0 ? (runs.length / totalRuntimeMs) * 1000 : 0,
    terminationCounts,
    dists,
    avgChainLenStat,
    terminationRates,
    seedList: runs.map((r) => r.seed),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Private stat helpers. Duplicated from scripts/_lib.ts so src/game/ stays
// independent of the harness scripts (engine code can be imported by anything,
// including the React app, where a harness dependency would be inappropriate).
// Kept minimal: just what summarize() needs.
// ─────────────────────────────────────────────────────────────────────────────

const _BOOTSTRAP_SAMPLES = 1000;
const _BOOTSTRAP_SEED = 1;

function _makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

function _stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = avg(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

function distStat(xs: number[]): DistributionStat {
  const n = xs.length;
  if (n === 0) {
    return { n: 0, mean: 0, median: 0, stddev: 0, p10: 0, p25: 0, p75: 0, p90: 0, iqr: 0, ciLow: 0, ciHigh: 0, ciHalfWidth: 0 };
  }
  const m = avg(xs);
  const md = median(xs);
  const sd = _stddev(xs);
  const p10 = _percentile(xs, 10);
  const p25 = _percentile(xs, 25);
  const p75 = _percentile(xs, 75);
  const p90 = _percentile(xs, 90);
  // Bootstrap CI on the mean.
  const rng = _makeRng(_BOOTSTRAP_SEED);
  const stats = new Float64Array(_BOOTSTRAP_SAMPLES);
  const buf = new Float64Array(n);
  for (let b = 0; b < _BOOTSTRAP_SAMPLES; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = xs[Math.floor(rng() * n)];
      buf[i] = v;
      sum += v;
    }
    stats[b] = sum / n;
  }
  const sortedStats = Array.from(stats).sort((a, b) => a - b);
  const ciLow = sortedStats[Math.floor(0.025 * _BOOTSTRAP_SAMPLES)];
  const ciHigh = sortedStats[Math.floor(0.975 * _BOOTSTRAP_SAMPLES)];
  return {
    n, mean: m, median: md, stddev: sd,
    p10, p25, p75, p90, iqr: p75 - p25,
    ciLow, ciHigh, ciHalfWidth: Math.max(m - ciLow, ciHigh - m),
  };
}

// Bootstrap CI on a pooled ratio Σnum / Σden. Resamples whole (num, den) pairs.
function bootstrapPooledRatio(pairs: { num: number; den: number }[]): {
  stat: number; low: number; high: number; ciHalfWidth: number;
} {
  const n = pairs.length;
  const totalNum = pairs.reduce((a, p) => a + p.num, 0);
  const totalDen = pairs.reduce((a, p) => a + p.den, 0);
  const stat = totalDen > 0 ? totalNum / totalDen : 0;
  if (n < 2) return { stat, low: stat, high: stat, ciHalfWidth: 0 };
  const rng = _makeRng(_BOOTSTRAP_SEED);
  const stats = new Float64Array(_BOOTSTRAP_SAMPLES);
  for (let b = 0; b < _BOOTSTRAP_SAMPLES; b++) {
    let sn = 0, sd = 0;
    for (let i = 0; i < n; i++) {
      const p = pairs[Math.floor(rng() * n)];
      sn += p.num;
      sd += p.den;
    }
    stats[b] = sd > 0 ? sn / sd : 0;
  }
  const sorted = Array.from(stats).sort((a, b) => a - b);
  const low = sorted[Math.floor(0.025 * _BOOTSTRAP_SAMPLES)];
  const high = sorted[Math.floor(0.975 * _BOOTSTRAP_SAMPLES)];
  return { stat, low, high, ciHalfWidth: Math.max(stat - low, high - stat) };
}

function wilson(successes: number, n: number): ProportionStat {
  if (n === 0) return { rate: 0, low: 0, high: 0 };
  const z = 1.96;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { rate: p, low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function makeSeeds(n: number): number[] {
  return Array.from({ length: n }, () => randomSeed());
}

// BenchOpts adds an optional `seeds` array to RunOpts. When provided, all
// algos/conditions in a single benchmark() or sweep() call use the SAME seeds,
// enabling paired comparisons across calls (the caller controls pairing).
// `seeds.length` overrides `n` if both are passed.
export type BenchOpts = RunOpts & { seeds?: number[] };

export function benchmark(
  algos: SpawnAlgo[],
  n: number,
  opts: BenchOpts = {}
): BenchmarkSummary[] {
  const seeds = opts.seeds ?? makeSeeds(n);
  const strength = opts.strength ?? DEFAULT_STRENGTH;
  const softness = opts.softness ?? DEFAULT_SOFTNESS;
  const mode: GameMode = opts.mode ?? "classic";
  const policy = opts.policy ?? "greedy";
  const maxMoves = opts.maxMoves;
  const { rows, cols, poolSize } = opts;
  return algos.map((algo) =>
    summarize(
      algo,
      strength,
      softness,
      mode,
      policy,
      seeds.map((s) => runBot(s, algo, { strength, softness, mode, policy, maxMoves, rows, cols, poolSize }))
    )
  );
}

export type SweepParam = "strength" | "softness";

export function sweep(
  algo: SpawnAlgo,
  param: SweepParam,
  values: number[],
  n: number,
  policy: BotPolicy = "greedy",
  mode: GameMode = "classic",
  opts: Pick<BenchOpts, "maxMoves" | "seeds"> = {}
): BenchmarkSummary[] {
  const seeds = opts.seeds ?? makeSeeds(n);
  const maxMoves = opts.maxMoves;
  return values.map((v) => {
    const strength = param === "strength" ? v : DEFAULT_STRENGTH;
    const softness = param === "softness" ? v : DEFAULT_SOFTNESS;
    return summarize(
      algo,
      strength,
      softness,
      mode,
      policy,
      seeds.map((s) => runBot(s, algo, { strength, softness, mode, policy, maxMoves }))
    );
  });
}

export function sweepStrength(
  algo: SpawnAlgo,
  strengths: number[],
  n: number,
  policy: BotPolicy = "greedy"
): BenchmarkSummary[] {
  return sweep(algo, "strength", strengths, n, policy);
}

// Generate a deterministic seed list from a master uint32 seed. Used by CLI
// scripts that accept --seed for full reproducibility. Implemented via the
// same Mulberry32 step the engine uses.
export function deterministicSeeds(masterSeed: number, n: number): number[] {
  let s = masterSeed >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    // Step Mulberry32 once and take the resulting state as the seed.
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    out.push((t ^ (t >>> 14)) >>> 0);
  }
  return out;
}
