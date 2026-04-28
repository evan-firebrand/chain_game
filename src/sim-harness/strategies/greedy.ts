import type { GameState } from '../../game-kernel/index.js';
import type { SimStrategy, StrategyContext } from '../types.js';
import { compareChains, enumerateCandidateChains, toDecision } from './common.js';

export const greedyStrategy: SimStrategy = {
  id: 'greedy',
  chooseAction(state: GameState, context: StrategyContext) {
    const candidates = enumerateCandidateChains(state, context.maxChainLength);
    if (candidates.length === 0) return { action: null };

    const best = [...candidates].sort((a, b) => {
      if (a.resultValue !== b.resultValue) return b.resultValue - a.resultValue;
      if (a.chain.length !== b.chain.length) return b.chain.length - a.chain.length;
      return compareChains(a.chain, b.chain);
    })[0];

    return toDecision(best, 'greedy', 'highest-result-then-length', 'push');
  },
};
