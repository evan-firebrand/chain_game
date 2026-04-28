import { computeChainResult } from '../../game-kernel/index.js';
import type { Cell, GameState } from '../../game-kernel/index.js';
import type { SimStrategy, StrategyContext, StrategyDecision } from '../types.js';
import {
  buildConstructiveChain,
  cellKey,
  compareCell,
  countIsolatedRetiredTiles,
  findLegalChainStarts,
  legalExtensionsForChain,
  toDecision,
} from './common.js';
import type { CandidateChain } from './common.js';

const LONG_CHAIN_CAP = 24;

function boardCapacity(state: GameState): number {
  return state.board.length * (state.board[0]?.length ?? 0);
}

function highCap(state: GameState): number {
  return Math.min(LONG_CHAIN_CAP, boardCapacity(state));
}

function randomStart(state: GameState, context: StrategyContext): readonly [Cell, Cell] | undefined {
  const starts = findLegalChainStarts(state);
  const index = Math.floor(context.random() * starts.length);
  return starts[Math.min(index, starts.length - 1)];
}

function locallyBestExtension(state: GameState, chain: readonly Cell[], extensions: readonly Cell[]): Cell | null {
  return [...extensions].sort((a, b) => {
    const leftValue = computeChainResult(state.board, [...chain, a], state.config);
    const rightValue = computeChainResult(state.board, [...chain, b], state.config);
    if (leftValue !== rightValue) return rightValue - leftValue;
    const leftTile = state.board[a.row]?.[a.col]?.value ?? 0;
    const rightTile = state.board[b.row]?.[b.col]?.value ?? 0;
    if (leftTile !== rightTile) return rightTile - leftTile;
    return compareCell(a, b);
  })[0] ?? null;
}

function randomWalkCandidate(
  state: GameState,
  context: StrategyContext,
  stopAfterSixProbability: number
): CandidateChain | undefined {
  const start = randomStart(state, context);
  if (start === undefined) return undefined;

  return buildConstructiveChain(state, start, highCap(state), (_state, chain, extensions) => {
    if (chain.length >= 6 && context.random() < stopAfterSixProbability) return null;
    const index = Math.floor(context.random() * extensions.length);
    return extensions[Math.min(index, extensions.length - 1)] ?? null;
  });
}

function greedyWalkCandidate(state: GameState): CandidateChain | undefined {
  return findLegalChainStarts(state)
    .map(start => buildConstructiveChain(state, start, highCap(state), locallyBestExtension))
    .sort((a, b) => {
      if (a.resultValue !== b.resultValue) return b.resultValue - a.resultValue;
      if (a.chain.length !== b.chain.length) return b.chain.length - a.chain.length;
      return compareCell(a.chain[0]!, b.chain[0]!);
    })[0];
}

function soonToRetireValue(state: GameState): number {
  return state.spawnPoolMin;
}

function cleanupCandidate(state: GameState, maxLength: number): CandidateChain | undefined {
  const retiringValue = soonToRetireValue(state);
  const starts = findLegalChainStarts(state)
    .filter(start => start.some(cell => state.board[cell.row]?.[cell.col]?.value === retiringValue));

  const preferredStarts = starts.length > 0 ? starts : findLegalChainStarts(state);
  const start = [...preferredStarts].sort((a, b) => compareCell(a[0], b[0]))[0];
  if (start === undefined) return undefined;

  return buildConstructiveChain(state, start, maxLength, (_state, _chain, extensions) => {
    const retiringExtensions = extensions.filter(
      cell => state.board[cell.row]?.[cell.col]?.value === retiringValue
    );
    const pool = retiringExtensions.length > 0 ? retiringExtensions : extensions;
    return [...pool].sort(compareCell)[0] ?? null;
  });
}

function setupCandidate(state: GameState): CandidateChain | undefined {
  const starts = findLegalChainStarts(state);
  const start = [...starts].sort((a, b) => compareCell(a[0], b[0]))[0];
  if (start === undefined) return undefined;
  return buildConstructiveChain(state, start, 5, (_state, chain, extensions) => {
    const byFutureOptions = [...extensions].sort((a, b) => {
      const left = legalExtensionsForChain(state, [...chain, a]).length;
      const right = legalExtensionsForChain(state, [...chain, b]).length;
      if (left !== right) return right - left;
      return compareCell(a, b);
    });
    return byFutureOptions[0] ?? null;
  });
}

function recoveryCandidate(state: GameState): CandidateChain | undefined {
  const retiredCells: Cell[] = [];
  for (let r = 0; r < state.board.length; r++) {
    for (let c = 0; c < (state.board[0]?.length ?? 0); c++) {
      const tile = state.board[r]?.[c];
      if (tile?.retired === true && tile.value !== 0) {
        retiredCells.push({ row: r as Cell['row'], col: c as Cell['col'] });
      }
    }
  }

  const starts = findLegalChainStarts(state).filter(start =>
    start.some(cell => retiredCells.some(retired => cellKey(retired) === cellKey(cell)))
  );
  const start = [...(starts.length > 0 ? starts : findLegalChainStarts(state))]
    .sort((a, b) => compareCell(a[0], b[0]))[0];
  if (start === undefined) return undefined;
  return buildConstructiveChain(state, start, 4, locallyBestExtension);
}

function thresholdCrosses(state: GameState, candidate: CandidateChain): boolean {
  return candidate.resultValue >= state.spawnPoolMax * 2;
}

function milestoneCandidate(state: GameState): CandidateChain | undefined {
  const candidates = findLegalChainStarts(state).map(start =>
    buildConstructiveChain(state, start, highCap(state), locallyBestExtension)
  );
  return candidates.sort((a, b) => {
    const aCrosses = thresholdCrosses(state, a) ? 1 : 0;
    const bCrosses = thresholdCrosses(state, b) ? 1 : 0;
    if (aCrosses !== bCrosses) return bCrosses - aCrosses;
    if (a.resultValue !== b.resultValue) return b.resultValue - a.resultValue;
    return b.chain.length - a.chain.length;
  })[0];
}

function hasRecentRetirement(state: GameState): boolean {
  const last = state.events[state.events.length - 1];
  return last?.kind === 'retirement-fired' || state.events.slice(-3).some(event => event.kind === 'retirement-fired');
}

function hasRetiredTiles(state: GameState): boolean {
  return countIsolatedRetiredTiles(state.board) > 0;
}

function isNearMilestone(state: GameState): boolean {
  return state.maxTileEver >= state.spawnPoolMax || findLegalChainStarts(state).some(start => {
    const candidate = buildConstructiveChain(state, start, 8, locallyBestExtension);
    return thresholdCrosses(state, candidate);
  });
}

export const longRandomWalkStrategy: SimStrategy = {
  id: 'longRandomWalk',
  chooseAction(state: GameState, context: StrategyContext): StrategyDecision {
    return toDecision(
      randomWalkCandidate(state, context, 0.18),
      'long-random-walk',
      'constructive-random-extension',
      'push'
    );
  },
};

export const longGreedyWalkStrategy: SimStrategy = {
  id: 'longGreedyWalk',
  chooseAction(state: GameState): StrategyDecision {
    return toDecision(
      greedyWalkCandidate(state),
      'long-greedy-walk',
      'constructive-best-local-extension',
      'push'
    );
  },
};

export const milestonePushStrategy: SimStrategy = {
  id: 'milestonePush',
  chooseAction(state: GameState): StrategyDecision {
    const candidate = isNearMilestone(state) ? milestoneCandidate(state) : setupCandidate(state);
    return toDecision(
      candidate,
      isNearMilestone(state) ? 'milestone' : 'setup',
      isNearMilestone(state) ? 'push-through-threshold' : 'prepare-for-threshold',
      isNearMilestone(state) ? 'milestone' : 'setup'
    );
  },
};

export const preRetirementCleanupStrategy: SimStrategy = {
  id: 'preRetirementCleanup',
  chooseAction(state: GameState): StrategyDecision {
    const candidate = isNearMilestone(state) ? cleanupCandidate(state, 4) : setupCandidate(state);
    return toDecision(
      candidate,
      isNearMilestone(state) ? 'cleanup' : 'setup',
      isNearMilestone(state) ? 'clear-soon-retiring-tier' : 'improve-board-options',
      isNearMilestone(state) ? 'cleanup' : 'setup'
    );
  },
};

export const strategicHumanLikeStrategy: SimStrategy = {
  id: 'strategicHumanLike',
  chooseAction(state: GameState): StrategyDecision {
    if (hasRecentRetirement(state) || hasRetiredTiles(state)) {
      return toDecision(recoveryCandidate(state), 'recovery', 'retirement-fallout', 'recovery');
    }

    if (isNearMilestone(state)) {
      const cleanup = cleanupCandidate(state, 4);
      if (cleanup !== undefined && cleanup.chain.some(cell => state.board[cell.row]?.[cell.col]?.value === soonToRetireValue(state))) {
        return toDecision(cleanup, 'cleanup', 'pre-milestone-cleanup', 'cleanup');
      }
      return toDecision(milestoneCandidate(state), 'milestone', 'controlled-threshold-push', 'milestone');
    }

    const build = greedyWalkCandidate(state);
    if (build !== undefined && build.chain.length >= 10) {
      return toDecision(build, 'build', 'long-compatible-path-available', 'push');
    }

    const setup = setupCandidate(state);
    if (setup !== undefined) {
      return toDecision(setup, 'setup', 'improve-future-options', 'setup');
    }

    return toDecision(build, 'build', 'fallback-build', 'push');
  },
};
