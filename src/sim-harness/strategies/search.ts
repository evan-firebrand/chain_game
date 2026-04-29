import type { Cell } from '../../game-kernel/index.js';
import {
  applyChainInPlace,
  cloneFast,
  enumerateLegalPairsFast,
  resolveChainInPlace,
  unpackValue,
  type FastState,
} from '../../game-kernel/fast/index.js';
import type { Strategy } from '../types.js';

// ─── searchStrategy ──────────────────────────────────────────────────────────
//
// Beam-search look-ahead. At each decision point, enumerate legal chains,
// rank them by immediate result value, take the top W, and recursively
// evaluate each by applying the chain to a cloned state and re-searching to
// depth-1. The chain whose subtree yields the highest leaf score wins.
//
// Leaf score is `state.maxTileEver` — log2 is monotonic, so raw value works
// and avoids a per-leaf log call.
//
// Trusted-move contract: returned chain is enumerated by the kernel's
// enumerator, so it's always legal.
//
// Stochastic spawn note: cloneFast copies prngState. Sibling branches starting
// from the same parent state advance the same PRNG sequence, so the same tile
// values are spawned (in different positions for different chains). This is a
// deterministic max-N tree search rather than expectimax — the skill-depth
// study just needs a consistent "look 3 chains ahead" baseline, not Monte-Carlo
// accuracy across spawn distributions.

export interface SearchStrategyOptions {
  /** Look-ahead depth. depth=1 reduces to greedy-by-immediate-result. */
  readonly depth: number;
  /** Beam width (top-K root chains explored at each node). Defaults to 5. */
  readonly width?: number;
}

const DEFAULT_WIDTH = 5;

export function searchStrategy(opts: SearchStrategyOptions): Strategy {
  const { depth } = opts;
  const width = opts.width ?? DEFAULT_WIDTH;
  if (!Number.isInteger(depth) || depth < 1) {
    throw new Error(`searchStrategy: depth must be integer >=1, got ${depth}`);
  }
  if (!Number.isInteger(width) || width < 1) {
    throw new Error(`searchStrategy: width must be integer >=1, got ${width}`);
  }

  return (state: FastState) => {
    const ranked = enumerateRankedChains(state);
    if (ranked.length === 0) return null;
    const beam = ranked.length > width ? ranked.slice(0, width) : ranked;

    if (depth === 1) return beam[0]?.chain ?? null;

    let bestChain = beam[0]?.chain ?? null;
    let bestVal = -Infinity;
    for (const { chain } of beam) {
      const branch = cloneFast(state);
      applyChainInPlace(branch, chain);
      const v = evalState(branch, depth - 1, width);
      if (v > bestVal) {
        bestVal = v;
        bestChain = chain;
      }
    }
    return bestChain;
  };
}

function evalState(state: FastState, depth: number, width: number): number {
  if (depth === 0 || state.phase === 'game-over') return state.maxTileEver;
  const ranked = enumerateRankedChains(state);
  if (ranked.length === 0) return state.maxTileEver;
  const beam = ranked.length > width ? ranked.slice(0, width) : ranked;
  let best = -Infinity;
  for (const { chain } of beam) {
    const branch = cloneFast(state);
    applyChainInPlace(branch, chain);
    const v = evalState(branch, depth - 1, width);
    if (v > best) best = v;
  }
  return best;
}

interface RankedChain {
  readonly chain: readonly Cell[];
  readonly score: number;
  readonly idx: number;
}

function enumerateRankedChains(state: FastState): RankedChain[] {
  const flat = enumerateLegalPairsFast(state);
  if (flat.length === 0) return [];
  const numPairs = flat.length / 2;
  const out: RankedChain[] = [];
  let idx = 0;
  for (let i = 0; i < numPairs; i++) {
    const a = flat[i * 2];
    const b = flat[i * 2 + 1];
    /* v8 ignore next 1 */
    if (a === undefined || b === undefined) continue;
    const pair: readonly Cell[] = [a, b];
    out.push({
      chain: pair,
      score: resolveChainInPlace(state, pair, state.config).resultValue,
      idx: idx++,
    });
    const exts = extendBy1(state, a, b);
    for (const c of exts) {
      const tri: readonly Cell[] = [a, b, c];
      out.push({
        chain: tri,
        score: resolveChainInPlace(state, tri, state.config).resultValue,
        idx: idx++,
      });
    }
  }
  out.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    if (y.chain.length !== x.chain.length) return y.chain.length - x.chain.length;
    return x.idx - y.idx;
  });
  return out;
}

function extendBy1(state: FastState, a: Cell, b: Cell): readonly Cell[] {
  const { rows, cols, board } = state;
  const bByte = board[b.row * cols + b.col] ?? 0;
  const bValueLow = bByte & 0x0f;
  const bValue = unpackValue(bByte);

  const out: Cell[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    const nr = b.row + dr;
    if (nr < 0 || nr >= rows) continue;
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nc = b.col + dc;
      if (nc < 0 || nc >= cols) continue;
      if (nr === a.row && nc === a.col) continue;

      const nByte = board[nr * cols + nc] ?? 0;
      const nValueLow = nByte & 0x0f;
      if (nValueLow === 0) continue;

      const nValue = unpackValue(nByte);
      if (nValueLow === bValueLow || nValue === bValue * 2) {
        out.push({ row: nr as Cell['row'], col: nc as Cell['col'] });
      }
    }
  }
  return out;
}
