import { bench, describe } from 'vitest';
import { BENCH_CONFIG, playRandomGame } from '../_helpers.js';

// Full-game benchmark: plays one game from createGame to game-over (or
// the maxTurns cap) using a random-legal-move strategy. This is where
// the O(T²) event-log spread shows up — every additional turn pays
// the cost of every prior turn's events.

describe('full game', () => {
  bench('playRandomGame (single game, default config, walker seed 1)', () => {
    playRandomGame(BENCH_CONFIG, 1, 10_000);
  });

  bench('playRandomGame (single game, default config, walker seed 2)', () => {
    playRandomGame(BENCH_CONFIG, 2, 10_000);
  });
});
