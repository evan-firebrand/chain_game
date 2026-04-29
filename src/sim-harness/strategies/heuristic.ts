import type { Cell } from '../../game-kernel/index.js';
import {
  enumerateLegalPairsFast,
  resolveChainInPlace,
  unpackValue,
  type FastState,
} from '../../game-kernel/fast/index.js';
import type { Strategy } from '../types.js';

// ─── Heuristic weights ───────────────────────────────────────────────────────
// These constants encode a design assumption about what "good play" looks
// like. Per docs/.../strategies/README.md they require Evan sign-off — the
// values below are an Architecture-Agent baseline pending review.
//
//   score = TIER_WEIGHT * log2(resultValue) + LENGTH_WEIGHT * chainLength
//
// Rationale for the baseline:
//   - TIER_WEIGHT > LENGTH_WEIGHT: pushing tiers forward is the primary
//     game-mechanic goal; chain length is a means to that end, not an end
//     in itself.
//   - log2 of result so tier advancement scales linearly in "tile rank"
//     rather than in raw value (a 16→32 step shouldn't be 10× as exciting
//     as a 2→4 step).
//   - chainLength contributes a small bonus to break ties in favour of
//     longer chains (= more spawn = more board reset = more options next
//     turn).

const TIER_WEIGHT = 1.0;
const LENGTH_WEIGHT = 0.25;

// ─── Strategy ────────────────────────────────────────────────────────────────

/**
 * Heuristic strategy: enumerate legal chains of length 2 or 3, score each
 * by a weighted combination of tier advancement (log2 of result value) and
 * chain length, pick the highest-scoring chain. Tie-break by chain length
 * then enumeration order.
 *
 * Bounded at length 3 for perf parity with greedy. Future iterations may
 * extend the search depth or introduce board-space metrics.
 *
 * Heuristic is fully deterministic. The Strategy signature still requires
 * a StrategyRng arg; heuristic ignores it.
 */
export const heuristicStrategy: Strategy = (state) => {
  const flat = enumerateLegalPairsFast(state);
  if (flat.length === 0) return null;

  let best: readonly Cell[] | null = null;
  let bestScore = -Infinity;
  let bestLen = -1;

  const numPairs = flat.length / 2;
  for (let i = 0; i < numPairs; i++) {
    const a = flat[i * 2];
    const b = flat[i * 2 + 1];
    if (a === undefined || b === undefined) continue;

    const pair: readonly Cell[] = [a, b];
    const pairScore = scoreChain(state, pair);
    if (pairScore > bestScore || (pairScore === bestScore && 2 > bestLen)) {
      best = pair;
      bestScore = pairScore;
      bestLen = 2;
    }

    const exts = extendBy1(state, a, b);
    for (const c of exts) {
      const tri: readonly Cell[] = [a, b, c];
      const triScore = scoreChain(state, tri);
      if (triScore > bestScore || (triScore === bestScore && 3 > bestLen)) {
        best = tri;
        bestScore = triScore;
        bestLen = 3;
      }
    }
  }

  return best;
};

function scoreChain(state: FastState, chain: readonly Cell[]): number {
  const result = resolveChainInPlace(state, chain, state.config).resultValue;
  if (result <= 0) return -Infinity;
  const tierLog2 = Math.log2(result);
  return TIER_WEIGHT * tierLog2 + LENGTH_WEIGHT * chain.length;
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
