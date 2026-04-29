import type { Tile, TileValue } from '../types.js';

// ─── Bit-packed cell encoding ────────────────────────────────────────────────
//
// One byte per cell. Layout (LSB → MSB):
//   bits 0..3   log2(value), 0 = empty, 1..15 = 2..32768
//   bit  4      retired
//   bits 5..7   reserved (must be zero)
//
// The 4-bit value field encodes log2 ∈ [0, 15], covering values up to 2^15
// = 32768. The public TileValue enum stops at 8192 (log2 13), but the pure
// surface routinely produces higher result values via `lastValue × 2 ×
// 2^floor(s/k)` and silently casts them through `as TileValue`. The fast
// surface follows that contract: any power-of-2 value up to 32768 packs
// successfully; anything outside that range throws.

/** Maximum cell byte value the kernel will ever produce. */
export const MAX_PACKED = (1 << 4) | 15;

/** Encoded value for an empty, non-retired cell. Reused as the "clear" byte. */
export const PACKED_EMPTY = 0;

const VALUE_BY_LOG2: readonly number[] = [
  0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768,
];

/**
 * Pack a tile into one byte. Accepts any power-of-2 value up to 32768
 * (TileValue or pure-surface-produced compound result). Throws on
 * non-power-of-2 inputs and on values that overflow the 4-bit field —
 * those represent silent state corruption upstream.
 */
export function packTile(value: TileValue, retired: boolean): number {
  if (value === 0) return retired ? 1 << 4 : 0;
  if ((value & (value - 1)) !== 0) {
    throw new Error(`packTile: ${value} is not a power of 2`);
  }
  const log2 = Math.log2(value);
  if (log2 < 1 || log2 > 15 || !Number.isInteger(log2)) {
    throw new Error(`packTile: ${value} outside encodable range (2..32768)`);
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
  /* v8 ignore next 3 — log2 is a 4-bit nibble, always in [0, 15],
     always a valid index into the 16-entry VALUE_BY_LOG2 table. */
  if (v === undefined) {
    throw new Error(`unpackValue: invalid log2 nibble ${log2} in byte ${byte}`);
  }
  return v as TileValue;
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
