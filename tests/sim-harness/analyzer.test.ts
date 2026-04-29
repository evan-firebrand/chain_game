import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game-kernel/index.js';
import { analyze } from '../../src/sim-harness/analyzer.js';
import type { GameConfig } from '../../src/game-kernel/index.js';
import type { GameResult } from '../../src/sim-harness/types.js';

const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42 };

function mkResult(overrides: {
  turns: number;
  maxTile: number;
  finalPhase?: 'playing' | 'game-over';
  deathCause?: 'no-legal-chain-start' | null;
  chainLengthHistogram?: number[];
  chainResultHistogram?: number[];
  strategySeed?: number;
}): GameResult {
  return {
    inputs: {
      config: CONFIG,
      strategy: 'random',
      strategySeed: overrides.strategySeed ?? 0,
    },
    outputs: {
      turns: overrides.turns,
      maxTile: overrides.maxTile,
      finalPhase: overrides.finalPhase ?? 'game-over',
      deathCause:
        overrides.deathCause === undefined
          ? 'no-legal-chain-start'
          : overrides.deathCause,
      chainLengthHistogram: overrides.chainLengthHistogram ?? [0, 0, 1],
      chainResultHistogram: overrides.chainResultHistogram ?? [0, 1, 0],
    },
  };
}

describe('analyze — aggregation', () => {
  it('throws if results.length !== options.n', () => {
    const results = [mkResult({ turns: 10, maxTile: 8 })];
    expect(() =>
      analyze(results, { config: CONFIG, strategy: 'random', n: 2, startStrategySeed: 0 }),
    ).toThrow();
  });

  it('completedGames counts only game-over results', () => {
    const results = [
      mkResult({ turns: 100, maxTile: 8, finalPhase: 'game-over' }),
      mkResult({ turns: 100, maxTile: 8, finalPhase: 'playing', deathCause: null }),
      mkResult({ turns: 100, maxTile: 8, finalPhase: 'game-over' }),
    ];
    const agg = analyze(results, { config: CONFIG, strategy: 'random', n: 3, startStrategySeed: 0 });
    expect(agg.outputs.completedGames).toBe(2);
  });

  it('mean/median game length only consider completed games', () => {
    const results = [
      mkResult({ turns: 10, maxTile: 4, finalPhase: 'game-over' }),
      mkResult({ turns: 20, maxTile: 4, finalPhase: 'game-over' }),
      mkResult({ turns: 99999, maxTile: 4, finalPhase: 'playing', deathCause: null }),
    ];
    const agg = analyze(results, { config: CONFIG, strategy: 'random', n: 3, startStrategySeed: 0 });
    expect(agg.outputs.meanGameLength).toBe(15);
    expect(agg.outputs.medianGameLength).toBe(15);
  });

  it('mean / median maxTile consider all games', () => {
    const results = [
      mkResult({ turns: 10, maxTile: 4 }),
      mkResult({ turns: 10, maxTile: 8 }),
      mkResult({ turns: 10, maxTile: 16 }),
    ];
    const agg = analyze(results, { config: CONFIG, strategy: 'random', n: 3, startStrategySeed: 0 });
    expect(agg.outputs.meanMaxTile).toBeCloseTo((4 + 8 + 16) / 3, 6);
    expect(agg.outputs.medianMaxTile).toBe(8);
  });

  it('maxTileDistribution counts each maxTile value', () => {
    const results = [
      mkResult({ turns: 10, maxTile: 4 }),
      mkResult({ turns: 10, maxTile: 4 }),
      mkResult({ turns: 10, maxTile: 8 }),
    ];
    const agg = analyze(results, { config: CONFIG, strategy: 'random', n: 3, startStrategySeed: 0 });
    expect(agg.outputs.maxTileDistribution['4']).toBe(2);
    expect(agg.outputs.maxTileDistribution['8']).toBe(1);
  });

  it('chainLengthDistribution sums per-game histograms', () => {
    const results = [
      mkResult({ turns: 5, maxTile: 4, chainLengthHistogram: [0, 0, 3, 1] }),
      mkResult({ turns: 4, maxTile: 4, chainLengthHistogram: [0, 0, 2, 0, 1] }),
    ];
    const agg = analyze(results, { config: CONFIG, strategy: 'random', n: 2, startStrategySeed: 0 });
    expect(agg.outputs.chainLengthDistribution).toEqual([0, 0, 5, 1, 1]);
  });

  it('chainResultDistribution sums per-game histograms', () => {
    const results = [
      mkResult({ turns: 3, maxTile: 8, chainResultHistogram: [0, 1, 1, 0] }),
      mkResult({ turns: 2, maxTile: 8, chainResultHistogram: [0, 0, 1, 0] }),
    ];
    const agg = analyze(results, { config: CONFIG, strategy: 'random', n: 2, startStrategySeed: 0 });
    expect(agg.outputs.chainResultDistribution.slice(0, 4)).toEqual([0, 1, 2, 0]);
  });

  it('deathCauseDistribution counts each cause; "none" for maxTurns-capped', () => {
    const results = [
      mkResult({ turns: 100, maxTile: 8, finalPhase: 'game-over', deathCause: 'no-legal-chain-start' }),
      mkResult({ turns: 100, maxTile: 8, finalPhase: 'game-over', deathCause: 'no-legal-chain-start' }),
      mkResult({ turns: 99999, maxTile: 8, finalPhase: 'playing', deathCause: null }),
    ];
    const agg = analyze(results, { config: CONFIG, strategy: 'random', n: 3, startStrategySeed: 0 });
    expect(agg.outputs.deathCauseDistribution['no-legal-chain-start']).toBe(2);
    expect(agg.outputs.deathCauseDistribution['none']).toBe(1);
  });
});

describe('analyze — percentile correctness', () => {
  it('p10/p50/p90 match known small dataset', () => {
    // 11 games with turns 1..11 → median=6, p10≈2, p90≈10
    const results = Array.from({ length: 11 }, (_, i) =>
      mkResult({ turns: i + 1, maxTile: 4 }),
    );
    const agg = analyze(results, { config: CONFIG, strategy: 'random', n: 11, startStrategySeed: 0 });
    expect(agg.outputs.medianGameLength).toBe(6);
    expect(agg.outputs.p10GameLength).toBeCloseTo(2, 6);
    expect(agg.outputs.p90GameLength).toBeCloseTo(10, 6);
  });
});

describe('analyze — passthrough of inputs', () => {
  it('inputs preserved verbatim', () => {
    const results = [mkResult({ turns: 10, maxTile: 8 })];
    const agg = analyze(results, {
      config: CONFIG,
      strategy: 'greedy',
      n: 1,
      startStrategySeed: 999,
    });
    expect(agg.inputs.config).toBe(CONFIG);
    expect(agg.inputs.strategy).toBe('greedy');
    expect(agg.inputs.n).toBe(1);
    expect(agg.inputs.startStrategySeed).toBe(999);
  });
});
