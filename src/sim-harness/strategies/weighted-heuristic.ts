// Tetris-style weighted heuristic bot.
//
// Scores each candidate chain by features of the board AFTER applyAction.
// Weights are a parameter of the strategy (not hardcoded) so a follow-up PR
// can fit them to recorded human play. This PR ships unit weights as a
// baseline.
//
// Sign convention: weights have signs baked in (negative for "bad" features).
// The score is sum(feature × weight) directly — no extra negation. So with
// `isolatedRetiredAfter: -1`, more isolated retired tiles produces a more
// negative score, correctly pushing the bot away from those moves.
//
// Implementation note: uses findBestDeepChain (O(depth) memory) rather than
// enumerateCandidateChains. Candidate enumeration at depth 12+ on a populated
// board produces millions of paths; storing them all blows the heap. Instead
// we DFS, scoring each candidate inline (which calls applyAction once per
// candidate to get the resulting board for feature extraction).

import { applyAction } from '../../game-kernel/index.js';
import type { GameState } from '../../game-kernel/index.js';
import type { SimStrategy, StrategyContext, StrategyDecision, StrategyId } from '../types.js';
import {
  countIsolatedRetiredTiles,
  countLegalChainStarts,
  countRetiredTiles,
  findBestDeepChain,
  maxTileOnBoard,
  toCommitAction,
  toDecision,
} from './common.js';
import type { CandidateChain } from './common.js';

// Cap at 6: our scorer calls applyAction per candidate, much heavier than
// engagedStrategy's resultValue-only scorer. Deeper caps explode runtime
// (depth 12 makes the smoke study run for >5 min on a populated 7×6 board).
// Depth 6 covers short chains and mid-length human-realistic chains; longer
// chains are still picked up via repeated turns. Increase via the factory's
// context.maxChainLength if a study calls for it.
const MAX_CHAIN_LENGTH = 6;

export interface HeuristicWeights {
  /** Negative — more isolated retired tiles after the move is worse. */
  readonly isolatedRetiredAfter: number;
  /** Positive — more legal chain starts after the move is better. */
  readonly legalChainStartsAfter: number;
  /** Negative — bigger gap between max-on-board and spawn-pool max is worse. */
  readonly maxTileVsSpawnPool: number;
  /** Positive — clearing retired tiles with this chain is good. */
  readonly retiredClearedByThisChain: number;
  /** Negative by default — triggering retirement is risky. */
  readonly triggersNextRetirement: number;
}

// Fitted from 252 human turns via scripts/fit-weights.ts (top-3 accuracy: 11.5%)
export const DEFAULT_UNIT_WEIGHTS: HeuristicWeights = {
  isolatedRetiredAfter: -10,
  legalChainStartsAfter: 0.5,
  maxTileVsSpawnPool: -1,
  retiredClearedByThisChain: 6.5,
  triggersNextRetirement: -1,
};

function log2Safe(value: number): number {
  if (value <= 0) return 0;
  return Math.log2(value);
}

function scoreCandidate(
  state: GameState,
  prevRetiredCount: number,
  weights: HeuristicWeights,
  candidate: CandidateChain
): number {
  const nextState = applyAction(state, toCommitAction(candidate));

  const isolatedRetiredAfter = countIsolatedRetiredTiles(nextState.board);
  const legalChainStartsAfter = countLegalChainStarts(nextState.board);
  const maxTile = maxTileOnBoard(nextState.board);
  const maxTileVsSpawnPool =
    maxTile === 0 ? 0 : log2Safe(maxTile) - log2Safe(nextState.spawnPoolMax);
  const retiredClearedByThisChain =
    prevRetiredCount - countRetiredTiles(nextState.board);
  const newEvents = nextState.events.slice(state.events.length);
  const triggersNextRetirement = newEvents.some(e => e.kind === 'retirement-fired') ? 1 : 0;

  return (
    isolatedRetiredAfter * weights.isolatedRetiredAfter +
    legalChainStartsAfter * weights.legalChainStartsAfter +
    maxTileVsSpawnPool * weights.maxTileVsSpawnPool +
    retiredClearedByThisChain * weights.retiredClearedByThisChain +
    triggersNextRetirement * weights.triggersNextRetirement
  );
}

export function makeWeightedHeuristic(
  weights: HeuristicWeights,
  id: StrategyId = 'weightedHeuristic'
): SimStrategy {
  return {
    id,
    chooseAction(state: GameState, context: StrategyContext): StrategyDecision {
      const cap = Math.min(context.maxChainLength, MAX_CHAIN_LENGTH);
      const prevRetiredCount = countRetiredTiles(state.board);
      const best = findBestDeepChain(state, cap, candidate =>
        scoreCandidate(state, prevRetiredCount, weights, candidate)
      );
      if (best === undefined) return { action: null };
      return toDecision(best, 'heuristic', 'weighted-heuristic', 'push');
    },
  };
}

export const weightedHeuristicStrategy: SimStrategy = makeWeightedHeuristic(
  DEFAULT_UNIT_WEIGHTS,
  'weightedHeuristic'
);
