import type { Cell } from '../../game-kernel/index.js';
import { enumerateLegalPairsFast } from '../../game-kernel/fast/index.js';
import type { Strategy, StrategyRng } from '../types.js';

/**
 * Random strategy: picks a uniformly-random legal 2-cell chain start.
 *
 * Does NOT extend chains beyond the initial pair. Extensions add complexity
 * the random strategy doesn't need to demonstrate baseline game-length
 * variance.
 *
 * The greedy and heuristic strategies (3.6, 3.7) do consider extensions.
 */
export const randomStrategy: Strategy = (state, rng: StrategyRng) => {
  const flat = enumerateLegalPairsFast(state);
  if (flat.length === 0) return null;
  const numPairs = flat.length / 2;
  const idx = rng.int(numPairs);
  const a = flat[idx * 2];
  const b = flat[idx * 2 + 1];
  /* v8 ignore next 1 — enumerateLegalPairsFast emits pairs in 2-cell
     blocks; idx*2 and idx*2+1 are always defined when numPairs > 0. */
  if (a === undefined || b === undefined) return null;
  const chain: readonly Cell[] = [a, b];
  return chain;
};

/**
 * Build a deterministic StrategyRng from a single integer seed. Independent
 * from the kernel PRNG so strategy choice doesn't perturb spawn sequences.
 */
export function makeStrategyRng(seed: number): StrategyRng {
  let state = (seed >>> 0) || 1;
  const next = (): number => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return {
    next,
    int(maxExclusive: number): number {
      return Math.floor(next() * maxExclusive);
    },
  };
}
