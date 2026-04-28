import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/game-kernel/index.js';
import {
  greedyStrategy,
  randomStrategy,
  runSimulation,
} from '../../src/sim-harness/index.js';

describe('runSimulation', () => {
  it('returns exactly N game results', () => {
    const result = runSimulation({
      config: DEFAULT_CONFIG,
      strategy: randomStrategy,
      runs: 3,
      seed: 100,
      maxTurns: 4,
      maxChainLength: 3,
    });

    expect(result.games).toHaveLength(3);
    expect(result.inputs.runCount).toBe(3);
    expect(result.inputs.retirementMode).toBe('cascade');
  });

  it('is deterministic for the same seed, config, and strategy', () => {
    const options = {
      config: DEFAULT_CONFIG,
      strategy: randomStrategy,
      runs: 4,
      seed: 42,
      maxTurns: 6,
      maxChainLength: 3,
    };

    expect(runSimulation(options)).toEqual(runSimulation(options));
  });

  it('records legal committed chains in turn records', () => {
    const result = runSimulation({
      config: DEFAULT_CONFIG,
      strategy: greedyStrategy,
      runs: 1,
      seed: 5,
      maxTurns: 3,
      maxChainLength: 3,
    });

    for (const game of result.games) {
      for (const turn of game.turns) {
        expect(turn.chainLength).toBe(turn.chain.length);
        expect(turn.resultValue).toBeGreaterThan(0);
      }
    }
  });

  it('stops at max-turns when the game is still playing', () => {
    const result = runSimulation({
      config: DEFAULT_CONFIG,
      strategy: greedyStrategy,
      runs: 1,
      seed: 7,
      maxTurns: 1,
      maxChainLength: 3,
    });

    const game = result.games[0];
    expect(game?.finalTurn).toBe(1);
    if (game?.finalPhase === 'playing') {
      expect(game.deathCause).toBe('max-turns');
    }
  });
});
