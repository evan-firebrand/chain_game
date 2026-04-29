import { bench, describe } from 'vitest';
import {
  applyChainInPlace,
  fromPure,
} from '../../src/game-kernel/fast/index.js';
import { createGame } from '../../src/game-kernel/index.js';
import {
  BENCH_CONFIG_NO_EVENTS,
  configWithSeedNoEvents,
  enumerateLegalPairs,
  playRandomGameFast,
} from '../_helpers.js';

// ─── Single-turn fast surface ───────────────────────────────────────────────
// Each iteration creates a fresh FastState (so the fixed chain stays valid)
// and commits one chain. This includes the fromPure cost; the per-game bench
// below amortises that across many turns.

const SAMPLE_PURE = createGame(BENCH_CONFIG_NO_EVENTS);
const PAIRS = enumerateLegalPairs(SAMPLE_PURE.board);
const PAIR = PAIRS[0]!;

describe('applyChainInPlace (fast surface)', () => {
  bench('applyChainInPlace (fromPure + commit 2-chain)', () => {
    const fast = fromPure(SAMPLE_PURE);
    applyChainInPlace(fast, PAIR);
  });
});

// ─── Full game on fast surface ───────────────────────────────────────────────

describe('full game (fast surface)', () => {
  bench('playRandomGameFast (default config, walker seed 1)', () => {
    playRandomGameFast(BENCH_CONFIG_NO_EVENTS, 1, 10_000);
  });

  bench('playRandomGameFast (default config, walker seed 2)', () => {
    playRandomGameFast(BENCH_CONFIG_NO_EVENTS, 2, 10_000);
  });
});

// ─── 1000-game sweep on fast surface (the Phase 2 exit gate) ─────────────────

function runFastSweep(): void {
  for (let i = 0; i < 1000; i++) {
    playRandomGameFast(configWithSeedNoEvents(i), /* walkerSeed */ i + 1, 10_000);
  }
}

describe('sweep-1000 fast surface (Phase 2 exit gate)', () => {
  bench(
    '1000 games (fast surface)',
    () => {
      runFastSweep();
    },
    { iterations: 3, warmupIterations: 0, warmupTime: 0, time: 0 },
  );
});
