import { applyAction } from '../../game-kernel/index.js';
import type { GameState } from '../../game-kernel/index.js';
import type { SimStrategy, StrategyContext } from '../types.js';
import {
  compareChains,
  countLegalChainStarts,
  enumerateCandidateChains,
  toDecision,
  toCommitAction,
} from './common.js';

export const heuristicStrategy: SimStrategy = {
  id: 'heuristic',
  chooseAction(state: GameState, context: StrategyContext) {
    const candidates = enumerateCandidateChains(state, context.maxChainLength);
    if (candidates.length === 0) return { action: null };

    const scored = candidates.map(candidate => {
      const nextState = applyAction(state, toCommitAction(candidate));
      const retirementCount = nextState.events
        .slice(state.events.length)
        .filter(event => event.kind === 'retirement-fired').length;
      const legalStartsAfter = countLegalChainStarts(nextState.board);
      const poolProgress = candidate.resultValue >= state.spawnPoolMax ? 1 : 0;

      return {
        candidate,
        score:
          retirementCount * 1_000_000 +
          poolProgress * 100_000 +
          candidate.resultValue * 100 +
          candidate.chain.length * 10 +
          legalStartsAfter,
      };
    });

    const best = scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return compareChains(a.candidate.chain, b.candidate.chain);
    })[0];

    return toDecision(best?.candidate, 'heuristic', 'retirement-progress-board-health', 'push');
  },
};
