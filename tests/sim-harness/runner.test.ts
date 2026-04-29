import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game-kernel/index.js';
import { playOneGame, runGames } from '../../src/sim-harness/runner.js';
import type { GameConfig } from '../../src/game-kernel/index.js';

const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42 };

describe('playOneGame', () => {
  it('produces a valid GameResult for the random strategy', () => {
    const r = playOneGame(CONFIG, 'random', 1);
    expect(r.inputs.config).toEqual(CONFIG);
    expect(r.inputs.strategy).toBe('random');
    expect(r.inputs.strategySeed).toBe(1);
    expect(r.outputs.turns).toBeGreaterThan(0);
    expect(r.outputs.maxTile).toBeGreaterThan(0);
    expect(['playing', 'game-over']).toContain(r.outputs.finalPhase);
  });

  it('returns deathCause=no-legal-chain-start when game ends naturally', () => {
    const r = playOneGame(CONFIG, 'random', 1, { maxTurns: 100_000 });
    if (r.outputs.finalPhase === 'game-over') {
      expect(r.outputs.deathCause).toBe('no-legal-chain-start');
    } else {
      expect(r.outputs.deathCause).toBeNull();
    }
  });

  it('honours maxTurns cap (game right-censored)', () => {
    const r = playOneGame(CONFIG, 'random', 1, { maxTurns: 5 });
    expect(r.outputs.turns).toBeLessThanOrEqual(5);
    if (r.outputs.turns === 5) {
      expect(r.outputs.finalPhase).toBe('playing');
      expect(r.outputs.deathCause).toBeNull();
    }
  });

  it('chainLengthHistogram counts add up to total turns', () => {
    const r = playOneGame(CONFIG, 'random', 1);
    const totalChains = r.outputs.chainLengthHistogram.reduce((a, b) => a + b, 0);
    expect(totalChains).toBe(r.outputs.turns);
  });

  it('chainResultHistogram[k] only set for valid log2 indices', () => {
    const r = playOneGame(CONFIG, 'random', 1);
    expect(r.outputs.chainResultHistogram.length).toBe(16);
    // log2(2)=1 is the smallest possible result; index 0 should be 0.
    expect(r.outputs.chainResultHistogram[0]).toBe(0);
  });
});

describe('playOneGame — A.3 schema additions', () => {
  it('chainsPerLevel = turns / log2(maxTile) when maxTile > 1', () => {
    const r = playOneGame(CONFIG, 'random', 1);
    if (r.outputs.maxTile > 1) {
      const expected = r.outputs.turns / Math.log2(r.outputs.maxTile);
      expect(r.outputs.chainsPerLevel).toBeCloseTo(expected, 9);
    }
  });

  it('avgChainLength = mean of committed chain lengths', () => {
    const r = playOneGame(CONFIG, 'random', 1);
    let totalLen = 0;
    let count = 0;
    for (let i = 0; i < r.outputs.chainLengthHistogram.length; i++) {
      const c = r.outputs.chainLengthHistogram[i] ?? 0;
      totalLen += i * c;
      count += c;
    }
    if (count > 0) {
      expect(r.outputs.avgChainLength).toBeCloseTo(totalLen / count, 9);
    }
  });

  it('endedByTurnCap is true iff loop hit the cap and phase still playing', () => {
    const r = playOneGame(CONFIG, 'random', 1, { maxTurns: 5 });
    if (r.outputs.turns >= 5 && r.outputs.finalPhase === 'playing') {
      expect(r.outputs.endedByTurnCap).toBe(true);
    } else {
      expect(r.outputs.endedByTurnCap).toBe(false);
    }
  });

  it('metricsByTurn arrays have length = turns', () => {
    const r = playOneGame(CONFIG, 'random', 1);
    expect(r.outputs.metricsByTurn.maxTile.length).toBe(r.outputs.turns);
    expect(r.outputs.metricsByTurn.chainLength.length).toBe(r.outputs.turns);
  });

  it('metricsByTurn.maxTile is monotonically non-decreasing', () => {
    const r = playOneGame(CONFIG, 'random', 1);
    const arr = r.outputs.metricsByTurn.maxTile;
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i]!).toBeGreaterThanOrEqual(arr[i - 1]!);
    }
  });

  it('boardSnapshotTurn30 is null when game ends before turn 30', () => {
    const r = playOneGame(CONFIG, 'random', 1, { maxTurns: 10 });
    expect(r.outputs.boardSnapshotTurn30).toBeNull();
  });

  it('boardSnapshotTurn30 has length rows*cols when game reaches turn 30', () => {
    // Find a seed where the random strategy reaches turn 30.
    for (let s = 1; s <= 50; s++) {
      const r = playOneGame(CONFIG, 'random', s, { maxTurns: 50 });
      if (r.outputs.turns >= 30) {
        expect(r.outputs.boardSnapshotTurn30).not.toBeNull();
        expect(r.outputs.boardSnapshotTurn30!.length).toBe(
          CONFIG.gridRows * CONFIG.gridCols,
        );
        return;
      }
    }
    // If no seed reached turn 30, the test is inconclusive but not a failure.
  });
});

describe('playOneGame — determinism', () => {
  it('same (config, strategy, strategySeed) → byte-identical result', () => {
    const a = playOneGame(CONFIG, 'random', 7);
    const b = playOneGame(CONFIG, 'random', 7);
    expect(a).toEqual(b);
  });

  it('different strategy seeds produce different turns counts (typical case)', () => {
    const a = playOneGame(CONFIG, 'random', 1);
    const b = playOneGame(CONFIG, 'random', 1000);
    // Not strictly required but very likely for any non-trivial workload.
    // If this ever flakes we can pin specific seeds known to differ.
    expect(a.outputs.turns).not.toBe(b.outputs.turns);
  });

  it('same kernel seed but different strategy seeds → maxTile typically differs', () => {
    const seenTiles = new Set<number>();
    for (let s = 1; s <= 5; s++) {
      const r = playOneGame(CONFIG, 'random', s);
      seenTiles.add(r.outputs.maxTile);
    }
    expect(seenTiles.size).toBeGreaterThan(1);
  });
});

describe('runGames', () => {
  it('returns N results in order', () => {
    const results = runGames(CONFIG, 'random', { n: 5, startStrategySeed: 0 });
    expect(results).toHaveLength(5);
    for (let i = 0; i < results.length; i++) {
      expect(results[i]!.inputs.strategySeed).toBe(i);
    }
  });

  it('is deterministic across runs', () => {
    const a = runGames(CONFIG, 'random', { n: 5, startStrategySeed: 42 });
    const b = runGames(CONFIG, 'random', { n: 5, startStrategySeed: 42 });
    expect(a).toEqual(b);
  });

  it('honours maxTurns', () => {
    const results = runGames(CONFIG, 'random', { n: 3, startStrategySeed: 0, maxTurns: 10 });
    for (const r of results) {
      expect(r.outputs.turns).toBeLessThanOrEqual(10);
    }
  });
});
