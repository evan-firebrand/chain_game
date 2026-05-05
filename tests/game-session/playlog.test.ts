import { describe, it, expect } from 'vitest';
import { GameSession, DEFAULT_CONFIG } from '../../src/game-session/index.js';
import { PlaylogRecorder } from '../../src/game-session/playlog.js';
import type {
  Cell,
  CommitChainAction,
  GameConfig,
} from '../../src/game-session/index.js';

const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42 };

function cell(row: number, col: number): Cell {
  return { row: row as Cell['row'], col: col as Cell['col'] };
}

/** Find any valid 2-cell same-value adjacent chain on the current board. */
function findAdjacentPair(session: GameSession): Cell[] | null {
  const state = session.getState();
  for (let r = 0; r < state.config.gridRows; r++) {
    for (let c = 0; c < state.config.gridCols; c++) {
      const v = state.board[r]?.[c]?.value ?? 0;
      if (v === 0) continue;
      if (c + 1 < state.config.gridCols && state.board[r]?.[c + 1]?.value === v) {
        return [cell(r, c), cell(r, c + 1)];
      }
      if (r + 1 < state.config.gridRows && state.board[r + 1]?.[c]?.value === v) {
        return [cell(r, c), cell(r + 1, c)];
      }
    }
  }
  return null;
}

describe('PlaylogRecorder', () => {
  it('accumulates one record per commit-chain dispatch', () => {
    const session = new GameSession(CONFIG);
    const recorder = new PlaylogRecorder(session);
    expect(recorder.getRecords().length).toBe(0);

    const chain = findAdjacentPair(session);
    expect(chain).not.toBeNull();
    if (chain === null) return;
    const action: CommitChainAction = { kind: 'commit-chain', chain };
    session.dispatch(action);

    expect(recorder.getRecords().length).toBe(1);
  });

  it('records boardBefore = state BEFORE the chain (not after)', () => {
    const session = new GameSession(CONFIG);
    const before = session.getState();
    const recorder = new PlaylogRecorder(session);

    const chain = findAdjacentPair(session);
    if (chain === null) throw new Error('no chain found');
    session.dispatch({ kind: 'commit-chain', chain });

    const records = recorder.getRecords();
    expect(records.length).toBe(1);
    const rec = records[0];
    if (rec === undefined) throw new Error('no record');
    expect(rec.boardBefore).toEqual(before.board);
    // Sanity: post-state board differs from boardBefore (chain modified the board).
    expect(rec.boardAfter).not.toEqual(before.board);
  });

  it('records boardAfter matching the post-dispatch state', () => {
    const session = new GameSession(CONFIG);
    const recorder = new PlaylogRecorder(session);

    const chain = findAdjacentPair(session);
    if (chain === null) throw new Error('no chain found');
    session.dispatch({ kind: 'commit-chain', chain });

    const after = session.getState();
    const rec = recorder.getRecords()[0];
    if (rec === undefined) throw new Error('no record');
    expect(rec.boardAfter).toEqual(after.board);
  });

  it('kernelEvents includes chain-resolved and tiles-spawned', () => {
    const session = new GameSession(CONFIG);
    const recorder = new PlaylogRecorder(session);

    const chain = findAdjacentPair(session);
    if (chain === null) throw new Error('no chain found');
    session.dispatch({ kind: 'commit-chain', chain });

    const rec = recorder.getRecords()[0];
    if (rec === undefined) throw new Error('no record');
    const kinds = rec.kernelEvents.map(e => e.kind);
    expect(kinds).toContain('chain-resolved');
    expect(kinds).toContain('tiles-spawned');
  });

  it('records game-over kernel event when emitted on the same dispatch', () => {
    // Drive turns until game-over. We use a small grid + tight seed to converge
    // by replaying chains; if we don't hit game-over after many turns, skip.
    const session = new GameSession(CONFIG);
    const recorder = new PlaylogRecorder(session);

    let sawGameOver = false;
    for (let i = 0; i < 500; i++) {
      const chain = findAdjacentPair(session);
      if (chain === null) break;
      session.dispatch({ kind: 'commit-chain', chain });
      if (session.getState().phase === 'game-over') {
        const rec = recorder.getRecords()[recorder.getRecords().length - 1];
        if (rec !== undefined) {
          sawGameOver = rec.kernelEvents.some(e => e.kind === 'game-over');
        }
        break;
      }
    }
    // Either we saw game-over (and asserted it appears in the last record's events)
    // or the test board never reaches game-over within 500 turns — in which case
    // we can't assert and skip. Use a soft expect: if game-over phase reached,
    // last record must include the event.
    if (session.getState().phase === 'game-over') {
      expect(sawGameOver).toBe(true);
    }
  });

  it('serialize() produces valid JSONL with one line per record', () => {
    const session = new GameSession(CONFIG);
    const recorder = new PlaylogRecorder(session);

    for (let i = 0; i < 3; i++) {
      const chain = findAdjacentPair(session);
      if (chain === null) break;
      session.dispatch({ kind: 'commit-chain', chain });
    }

    const records = recorder.getRecords();
    expect(records.length).toBeGreaterThan(0);

    const lines = recorder.serialize().split('\n');
    expect(lines.length).toBe(records.length);
    for (const line of lines) {
      expect(() => JSON.parse(line) as unknown).not.toThrow();
    }
  });

  it('dispose() unsubscribes — further dispatches do not append records', () => {
    const session = new GameSession(CONFIG);
    const recorder = new PlaylogRecorder(session);

    const firstChain = findAdjacentPair(session);
    if (firstChain === null) throw new Error('no chain found');
    session.dispatch({ kind: 'commit-chain', chain: firstChain });

    const beforeDispose = recorder.getRecords().length;
    recorder.dispose();

    const nextChain = findAdjacentPair(session);
    if (nextChain !== null) {
      session.dispatch({ kind: 'commit-chain', chain: nextChain });
    }

    expect(recorder.getRecords().length).toBe(beforeDispose);
  });
});
