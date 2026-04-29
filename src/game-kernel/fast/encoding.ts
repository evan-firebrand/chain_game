import type { Tile, TileValue } from '../types.js';

// ─── Bit-packed cell encoding ────────────────────────────────────────────────
//
// One byte per cell. Layout (LSB → MSB):
//   bits 0..3   log2(value), 0 = empty, 1..13 = 2..8192
//   bit  4      retired
//   bits 5..7   reserved (must be zero)
//
// 14 valid TileValues * 2 retired states = 28 valid byte values per cell.
// The fast surface stores a Uint8Array(rows * cols) of these bytes.

/** Maximum cell byte value the kernel will ever produce. */
export const MAX_PACKED = (1 << 4) | 13;

/** Encoded value for an empty, non-retired cell. Reused as the "clear" byte. */
export const PACKED_EMPTY = 0;

const VALUE_BY_LOG2: readonly TileValue[] = [
  0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192,
];

const LOG2_BY_VALUE: ReadonlyMap<TileValue, number> = new Map(
  VALUE_BY_LOG2.map((v, i) => [v, i] as const),
);

/**
 * Pack a tile into one byte. Throws on invalid values — encoding errors
 * are silent state corruption, so we fail loudly instead.
 */
export function packTile(value: TileValue, retired: boolean): number {
  const log2 = LOG2_BY_VALUE.get(value);
  if (log2 === undefined) {
    throw new Error(`packTile: invalid TileValue ${value}`);
  }
  return (retired ? 1 << 4 : 0) | log2;
}

/** Pack a Tile object. */
export function packTileObj(tile: Tile): number {
  return packTile(tile.value, tile.retired);
}

/** Read the value bits of a packed cell. */
export function unpackValue(byte: number): TileValue {
  const log2 = byte & 0x0f;
  const v = VALUE_BY_LOG2[log2];
  if (v === undefined) {
    throw new Error(`unpackValue: invalid log2 nibble ${log2} in byte ${byte}`);
  }
  return v;
}

/** Read the retired bit of a packed cell. */
export function unpackRetired(byte: number): boolean {
  return (byte & 0x10) !== 0;
}

/** Decode a full packed byte back to a Tile object. */
export function unpackTile(byte: number): Tile {
  return {
    value: unpackValue(byte),
    retired: unpackRetired(byte),
  };
}
