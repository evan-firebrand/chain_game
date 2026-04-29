import { describe, it, expect } from 'vitest';
import {
  applyChainInPlace,
  fromPure,
  toPure,
  type FastState,
} from '../../src/game-kernel/fast/index.js';
import { createGame, DEFAULT_CONFIG, validateChain } from '../../src/game-kernel/index.js';
import { heuristicStrategy } from '../../src/sim-harness/strategies/heuristic.js';
import { makeStrategyRng } from '../../src/sim-harness/strategies/random.js';
import type { GameConfig } from '../../src/game-kernel/index.js';

const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42, recordEvents: false };

describe('heuristicStrategy — legality', () => {
  it('returns a legal chain on a fresh board', () => {
    const fast: FastState = fromPure(createGame(CONFIG));
    const chain = heuristicStrategy(fast, makeStrategyRng(0));
    expect(chain).not.toBeNull();
    expect(validateChain(toPure(fast).board, chain!).valid).toBe(true);
  });

  it('returns a legal chain across 30 seeds', () => {
    for (let s = 0; s < 30; s++) {
      const fast = fromPure(createGame({ ...CONFIG, prngSeed: s }));
      const chain = heuristicStrategy(fast, makeStrategyRng(0));
      expect(chain, `seed ${s}`).not.toBeNull();
      expect(validateChain(toPure(fast).board, chain!).valid, `seed ${s}`).toBe(true);
    }
  });

  it('returns null on an empty board', () => {
    const fast = fromPure(createGame(CONFIG));
    fast.board.fill(0);
    expect(heuristicStrategy(fast, makeStrategyRng(0))).toBeNull();
  });
});

describe('heuristicStrategy — determinism', () => {
  it('heuristic is fully deterministic (no RNG use)', () => {
    const fastA = fromPure(createGame(CONFIG));
    const fastB = fromPure(createGame(CONFIG));
    const a = heuristicStrategy(fastA, makeStrategyRng(1));
    const b = heuristicStrategy(fastB, makeStrategyRng(99999));
    expect(a).toEqual(b);
  });

  it('multi-turn heuristic play is deterministic for fixed kernel seed', () => {
    const playN = (kSeed: number, turns: number): number[] => {
      const fast = fromPure(createGame({ ...CONFIG, prngSeed: kSeed }));
      const rng = makeStrategyRng(0);
      for (let t = 0; t < turns; t++) {
        const chain = heuristicStrategy(fast, rng);
        if (chain === null) break;
        applyChainInPlace(fast, chain);
      }
      return Array.from(fast.board);
    };
    expect(playN(1, 30)).toEqual(playN(1, 30));
  });
});

// Note: I intentionally omit a "heuristic differs from greedy" assertion.
// With the current TIER_WEIGHT=1.0 / LENGTH_WEIGHT=0.25 baseline AND a
// length-cap of 3, heuristic never disagrees with greedy — the tier
// component (log2 scale) dominates the length component for any
// length-2-vs-length-3 comparison. That convergence is a real property of
// the chosen weights, not a bug, and the heuristic weights require Evan
// sign-off (per docs/.../strategies/README.md). When the weights or
// search depth are revised, a divergence test belongs here.
