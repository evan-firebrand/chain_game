import type { Cell, GameConfig, TileValue } from '../types.js';
import { unpackValue } from './encoding.js';
import type { FastState } from './state.js';

// Trusted-move chain resolution. NO validation — sim-harness strategies
// are responsible for emitting only legal chains. A DEBUG-time wrapper
// exists in chain-debug.ts for tests; that wrapper is not in the hot path.

export interface ChainResolution {
  readonly resultValue: TileValue;
  readonly sameExtensions: number;
  readonly doublingExtensions: number;
}

/**
 * Walks the chain on the FastState's packed board and computes the
 * resolution. Mutates nothing.
 *
 * Caller invariants (NOT checked):
 *   - chain.length >= 2
 *   - every chain cell is in bounds and non-empty
 *   - chain[0] and chain[1] are adjacent and have the same value
 *   - each chain[i] for i >= 2 is adjacent to chain[i-1] and either
 *     same-value or double-value
 */
export function resolveChainInPlace(
  fast: FastState,
  chain: readonly Cell[],
  config: Pick<GameConfig, 'ruleK'>,
): ChainResolution {
  const cols = fast.cols;
  const board = fast.board;

  let sameExtensions = 0;
  let doublingExtensions = 0;
  // Initialise prevValue from chain[0] outside the loop so we don't need to
  // special-case i === 0 inside the hot path.
  const first = chain[0];
  /* v8 ignore next 1 */
  if (first === undefined) {
    return { resultValue: 0 as TileValue, sameExtensions: 0, doublingExtensions: 0 };
  }
  let prevValue = unpackValue(board[first.row * cols + first.col] ?? 0);
  let lastValue = prevValue;

  for (let i = 1; i < chain.length; i++) {
    const cell = chain[i];
    /* v8 ignore next 1 */
    if (cell === undefined) continue;
    const v = unpackValue(board[cell.row * cols + cell.col] ?? 0);
    if (i >= 2) {
      if (v === prevValue) sameExtensions++;
      else if (v === prevValue * 2) doublingExtensions++;
      // Else: caller violated the trusted-move contract. Silently treat
      // as a doubling-of-zero, which produces a deterministic but wrong
      // result. The DEBUG wrapper catches this; the production hot path
      // does not, by design.
    }
    prevValue = v;
    lastValue = v;
  }

  // Rule D, k: result = lastValue × 2 × 2^floor(s/k), s = sameExtensions
  const bonus = Math.floor(sameExtensions / config.ruleK);
  const resultValue = (lastValue * 2 * (1 << bonus)) as TileValue;

  return { resultValue, sameExtensions, doublingExtensions };
}
