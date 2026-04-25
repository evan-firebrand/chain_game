/**
 * Board-size and spawn-pool-size sweep harness.
 *
 *   npx tsx scripts/sweep-config.ts \
 *     --rows 7,8,9 --cols 5,6,7 --pool 4,5,6,8,10 \
 *     --seeds 30 --mode classic --policy greedy
 *
 * Runs the cartesian product of (rows × cols × poolSize), N seeds each,
 * prints a summary table, and dumps raw results + a manifest to JSON.
 */

import { runBot, deterministicSeeds } from "../src/game/bot";
import type { BotPolicy, BotResult } from "../src/game/bot";
import type { GameMode, SpawnAlgo } from "../src/game/types";
import { ALL_ALGOS, ALL_MODES } from "../src/game/types";
import { randomSeed } from "../src/game/rng";
import {
  parseFlags, fmtFixed, printTable, envelope, reconstructCommand,
  writeJSON, checkGuardrails, estimateRuntimeMs, isMainModule,
  DEFAULT_MAX_GAMES,
} from "./_lib";

type Args = {
  rows: number[];
  cols: number[];
  poolSizes: number[];
  seedCount: number;
  mode: GameMode;
  algo: SpawnAlgo;
  policy: BotPolicy;
  maxMoves: number;
  masterSeed: number;
  seeds: number[];
  seedsExplicit: boolean;
  out?: string;
  allowLong: boolean;
  maxGames: number;
};

function parseArgs(argv: string[]): Args {
  const f = parseFlags(argv);
  const rows = f.numList("--rows", [7, 8, 9]);
  const cols = f.numList("--cols", [5, 6, 7]);
  const poolSizes = f.numList("--pool", [4, 5, 6, 8, 10]);
  const seedCount = f.num("--seeds", 30, { min: 1 });
  const mode = f.str<GameMode>("--mode", "classic", ALL_MODES);
  const algo = f.str<SpawnAlgo>("--algo", "weighted", ALL_ALGOS);
  const policy = f.str<BotPolicy>("--policy", "greedy", ["greedy", "lookahead1"] as const);
  const maxMoves = f.num("--max-moves", 300, { min: 1 });
  const out = f.get("--out");
  const allowLong = f.has("--allow-long");
  const maxGames = f.num("--max-games", DEFAULT_MAX_GAMES, { min: 1 });

  const seedListCsv = f.get("--seedList");
  let seeds: number[];
  let masterSeed: number;
  let seedsExplicit = false;
  if (seedListCsv) {
    seeds = seedListCsv.split(",").map((s) => Number(s.trim())).filter((x) => Number.isFinite(x));
    if (seeds.length === 0) throw new Error("--seedList parsed to empty list");
    masterSeed = 0;
    seedsExplicit = true;
  } else {
    const seedArg = f.get("--seed");
    masterSeed = seedArg !== undefined ? Number(seedArg) : randomSeed();
    if (!Number.isFinite(masterSeed)) throw new Error(`--seed must be uint32`);
    seeds = deterministicSeeds(masterSeed >>> 0, seedCount);
  }
  return { rows, cols, poolSizes, seedCount: seeds.length, mode, algo, policy, maxMoves, masterSeed, seeds, seedsExplicit, out, allowLong, maxGames };
}

type ConfigStats = {
  rows: number;
  cols: number;
  poolSize: number;
  n: number;
  avgPeak: number;
  maxPeak: number;
  avgMoves: number;
  avgScore: number;
  avgChainLen: number;
  avgLevels: number;
  pct512: number;
  pct1024: number;
  pct2048: number;
  pct4096: number;
  avgRuntimeMs: number;
  gamesPerSec: number;
  gameOverPct: number;
  moveCapPct: number;
};

function summarize(rows: number, cols: number, poolSize: number, runs: BotResult[]): ConfigStats {
  const n = runs.length || 1;
  const sum = (f: (r: BotResult) => number) => runs.reduce((a, r) => a + f(r), 0);
  const peakAtLeast = (v: number) => runs.filter((r) => r.peak >= v).length / n;
  const totalMoves = sum((r) => r.moves);
  const totalChain = sum((r) => r.chainLenSum);
  const totalRuntime = sum((r) => r.runtimeMs);
  const goCount = runs.filter((r) => r.terminationReason === "gameOver").length;
  const capCount = runs.filter((r) => r.terminationReason === "moveCapReached").length;
  return {
    rows,
    cols,
    poolSize,
    n: runs.length,
    avgPeak: sum((r) => r.peak) / n,
    maxPeak: runs.length ? Math.max(...runs.map((r) => r.peak)) : 0,
    avgMoves: totalMoves / n,
    avgScore: sum((r) => r.score) / n,
    avgChainLen: totalMoves > 0 ? totalChain / totalMoves : 0,
    avgLevels: sum((r) => r.levelsCleared) / n,
    pct512: peakAtLeast(512) * 100,
    pct1024: peakAtLeast(1024) * 100,
    pct2048: peakAtLeast(2048) * 100,
    pct4096: peakAtLeast(4096) * 100,
    avgRuntimeMs: totalRuntime / n,
    gamesPerSec: totalRuntime > 0 ? (n / totalRuntime) * 1000 : 0,
    gameOverPct: (goCount / n) * 100,
    moveCapPct: (capCount / n) * 100,
  };
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  const totalConfigs = args.rows.length * args.cols.length * args.poolSizes.length;
  const totalGames = totalConfigs * args.seedCount;

  checkGuardrails({
    totalGames,
    maxGames: args.maxGames,
    allowLong: args.allowLong,
    estimatedMs: estimateRuntimeMs(totalGames),
  });

  console.log(
    `[sweep-config] rows=${args.rows.join(",")} cols=${args.cols.join(",")} pool=${args.poolSizes.join(",")} seeds=${args.seedCount} mode=${args.mode} algo=${args.algo} policy=${args.policy} maxMoves=${args.maxMoves}`
  );
  if (args.seedsExplicit) console.log(`[sweep-config] seeds=[explicit, ${args.seedCount} values]`);
  else console.log(`[sweep-config] --seed ${args.masterSeed} (replay with this exact value)`);
  console.log(`[sweep-config] ${totalConfigs} configs × ${args.seedCount} seeds = ${totalGames} games`);

  const allStats: ConfigStats[] = [];
  const allRuns: Array<BotResult & { rows: number; cols: number; poolSize: number }> = [];
  const tStart = Date.now();
  let configIdx = 0;
  for (const rows of args.rows) {
    for (const cols of args.cols) {
      for (const poolSize of args.poolSizes) {
        configIdx++;
        const elapsedS = (Date.now() - tStart) / 1000;
        const etaS = configIdx > 1 ? (elapsedS / (configIdx - 1)) * (totalConfigs - configIdx + 1) : 0;
        process.stderr.write(
          `[${configIdx}/${totalConfigs}] rows=${rows} cols=${cols} pool=${poolSize} ` +
          (configIdx > 1 ? `(eta ~${etaS.toFixed(0)}s) ` : "") + `... `
        );
        const t0 = Date.now();
        const runs = args.seeds.map((seed) =>
          runBot(seed, args.algo, {
            mode: args.mode, policy: args.policy, rows, cols, poolSize, maxMoves: args.maxMoves,
          })
        );
        process.stderr.write(`${Date.now() - t0}ms\n`);
        const stats = summarize(rows, cols, poolSize, runs);
        allStats.push(stats);
        for (const r of runs) allRuns.push({ ...r, rows, cols, poolSize });
      }
    }
  }
  const totalRuntimeMs = Date.now() - tStart;

  console.log("");
  printTable<ConfigStats>(allStats, [
    { header: "rxc", render: (s) => `${s.cols}x${s.rows}` },
    { header: "pool", render: (s) => String(s.poolSize) },
    { header: "n", render: (s) => String(s.n) },
    { header: "avgPeak", render: (s) => fmtFixed(s.avgPeak, 0) },
    { header: "maxPeak", render: (s) => fmtFixed(s.maxPeak, 0) },
    { header: "avgMoves", render: (s) => fmtFixed(s.avgMoves, 0) },
    { header: "avgChain", render: (s) => fmtFixed(s.avgChainLen, 2) },
    { header: "avgLvl", render: (s) => fmtFixed(s.avgLevels, 1) },
    { header: "%512", render: (s) => fmtFixed(s.pct512, 0) },
    { header: "%1024", render: (s) => fmtFixed(s.pct1024, 0) },
    { header: "%2048", render: (s) => fmtFixed(s.pct2048, 0) },
    { header: "%4096", render: (s) => fmtFixed(s.pct4096, 0) },
    { header: "go%", render: (s) => fmtFixed(s.gameOverPct, 0) },
    { header: "cap%", render: (s) => fmtFixed(s.moveCapPct, 0) },
    { header: "g/s", render: (s) => fmtFixed(s.gamesPerSec, 1) },
  ]);

  const outPath = args.out ?? `dist/sweep-results.${Date.now()}.json`;
  const manifest = {
    ...envelope({
      script: "scripts/sweep-config.ts",
      schema: "harness-sweep-config",
      command: reconstructCommand("scripts/sweep-config.ts", argv),
    }),
    args: {
      rows: args.rows, cols: args.cols, poolSizes: args.poolSizes,
      seeds: args.seedCount, mode: args.mode, algo: args.algo, policy: args.policy,
      maxMoves: args.maxMoves,
      masterSeed: args.seedsExplicit ? null : args.masterSeed,
      seedsExplicit: args.seedsExplicit,
    },
    seedList: args.seeds,
    totalRuntimeMs,
    totalRuns: allRuns.length,
    gamesPerSec: totalRuntimeMs > 0 ? (allRuns.length / totalRuntimeMs) * 1000 : 0,
  };
  writeJSON(outPath, { manifest, summary: allStats, runs: allRuns });
  console.log(`\n[sweep-config] wrote ${outPath} (${allRuns.length} runs, ${totalRuntimeMs}ms total)`);
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
