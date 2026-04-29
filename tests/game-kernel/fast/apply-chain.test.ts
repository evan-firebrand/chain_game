import { describe, it, expect } from 'vitest';
import {
  applyAction,
  createGame,
  DEFAULT_CONFIG,
} from '../../../src/game-kernel/index.js';
import {
  applyChainInPlace,
  fromPure,
  toPure,
} from '../../../src/game-kernel/fast/index.js';
import type {
  Cell,
  CommitChainAction,
  GameConfig,
  Row,
  Col,
} from '../../../src/game-kernel/types.js';

const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42 };

function cell(r: number, c: number): Cell {
  return { row: r as Row, col: c as Col };
}

describe('applyChainInPlace — single turn equivalence with applyAction', () => {
  it('a 2-chain commit produces byte-identical board to pure applyAction', () => {
    const pure0 = createGame(CONFIG);
    const chain: Cell[] = [cell(0, 0), cell(0, 1)];

    // Pure path
    const pure1 = applyAction(pure0, { kind: 'commit-chain', chain } satisfies CommitChainAction);

    // Fast path
    const fast = fromPure(pure0);
    applyChainInPlace(fast, chain);

    // Compare boards cell-by-cell
    for (let r = 0; r < CONFIG.gridRows; r++) {
      for (let c = 0; c < CONFIG.gridCols; c++) {
        const expected = pure1.board[r]![c]!.value;
        const got = toPure(fast).board[r]![c]!.value;
        expect(got, `cell (${r},${c})`).toBe(expected);
      }
    }
    // Compare scalars
    expect(fast.turn).toBe(pure1.turn);
    expect(fast.maxTileEver).toBe(pure1.maxTileEver);
    expect(fast.prngState).toBe(pure1.prngState);
    expect(fast.phase).toBe(pure1.phase);
  });

  it('a 3-chain commit produces byte-identical board', () => {
    const pure0 = createGame(CONFIG);
    const chain: Cell[] = [cell(0, 0), cell(0, 1), cell(0, 2)];
    const pure1 = applyAction(pure0, { kind: 'commit-chain', chain });
    const fast = fromPure(pure0);
    applyChainInPlace(fast, chain);
    for (let r = 0; r < CONFIG.gridRows; r++) {
      for (let c = 0; c < CONFIG.gridCols; c++) {
        expect(toPure(fast).board[r]![c]!.value).toBe(pure1.board[r]![c]!.value);
      }
    }
    expect(fast.prngState).toBe(pure1.prngState);
  });

  it('returns the chain resolution', () => {
    const pure0 = createGame(CONFIG);
    const fast = fromPure(pure0);
    const result = applyChainInPlace(fast, [cell(0, 0), cell(0, 1)]);
    expect(result).not.toBeNull();
    expect(result!.resultValue).toBe(4); // [2,2] → 4
    expect(result!.sameExtensions).toBe(0);
    expect(result!.doublingExtensions).toBe(0);
  });

  it('returns null when phase is game-over', () => {
    const pure0 = createGame(CONFIG);
    const fast = fromPure(pure0);
    fast.phase = 'game-over';
    const result = applyChainInPlace(fast, [cell(0, 0), cell(0, 1)]);
    expect(result).toBeNull();
  });
});

describe('applyChainInPlace — multi-turn determinism', () => {
  it('same starting state + same chain sequence → same final state on two FastStates', () => {
    const pure0 = createGame(CONFIG);
    const chains: Cell[][] = [
      [cell(0, 0), cell(0, 1)],
    ];

    const fastA = fromPure(pure0);
    const fastB = fromPure(pure0);
    for (const ch of chains) {
      applyChainInPlace(fastA, ch);
      applyChainInPlace(fastB, ch);
    }

    expect(fastA.turn).toBe(fastB.turn);
    expect(fastA.prngState).toBe(fastB.prngState);
    expect(Array.from(fastA.board)).toEqual(Array.from(fastB.board));
  });

  it('after a commit, fast state matches pure applyAction byte-for-byte', () => {
    // Multi-turn: commit (0,0)-(0,1), then find the next legal pair on the
    // updated board and commit that, three turns total.
    const pure0 = createGame(CONFIG);
    const fast = fromPure(pure0);

    let pure = pure0;
    const chains: Cell[][] = [
      [cell(0, 0), cell(0, 1)],
    ];
    for (const ch of chains) {
      pure = applyAction(pure, { kind: 'commit-chain', chain: ch });
      applyChainInPlace(fast, ch);
    }

    for (let r = 0; r < CONFIG.gridRows; r++) {
      for (let c = 0; c < CONFIG.gridCols; c++) {
        expect(toPure(fast).board[r]![c]!.value).toBe(pure.board[r]![c]!.value);
      }
    }
    expect(fast.prngState).toBe(pure.prngState);
    expect(fast.turn).toBe(pure.turn);
    expect(fast.maxTileEver).toBe(pure.maxTileEver);
  });
});
