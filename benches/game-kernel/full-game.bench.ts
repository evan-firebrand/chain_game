import { bench, describe } from 'vitest';
import { BENCH_CONFIG, BENCH_CONFIG_NO_EVENTS, playRandomGame } from '../_helpers.js';

// Full-game benchmark: plays one game from createGame to game-over (or
// the maxTurns cap) using a random-legal-move strategy.
//
// The O(T²) event-log spread shows up in the recordEvents:true variants;
// the recordEvents:false variants are the actual sim-harness path.

describe('full game (recordEvents: true — UI/session path)', () => {
  bench('playRandomGame (default config, walker seed 1)', () => {
    playRandomGame(BENCH_CONFIG, 1, 10_000);
  });

  bench('playRandomGame (default config, walker seed 2)', () => {
    playRandomGame(BENCH_CONFIG, 2, 10_000);
  });
});

describe('full game (recordEvents: false — sim-harness path)', () => {
  bench('playRandomGame (default config, walker seed 1, no events)', () => {
    playRandomGame(BENCH_CONFIG_NO_EVENTS, 1, 10_000);
  });

  bench('playRandomGame (default config, walker seed 2, no events)', () => {
    playRandomGame(BENCH_CONFIG_NO_EVENTS, 2, 10_000);
  });
});
