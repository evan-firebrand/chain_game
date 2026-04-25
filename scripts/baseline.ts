/**
 * Capture a perf + behaviour baseline for the test harness.
 *
 *   npx tsx scripts/baseline.ts                  # writes baselines/perf-<id>.json
 *   npx tsx scripts/baseline.ts --seed 1 --n 30  # explicit reproducibility
 *   npx tsx scripts/baseline.ts --include-exp2   # also run expectimax2 at --n-exp2 seeds
 *
 * Default policies: random, greedy, lookahead1.
 * Add --include-exp2 for expectimax2 (slow: ~0.6 g/s; defaults to N=10).
 */

import { benchmark, deterministicSeeds } from "../src/game/bot";
import type { BenchmarkSummary, BotPolicy } from "../src/game/bot";
import { ALL_ALGOS, ALL_MODES, getBoardConfig } from "../src/game/types";
import type { GameMode, SpawnAlgo } from "../src/game/types";
import {
  parseFlags, envelope, reconstructCommand, writeJSON,
  isMainModule, gitSha,
} from "./_lib";

function parseArgs(argv: string[]) {
  const f = parseFlags(argv);
  const n = f.num("--n", 30, { min: 1 });
  const masterSeed = f.num("--seed", 1) >>> 0;
  const maxMoves = f.num("--max-moves", 300, { min: 1 });
  const includeExp2 = f.has("--include-exp2");
  const nExp2 = f.num("--n-exp2", 10, { min: 1 });
  const out = f.get("--out");
  return { n, masterSeed, maxMoves, includeExp2, nExp2, out };
}

type Cell = {
  mode: GameMode;
  algo: SpawnAlgo;
  policy: BotPolicy;
  n: number;
  avgMoves: number;
  medianMoves: number;
  avgPeak: number;
  avgScore: number;
  avgChainLen: number;
  avgLevels: number;
  medianLevels: number;
  terminationCounts: Record<string, number>;
  totalRuntimeMs: number;
  avgRuntimeMs: number;
  totalBotDecisionMs: number;
  decisionPctOfRuntime: number;
  gamesPerSec: number;
};

function toCell(s: BenchmarkSummary): Cell {
  return {
    mode: s.mode, algo: s.algo, policy: s.policy,
    n: s.runs.length,
    avgMoves: s.avgMoves, medianMoves: s.medianMoves,
    avgPeak: s.avgPeak, avgScore: s.avgScore,
    avgChainLen: s.avgChainLen,
    avgLevels: s.avgLevels, medianLevels: s.medianLevels,
    terminationCounts: { ...s.terminationCounts },
    totalRuntimeMs: s.totalRuntimeMs,
    avgRuntimeMs: s.avgRuntimeMs,
    totalBotDecisionMs: s.totalBotDecisionMs,
    decisionPctOfRuntime: s.totalRuntimeMs > 0 ? (s.totalBotDecisionMs / s.totalRuntimeMs) * 100 : 0,
    gamesPerSec: s.gamesPerSec,
  };
}

export function main(argv: string[]): void {
  const { n, masterSeed, maxMoves, includeExp2, nExp2, out } = parseArgs(argv);
  const sha = gitSha();
  const seeds = deterministicSeeds(masterSeed, n);
  const exp2Seeds = deterministicSeeds(masterSeed, nExp2);
  const board = getBoardConfig();

  const corePolicies: BotPolicy[] = ["random", "greedy", "lookahead1"];
  const totalCoreCells = ALL_MODES.length * ALL_ALGOS.length * corePolicies.length;
  const totalExp2Cells = includeExp2 ? ALL_MODES.length * ALL_ALGOS.length : 0;
  const totalCells = totalCoreCells + totalExp2Cells;

  console.log(`[baseline] capturing reference run`);
  console.log(`[baseline] sha=${sha} n=${n} maxMoves=${maxMoves} masterSeed=${masterSeed}`);
  console.log(`[baseline] board=${board.cols}x${board.rows} pool=${board.poolSize}`);
  console.log(`[baseline] policies: ${corePolicies.join(",")}${includeExp2 ? ",expectimax2 (n=" + nExp2 + ")" : " (add --include-exp2 for expectimax2)"}`);
  console.log(``);

  const tStart = Date.now();
  const cells: Cell[] = [];
  let cellIdx = 0;

  for (const policy of corePolicies) {
    for (const mode of ALL_MODES) {
      process.stderr.write(`[${++cellIdx}/${totalCells}] policy=${policy} mode=${mode} ... `);
      const t0 = Date.now();
      const summaries = benchmark([...ALL_ALGOS], n, { mode, policy, maxMoves, seeds });
      process.stderr.write(`${Date.now() - t0}ms\n`);
      for (const s of summaries) cells.push(toCell(s));
    }
  }

  if (includeExp2) {
    for (const mode of ALL_MODES) {
      process.stderr.write(`[${++cellIdx}/${totalCells}] policy=expectimax2 mode=${mode} (n=${nExp2}) ... `);
      const t0 = Date.now();
      const summaries = benchmark([...ALL_ALGOS], nExp2, { mode, policy: "expectimax2", maxMoves, seeds: exp2Seeds });
      process.stderr.write(`${Date.now() - t0}ms\n`);
      for (const s of summaries) cells.push(toCell(s));
    }
  }

  const totalMs = Date.now() - tStart;
  const totalGames = cells.reduce((a, c) => a + c.n, 0);

  const baseline = {
    ...envelope({
      script: "scripts/baseline.ts",
      schema: "harness-perf-baseline",
      command: reconstructCommand("scripts/baseline.ts", argv),
    }),
    args: { n, masterSeed, maxMoves, corePolicies, includeExp2, nExp2 },
    board: { rows: board.rows, cols: board.cols, poolSize: board.poolSize },
    seedList: seeds,
    totalRuntimeMs: totalMs,
    totalGames,
    overallGamesPerSec: totalMs > 0 ? (totalGames / totalMs) * 1000 : 0,
    cells,
  };

  const id = sha === "unknown" ? new Date().toISOString().slice(0, 10) : sha.slice(0, 12);
  const outPath = out ?? `baselines/perf-${id}.json`;
  writeJSON(outPath, baseline);

  console.log(``);
  console.log(`overall: ${totalGames} games in ${totalMs}ms = ${baseline.overallGamesPerSec.toFixed(1)} g/s`);
  console.log(``);
  console.log(`policy        mode             algo         g/s   avgMs  decision%   avgLvls  go%   cap%`);
  console.log(`------------  ---------------  -----------  ----  -----  ---------  -------  ----  ----`);
  for (const c of cells) {
    const goPct = ((c.terminationCounts.gameOver ?? 0) / c.n) * 100;
    const capPct = ((c.terminationCounts.moveCapReached ?? 0) / c.n) * 100;
    console.log(
      `${c.policy.padEnd(12)}  ${c.mode.padEnd(15)}  ${c.algo.padEnd(11)}  ${c.gamesPerSec.toFixed(1).padStart(4)}  ${c.avgRuntimeMs.toFixed(1).padStart(4)}   ${c.decisionPctOfRuntime.toFixed(0).padStart(7)}%  ${c.avgLevels.toFixed(1).padStart(6)}   ${goPct.toFixed(0).padStart(3)}%  ${capPct.toFixed(0).padStart(3)}%`
    );
  }
  console.log(``);
  console.log(`[baseline] wrote ${outPath}`);
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
