import type { Cell } from '../types.js';
import { packTile } from './encoding.js';
import {
  applyGravityInPlace,
  hasLegalChainStartFast,
  removeTilesInPlace,
  setTileInPlace,
  spawnTilesInPlace,
} from './board.js';
import { resolveChainInPlace } from './chain.js';
import type { FastState } from './state.js';

// Re-export the surface that sim-harness will consume. fast/* is internal
// to game-kernel; sim-harness imports from this module rather than the
// individual files.
export type { FastState } from './state.js';
export { fromPure, toPure, readCell, writeCell } from './state.js';
export {
  applyGravityInPlace,
  enumerateLegalPairsFast,
  hasLegalChainStartFast,
  removeTilesInPlace,
  setTileInPlace,
  spawnTilesInPlace,
} from './board.js';
export { resolveChainInPlace } from './chain.js';
export type { ChainResolution } from './chain.js';
export {
  PACKED_EMPTY,
  packTile,
  packTileObj,
  unpackRetired,
  unpackTile,
  unpackValue,
} from './encoding.js';

/**
 * Apply a commit-chain action in place. The hot integration step that ties
 * resolveChainInPlace, removeTilesInPlace, setTileInPlace, applyGravityInPlace,
 * spawnTilesInPlace, and hasLegalChainStartFast together.
 *
 * Trusted-move contract:
 *   - chain.length >= 2
 *   - chain is fully legal (the caller has already validated)
 *   - fast.phase === 'playing' (no-op otherwise — same as the pure surface)
 *
 * Mutates `fast` in place. No event allocation. Returns the chain resolution
 * for callers that need it (e.g. updating sim stats); does NOT return any
 * spawned-tile metadata — sim-harness can read fast.board after the call if
 * it needs spawn locations, but the typical sim path doesn't.
 */
export function applyChainInPlace(
  fast: FastState,
  chain: readonly Cell[],
): { resultValue: number; sameExtensions: number; doublingExtensions: number } | null {
  if (fast.phase === 'game-over') return null;

  const resolution = resolveChainInPlace(fast, chain, fast.config);
  const last = chain[chain.length - 1];
  /* v8 ignore next 1 */
  if (last === undefined) return null;

  removeTilesInPlace(fast, chain);
  setTileInPlace(fast, last.row, last.col, packTile(resolution.resultValue, false));
  applyGravityInPlace(fast);
  spawnTilesInPlace(fast, chain.length - 1);

  fast.turn += 1;
  if (resolution.resultValue > fast.maxTileEver) {
    fast.maxTileEver = resolution.resultValue;
  }

  if (!hasLegalChainStartFast(fast)) {
    fast.phase = 'game-over';
  }

  return resolution;
}
