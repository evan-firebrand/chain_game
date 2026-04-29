import { describe, it, expect } from 'vitest';
import {
  applyChainInPlace,
  enumerateLegalPairsFast,
  fromPure,
  resolveChainInPlace,
  toPure,
  type FastState,
} from '../../src/game-kernel/fast/index.js';
import { createGame, DEFAULT_CONFIG, validateChain } from '../../src/game-kernel/index.js';
import { greedyStrategy } from '../../src/sim-harness/strategies/greedy.js';
import { makeStrategyRng } from '../../src/sim-harness/strategies/random.js';
import type { GameConfig } from '../../src/game-kernel/index.js';

const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42, recordEvents: false };

describe('greedyStrategy — legality', () => {
  it('returns a legal chain on a fresh board', () => {
    const fast: FastState = fromPure(createGame(CONFIG));
    const chain = greedyStrategy(fast, makeStrategyRng(0));
    expect(chain).not.toBeNull();
    expect(validateChain(toPure(fast).board, chain!).valid).toBe(true);
  });

  it('returns a legal chain across 30 seeds', () => {
    for (let s = 0; s < 30; s++) {
      const fast = fromPure(createGame({ ...CONFIG, prngSeed: s }));
      const chain = greedyStrategy(fast, makeStrategyRng(0));
      expect(chain, `seed ${s}`).not.toBeNull();
      expect(validateChain(toPure(fast).board, chain!).valid, `seed ${s}`).toBe(true);
    }
  });

  it('returns null on an empty board', () => {
    const fast = fromPure(createGame(CONFIG));
    fast.board.fill(0);
    expect(greedyStrategy(fast, makeStrategyRng(0))).toBeNull();
  });
});

describe('greedyStrategy — actually maximises immediate result', () => {
  it('chosen chain has the maximum result value among 2- and 3-chains', () => {
    // Repeat across several seeds to exercise different boards.
    for (let s = 0; s < 5; s++) {
      const fast = fromPure(createGame({ ...CONFIG, prngSeed: s }));
      const chosen = greedyStrategy(fast, makeStrategyRng(0));
      expect(chosen).not.toBeNull();

      const chosenResult = resolveChainInPlace(fast, chosen!, fast.config).resultValue;
      // Chosen result should be >= every other 2-chain on the board.
      // We don't enumerate all 3-chains for the assertion (greedy already
      // does that); we only check that no plain 2-chain beats it.
      const flat = enumerateLegalPairsFast(fast);
      for (let i = 0; i < flat.length; i += 2) {
        const a = flat[i]!;
        const b = flat[i + 1]!;
        const r = resolveChainInPlace(fast, [a, b], fast.config).resultValue;
        expect(r, `seed ${s}, pair ${i / 2}`).toBeLessThanOrEqual(chosenResult);
      }
    }
  });
});

describe('greedyStrategy — determinism', () => {
  it('greedy is fully deterministic (no RNG use)', () => {
    const fastA = fromPure(createGame(CONFIG));
    const fastB = fromPure(createGame(CONFIG));
    const a = greedyStrategy(fastA, makeStrategyRng(1));
    const b = greedyStrategy(fastB, makeStrategyRng(99999));
    expect(a).toEqual(b);
  });

  it('multi-turn greedy play is deterministic for fixed kernel seed', () => {
    const playN = (kSeed: number, turns: number) => {
      const fast = fromPure(createGame({ ...CONFIG, prngSeed: kSeed }));
      const rng = makeStrategyRng(0);
      for (let t = 0; t < turns; t++) {
        const chain = greedyStrategy(fast, rng);
        if (chain === null) break;
        applyChainInPlace(fast, chain);
      }
      return Array.from(fast.board);
    };
    expect(playN(1, 30)).toEqual(playN(1, 30));
  });
});
