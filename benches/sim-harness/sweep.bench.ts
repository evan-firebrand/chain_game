import { bench, describe } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game-kernel/index.js';
import { runGames } from '../../src/sim-harness/runner.js';
import { analyze } from '../../src/sim-harness/analyzer.js';

// THE PHASE 5 GATE.
//
// docs/engineering/ARCHITECTURE.md (line 87) requires the sim harness to
// run "1000 games in <60s; deterministic; schema approved". This bench is
// the end-to-end source of truth for that number — strategies registered,
// schema-shaped output, the works.
//
// Measured per-strategy because the contract doesn't pin a strategy mix
// and game length varies by an order of magnitude across them.

const N = 1000;
const BASE_CONFIG = { ...DEFAULT_CONFIG, prngSeed: 0 };

describe('sim-harness sweep — Phase 5 gate (1000 games)', () => {
  bench(
    '1000 games (random strategy)',
    () => {
      const games = runGames(BASE_CONFIG, 'random', {
        n: N,
        startStrategySeed: 0,
      });
      // Aggregate too — that's the actual harness output, not just the raw games.
      analyze(games, {
        config: BASE_CONFIG,
        strategy: 'random',
        n: N,
        startStrategySeed: 0,
      });
    },
    { iterations: 3, warmupIterations: 0, warmupTime: 0, time: 0 },
  );

  bench(
    '1000 games (greedy strategy)',
    () => {
      const games = runGames(BASE_CONFIG, 'greedy', {
        n: N,
        startStrategySeed: 0,
      });
      analyze(games, {
        config: BASE_CONFIG,
        strategy: 'greedy',
        n: N,
        startStrategySeed: 0,
      });
    },
    { iterations: 3, warmupIterations: 0, warmupTime: 0, time: 0 },
  );

  bench(
    '1000 games (heuristic strategy)',
    () => {
      const games = runGames(BASE_CONFIG, 'heuristic', {
        n: N,
        startStrategySeed: 0,
      });
      analyze(games, {
        config: BASE_CONFIG,
        strategy: 'heuristic',
        n: N,
        startStrategySeed: 0,
      });
    },
    { iterations: 3, warmupIterations: 0, warmupTime: 0, time: 0 },
  );
});
