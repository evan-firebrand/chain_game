import type { TileValue } from './types.js';

export const EMPTY_TILE_VALUE = 0 as TileValue;
export const MIN_TILE_VALUE = 2 as TileValue;

export function isTileValue(value: number): value is TileValue {
  return value === EMPTY_TILE_VALUE || isPlayableTileValue(value);
}

export function isPlayableTileValue(value: number): value is TileValue {
  return Number.isInteger(value) && value >= MIN_TILE_VALUE && (value & (value - 1)) === 0;
}

export function nextTileValue(value: TileValue): TileValue | null {
  if (!isPlayableTileValue(value)) return null;
  const next = value * 2;
  return Number.isSafeInteger(next) ? next : null;
}

export function previousTileValue(value: TileValue): TileValue | null {
  if (!isPlayableTileValue(value) || value <= MIN_TILE_VALUE) return null;
  return (value / 2) as TileValue;
}

export function tileValueStepsBelow(value: TileValue, steps: number): TileValue | null {
  let current: TileValue | null = value;
  for (let i = 0; i < steps; i++) {
    if (current === null) return null;
    current = previousTileValue(current);
  }
  return current;
}

export function forEachTileValueInRange(
  min: TileValue,
  max: TileValue,
  visit: (value: TileValue) => void
): void {
  if (!isPlayableTileValue(min) || !isPlayableTileValue(max) || min > max) return;

  let value: TileValue | null = min;
  while (value !== null && value <= max) {
    visit(value);
    value = nextTileValue(value);
  }
}
