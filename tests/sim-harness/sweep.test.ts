import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game-kernel/index.js';
import { randomStrategy, runSweep } from '../../src/sim-harness/index.js';

describe('runSweep', () => {
  it('runs one simulation row per provided value', () => {
    const rows = runSweep({
      baseConfig: DEFAULT_CONFIG,
      strategy: randomStrategy,
      runs: 1,
      seed: 30,
      maxTurns: 2,
      maxChainLength: 3,
      values: [
        { label: 'k2', value: 2 },
        { label: 'k3', value: 3 },
      ],
      applyValue: (config, ruleK) => ({ ...config, ruleK }),
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.inputs.config.ruleK).toBe(2);
    expect(rows[1]?.inputs.config.ruleK).toBe(3);
  });
});
