// Tests for the research-probe archetypes:
//   retirementAvoiderStrategy — refuses to create tiles higher than max-on-board
//   sweeperStrategy           — prefers chains whose result == 2 × spawnPoolMin
//   cleanupPrioritizerStrategy — prefers chains that include retired cells
//   adaptiveStrategy          — phase-aware: greedy in free play, non-escalating
//                               cleanup once retired tiles exist
//
// These archetypes are not canonical player skill tiers; they exist to probe
// hypotheses about what mechanism kills games (see plan / findings doc).

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, createGame, setTile, validateChain } from '../../src/game-kernel/index.js';
import type { Board, Cell, GameState, TileValue } from '../../src/game-kernel/index.js';
import {
  adaptiveStrategy,
  cleanupPrioritizerStrategy,
  retirementAvoiderStrategy,
  sweeperStrategy,
} from '../../src/sim-harness/index.js';

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

describe('retirementAvoiderStrategy', () => {
  it('returns a valid chain or null', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 7 });
    const { action } = retirementAvoiderStrategy.chooseAction(state);
    if (action !== null) {
      expect(validateChain(state.board, action.chain).valid).toBe(true);
    }
  });

  it('prefers a chain whose result <= max-on-board over one that exceeds it', () => {
    // Board layout:
    //   2 2 . . .
    //   . . . . .
    //   . . . . .
    //   8 . . . .
    //   8 . . . .
    //
    // Available chains:
    //   [2,2]  → result 4   (≤ max=8, preferred)
    //   [8,8]  → result 16  (> max=8, fallback)
    //
    // Avoider must pick the [2,2] chain. (Cells in chain matter because
    // findBestDeepChain searches every start.)
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(3, 0), { value: 8 as TileValue, retired: false });
    board = setTile(board, cell(4, 0), { value: 8 as TileValue, retired: false });
    const state = stateFromBoard(board, 8 as TileValue);

    const { action, diagnostics } = retirementAvoiderStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    expect(diagnostics?.projectedResultValue).toBeLessThanOrEqual(8);
  });

  it('falls back to lowest-result chain when every chain would overshoot', () => {
    // Board has only adjacent 8s. Max-on-board = 8. Any chain produces result ≥ 16.
    // Avoider has no preferred chain, must fall back. With only [8,8] as a chain,
    // it picks that — and we verify it's a legal commit.
    let board = emptyBoard(3, 3);
    board = setTile(board, cell(0, 0), { value: 8 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 8 as TileValue, retired: false });
    const state = stateFromBoard(board, 8 as TileValue);

    const { action } = retirementAvoiderStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    if (action !== null) {
      expect(validateChain(state.board, action.chain).valid).toBe(true);
    }
  });

  it('among preferred chains, picks the one with HIGHEST result (closest to ceiling)', () => {
    // Two preferred chains:
    //   [2, 2]   → result 4
    //   [4, 4]   → result 8
    // Lone 8 in a corner makes max-on-board = 8 (the avoider's ceiling).
    // Both chain results ≤ 8 → both preferred. Scorer is +offset + resultValue,
    // so result-8 chain wins.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(3, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 1), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(6, 5), { value: 8 as TileValue, retired: false });
    const state = stateFromBoard(board, 8 as TileValue);

    const { diagnostics } = retirementAvoiderStrategy.chooseAction(state);
    expect(diagnostics?.projectedResultValue).toBe(8);
  });
});

describe('sweeperStrategy', () => {
  it('returns a valid chain or null', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 7 });
    const { action } = sweeperStrategy.chooseAction(state);
    if (action !== null) {
      expect(validateChain(state.board, action.chain).valid).toBe(true);
    }
  });

  it('prefers a chain whose result == 2 × spawnPoolMin over higher-result chains', () => {
    // spawnPoolMin = 2 (DEFAULT_CONFIG). Target result = 4.
    // Available chains:
    //   [2, 2] → result 4   ← target match
    //   [4, 4] → result 8   ← non-match (higher)
    // Sweeper picks the [2,2] chain.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(3, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 1), { value: 4 as TileValue, retired: false });
    const state = stateFromBoard(board, 4 as TileValue);

    const { action, diagnostics } = sweeperStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    expect(diagnostics?.projectedResultValue).toBe(4);
  });

  it('falls back to byResultValue when no chain matches the target', () => {
    // No 2s on the board → no chain produces result=4. Sweeper falls back
    // to highest-result chain.
    //   [4, 4]  → result 8
    //   [8, 8]  → result 16
    // Falls back to byResultValue → picks the [8, 8] chain.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 0), { value: 8 as TileValue, retired: false });
    board = setTile(board, cell(3, 1), { value: 8 as TileValue, retired: false });
    const state = stateFromBoard(board, 8 as TileValue);

    const { diagnostics } = sweeperStrategy.chooseAction(state);
    expect(diagnostics?.projectedResultValue).toBe(16);
  });

  it('among target-matching chains, prefers the longer one', () => {
    // Three same-value 2s in a row produce a 3-tile chain whose result
    // is still 4 (Rule D: same-value extension at length 3 has bonus 1).
    // A 2-tile chain of 2s also gives result 4 but length 2.
    // Sweeper preferred-tier scorer is `+offset + chain.length`,
    // so the 3-tile chain wins.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 2), { value: 2 as TileValue, retired: false });
    const state = stateFromBoard(board, 4 as TileValue);

    const { action } = sweeperStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    if (action !== null) {
      expect(action.chain.length).toBe(3);
    }
  });
});

describe('cleanupPrioritizerStrategy', () => {
  it('returns a valid chain or null', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 7 });
    const { action } = cleanupPrioritizerStrategy.chooseAction(state);
    if (action !== null) {
      expect(validateChain(state.board, action.chain).valid).toBe(true);
    }
  });

  it('prefers a chain that includes retired cells over a higher-result chain that does not', () => {
    // Two available chains:
    //   [2(retired), 2(retired)] at (0,0)-(0,1) → result 4, includes 2 retired
    //   [4, 4] at (3,0)-(3,1)                   → result 8, includes 0 retired
    // Greedy would pick [4,4] (result 8). Cleanup-prioritizer must pick
    // [2,2] because it includes 2 retired cells.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(3, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 1), { value: 4 as TileValue, retired: false });
    const state = stateFromBoard(board, 4 as TileValue);

    const { action, diagnostics } = cleanupPrioritizerStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    expect(diagnostics?.projectedResultValue).toBe(4);
  });

  it('falls back to byResultValue when no chain includes any retired cells', () => {
    // No retired tiles on the board → cleanup-prioritizer's preferred
    // tier is empty. Falls back to byResultValue → picks the [4,4] chain
    // (result 8) over [2,2] (result 4).
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(3, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 1), { value: 4 as TileValue, retired: false });
    const state = stateFromBoard(board, 4 as TileValue);

    const { diagnostics } = cleanupPrioritizerStrategy.chooseAction(state);
    expect(diagnostics?.projectedResultValue).toBe(8);
  });

  it('among chains with retired cells, prefers the one with more retired cells', () => {
    // [2(retired), 2(retired), 2(retired)] at row 0 → 3 retired cells, result 4
    // [4(retired), 4] at row 3                       → 1 retired cell, result 8
    // Cleanup-prioritizer picks the row-0 chain because retiredCount=3 > 1.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(0, 2), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(3, 0), { value: 4 as TileValue, retired: true });
    board = setTile(board, cell(3, 1), { value: 4 as TileValue, retired: false });
    const state = stateFromBoard(board, 4 as TileValue);

    const { action } = cleanupPrioritizerStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    if (action !== null) {
      // The 3-cell row-0 chain wins.
      expect(action.chain.length).toBe(3);
    }
  });
});

describe('adaptiveStrategy', () => {
  it('returns a valid chain or null', () => {
    const state = createGame({ ...DEFAULT_CONFIG, prngSeed: 7 });
    const { action } = adaptiveStrategy.chooseAction(state);
    if (action !== null) {
      expect(validateChain(state.board, action.chain).valid).toBe(true);
    }
  });

  it('plays free-play greedy (highest resultValue) when no retired tiles exist', () => {
    // No retired tiles → free-play phase. Two chains:
    //   [2, 2] → result 4
    //   [4, 4] → result 8
    // Adaptive should pick [4,4] (greedy by resultValue), same as `skilled`.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(3, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 1), { value: 4 as TileValue, retired: false });
    const state = stateFromBoard(board, 4 as TileValue);

    const { action, diagnostics } = adaptiveStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    expect(diagnostics?.projectedResultValue).toBe(8);
    expect(diagnostics?.mode).toBe('greedy');
    expect(diagnostics?.reasonCode).toBe('adaptive-free-play');
  });

  it('switches to cleanup mode when any retired tile is on the board', () => {
    // One retired 2 alongside a chain of normal 4s.
    //   [2(retired), 2]  → result 4, includes 1 retired, ≤ ceiling 8 (preferred)
    //   [4, 4]           → result 8, no retired (fallback)
    // Free-play would pick [4,4]. Adaptive in cleanup mode picks the retired-
    // including chain because it's preferred-tier.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(3, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(3, 1), { value: 4 as TileValue, retired: false });
    const state = stateFromBoard(board, 8 as TileValue);

    const { action, diagnostics } = adaptiveStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    expect(diagnostics?.mode).toBe('cleanup');
    expect(diagnostics?.reasonCode).toBe('adaptive-cleanup-non-escalating');
    expect(diagnostics?.projectedResultValue).toBe(4);
  });

  it('refuses to escalate in cleanup mode: prefers non-escalating cleanup over higher-result cleanup', () => {
    // Ceiling = max-on-board = 8. Two cleanup-eligible chains:
    //   [2(retired), 2]            → result 4  (≤ 8, preferred)
    //   [4(retired), 4(retired)]   → result 8  (≤ 8, preferred — same retired count? no, has 2 retired)
    // To isolate the non-escalation rule, pair a low cleanup with an escalating cleanup:
    //   [2(retired), 2(retired)] → result 4, retired=2 ≤ 8 (preferred)
    //   [8(retired), 8]          → result 16, retired=1 > 8 (NOT preferred — escalates)
    // Adaptive picks the non-escalating chain even though the other has fewer
    // retired but a much bigger resultValue.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(3, 0), { value: 8 as TileValue, retired: true });
    board = setTile(board, cell(3, 1), { value: 8 as TileValue, retired: false });
    const state = stateFromBoard(board, 8 as TileValue);

    const { action, diagnostics } = adaptiveStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    expect(diagnostics?.projectedResultValue).toBe(4);
  });

  it('falls back to resultValue when no non-escalating cleanup chain exists', () => {
    // Only chain available is escalating: [8(retired), 8] → result 16, ceiling = 8.
    // No preferred chain exists. Adaptive falls back to byResultValue,
    // picking the only chain (which escalates).
    let board = emptyBoard(3, 3);
    board = setTile(board, cell(0, 0), { value: 8 as TileValue, retired: true });
    board = setTile(board, cell(0, 1), { value: 8 as TileValue, retired: false });
    const state = stateFromBoard(board, 8 as TileValue);

    const { action, diagnostics } = adaptiveStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    expect(diagnostics?.projectedResultValue).toBe(16);
  });

  it('among non-escalating cleanup chains, prefers more retired cells', () => {
    // Lone 4 in a corner sets max-on-board = 4 (the non-escalation ceiling).
    // Two cleanup-eligible chains:
    //   [2(retired), 2(retired), 2(retired)] → result 4 ≤ 4 ✓, retired=3, length=3
    //   [2(retired), 2]                       → result 4 ≤ 4 ✓, retired=1, length=2
    // Both preferred. Scorer is offset + retired*1000 + length, so the
    // 3-retired chain wins decisively.
    let board = emptyBoard(7, 6);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(0, 2), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(3, 0), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(3, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(6, 5), { value: 4 as TileValue, retired: false });
    const state = stateFromBoard(board, 4 as TileValue);

    const { action } = adaptiveStrategy.chooseAction(state);
    expect(action).not.toBeNull();
    if (action !== null) {
      expect(action.chain.length).toBe(3);
    }
  });
});
