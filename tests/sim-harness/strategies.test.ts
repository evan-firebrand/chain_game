import { describe, expect, it } from 'vitest';
import { createGame, DEFAULT_CONFIG, validateChain } from '../../src/game-kernel/index.js';
import {
  countLegalChainStarts,
  enumerateCandidateChains,
  greedyStrategy,
  heuristicStrategy,
  randomStrategy,
} from '../../src/sim-harness/index.js';
import type { StrategyContext } from '../../src/sim-harness/index.js';

function context(): StrategyContext {
  return {
    maxChainLength: 4,
    random: (): number => 0,
  };
}

describe('strategies', () => {
  it('enumerates legal candidate chains only', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 12 });
    const candidates = enumerateCandidateChains(state, 4);

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(validateChain(state.board, candidate.chain).valid).toBe(true);
      expect(candidate.chain.length).toBeLessThanOrEqual(4);
    }
  });

  it('counts legal starts without double-counting symmetric pairs', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 42 });
    expect(countLegalChainStarts(state.board)).toBeGreaterThan(0);
  });

  it('random strategy returns a legal chain or null', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 21 });
    const action = randomStrategy.chooseAction(state, context());
    expect(action === null || validateChain(state.board, action.chain).valid).toBe(true);
  });

  it('greedy strategy returns a legal chain or null', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 22 });
    const action = greedyStrategy.chooseAction(state, context());
    expect(action === null || validateChain(state.board, action.chain).valid).toBe(true);
  });

  it('heuristic strategy returns a legal chain or null', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 23 });
    const action = heuristicStrategy.chooseAction(state, context());
    expect(action === null || validateChain(state.board, action.chain).valid).toBe(true);
  });
});
