import { describe, it, expect } from 'vitest';
import { GameSession, DEFAULT_CONFIG, computeChainResult } from '../../src/game-session/index.js';
import type {
  GameConfig,
  Cell,
  CommitChainAction,
  TilesSpawnedEvent,
  SessionEvent,
} from '../../src/game-session/index.js';

const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42 };

function cell(row: number, col: number): Cell {
  return { row: row as Cell['row'], col: col as Cell['col'] };
}

describe('GameSession.updateConfig — Tier 1 acceptance', () => {
  it('updates ruleK in state.config and emits state-changed', () => {
    const session = new GameSession(CONFIG);
    const events: SessionEvent[] = [];
    session.on(e => events.push(e));

    session.updateConfig({ ruleK: 5 });

    expect(session.getState().config.ruleK).toBe(5);
    expect(events).toHaveLength(1);
    expect(events[0]?.config.ruleK).toBe(5);
  });

  it('updates spawnWeights and the next spawn samples from new weights', () => {
    const session = new GameSession(CONFIG);
    // Force only-4 spawns by zeroing every weight except weight[4].
    session.updateConfig({
      spawnWeights: { 2: 0, 4: 1, 8: 0, 16: 0, 32: 0, 64: 0, 128: 0, 256: 0 },
    });

    // Find any same-value adjacent pair; commit it. The resulting spawn must be 4.
    const initial = session.getState();
    let chain: Cell[] | null = null;
    outer: for (let r = 0; r < initial.config.gridRows; r++) {
      for (let c = 0; c < initial.config.gridCols; c++) {
        const v = initial.board[r]?.[c]?.value ?? 0;
        if (v === 0) continue;
        if (c + 1 < initial.config.gridCols && initial.board[r]?.[c + 1]?.value === v) {
          chain = [cell(r, c), cell(r, c + 1)];
          break outer;
        }
        if (r + 1 < initial.config.gridRows && initial.board[r + 1]?.[c]?.value === v) {
          chain = [cell(r, c), cell(r + 1, c)];
          break outer;
        }
      }
    }
    expect(chain).not.toBeNull();
    if (chain === null) return;

    const events: SessionEvent[] = [];
    session.on(e => events.push(e));
    const action: CommitChainAction = { kind: 'commit-chain', chain };
    session.dispatch(action);

    const last = events[events.length - 1];
    const spawned = last?.kernelEvents.find(
      (k): k is TilesSpawnedEvent => k.kind === 'tiles-spawned'
    );
    expect(spawned).toBeDefined();
    if (spawned === undefined) return;
    for (const s of spawned.spawned) {
      expect(s.value).toBe(4);
    }
  });

  it('after updateConfig({ruleK: 4}), the next chain commit uses k=4 in result math', () => {
    const session = new GameSession(CONFIG);
    session.updateConfig({ ruleK: 4 });

    // Find a same-value pair on the seeded board.
    const initial = session.getState();
    let chain: Cell[] | null = null;
    outer: for (let r = 0; r < initial.config.gridRows; r++) {
      for (let c = 0; c < initial.config.gridCols; c++) {
        const v = initial.board[r]?.[c]?.value ?? 0;
        if (v === 0) continue;
        if (c + 1 < initial.config.gridCols && initial.board[r]?.[c + 1]?.value === v) {
          chain = [cell(r, c), cell(r, c + 1)];
          break outer;
        }
      }
    }
    expect(chain).not.toBeNull();
    if (chain === null) return;

    // computeChainResult is a pure query — passing the (now mutated) config from session must yield k=4 result.
    const expected = computeChainResult(initial.board, chain, initial.config);
    session.dispatch({ kind: 'commit-chain', chain });
    const after = session.getState();
    const chainResolved = after.events.find(e => e.kind === 'chain-resolved');
    expect(chainResolved).toBeDefined();
    if (chainResolved?.kind !== 'chain-resolved') return;
    expect(chainResolved.resultValue).toBe(expected);
  });

  it('empty patch is a no-op merge but still emits state-changed', () => {
    const session = new GameSession(CONFIG);
    const events: SessionEvent[] = [];
    session.on(e => events.push(e));
    const before = session.getState();
    session.updateConfig({});
    expect(events).toHaveLength(1);
    expect(session.getState().config).toEqual(before.config);
  });
});

describe('GameSession.updateConfig — Tier 2 rejection', () => {
  it.each([
    ['gridRows', { gridRows: 8 }],
    ['gridCols', { gridCols: 5 }],
    ['spawnPoolMin', { spawnPoolMin: 4 as const }],
    ['spawnPoolMax', { spawnPoolMax: 128 as const }],
    ['prngSeed', { prngSeed: 999 }],
  ])('throws on Tier 2 key %s', (_, patch) => {
    const session = new GameSession(CONFIG);
    expect(() => { session.updateConfig(patch as Partial<GameConfig>); }).toThrow(/Tier 2/);
  });

  it('Tier 2 rejection leaves state unchanged', () => {
    const session = new GameSession(CONFIG);
    const before = session.getState();
    expect(() => { session.updateConfig({ gridRows: 8 }); }).toThrow();
    expect(session.getState()).toBe(before);
  });
});
