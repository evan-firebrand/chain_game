import { bench, describe } from 'vitest';

describe('bench harness smoke', () => {
  bench('noop', () => {
    // intentionally empty — proves the bench runner is wired
  });
});
