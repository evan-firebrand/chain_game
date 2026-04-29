import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game-kernel/index.js';
import { sweep } from '../../src/sim-harness/sweep.js';
import type { GameConfig } from '../../src/game-kernel/index.js';

const BASE: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42 };

describe('sweep — shape', () => {
  it('produces one row per sweepValue', () => {
    const result = sweep({
      baseConfig: BASE,
      sweepKey: 'prngSeed',
      sweepValues: [1, 2, 3],
      strategy: 'random',
      n: 2,
      startStrategySeed: 0,
      maxTurns: 50,
    });
    expect(result.outputs.rows).toHaveLength(3);
  });

  it('each row.config has sweepKey overridden, other fields preserved', () => {
    const result = sweep({
      baseConfig: BASE,
      sweepKey: 'ruleK',
      sweepValues: [2, 3],
      strategy: 'random',
      n: 1,
      startStrategySeed: 0,
      maxTurns: 20,
    });
    expect(result.outputs.rows[0]!.inputs.config.ruleK).toBe(2);
    expect(result.outputs.rows[1]!.inputs.config.ruleK).toBe(3);
    expect(result.outputs.rows[0]!.inputs.config.gridRows).toBe(BASE.gridRows);
    expect(result.outputs.rows[1]!.inputs.config.spawnPoolMax).toBe(BASE.spawnPoolMax);
  });

  it('inputs preserved verbatim on the SweepResult', () => {
    const result = sweep({
      baseConfig: BASE,
      sweepKey: 'prngSeed',
      sweepValues: [10, 20],
      strategy: 'random',
      n: 2,
      startStrategySeed: 99,
      maxTurns: 20,
    });
    expect(result.inputs.sweepKey).toBe('prngSeed');
    expect(result.inputs.sweepValues).toEqual([10, 20]);
    expect(result.inputs.strategy).toBe('random');
    expect(result.inputs.n).toBe(2);
    expect(result.inputs.startStrategySeed).toBe(99);
    expect(result.inputs.baseConfig).toBe(BASE);
  });
});

describe('sweep — determinism', () => {
  it('identical inputs → byte-identical SweepResult', () => {
    const opts = {
      baseConfig: BASE,
      sweepKey: 'prngSeed' as const,
      sweepValues: [1, 2, 3],
      strategy: 'random' as const,
      n: 3,
      startStrategySeed: 0,
      maxTurns: 100,
    };
    const a = sweep(opts);
    const b = sweep(opts);
    expect(a).toEqual(b);
  });
});

describe('sweep — varying prngSeed produces varied outputs', () => {
  it('different kernel seeds produce measurably different aggregate stats', () => {
    // The random strategy only commits 2-cell chains, so ruleK (which
    // only matters for >=3-chains via the sameExtensions/k bonus) has no
    // effect on its games. To verify the sweep machinery actually
    // produces varied output, vary a config knob the random strategy
    // does respond to: prngSeed (which determines the spawn sequence).
    const result = sweep({
      baseConfig: BASE,
      sweepKey: 'prngSeed',
      sweepValues: [1, 2, 3],
      strategy: 'random',
      n: 5,
      startStrategySeed: 0,
      maxTurns: 500,
    });
    const a = result.outputs.rows[0]!.outputs;
    const c = result.outputs.rows[2]!.outputs;
    const meansDiffer = Math.abs(a.meanGameLength - c.meanGameLength) > 0.0001;
    const distDiffer =
      JSON.stringify(a.maxTileDistribution) !== JSON.stringify(c.maxTileDistribution);
    expect(meansDiffer || distDiffer).toBe(true);
  });
});
