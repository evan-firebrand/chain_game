import { bench, describe } from 'vitest';
import { configWithSeed, configWithSeedNoEvents, playRandomGame } from './_helpers.js';

// THE PHASE 5 GATE.
//
// docs/engineering/ARCHITECTURE.md mandates that the sim harness must run
// 1000 games in under 60s. This bench is the source of truth for that
// number and it lives here permanently — every perf change is measured
// against it.
//
// Workload: 1000 games at the default config, varying both kernel seed
// and walker seed so we get representative game-length variance. The
// kernel seed varies so the kernel PRNG sees different spawn sequences;
// the walker seed varies so the strategy makes different choices.
//
// We disable warmup and cap iterations because a single iteration of
// this bench is on the order of seconds — vitest's default 500ms budget
// would otherwise run zero full iterations.

function runSweep(): void {
  for (let i = 0; i < 1000; i++) {
    playRandomGame(configWithSeed(i), /* walkerSeed */ i + 1, /* maxTurns */ 10_000);
  }
}

function runSweepNoEvents(): void {
  for (let i = 0; i < 1000; i++) {
    playRandomGame(configWithSeedNoEvents(i), /* walkerSeed */ i + 1, /* maxTurns */ 10_000);
  }
}

describe('sweep-1000 (Phase 5 gate)', () => {
  // The recordEvents:true variant matches the historical UI/session
  // contract — kept here to compare against the no-events sim path.
  bench(
    '1000 games (recordEvents: true)',
    () => {
      runSweep();
    },
    { iterations: 3, warmupIterations: 0, warmupTime: 0, time: 0 },
  );

  // The recordEvents:false variant is what sim-harness will actually use.
  // This is the source of truth for the Phase 5 gate.
  bench(
    '1000 games (recordEvents: false — sim-harness path)',
    () => {
      runSweepNoEvents();
    },
    { iterations: 3, warmupIterations: 0, warmupTime: 0, time: 0 },
  );
});
