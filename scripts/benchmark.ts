/**
 * Mode-aware benchmark. Defaults to `classic` greedy weighted at N=20.
 *
 *   npx tsx scripts/benchmark.ts --mode classic --n 20
 *   npx tsx scripts/benchmark.ts --mode movesLimited --policy lookahead1
 *
 * Reproducibility: pass --seed <uint32> for a deterministic seed list, or
 * --seeds <csv> for explicit values. Without either, a random master seed is
 * generated and printed; replay with the same value.
 *
 * Exports `main(argv)` so scripts/harness.ts can dispatch to it.
 */

import { benchmark, deterministicSeeds } from "../src/game/bot";
import type { BotPolicy } from "../src/game/bot";
import type { GameMode, SpawnAlgo } from "../src/game/types";
import { ALL_ALGOS, ALL_MODES } from "../src/game/types";
import { randomSeed } from "../src/game/rng";
import {
  parseFlags, fmtCI, fmtCINum, fmtProportionCI,
  printTable, envelope, reconstructCommand, writeJSON, checkGuardrails,
  estimateRuntimeMs, isMainModule, DEFAULT_MAX_GAMES,
} from "./_lib";

type Args = {
  mode: GameMode;
  algos: SpawnAlgo[];
  n: number;
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
  const mode = f.str<GameMode>("--mode", "classic", ALL_MODES);
  const algos = f.strList<SpawnAlgo>("--algo", [...ALL_ALGOS], ALL_ALGOS);
  const n = f.num("--n", 20, { min: 1 });
  const policy = f.str<BotPolicy>("--policy", "greedy", ["greedy", "lookahead1", "random", "expectimax2"] as const);
  const maxMoves = f.num("--max-moves", 300, { min: 1 });
  const out = f.get("--out");
  const allowLong = f.has("--allow-long");
  const maxGames = f.num("--max-games", DEFAULT_MAX_GAMES, { min: 1 });

  // Seeds: --seeds wins; --seed master; otherwise generate fresh master.
  const seedsCsv = f.get("--seeds");
  let seeds: number[];
  let masterSeed: number;
  let seedsExplicit = false;
  if (seedsCsv) {
    seeds = seedsCsv.split(",").map((s) => Number(s.trim())).filter((x) => Number.isFinite(x));
    if (seeds.length === 0) throw new Error("--seeds parsed to empty list");
    masterSeed = 0;
    seedsExplicit = true;
  } else {
    const seedArg = f.get("--seed");
    masterSeed = seedArg !== undefined ? Number(seedArg) : randomSeed();
    if (!Number.isFinite(masterSeed)) throw new Error(`--seed must be uint32`);
    seeds = deterministicSeeds(masterSeed >>> 0, n);
  }
  return { mode, algos, n: seeds.length, policy, maxMoves, masterSeed, seeds, seedsExplicit, out, allowLong, maxGames };
}

function metricLabel(mode: GameMode): string {
  if (mode === "movesLimited") return "movesLeft";
  if (mode === "risingFloor") return "finalFloor";
  return "levels";
}

export function main(argv: string[]): void {
  const args = parseArgs(argv);
  const { mode, algos, n, policy, maxMoves, masterSeed, seeds, seedsExplicit, allowLong, maxGames } = args;

  // Guardrail: total games = algos × seeds.
  const totalGames = algos.length * seeds.length;
  checkGuardrails({
    totalGames,
    maxGames,
    allowLong,
    estimatedMs: estimateRuntimeMs(totalGames),
  });

  console.log(`\n  Benchmark — mode=${mode} policy=${policy} N=${n} maxMoves=${maxMoves}`);
  if (seedsExplicit) console.log(`  seeds=[explicit, ${seeds.length} values]`);
  else console.log(`  --seed ${masterSeed} (replay with this exact value)`);
  console.log("  " + "─".repeat(92));

  const tStart = Date.now();
  const summaries = benchmark(algos, n, { mode, policy, maxMoves, seeds });
  const totalMs = Date.now() - tStart;

  // Numeric cells render as "mean ± hw" (95% bootstrap CI half-width). Termination
  // rates render as "p% [low–high]" (Wilson CI). g/s is a single-shot perf
  // measurement so no CI.
  type Row = (typeof summaries)[number];
  printTable<Row>(summaries, [
    { header: "algo", render: (s) => s.algo, align: "left" },
    { header: "moves", render: (s) => fmtCI(s.dists.moves.mean, s.dists.moves.ciHalfWidth, 0) },
    { header: "peak", render: (s) => fmtCINum(s.dists.peak.mean, s.dists.peak.ciHalfWidth) },
    { header: "score", render: (s) => fmtCINum(s.dists.score.mean, s.dists.score.ciHalfWidth) },
    { header: "chain", render: (s) => fmtCI(s.avgChainLenStat.stat, s.avgChainLenStat.ciHalfWidth, 2) },
    { header: metricLabel(mode), render: (s) => fmtCI(s.dists.modeMetric.mean, s.dists.modeMetric.ciHalfWidth, 1) },
    { header: "gameOver", render: (s) => fmtProportionCI(s.terminationRates.gameOver.rate, s.terminationRates.gameOver.low, s.terminationRates.gameOver.high) },
    { header: "cap", render: (s) => fmtProportionCI(s.terminationRates.moveCapReached.rate, s.terminationRates.moveCapReached.low, s.terminationRates.moveCapReached.high) },
    { header: "g/s", render: (s) => s.gamesPerSec.toFixed(1) },
  ]);
  console.log(`\n  values: mean ± 95% bootstrap CI half-width.  rates: p% [Wilson 95% CI]`);
  console.log("");

  // Manifest + JSON output. Always written so agents can introspect / replay.
  const manifest = {
    ...envelope({
      script: "scripts/benchmark.ts",
      schema: "harness-benchmark",
      command: reconstructCommand("scripts/benchmark.ts", argv),
    }),
    args: { mode, algos, n, policy, maxMoves, masterSeed: seedsExplicit ? null : masterSeed, seedsExplicit },
    seedList: seeds,
    totalGames,
    totalRuntimeMs: totalMs,
    overallGamesPerSec: totalMs > 0 ? (totalGames / totalMs) * 1000 : 0,
  };
  const outPath = args.out ?? `dist/bench-${Date.now()}.json`;
  writeJSON(outPath, { manifest, summaries });
  console.log(`[bench] wrote ${outPath}`);
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
