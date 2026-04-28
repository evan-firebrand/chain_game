import type { GameState } from '../../game-kernel/index.js';
import type { SimStrategy, StrategyContext } from '../types.js';
import { enumerateCandidateChains, toCommitAction } from './common.js';

export const randomStrategy: SimStrategy = {
  id: 'random',
  chooseAction(state: GameState, context: StrategyContext) {
    const candidates = enumerateCandidateChains(state, context.maxChainLength);
    if (candidates.length === 0) return null;

    const index = Math.floor(context.random() * candidates.length);
    const candidate = candidates[Math.min(index, candidates.length - 1)];
    return candidate === undefined ? null : toCommitAction(candidate);
  },
};
