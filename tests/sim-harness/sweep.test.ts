import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game-kernel/index.js';
import {
  createExperimentProfiles,
  flat,
  formatBatchTable,
  randomStrategy,
  runExperimentBatch,
  runSweep,
  scoreAgainstTarget,
} from '../../src/sim-harness/index.js';

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

describe('experiment profiles and scoring', () => {
  it('creates named profiles with design questions and valid weights', () => {
    const profiles = createExperimentProfiles(DEFAULT_CONFIG);
    expect(profiles.length).toBeGreaterThanOrEqual(12);
    expect(profiles.every(profile => profile.designQuestion.length > 0)).toBe(true);

    const flatConfig = flat(DEFAULT_CONFIG);
    expect(flatConfig.spawnWeights[2]).toBeGreaterThan(0);
    expect(flatConfig.spawnWeights[256]).toBeGreaterThan(0);
  });

  it('scores and classifies simulation rows', () => {
    const row = runSweep({
      baseConfig: DEFAULT_CONFIG,
      strategy: randomStrategy,
      runs: 1,
      seed: 31,
      maxTurns: 2,
      maxChainLength: 3,
      values: [{ label: 'k2', value: 2 }],
      applyValue: (config, ruleK) => ({ ...config, ruleK }),
    })[0];

    expect(row).toBeDefined();
    const score = scoreAgainstTarget(row!);
    expect(score.distance).toBeGreaterThanOrEqual(0);
    expect(score.labels.length).toBeGreaterThan(0);
  });

  it('runs a tiny experiment batch and formats a compact table', () => {
    const rows = runExperimentBatch({
      profiles: createExperimentProfiles(DEFAULT_CONFIG).slice(0, 1),
      strategies: [randomStrategy],
      runs: 1,
      seed: 40,
      maxTurns: 2,
      maxChainLength: 3,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.notableSeeds).toBeDefined();
    expect(formatBatchTable(rows)).toContain('profile\tstrategy');
  });
});
