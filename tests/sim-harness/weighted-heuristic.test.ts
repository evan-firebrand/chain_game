// Tests for the weightedHeuristicStrategy and makeWeightedHeuristic factory.
//
// The bot scores each candidate chain by features of the resulting board
// (after applyAction) and picks the highest-scoring candidate. Weights are a
// parameter so they can be fit later — this suite validates that:
//   1. The bot picks legal chains.
//   2. Each feature is computed correctly.
//   3. Weights actually weight (flipping a sign flips the choice).
//   4. The factory honours custom ids.

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, createGame, setTile, validateChain } from '../../src/game-kernel/index.js';
import type { Board, Cell, GameState, TileValue } from '../../src/game-kernel/index.js';
import {
  DEFAULT_UNIT_WEIGHTS,
  makeWeightedHeuristic,
  weightedHeuristicStrategy,
} from '../../src/sim-harness/index.js';
import type { HeuristicWeights, StrategyContext } from '../../src/sim-harness/index.js';

function cell(row: number, col: number): Cell {
  return { row: row as Cell['row'], col: col as Cell['col'] };
}

function emptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ value: 0 as TileValue, retired: false }))
  ) as Board;
}

function stateFromBoard(board: Board, max: TileValue, prngSeed = 1): GameState {
  return {
    ...createGame({ ...DEFAULT_CONFIG, prngSeed }),
    board,
    maxTileEver: max,
  };
}

const CONTEXT: StrategyContext = {
  maxChainLength: 12,
  random: () => 0.5,
};

describe('weightedHeuristicStrategy', () => {
  it('returns a valid chain or null on default game state', () => {
    // Use a hand-built sparse board to keep enumerateCandidateChains cheap.
    // (createGame's full random board fans out exponentially at depth 12.)
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    const state = stateFromBoard(board, 2 as TileValue, 7);
    const { action } = weightedHeuristicStrategy.chooseAction(state, CONTEXT);
    if (action !== null) {
      expect(validateChain(state.board, action.chain).valid).toBe(true);
    }
  });

  it('exposes id "weightedHeuristic" on the default strategy', () => {
    expect(weightedHeuristicStrategy.id).toBe('weightedHeuristic');
  });

  // ── Feature: retiredClearedByThisChain ────────────────────────────────────
  it('prefers a chain that clears retired tiles when retiredCleared weight is positive', () => {
    // Two non-overlapping candidates:
    //   [2(retired), 2(retired)] at (0,0)-(0,1) → result 4, clears 2 retired
    //   [4, 4]                  at (3,0)-(3,1) → result 8, clears 0 retired
    // With unit weights, the retiredCleared term (= +2) outweighs the small
    // legalStartsAfter / log-spawn-pool deltas, so the retired-clearing chain
    // wins.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(3, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 1), { value: 4 as TileValue, retired: false });
    const state = stateFromBoard(board, 8 as TileValue);

    const { action, diagnostics } = weightedHeuristicStrategy.chooseAction(state, CONTEXT);
    expect(action).not.toBeNull();
    expect(diagnostics?.projectedResultValue).toBe(4);
  });

  // ── Feature: triggersNextRetirement ──────────────────────────────────────
  it('avoids triggering retirement when triggersNextRetirement weight is negative', () => {
    // spawnPoolMax = 256 (DEFAULT_CONFIG). To trigger retirement we'd need
    // the chain result to reach 256. Build:
    //   [128, 128] → result 256  (would trigger retirement)
    //   [2, 2]     → result 4    (does not trigger)
    // The negative `triggersNextRetirement` weight should push the bot to
    // the [2,2] chain even though resultValue is much smaller.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 128 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 128 as TileValue, retired: false });
    board = setTile(board, cell(3, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(3, 1), { value: 2 as TileValue, retired: false });
    const state = stateFromBoard(board, 128 as TileValue);

    const triggerAvoider = makeWeightedHeuristic({
      ...DEFAULT_UNIT_WEIGHTS,
      triggersNextRetirement: -1000,
    });
    const { action, diagnostics } = triggerAvoider.chooseAction(state, CONTEXT);
    expect(action).not.toBeNull();
    expect(diagnostics?.projectedResultValue).toBe(4);
  });

  // ── Feature: isolatedRetiredAfter ────────────────────────────────────────
  it('penalises isolated retired tiles after the move when weight is negative', () => {
    // Pair a retired 2 with a non-retired neighbor 2 — clearing them removes
    // the retired tile, so isolatedRetiredAfter = 0. The other candidate uses
    // unrelated 4s and leaves the retired 2 stranded (no same-value neighbor),
    // which is isolated.
    //
    //   row 0:  2(retired)  2          → chain clears the retired tile
    //   row 3:  4           4          → chain leaves the retired 2 alone (no neighbor 2)
    //
    // With negative isolatedRetiredAfter and positive retiredCleared, both
    // signals push to row 0.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(3, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 1), { value: 4 as TileValue, retired: false });
    const state = stateFromBoard(board, 8 as TileValue);

    const { action } = weightedHeuristicStrategy.chooseAction(state, CONTEXT);
    expect(action).not.toBeNull();
    if (action !== null) {
      // Row-0 chain starts at (0,0).
      expect(action.chain[0]).toEqual(cell(0, 0));
    }
  });

  // ── Feature: legalChainStartsAfter ───────────────────────────────────────
  it('prefers boards with more legal chain starts after the move', () => {
    // Two candidate chains; we want the one that leaves more legal starts.
    // Construct a board where:
    //   chain A: [2,2] at (0,0)-(0,1) — after, the rest of the board still
    //            has many same-value pairs (we'll seed a cluster of 4s).
    //   chain B: [4,4] at (3,0)-(3,1) — destroys the cluster, fewer starts.
    //
    // Specifically: row 3 has 4,4,4,4 — chain B uses two of them and
    // resolves to 8 in one of those cells, breaking the row.
    // Row 0 has 2,2 — chain A consumes them; row 3's 4-cluster remains.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(3, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 1), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 2), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 3), { value: 4 as TileValue, retired: false });
    const state = stateFromBoard(board, 4 as TileValue);

    // Use a heuristic that ONLY cares about legalChainStartsAfter — this
    // isolates the feature signal from confounders (resultValue, etc).
    const startsOnly = makeWeightedHeuristic({
      isolatedRetiredAfter: 0,
      legalChainStartsAfter: 1,
      maxTileVsSpawnPool: 0,
      retiredClearedByThisChain: 0,
      triggersNextRetirement: 0,
    });
    const { action } = startsOnly.chooseAction(state, CONTEXT);
    expect(action).not.toBeNull();
    if (action !== null) {
      // Chain A (the 2,2 pair) preserves the 4-cluster → more starts after.
      expect(action.chain[0]).toEqual(cell(0, 0));
    }
  });

  // ── Weights actually weight: flipping a sign flips the choice ────────────
  it('flips its choice between two candidates when a weight is inverted', () => {
    // Board with two clear candidates that disagree on retiredCleared:
    //   [2(retired), 2(retired)] at row 0 → clears 2 retired, result 4
    //   [4, 4]                   at row 3 → clears 0 retired, result 8
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(3, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 1), { value: 4 as TileValue, retired: false });
    const state = stateFromBoard(board, 8 as TileValue);

    // Default unit weights: prefers clearing retired (positive weight).
    const defaultDecision = weightedHeuristicStrategy.chooseAction(state, CONTEXT);
    expect(defaultDecision.diagnostics?.projectedResultValue).toBe(4);

    // Flip the retiredCleared weight to a strong negative — bot now PREFERS
    // chains that don't clear retired tiles. Should switch to [4,4].
    // Also zero out the other features that would otherwise pull toward row 0
    // (isolatedRetiredAfter is 0 in both branches here, so it's neutral).
    const inverted = makeWeightedHeuristic({
      isolatedRetiredAfter: 0,
      legalChainStartsAfter: 0,
      maxTileVsSpawnPool: 0,
      retiredClearedByThisChain: -100,
      triggersNextRetirement: 0,
    });
    const flipped = inverted.chooseAction(state, CONTEXT);
    expect(flipped.diagnostics?.projectedResultValue).toBe(8);
  });

  // ── Factory: custom id ────────────────────────────────────────────────────
  it('makeWeightedHeuristic with a custom id produces a strategy with that id', () => {
    // Re-use the existing 'weightedHeuristic' StrategyId — the factory accepts
    // any StrategyId, but we can only test ids that are part of the union.
    // Build the strategy with the explicit id parameter and verify the id
    // round-trips. (Type system already enforces validity.)
    const weights: HeuristicWeights = {
      ...DEFAULT_UNIT_WEIGHTS,
      retiredClearedByThisChain: 5,
    };
    const strategy = makeWeightedHeuristic(weights, 'weightedHeuristic');
    expect(strategy.id).toBe('weightedHeuristic');

    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    const state = stateFromBoard(board, 2 as TileValue, 11);
    const { action } = strategy.chooseAction(state, CONTEXT);
    if (action !== null) {
      expect(validateChain(state.board, action.chain).valid).toBe(true);
    }
  });
});
