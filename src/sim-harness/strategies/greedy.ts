import type { Cell } from '../../game-kernel/index.js';
import {
  enumerateLegalPairsFast,
  resolveChainInPlace,
  unpackValue,
  type FastState,
} from '../../game-kernel/fast/index.js';
import type { Strategy } from '../types.js';

/**
 * Greedy strategy: among all legal chains of length 2 or 3, pick the one
 * whose committed result has the highest tile value. Tie-break by chain
 * length (longer wins, since the spawn count = chain.length-1 means more
 * board reset), then by enumeration order (first found).
 *
 * Bounded at length 3 by design — a full search would be exponential and
 * the bench needs to stay well under the Phase 5 gate. The heuristic
 * strategy (3.7) explores a richer search.
 *
 * Strategy is fully deterministic (no RNG use). The Strategy signature
 * still requires a StrategyRng arg; greedy ignores it.
 */
export const greedyStrategy: Strategy = (state) => {
  const flat = enumerateLegalPairsFast(state);
  if (flat.length === 0) return null;

  let best: readonly Cell[] | null = null;
  let bestResult = -1;
  let bestLen = -1;

  const numPairs = flat.length / 2;
  for (let i = 0; i < numPairs; i++) {
    const a = flat[i * 2];
    const b = flat[i * 2 + 1];
    if (a === undefined || b === undefined) continue;

    // Score the bare 2-chain.
    const pair: readonly Cell[] = [a, b];
    const pairRes = resolveChainInPlace(state, pair, state.config).resultValue;
    if (pairRes > bestResult || (pairRes === bestResult && 2 > bestLen)) {
      best = pair;
      bestResult = pairRes;
      bestLen = 2;
    }

    // Score length-3 extensions: every neighbor of b that isn't a, with
    // a valid extension value (same or double).
    const extensions = extendBy1(state, a, b);
    for (const c of extensions) {
      const tri: readonly Cell[] = [a, b, c];
      const triRes = resolveChainInPlace(state, tri, state.config).resultValue;
      if (triRes > bestResult || (triRes === bestResult && 3 > bestLen)) {
        best = tri;
        bestResult = triRes;
        bestLen = 3;
      }
    }
  }

  return best;
};

/**
 * Returns every legal 1-step extension of a chain ending at `b` (with the
 * predecessor `a`). A legal extension is a cell adjacent to `b`, not equal
 * to `a`, whose value is equal-to or double-of `b`'s value.
 *
 * Uses a small fixed-length scratch array — typical extension count is 0..4.
 */
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
