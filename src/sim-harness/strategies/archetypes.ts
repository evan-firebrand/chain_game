// Player archetype strategies — four skill/behaviour profiles for simulation.
//
//   casual      — depth 5 greedy; models a player who doesn't look far ahead.
//                 Chains naturally stay 2–5 tiles.
//   engaged     — depth 12 greedy; thinks ahead but misses the absolute best.
//                 Chains typically 5–12 tiles.
//   skilled     — depth 20 greedy (deepest exhaustive search); finds the best
//                 available chain by resultValue.
//   speedrunner — depth 20, scores by resultValue² / chainLength; prefers
//                 high-value merges on fewer tiles.
//
// All four use findBestDeepChain (O(depth) memory) rather than
// enumerateCandidateChains so deep depths don't OOM.

import type { GameState } from '../../game-kernel/index.js';
import type { SimStrategy, StrategyDecision } from '../types.js';
import { findBestDeepChain, toDecision } from './common.js';
import type { CandidateChain } from './common.js';

function byResultValue(candidate: CandidateChain): number {
  return candidate.resultValue;
}

function byResultValuePerTile(candidate: CandidateChain): number {
  return candidate.resultValue * candidate.resultValue / candidate.chain.length;
}

export const casualStrategy: SimStrategy = {
  id: 'casual',
  chooseAction(state: GameState): StrategyDecision {
    return toDecision(
      findBestDeepChain(state, 5, byResultValue),
      'greedy',
      'shallow-best-result',
      'push'
    );
  },
};

export const engagedStrategy: SimStrategy = {
  id: 'engaged',
  chooseAction(state: GameState): StrategyDecision {
    return toDecision(
      findBestDeepChain(state, 12, byResultValue),
      'greedy',
      'moderate-best-result',
      'push'
    );
  },
};

export const skilledStrategy: SimStrategy = {
  id: 'skilled',
  chooseAction(state: GameState): StrategyDecision {
    return toDecision(
      findBestDeepChain(state, 20, byResultValue),
      'greedy',
      'deep-best-result',
      'push'
    );
  },
};

export const speedrunnerStrategy: SimStrategy = {
  id: 'speedrunner',
  chooseAction(state: GameState): StrategyDecision {
    return toDecision(
      findBestDeepChain(state, 20, byResultValuePerTile),
      'greedy',
      'result-squared-per-tile',
      'push'
    );
  },
};
