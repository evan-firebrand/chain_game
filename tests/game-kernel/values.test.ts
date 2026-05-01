import { describe, it, expect } from 'vitest';
import {
  isTileValue,
  isPlayableTileValue,
  forEachTileValueInRange,
} from '../../src/game-kernel/values.js';
import type { TileValue } from '../../src/game-kernel/types.js';

describe('isTileValue', () => {
  it('accepts 0 (empty tile)', () => {
    expect(isTileValue(0)).toBe(true);
  });

  it('accepts valid playable powers of 2', () => {
    expect(isTileValue(2)).toBe(true);
    expect(isTileValue(256)).toBe(true);
  });

  it('rejects non-power-of-2 values', () => {
    expect(isTileValue(3)).toBe(false);
    expect(isTileValue(7)).toBe(false);
  });
});

describe('isPlayableTileValue', () => {
  it('rejects 0 (empty)', () => {
    expect(isPlayableTileValue(0)).toBe(false);
  });

  it('rejects non-integers', () => {
    expect(isPlayableTileValue(2.5)).toBe(false);
  });
});

describe('forEachTileValueInRange', () => {
  it('does nothing when min > max', () => {
    const visited: number[] = [];
    forEachTileValueInRange(8 as TileValue, 4 as TileValue, v => visited.push(v));
    expect(visited).toEqual([]);
  });

  it('does nothing when min is not a playable value', () => {
    const visited: number[] = [];
    forEachTileValueInRange(3 as TileValue, 8 as TileValue, v => visited.push(v));
    expect(visited).toEqual([]);
  });

  it('visits all powers of 2 from min to max inclusive', () => {
    const visited: number[] = [];
    forEachTileValueInRange(4 as TileValue, 16 as TileValue, v => visited.push(v));
    expect(visited).toEqual([4, 8, 16]);
  });
});
