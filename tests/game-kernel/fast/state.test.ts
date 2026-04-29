import { describe, it, expect } from 'vitest';
import { createGame, DEFAULT_CONFIG } from '../../../src/game-kernel/index.js';
import {
  fromPure,
  readCell,
  toPure,
  writeCell,
} from '../../../src/game-kernel/fast/state.js';
import { packTile, unpackTile } from '../../../src/game-kernel/fast/encoding.js';
import type { GameConfig, TileValue } from '../../../src/game-kernel/types.js';

const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42 };

describe('fromPure / toPure round-trip', () => {
  it('preserves every cell value across pure → fast → pure', () => {
    const pure = createGame(CONFIG);
    const fast = fromPure(pure);
    const round = toPure(fast);

    for (let r = 0; r < CONFIG.gridRows; r++) {
      for (let c = 0; c < CONFIG.gridCols; c++) {
        const original = pure.board[r]![c]!;
        const back = round.board[r]![c]!;
        expect(back.value).toBe(original.value);
        expect(back.retired).toBe(original.retired);
      }
    }
  });

  it('preserves every metadata field', () => {
    const pure = createGame(CONFIG);
    const fast = fromPure(pure);
    const round = toPure(fast);

    expect(round.phase).toBe(pure.phase);
    expect(round.turn).toBe(pure.turn);
    expect(round.maxTileEver).toBe(pure.maxTileEver);
    expect(round.spawnPoolMin).toBe(pure.spawnPoolMin);
    expect(round.spawnPoolMax).toBe(pure.spawnPoolMax);
    expect(round.prngState).toBe(pure.prngState);
    expect(round.config).toBe(pure.config);
  });

  it('toPure produces an empty events array by default', () => {
    const fast = fromPure(createGame(CONFIG));
    const pure = toPure(fast);
    expect(pure.events).toEqual([]);
    expect(pure.lastEvents).toEqual([]);
  });

  it('toPure honors supplied events / lastEvents', () => {
    const fast = fromPure(createGame(CONFIG));
    const evs = [{ kind: 'tiles-spawned' as const, spawned: [] }];
    const pure = toPure(fast, { events: evs, lastEvents: evs });
    expect(pure.events).toBe(evs);
    expect(pure.lastEvents).toBe(evs);
  });
});

describe('FastState board layout', () => {
  it('board buffer length is rows * cols', () => {
    const fast = fromPure(createGame(CONFIG));
    expect(fast.board.length).toBe(CONFIG.gridRows * CONFIG.gridCols);
  });

  it('board is a Uint8Array (mutable)', () => {
    const fast = fromPure(createGame(CONFIG));
    expect(fast.board).toBeInstanceOf(Uint8Array);
  });

  it('readCell decodes the same value the pure board has', () => {
    const pure = createGame(CONFIG);
    const fast = fromPure(pure);
    for (let r = 0; r < CONFIG.gridRows; r++) {
      for (let c = 0; c < CONFIG.gridCols; c++) {
        const byte = readCell(fast, r, c);
        const tile = unpackTile(byte);
        expect(tile.value).toBe(pure.board[r]![c]!.value);
      }
    }
  });

  it('writeCell + readCell round-trip produces the written byte', () => {
    const fast = fromPure(createGame(CONFIG));
    const newByte = packTile(64 as TileValue, true);
    writeCell(fast, 3, 2, newByte);
    expect(readCell(fast, 3, 2)).toBe(newByte);
    const tile = unpackTile(readCell(fast, 3, 2));
    expect(tile.value).toBe(64);
    expect(tile.retired).toBe(true);
  });
});

describe('FastState mutation semantics', () => {
  it('mutating fast.board does not affect the source pure state', () => {
    const pure = createGame(CONFIG);
    const fast = fromPure(pure);

    writeCell(fast, 0, 0, 0); // clear (0,0)

    // The pure board is unchanged; fast diverges.
    expect(pure.board[0]![0]!.value).not.toBe(0);
    expect(readCell(fast, 0, 0)).toBe(0);
  });

  it('toPure after mutation reflects the mutated state, not the original', () => {
    const pure = createGame(CONFIG);
    const fast = fromPure(pure);
    writeCell(fast, 0, 0, packTile(8 as TileValue, false));
    const round = toPure(fast);
    expect(round.board[0]![0]!.value).toBe(8);
  });
});
