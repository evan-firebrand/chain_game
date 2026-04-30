/**
 * Archetype baseline study — first valid Layer 2 measurement after P0 fix.
 *
 *   npx tsx scripts/harness.ts study archetype-baseline --seed 42 --n 30
 *
 * Compares the four player archetypes (casual/engaged/skilled/speedrunner) on
 * classic mode with weighted spawns. These are the reference numbers to use
 * for all downstream difficulty-curve and mode-comparison work. Runs at
 * MAX_DEPTH_DEEP=20 (not the old depth-5 cap), so chain-length data is valid.
 */

import { benchmark, deterministicSeeds } from "../../src/game/bot";
import type { BotPolicy, BenchmarkSummary } from "../../src/game/bot";
import { parseFlags, fmtCI, fmtCINum, fmtFixed, isMainModule, envelope, reconstructCommand, writeJSON, pairedDeltaCI } from "../_lib";

const ARCHETYPES: BotPolicy[] = ["casual", "engaged", "skilled", "speedrunner"];

export function main(argv: string[]): void {
  const f = parseFlags(argv);
  const N = f.num("--n", 30, { min: 1 });
  const masterSeed = (f.num("--seed", 42)) >>> 0;
  const out = f.get("--out");
  const seeds = deterministicSeeds(masterSeed, N);

  console.log(`\n${"═".repeat(80)}`);
  console.log(`  ARCHETYPE BASELINE — N=${N} masterSeed=${masterSeed}`);
  console.log(`  classic/weighted — first valid run at MAX_DEPTH_DEEP=20`);
  console.log("═".repeat(80));

  const results: Record<string, BenchmarkSummary> = {};
  for (const policy of ARCHETYPES) {
    const [s] = benchmark(["weighted"], N, { mode: "classic", policy, maxMoves: 300, seeds });
    results[policy] = s;
  }

  console.log(`\n  ${"─".repeat(96)}`);
  console.log(`  ${"archetype".padEnd(12)}  ${"levels".padStart(14)}  ${"moves".padStart(12)}  ${"avgChain".padStart(12)}  ${"peak".padStart(14)}  ${"score".padStart(14)}  ${"gameOver%".padStart(10)}`);
  for (const policy of ARCHETYPES) {
    const s = results[policy];
    const goRate = s.runs.filter((r) => r.terminationReason === "gameOver").length / N * 100;
    console.log(
      `  ${policy.padEnd(12)}` +
      `  ${fmtCI(s.dists.levelsCleared.mean, s.dists.levelsCleared.ciHalfWidth, 1).padStart(14)}` +
      `  ${fmtCI(s.dists.moves.mean, s.dists.moves.ciHalfWidth, 0).padStart(12)}` +
      `  ${fmtFixed(s.avgChainLenStat.stat, 2).padStart(12)}` +
      `  ${fmtCINum(s.dists.peak.mean, s.dists.peak.ciHalfWidth).padStart(14)}` +
      `  ${fmtCINum(s.dists.score.mean, s.dists.score.ciHalfWidth).padStart(14)}` +
      `  ${goRate.toFixed(0).padStart(9)}%`
    );
  }

  console.log(`\n${"═".repeat(80)}`);
  console.log(`  PAIRED DELTAS vs CASUAL (95% bootstrap CI, * = excludes 0)`);
  console.log("═".repeat(80));
  console.log(`\n  ${"─".repeat(80)}`);
  console.log(`  ${"archetype".padEnd(12)}  ${"Δ levels".padStart(16)}  ${"Δ moves".padStart(14)}  ${"Δ avgChain".padStart(14)}  ${"Δ peak".padStart(20)}`);
  const base = results["casual"];
  for (const policy of ["engaged", "skilled", "speedrunner"] as const) {
    const p = results[policy];
    const dL = pairedDeltaCI(p.runs.map((r) => r.levelsCleared), base.runs.map((r) => r.levelsCleared));
    const dM = pairedDeltaCI(p.runs.map((r) => r.moves), base.runs.map((r) => r.moves));
    const dC = pairedDeltaCI(
      p.runs.map((r) => (r.moves > 0 ? r.chainLenSum / r.moves : 0)),
      base.runs.map((r) => (r.moves > 0 ? r.chainLenSum / r.moves : 0)),
    );
    const dPk = pairedDeltaCI(p.runs.map((r) => r.peak), base.runs.map((r) => r.peak));
    const tag = (d: { low: number; high: number }) => (d.low > 0 || d.high < 0) ? " *" : "  ";
    console.log(
      `  ${policy.padEnd(12)}` +
      `  ${(fmtCI(dL.delta, dL.halfWidth, 1) + tag(dL)).padStart(16)}` +
      `  ${(fmtCI(dM.delta, dM.halfWidth, 0) + tag(dM)).padStart(14)}` +
      `  ${(fmtFixed(dC.delta, 2) + " ± " + fmtFixed(dC.halfWidth, 2) + tag(dC)).padStart(14)}` +
      `  ${(fmtCINum(dPk.delta, dPk.halfWidth) + tag(dPk)).padStart(20)}`
    );
  }
  console.log(`\n  * = paired CI excludes 0 (significant divergence at 95%).\n`);

  const outPath = out ?? `dist/study-archetype-baseline.${Date.now()}.json`;
  writeJSON(outPath, {
    ...envelope({
      script: "scripts/studies/archetype-baseline.ts",
      schema: "harness-study-archetype-baseline",
      command: reconstructCommand("scripts/harness.ts study archetype-baseline", argv),
    }),
    args: { n: N, masterSeed, mode: "classic", algo: "weighted", archetypes: ARCHETYPES },
    seedList: seeds,
    results,
  });
  console.log(`[study] wrote ${outPath}`);
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
