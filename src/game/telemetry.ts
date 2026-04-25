import { computePeak, tileHistogram } from "./grid";
import { countPairs } from "./rules";
import { boardAwareWeights, pickAdversarial, spawnPool, spawnWeights } from "./spawn";
import { COLS } from "./types";
import type { GameState, Telemetry } from "./types";

export function buildTelemetry(state: GameState): Telemetry {
  const peak = computePeak(state.grid);
  const { starts, extensions, breakdown } = countPairs(state.grid);
  const pool = spawnPool(peak);
  // For antiPair, report the avg weights across all columns (a sense of the live distribution).
  let weights = spawnWeights();
  if (state.algo === "antiPair") {
    const agg = [0, 0, 0, 0];
    for (let c = 0; c < COLS; c++) {
      const w = boardAwareWeights(state.grid, c, peak, state.strength).weights;
      for (let i = 0; i < 4; i++) agg[i] += w[i];
    }
    weights = agg.map((v) => v / COLS);
  } else if (state.algo === "adversarial") {
    // Show the fraction of columns that would pick each pool index. Clearer signal
    // than a binary spike because adjacent columns can pick differently.
    const counts = [0, 0, 0, 0];
    for (let c = 0; c < COLS; c++) {
      const { value } = pickAdversarial(state.grid, c, peak);
      const idx = pool.indexOf(value);
      if (idx >= 0) counts[idx]++;
    }
    weights = counts.map((n) => n / COLS);
  }
  return {
    peak,
    spawnPool: pool,
    spawnWeights: weights,
    histogram: tileHistogram(state.grid),
    chainStarts: starts,
    chainExtensions: extensions,
    pairBreakdown: breakdown,
    lastMerge: state.lastMerge,
    recentStartCounts: state.recentStartCounts,
  };
}
