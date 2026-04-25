import { mergeValue } from "./chain";
import { enumerateLegalChains, canBeConsumed } from "./lookahead";
import { findDeadTiles, willResultBeOrphan } from "./rules";
import { getMode } from "./modes";
import { COLS, ROWS } from "./types";
import type { GameState } from "./types";

export type MoveSpaceStats = {
  // How many legal chains exist right now (capped — see lookahead MAX_CHAINS).
  totalChains: number;
  capped: boolean;
  // Chain-length histogram
  len2: number;
  len3: number;
  len4: number;
  len5Plus: number;
  // Result-value distribution (values that would land from these chains)
  resultDist: Array<{ value: number; count: number }>;
  // Percentage of legal chains whose result would be a truly-dead orphan
  orphanRatePct: number;
  // Tile status coverage (for all non-null tiles on the board)
  totalTiles: number;
  consumableK1: number;
  consumableK2: number;
  trulyDead: number;
  // Chain-quality score: mean result × mean length (higher = richer options)
  chainQuality: number;
};

function effectiveSpawnFloor(state: GameState): number | undefined {
  const behavior = getMode(state.mode);
  const modeFloor = behavior.spawnFloor?.(state);
  return state.ratchetEnabled
    ? Math.max(modeFloor ?? 2, state.ratchetFloor)
    : modeFloor;
}

export function computeMoveSpace(state: GameState): MoveSpaceStats {
  const chains = enumerateLegalChains(state.grid);
  const capped = chains.length >= 500;

  let len2 = 0, len3 = 0, len4 = 0, len5Plus = 0;
  const resultCounts = new Map<number, number>();
  let orphanChains = 0;

  for (const path of chains) {
    const len = path.length;
    if (len === 2) len2++;
    else if (len === 3) len3++;
    else if (len === 4) len4++;
    else len5Plus++;

    const values = path.map(({ r, c }) => (state.grid[r][c] as { value: number }).value);
    const result = mergeValue(values);
    resultCounts.set(result, (resultCounts.get(result) ?? 0) + 1);

    if (willResultBeOrphan(state.grid, path, result)) orphanChains++;
  }

  const resultDist = Array.from(resultCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => ({ value, count }));

  // Tile status coverage
  let totalTiles = 0;
  let consumableK1 = 0;
  let consumableK2 = 0;
  const floor = effectiveSpawnFloor(state);
  const k1Dead = findDeadTiles(state.grid, floor, state.peak, state.spawnQueue);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = state.grid[r][c];
      if (t === null) continue;
      totalTiles++;
      if (canBeConsumed(state, t.id, 1)) consumableK1++;
      if (canBeConsumed(state, t.id, 2)) consumableK2++;
    }
  }
  // Truly dead = K=1 dead AND K=2 can't rescue
  let trulyDead = 0;
  for (const id of k1Dead) {
    if (!canBeConsumed(state, id, 2)) trulyDead++;
  }

  const meanLen = chains.length === 0 ? 0 : chains.reduce((a, p) => a + p.length, 0) / chains.length;
  const meanResult = resultDist.length === 0
    ? 0
    : resultDist.reduce((a, { value, count }) => a + value * count, 0) /
      resultDist.reduce((a, { count }) => a + count, 0);
  const chainQuality = meanLen * meanResult;

  return {
    totalChains: chains.length,
    capped,
    len2, len3, len4, len5Plus,
    resultDist,
    orphanRatePct: chains.length === 0 ? 0 : (orphanChains / chains.length) * 100,
    totalTiles,
    consumableK1,
    consumableK2,
    trulyDead,
    chainQuality,
  };
}
