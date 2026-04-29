import { describe, it, expect } from 'vitest';
import {
  applyChainInPlace,
  fromPure,
  type FastState,
} from '../../src/game-kernel/fast/index.js';
import {
  createGame,
  DEFAULT_CONFIG,
  validateChain,
} from '../../src/game-kernel/index.js';
import {
  makeStrategyRng,
  randomStrategy,
} from '../../src/sim-harness/strategies/random.js';
import { toPure } from '../../src/game-kernel/fast/index.js';
import type { GameConfig } from '../../src/game-kernel/index.js';

const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42, recordEvents: false };

describe('randomStrategy — legality', () => {
  it('returns a legal chain on the fresh seed=42 board', () => {
    const fast: FastState = fromPure(createGame(CONFIG));
    const chain = randomStrategy(fast, makeStrategyRng(1));
    expect(chain).not.toBeNull();
    // Validate against pure validateChain by round-tripping FastState back
    expect(validateChain(toPure(fast).board, chain!).valid).toBe(true);
  });

  it('returns a legal chain across many seeds', () => {
    for (let s = 0; s < 30; s++) {
      const fast = fromPure(createGame({ ...CONFIG, prngSeed: s }));
      const chain = randomStrategy(fast, makeStrategyRng(s + 1));
      expect(chain, `seed ${s}`).not.toBeNull();
      expect(validateChain(toPure(fast).board, chain!).valid, `seed ${s}`).toBe(true);
    }
  });

  it('returns null on an empty board (no legal moves)', () => {
    const fast = fromPure(createGame(CONFIG));
    fast.board.fill(0);
    expect(randomStrategy(fast, makeStrategyRng(1))).toBeNull();
  });
});

describe('randomStrategy — determinism', () => {
  it('same FastState + same strategy seed → identical chain', () => {
    const fastA = fromPure(createGame(CONFIG));
    const fastB = fromPure(createGame(CONFIG));
    const a = randomStrategy(fastA, makeStrategyRng(7));
    const b = randomStrategy(fastB, makeStrategyRng(7));
    expect(a).toEqual(b);
  });

  it('multi-turn play is deterministic for (kernelSeed, strategySeed)', () => {
    const playN = (kSeed: number, sSeed: number, turns: number): number[] => {
      const fast = fromPure(createGame({ ...CONFIG, prngSeed: kSeed }));
      const rng = makeStrategyRng(sSeed);
      for (let t = 0; t < turns; t++) {
        const chain = randomStrategy(fast, rng);
        if (chain === null) break;
        applyChainInPlace(fast, chain);
      }
      return Array.from(fast.board);
    };

    const a = playN(1, 100, 50);
    const b = playN(1, 100, 50);
    expect(a).toEqual(b);
  });
});

describe('makeStrategyRng', () => {
  it('produces values in [0, 1)', () => {
    const rng = makeStrategyRng(42);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n) returns values in [0, n)', () => {
    const rng = makeStrategyRng(42);
    for (let i = 0; i < 100; i++) {
      const v = rng.int(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it('same seed → same sequence', () => {
    const a = makeStrategyRng(99);
    const b = makeStrategyRng(99);
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next());
    }
  });
});
