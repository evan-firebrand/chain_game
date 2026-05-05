// Player archetype strategies.
//
// Canonical skill profiles (model real player behaviour):
//   casual      — depth 5 greedy; player who doesn't look far ahead.
//                 Chains naturally stay 2–5 tiles.
//   engaged     — depth 12 greedy; thinks ahead but misses the absolute best.
//                 Chains typically 5–12 tiles.
//   skilled     — depth 20 greedy (deepest exhaustive search); finds the best
//                 available chain by resultValue.
//   speedrunner — depth 20, scores by resultValue² / chainLength; prefers
//                 high-value merges on fewer tiles.
//   adaptive    — depth 20, phase-aware. Plays free-play greedy when no retired
//                 tiles are on the board; switches to non-escalating cleanup
//                 (prefers chains containing retired cells whose result stays
//                 ≤ maxOnBoard) once retirement has fired. Tests the lifecycle
//                 framing: can a phase-switching bot conquer tiers?
//
// Research probes (NOT canonical skill tiers — used by studies to probe
// specific hypotheses about death mechanism):
//   retirementAvoider   — depth 12; refuses to create any tile higher than
//                         what's already on the board, so cannot trigger a
//                         new retirement. Used to test whether retirement is
//                         the load-bearing kill mechanism.
//   sweeper             — depth 12; prefers chains that consume the about-to-
//                         retire bottom tier without producing higher tiles.
//                         Used to test whether bottom-tier cleanup matters.
//   cleanupPrioritizer  — depth 12; prefers chains that include retired cells
//                         but ALWAYS prefers big chains within that constraint
//                         (escalates aggressively). Known-bad probe — its
//                         escalation triggers the next retirement before the
//                         current cleanup finishes. Preserved as comparison
//                         point for adaptive (which non-escalates).
//
// All use findBestDeepChain (O(depth) memory) rather than
// enumerateCandidateChains so deep depths don't OOM.

import type { GameState, TileValue } from '../../game-kernel/index.js';
import type { SimStrategy, StrategyDecision } from '../types.js';
import {
  countRetiredTiles,
  findBestDeepChain,
  maxTileOnBoard,
  toDecision,
} from './common.js';
import type { CandidateChain } from './common.js';

// Score tiers are separated by a large additive offset so a "preferred" chain
// always beats any "fallback" chain regardless of value magnitudes.
const PREFERRED_TIER_OFFSET = 1e12;

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

// Research probe: refuses to create any tile higher than what is already on
// the board (so the chain cannot trigger the next retirement). If no such
// chain exists, falls back to the lowest-resultValue chain available — which
// minimizes overshoot.
export const retirementAvoiderStrategy: SimStrategy = {
  id: 'retirementAvoider',
  chooseAction(state: GameState): StrategyDecision {
    const ceiling: TileValue = maxTileOnBoard(state.board);
    const score = (c: CandidateChain): number =>
      c.resultValue <= ceiling
        ? PREFERRED_TIER_OFFSET + c.resultValue
        : -c.resultValue;
    return toDecision(
      findBestDeepChain(state, 12, score),
      'greedy',
      'avoid-retirement-trigger',
      'setup'
    );
  },
};

// Research probe: prefers chains that consume the about-to-retire bottom
// tier without producing tiles above the active spawn pool — that is, chains
// whose resultValue is exactly 2 × spawnPoolMin. Tiebreak by longer chain so
// more bottom-tier tiles get cleared per turn. Falls back to byResultValue
// when no qualifying chain exists.
export const sweeperStrategy: SimStrategy = {
  id: 'sweeper',
  chooseAction(state: GameState): StrategyDecision {
    const target: TileValue = state.spawnPoolMin * 2;
    const score = (c: CandidateChain): number =>
      c.resultValue === target
        ? PREFERRED_TIER_OFFSET + c.chain.length
        : c.resultValue;
    return toDecision(
      findBestDeepChain(state, 12, score),
      'cleanup',
      'sweep-bottom-tier',
      'cleanup'
    );
  },
};

// Phase-aware adaptive bot. When no retired tiles exist, plays free-play
// greedy (resultValue, depth 20). When retired tiles are on the board,
// switches to non-escalating cleanup: prefers chains that include retired
// cells AND whose result does not exceed maxOnBoard (so the cleanup itself
// does not trigger the next retirement). Within preferred chains, scores by
// retiredCount * 1000 + chain.length — clear more retired tiles per turn,
// tiebreak by longer chain. When no preferred chain exists, falls back to
// resultValue (which may escalate — accepted weakness for v1).
//
// This is the bot the death-mechanism findings doc identifies as "the actual
// test of 'does the design work?'" If this bot conquers multiple tiers per
// game, the lifecycle is mechanically validated.
export const adaptiveStrategy: SimStrategy = {
  id: 'adaptive',
  chooseAction(state: GameState): StrategyDecision {
    const board = state.board;
    const inCleanupPhase = countRetiredTiles(board) > 0;

    if (inCleanupPhase) {
      const ceiling: TileValue = maxTileOnBoard(board);
      const score = (c: CandidateChain): number => {
        let retiredCount = 0;
        for (const cell of c.chain) {
          const tile = board[cell.row]?.[cell.col];
          if (tile?.retired === true) retiredCount++;
        }
        if (retiredCount > 0 && c.resultValue <= ceiling) {
          return PREFERRED_TIER_OFFSET + retiredCount * 1000 + c.chain.length;
        }
        return c.resultValue;
      };
      return toDecision(
        findBestDeepChain(state, 20, score),
        'cleanup',
        'adaptive-cleanup-non-escalating',
        'cleanup'
      );
    }

    return toDecision(
      findBestDeepChain(state, 20, byResultValue),
      'greedy',
      'adaptive-free-play',
      'push'
    );
  },
};

// Research probe: prefers chains that include retired cells — the strategy
// a real player adopts after retirement fires (clear the just-retired tier
// before gravity strands it). When no chain includes retired cells, falls
// back to byResultValue.
export const cleanupPrioritizerStrategy: SimStrategy = {
  id: 'cleanupPrioritizer',
  chooseAction(state: GameState): StrategyDecision {
    const board = state.board;
    const score = (c: CandidateChain): number => {
      let retiredCount = 0;
      for (const cell of c.chain) {
        const tile = board[cell.row]?.[cell.col];
        if (tile?.retired === true) retiredCount++;
      }
      if (retiredCount > 0) {
        return PREFERRED_TIER_OFFSET + retiredCount * 1000 + c.resultValue;
      }
      return c.resultValue;
    };
    return toDecision(
      findBestDeepChain(state, 12, score),
      'cleanup',
      'prioritize-retired-cells',
      'cleanup'
    );
  },
};
