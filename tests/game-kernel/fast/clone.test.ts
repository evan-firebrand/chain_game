import { describe, it, expect } from 'vitest';
import { createGame, DEFAULT_CONFIG } from '../../../src/game-kernel/index.js';
import {
  cloneFast,
  fromPure,
  readCell,
  writeCell,
} from '../../../src/game-kernel/fast/state.js';
import { packTile } from '../../../src/game-kernel/fast/encoding.js';
import type { GameConfig, TileValue } from '../../../src/game-kernel/types.js';

const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42 };

describe('cloneFast', () => {
  it('produces byte-for-byte identical board buffer', () => {
    const source = fromPure(createGame(CONFIG));
    const clone = cloneFast(source);
    expect(clone.board.length).toBe(source.board.length);
    for (let i = 0; i < source.board.length; i++) {
      expect(clone.board[i]).toBe(source.board[i]);
    }
  });

  it('preserves every scalar field', () => {
    const source = fromPure(createGame(CONFIG));
    source.turn = 7;
    source.maxTileEver = 64 as TileValue;
    source.prngState = 123_456;
    const clone = cloneFast(source);
    expect(clone.rows).toBe(source.rows);
    expect(clone.cols).toBe(source.cols);
    expect(clone.phase).toBe(source.phase);
    expect(clone.turn).toBe(source.turn);
    expect(clone.maxTileEver).toBe(source.maxTileEver);
    expect(clone.spawnPoolMin).toBe(source.spawnPoolMin);
    expect(clone.spawnPoolMax).toBe(source.spawnPoolMax);
    expect(clone.prngState).toBe(source.prngState);
  });

  it('shares the config reference', () => {
    const source = fromPure(createGame(CONFIG));
    const clone = cloneFast(source);
    expect(clone.config).toBe(source.config);
  });

  it('mutating the clone board does not affect the source', () => {
    const source = fromPure(createGame(CONFIG));
    const sourceByte = readCell(source, 0, 0);
    const clone = cloneFast(source);
    writeCell(clone, 0, 0, packTile(8 as TileValue, false));
    expect(readCell(source, 0, 0)).toBe(sourceByte);
    expect(readCell(clone, 0, 0)).not.toBe(sourceByte);
  });

  it('mutating the source board does not affect the clone', () => {
    const source = fromPure(createGame(CONFIG));
    const clone = cloneFast(source);
    const cloneByte = readCell(clone, 0, 0);
    writeCell(source, 0, 0, packTile(8 as TileValue, false));
    expect(readCell(clone, 0, 0)).toBe(cloneByte);
    expect(readCell(source, 0, 0)).not.toBe(cloneByte);
  });

  it('mutating clone scalars does not affect the source', () => {
    const source = fromPure(createGame(CONFIG));
    const sourceTurn = source.turn;
    const sourcePrng = source.prngState;
    const sourcePhase = source.phase;
    const clone = cloneFast(source);
    clone.turn = 999;
    clone.prngState = 999_999;
    clone.phase = 'game-over';
    expect(source.turn).toBe(sourceTurn);
    expect(source.prngState).toBe(sourcePrng);
    expect(source.phase).toBe(sourcePhase);
  });
});
