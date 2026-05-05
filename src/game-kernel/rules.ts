import type { TileValue, GameConfig } from './types.js';

/**
 * Rule D, k=2: result = lastValue × 2 × 2^⌊s/k⌋
 * where s = same-value extensions beyond the initial pair, k = config.ruleK
 *
 * Test vectors:
 * computeResultValue(2, 0, {ruleK:2}) = 4
 * computeResultValue(2, 2, {ruleK:2}) = 8
 * computeResultValue(8, 0, {ruleK:2}) = 16
 * computeResultValue(8, 3, {ruleK:2}) = 32
 * computeResultValue(2, 4, {ruleK:2}) = 16
 */
export function computeResultValue(
  lastValue: TileValue,
  sameExtensions: number,
  config: Pick<GameConfig, 'ruleK'>
): TileValue {
  const bonus = Math.floor(sameExtensions / config.ruleK);
  const result = lastValue * 2 * Math.pow(2, bonus);
  return result;
}
