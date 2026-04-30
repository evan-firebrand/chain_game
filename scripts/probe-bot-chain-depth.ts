/**
 * Probe: Bot chain depth cap.
 *
 * Confirms that MAX_DEPTH=5 in bot.ts means bots never consider chains
 * longer than 5 tiles, even when longer chains are legally available on
 * the board. Also quantifies the score fraction left on the table.
 *
 *   npx tsx scripts/probe-bot-chain-depth.ts
 *   npx tsx scripts/probe-bot-chain-depth.ts --n 10 --moves 30
 */

import { newGame, planCommit } from "../src/game/engine";
import { pickBestChainGreedy, deterministicSeeds } from "../src/game/bot";
import { isValidAppend, mergeValue, neighbors8 } from "../src/game/chain";
import { ROWS, COLS } from "../src/game/types";
import type { Coord, Grid, Tile } from "../src/game/types";
import { parseFlags, isMainModule, mean } from "./_lib";

// Mirrors bot.ts dfsAll, but without the MAX_DEPTH=5 guard.
// Safety cap at 25 to prevent runaway on degenerate boards.
function dfsUnlimited(
  grid: Grid,
  path: Coord[],
  values: number[],
  tiles: Tile[],
  used: Set<number>,
  best: { score: number; len: number }
): void {
  if (path.length >= 2) {
    const s = mergeValue(values) * path.length;
    if (s > best.score) { best.score = s; best.len = path.length; }
  }
  if (path.length >= 25) return;
  const last = path[path.length - 1];
  for (const [nr, nc] of neighbors8(last.r, last.c, ROWS, COLS)) {
    const k = nr * COLS + nc;
    if (used.has(k)) continue;
    const nt = grid[nr][nc];
    if (!nt) continue;
    if (!isValidAppend(tiles, nt)) continue;
    used.add(k);
    path.push({ r: nr, c: nc });
    values.push(nt.value);
    tiles.push(nt);
    dfsUnlimited(grid, path, values, tiles, used, best);
    used.delete(k);
    path.pop();
    values.pop();
    tiles.pop();
  }
}

function bestUnlimited(grid: Grid): { score: number; len: number } {
  const best = { score: 0, len: 0 };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (!t) continue;
      const used = new Set<number>([r * COLS + c]);
      dfsUnlimited(grid, [{ r, c }], [t.value], [t], used, best);
    }
  }
  return best;
}

export function main(argv: string[]): void {
  const f = parseFlags(argv);
  const N = f.num("--n", 20, { min: 1 });
  const MOVES = f.num("--moves", 50, { min: 1 });
  const masterSeed = f.num("--seed", 42) >>> 0;
  const seeds = deterministicSeeds(masterSeed, N);

  const botLens: number[] = [];
  const availLens: number[] = [];
  const scoreRatios: number[] = [];

  for (const seed of seeds) {
    let state = newGame(seed);
    for (let m = 0; m < MOVES && !state.gameOver; m++) {
      const botPath = pickBestChainGreedy(state.grid, state.mode, state);
      if (!botPath || botPath.length < 2) break;

      const botValues = botPath.map(({ r, c }) => state.grid[r][c]!.value);
      const botScore = mergeValue(botValues) * botPath.length;
      const uncapped = bestUnlimited(state.grid);

      botLens.push(botPath.length);
      availLens.push(uncapped.len);
      if (uncapped.score > 0) scoreRatios.push(botScore / uncapped.score);

      const plan = planCommit(state, botPath);
      if (!plan) break;
      state = plan.finalState;
    }
  }

  // Chain length histogram (bot-picked)
  const hist: Record<number, number> = {};
  for (const l of botLens) hist[l] = (hist[l] ?? 0) + 1;
  const maxBotLen = Math.max(...botLens);

  // Available length histogram (uncapped)
  const availHist: Record<number, number> = {};
  for (const l of availLens) availHist[l] = (availHist[l] ?? 0) + 1;
  const maxAvailLen = Math.max(...availLens);

  const avgScoreRatio = mean(scoreRatios);

  console.log(`\nProbe: bot chain depth cap (N=${N} games, ${MOVES} moves each)`);
  console.log(`Seeds: masterSeed=${masterSeed}`);
  console.log(`\nBot chain length histogram (MAX_DEPTH=5):`);
  for (let l = 2; l <= Math.max(maxBotLen, 6); l++) {
    const count = hist[l] ?? 0;
    const bar = "█".repeat(Math.round(count / botLens.length * 40));
    console.log(`  len=${l}:  ${String(count).padStart(5)} moves  ${bar}`);
  }
  console.log(`  MAX observed bot chain: ${maxBotLen}`);

  console.log(`\nBest available chain length (uncapped DFS, cap=25):`);
  for (let l = 2; l <= Math.min(maxAvailLen, 15); l++) {
    const count = availHist[l] ?? 0;
    if (count === 0) continue;
    const bar = "█".repeat(Math.round(count / availLens.length * 40));
    console.log(`  len=${l}:  ${String(count).padStart(5)} boards  ${bar}`);
  }
  console.log(`  MAX observed available chain: ${maxAvailLen}`);

  console.log(`\nScore capture: bot captures ${(avgScoreRatio * 100).toFixed(1)}% of uncapped-best score on average`);

  const longAvailable = availLens.filter((l) => l > 5).length;
  const longPct = (longAvailable / availLens.length * 100).toFixed(1);
  console.log(`  Boards where chains >5 exist: ${longAvailable}/${availLens.length} (${longPct}%)`);

  if (maxBotLen > 5) {
    console.log(`\nVERDICT: NOT CONFIRMED — bot found chain of length ${maxBotLen} (MAX_DEPTH may be higher than expected)`);
  } else if (maxAvailLen > 5 && longAvailable > 0) {
    console.log(`\nVERDICT: CONFIRMED — bot capped at ${maxBotLen}, but chains up to ${maxAvailLen} are available on real boards`);
    console.log(`  All bot data is constrained to chains ≤ ${maxBotLen}, misrepresenting human play.`);
  } else {
    console.log(`\nVERDICT: INCONCLUSIVE — no chains >5 found on sampled boards (try --n 50 --moves 100)`);
  }
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
