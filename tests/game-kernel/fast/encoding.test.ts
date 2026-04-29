import { describe, it, expect } from 'vitest';
import {
  MAX_PACKED,
  PACKED_EMPTY,
  packTile,
  packTileObj,
  unpackRetired,
  unpackTile,
  unpackValue,
} from '../../../src/game-kernel/fast/encoding.js';
import type { TileValue } from '../../../src/game-kernel/types.js';

const ALL_VALUES: TileValue[] = [
  0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192,
  // Compound values above the public enum (cast through `as TileValue`),
  // produced by the pure surface's lastValue × 2 × 2^bonus formula.
  16384 as TileValue, 32768 as TileValue,
];

describe('packTile', () => {
  it('empty non-retired packs to PACKED_EMPTY (0)', () => {
    expect(packTile(0, false)).toBe(PACKED_EMPTY);
    expect(PACKED_EMPTY).toBe(0);
  });

  it('value 2 non-retired packs to log2 nibble 1', () => {
    expect(packTile(2, false)).toBe(1);
  });

  it('value 8192 non-retired packs to log2 nibble 13', () => {
    expect(packTile(8192, false)).toBe(13);
  });

  it('value 2 retired packs with bit 4 set: (1 << 4) | 1 = 17', () => {
    expect(packTile(2, true)).toBe(17);
  });

  it('value 32768 retired packs to MAX_PACKED', () => {
    expect(packTile(32768 as TileValue, true)).toBe(MAX_PACKED);
    expect(MAX_PACKED).toBe(31);
  });

  it('compound result values above the public TileValue enum (16384) pack', () => {
    // The pure surface produces these via `as TileValue` casts; the fast
    // surface must accept them to remain equivalent.
    expect(packTile(16384 as TileValue, false)).toBe(14);
    expect(packTile(32768 as TileValue, false)).toBe(15);
  });

  it('packed bytes never set bits 5..7', () => {
    for (const v of ALL_VALUES) {
      expect(packTile(v, false) & 0xe0).toBe(0);
      expect(packTile(v, true) & 0xe0).toBe(0);
    }
  });

  it('throws on invalid TileValue', () => {
    expect(() => packTile(3 as TileValue, false)).toThrow();
    expect(() => packTile(99 as TileValue, false)).toThrow();
  });
});

describe('packTileObj', () => {
  it('matches packTile(value, retired)', () => {
    for (const v of ALL_VALUES) {
      for (const r of [false, true]) {
        expect(packTileObj({ value: v, retired: r })).toBe(packTile(v, r));
      }
    }
  });
});

describe('unpackValue / unpackRetired / unpackTile', () => {
  it('unpacks every packed (value, retired) round-trip exactly', () => {
    for (const v of ALL_VALUES) {
      for (const r of [false, true]) {
        const byte = packTile(v, r);
        expect(unpackValue(byte)).toBe(v);
        expect(unpackRetired(byte)).toBe(r);
        expect(unpackTile(byte)).toEqual({ value: v, retired: r });
      }
    }
  });

  it('PACKED_EMPTY decodes to {value:0, retired:false}', () => {
    expect(unpackTile(PACKED_EMPTY)).toEqual({ value: 0, retired: false });
  });

  it('decodes log2 nibble 14 → 16384 and 15 → 32768', () => {
    expect(unpackValue(14)).toBe(16384);
    expect(unpackValue(15)).toBe(32768);
  });

  it('round-trips through Tile -> byte -> Tile for every valid combination', () => {
    for (const v of ALL_VALUES) {
      for (const r of [false, true]) {
        const tile = { value: v, retired: r };
        expect(unpackTile(packTileObj(tile))).toEqual(tile);
      }
    }
  });
});
