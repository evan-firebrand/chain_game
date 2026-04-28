# tests/sim-harness

**Owner:** Test Agent
**Coverage requirement:** 80%+

Correctness tests for `src/sim-harness/`. The critical test property: same seed + same config must produce identical results across runs.

## What to test

- `runner.ts`: N games complete without error; results array has length N
- Determinism: run twice with same seed → identical results
- Harness correctness: for a known board state and seed, harness result matches manual kernel computation
- Strategy validity: each strategy always returns a legal chain or null (never an illegal chain)
- Coverage: `analyzer.ts` statistics are correct for known result sets
