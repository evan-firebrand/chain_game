/**
 * Wilds-launch study. Five fixed reports comparing Wilds against Classic
 * across spawn algos, policies, and antiPair strength values.
 *
 *   npx tsx scripts/harness.ts study wilds-launch
 *   npx tsx scripts/harness.ts study wilds-launch --seed 12345 --n 40
 *
 * All comparisons share one paired seed list (--seed master), so
 * Wilds-vs-Classic and greedy-vs-lookahead deltas are honestly paired.
 */

import { benchmark, sweep, deterministicSeeds } from "../../src/game/bot";
import type { BenchmarkSummary } from "../../src/game/bot";
import { ALL_ALGOS } from "../../src/game/types";
import { randomSeed } from "../../src/game/rng";
import {
  parseFlags, fmtNum, fmtCINum, envelope, reconstructCommand, writeJSON,
  isMainModule, checkGuardrails, estimateRuntimeMs, DEFAULT_MAX_GAMES,
  pairedDeltaCI,
} from "../_lib";

function row(s: BenchmarkSummary, label?: string) {
  const name = (label ?? s.algo).padEnd(14);
  return [
    name,
    s.medianMoves.toFixed(0).padStart(7),
    s.avgMoves.toFixed(0).padStart(7),
    fmtNum(s.avgPeak).padStart(9),
    fmtNum(s.avgScore).padStart(11),
    s.avgChainLen.toFixed(2).padStart(8),
    s.medianLevels.toFixed(1).padStart(9),
    s.maxLevels.toString().padStart(8),
  ].join("  ");
}

function header() {
  return [
    "algo          ".padEnd(16),
    "medMov".padStart(7),
    "avgMov".padStart(7),
    " avgPeak".padStart(9),
    "   avgScore".padStart(11),
    "avgChain".padStart(8),
    "medLevels".padStart(9),
    " maxLvl".padStart(8),
  ].join("  ");
}

const hr = "─".repeat(90);

export function main(argv: string[]): void {
  const f = parseFlags(argv);
  const N = f.num("--n", 20, { min: 1 });
  const MAX_MOVES = f.num("--max-moves", 300, { min: 1 });
  const seedArg = f.get("--seed");
  const masterSeed = (seedArg !== undefined ? Number(seedArg) : randomSeed()) >>> 0;
  if (!Number.isFinite(masterSeed)) throw new Error(`--seed must be uint32`);
  const allowLong = f.has("--allow-long");
  const maxGames = f.num("--max-games", DEFAULT_MAX_GAMES, { min: 1 });
  const out = f.get("--out");

  // Five reports: 1 (wilds 3 algos) + 1 (classic 3 algos) + 6 (look×3 algos) + 6 strength sweep = 18 cells × N games (the section 4/5 reports reuse data from #1, no extra games).
  const totalGames = (3 + 3 + 6 + 6) * N;
  checkGuardrails({
    totalGames,
    maxGames,
    allowLong,
    estimatedMs: estimateRuntimeMs(totalGames),
  });

  const SEEDS = deterministicSeeds(masterSeed, N);

  console.log(`\n${"═".repeat(90)}`);
  console.log(`  WILDS-LAUNCH STUDY — N=${N}, maxMoves=${MAX_MOVES}, masterSeed=${masterSeed}`);
  console.log(`  (replay: harness study wilds-launch --seed ${masterSeed} --n ${N})`);
  console.log("═".repeat(90));

  // 1. Wilds vs Classic — greedy
  console.log(`\n${"═".repeat(90)}`);
  console.log(`  1. WILDS vs CLASSIC — beast-aware greedy bot`);
  console.log("═".repeat(90));

  const wildsGreedy   = benchmark([...ALL_ALGOS], N, { mode: "wilds",   policy: "greedy", maxMoves: MAX_MOVES, seeds: SEEDS });
  const classicGreedy = benchmark([...ALL_ALGOS], N, { mode: "classic", policy: "greedy", maxMoves: MAX_MOVES, seeds: SEEDS });

  console.log("\n  WILDS");
  console.log("  " + header());
  console.log("  " + hr);
  wildsGreedy.forEach((s) => console.log("  " + row(s)));

  console.log("\n  CLASSIC");
  console.log("  " + header());
  console.log("  " + hr);
  classicGreedy.forEach((s) => console.log("  " + row(s)));

  // 2. Greedy vs Lookahead — Wilds, all algos
  console.log(`\n${"═".repeat(90)}`);
  console.log(`  2. GREEDY vs LOOKAHEAD1 — Wilds, all algos (paired seeds)`);
  console.log("═".repeat(90));
  console.log("\n  " + header());
  console.log("  " + hr);

  const lookaheadByAlgo: Record<string, BenchmarkSummary> = {};
  for (const algo of ALL_ALGOS) {
    const g = benchmark([algo], N, { mode: "wilds", policy: "greedy",     maxMoves: MAX_MOVES, seeds: SEEDS });
    const l = benchmark([algo], N, { mode: "wilds", policy: "lookahead1", maxMoves: MAX_MOVES, seeds: SEEDS });
    lookaheadByAlgo[algo] = l[0];
    console.log("  " + row(g[0], `${algo}/greedy`));
    console.log("  " + row(l[0], `${algo}/look1`));
    console.log("  " + hr);
  }

  // 3. Strength sweep — Wilds antiPair, greedy
  console.log(`\n${"═".repeat(90)}`);
  console.log(`  3. STRENGTH SWEEP — Wilds, antiPair, greedy`);
  console.log("═".repeat(90));

  const strengths = [0, 0.5, 1, 2.5, 5, 10];
  const strengthSweep = sweep("antiPair", "strength", strengths, N, "greedy", "wilds", { maxMoves: MAX_MOVES, seeds: SEEDS });
  console.log("\n  " + header());
  console.log("  " + hr);
  strengthSweep.forEach((s) => console.log("  " + row(s, `str=${s.strength}`)));

  // 4. Score-per-move (beast kill proxy)
  console.log(`\n${"═".repeat(90)}`);
  console.log("  4. SCORE/MOVE by algo (beast engagement proxy)");
  console.log("═".repeat(90));
  for (const s of wildsGreedy) {
    const spm = s.avgScore / s.avgMoves;
    console.log(`  ${s.algo.padEnd(14)} ${fmtNum(spm).padStart(10)}/move   avgScore: ${fmtNum(s.avgScore)}`);
  }

  // 5. Delta: Wilds − Classic (paired bootstrap on per-seed deltas).
  console.log(`\n${"═".repeat(90)}`);
  console.log("  5. DELTA: Wilds − Classic (greedy, paired bootstrap CI)");
  console.log("═".repeat(90));
  console.log("\n  algo                 avgMoves Δ           avgPeak Δ          avgScore Δ      avgLvl Δ");
  console.log("  " + hr);
  const deltas = [];
  const sign = (s: string) => (s.startsWith("-") ? s : "+" + s);
  for (let i = 0; i < ALL_ALGOS.length; i++) {
    const w = wildsGreedy[i];
    const c = classicGreedy[i];
    // Per-seed paired deltas. wildsGreedy and classicGreedy share the same
    // seed list (SEEDS), so this is a true paired comparison.
    const movesDelta = pairedDeltaCI(w.runs.map((r) => r.moves), c.runs.map((r) => r.moves));
    const peakDelta = pairedDeltaCI(w.runs.map((r) => r.peak), c.runs.map((r) => r.peak));
    const scoreDelta = pairedDeltaCI(w.runs.map((r) => r.score), c.runs.map((r) => r.score));
    const lvlDelta = pairedDeltaCI(w.runs.map((r) => r.levelsCleared), c.runs.map((r) => r.levelsCleared));
    const isSig = (low: number, high: number) => low > 0 || high < 0;
    const sigMark = (d: { low: number; high: number }) => isSig(d.low, d.high) ? "*" : " ";
    const d = {
      algo: w.algo,
      moves: movesDelta, peak: peakDelta, score: scoreDelta, levels: lvlDelta,
    };
    deltas.push(d);
    console.log(
      `  ${w.algo.padEnd(16)} ` +
      `${sigMark(movesDelta)}${sign(fmtCINum(movesDelta.delta, movesDelta.halfWidth)).padStart(18)}  ` +
      `${sigMark(peakDelta)}${sign(fmtCINum(peakDelta.delta, peakDelta.halfWidth)).padStart(18)}  ` +
      `${sigMark(scoreDelta)}${sign(fmtCINum(scoreDelta.delta, scoreDelta.halfWidth)).padStart(18)}  ` +
      `${sigMark(lvlDelta)}${sign(fmtCINum(lvlDelta.delta, lvlDelta.halfWidth)).padStart(12)}`
    );
  }
  console.log("\n  values: mean Δ ± 95% paired-bootstrap CI half-width.  * = CI excludes 0.");
  console.log("");

  // JSON manifest
  const outPath = out ?? `dist/study-wilds-launch.${Date.now()}.json`;
  const manifest = {
    ...envelope({
      script: "scripts/studies/wilds-launch.ts",
      schema: "harness-study-wilds-launch",
      command: reconstructCommand("scripts/harness.ts study wilds-launch", argv),
    }),
    args: { n: N, maxMoves: MAX_MOVES, masterSeed },
    seedList: SEEDS,
    totalGames,
    sections: {
      wildsGreedy,
      classicGreedy,
      lookaheadByAlgo,
      strengthSweep,
      deltas,
    },
  };
  writeJSON(outPath, manifest);
  console.log(`[study] wrote ${outPath}`);
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
