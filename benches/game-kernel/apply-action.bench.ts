import { bench, describe } from 'vitest';
import {
  applyAction,
  createGame,
  type CommitChainAction,
} from '../../src/game-kernel/index.js';
import { BENCH_CONFIG, enumerateLegalPairs } from '../_helpers.js';

// Single-turn benchmark: measures the cost of one commit-chain dispatch
// against a fresh, full board. This is the "per-turn" hot path and is
// dominated today by event-array spread, full-board copies, and validation.

const STATE = createGame(BENCH_CONFIG);
const PAIRS = enumerateLegalPairs(STATE.board);
const PAIR = PAIRS[0];
if (PAIR === undefined) {
  throw new Error('apply-action bench: fresh board has no legal pair (impossible per createGame contract)');
}
const ACTION: CommitChainAction = { kind: 'commit-chain', chain: PAIR };

describe('applyAction', () => {
  bench('applyAction (commit 2-cell chain on fresh board)', () => {
    applyAction(STATE, ACTION);
  });
});
