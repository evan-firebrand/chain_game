/**
 * Algo audit study — sweeps antiPair strength and adversarial softness
 * for classic and wilds modes.
 *
 *   npx tsx scripts/harness.ts study algo-audit
 *   npx tsx scripts/harness.ts study algo-audit --seed 42 --n 30
 *
 * Answers two learning-plan questions:
 *   1. Where is the antiPair "sweet spot" on the difficulty curve?
 *   2. Is adversarial spawn degenerate at softness=0, and at what softness
 *      does it become playable?
 */

import { sweep, deterministicSeeds } from "../../src/game/bot";
import type { BenchmarkSummary } from "../../src/game/bot";
import { randomSeed } from "../../src/game/rng";
import {
  parseFlags, fmtNum, fmtCI, fmtProportionCI,
  envelope, reconstructCommand, writeJSON, isMainModule,
  checkGuardrails, estimateRuntimeMs, DEFAULT_MAX_GAMES,
} from "../_lib";

const STRENGTH_VALUES = [0, 0.5, 1, 2.5, 5, 10];
const SOFTNESS_VALUES = [0, 0.1, 0.25, 0.5, 0.75, 1.0];
const MODES_FOR_ADV = ["classic", "wilds"] as const;

function rowStrength(s: BenchmarkSummary, label: string) {
  const go = s.terminationRates.gameOver;
  const cap = s.terminationRates.moveCapReached;
  return [
    label.padEnd(10),
    fmtCI(s.dists.moves.mean, s.dists.moves.ciHalfWidth, 0).padStart(12),
    fmtCI(s.dists.levelsCleared.mean, s.dists.levelsCleared.ciHalfWidth, 1).padStart(14),
    fmtProportionCI(go.rate, go.low, go.high).padStart(16),
    fmtProportionCI(cap.rate, cap.low, cap.high).padStart(16),
    s.gamesPerSec.toFixed(1).padStart(6),
  ].join("  ");
}

function header() {
  return [
    "param     ".padEnd(10),
    "moves".padStart(12),
    "levels".padStart(14),
    "gameOver%".padStart(16),
    "cap%".padStart(16),
    "g/s".padStart(6),
  ].join("  ");
}

const hr = "─".repeat(80);

export function main(argv: string[]): void {
  const f = parseFlags(argv);
  const N = f.num("--n", 20, { min: 1 });
  const allowLong = f.has("--allow-long");
  const maxGames = f.num("--max-games", DEFAULT_MAX_GAMES, { min: 1 });
  const out = f.get("--out");
  const seedArg = f.get("--seed");
  const masterSeed = (seedArg !== undefined ? Number(seedArg) : randomSeed()) >>> 0;
  if (!Number.isFinite(masterSeed)) throw new Error(`--seed must be uint32`);

  // cells: 6 strengths + 6 softness × 2 modes = 18
  const totalGames = (STRENGTH_VALUES.length + SOFTNESS_VALUES.length * MODES_FOR_ADV.length) * N;
  checkGuardrails({ totalGames, maxGames, allowLong, estimatedMs: estimateRuntimeMs(totalGames) });

  const SEEDS = deterministicSeeds(masterSeed, N);

  console.log(`\n${"═".repeat(80)}`);
  console.log(`  ALGO AUDIT — N=${N}, masterSeed=${masterSeed}`);
  console.log(`  (replay: harness study algo-audit --seed ${masterSeed} --n ${N})`);
  console.log("═".repeat(80));

  // ── 1. AntiPair strength sweep — classic, lookahead1 ──────────────────────
  console.log(`\n${"═".repeat(80)}`);
  console.log(`  1. ANTIPAIR STRENGTH — classic, lookahead1`);
  console.log(`     strength=0 → behaves like weighted; higher = harder (avoids pair neighbours)`);
  console.log("═".repeat(80));
  console.log("\n  " + header());
  console.log("  " + hr);

  const strengthResults = sweep("antiPair", "strength", STRENGTH_VALUES, N, "lookahead1", "classic", { seeds: SEEDS, maxMoves: 300 });
  for (let i = 0; i < STRENGTH_VALUES.length; i++) {
    console.log("  " + rowStrength(strengthResults[i], `str=${STRENGTH_VALUES[i]}`));
  }
  console.log("\n  Look for: where does difficulty plateau? That's the ceiling strength.");

  // ── 2. Adversarial softness sweep ─────────────────────────────────────────
  const advResults: Record<string, BenchmarkSummary[]> = {};
  for (const mode of MODES_FOR_ADV) {
    console.log(`\n${"═".repeat(80)}`);
    console.log(`  2. ADVERSARIAL SOFTNESS — ${mode}, lookahead1`);
    console.log(`     softness=0 → fully adversarial; softness=1 → revert to weighted every time`);
    console.log("═".repeat(80));
    console.log("\n  " + header());
    console.log("  " + hr);

    const res = sweep("adversarial", "softness", SOFTNESS_VALUES, N, "lookahead1", mode, { seeds: SEEDS, maxMoves: 300 });
    advResults[mode] = res;
    for (let i = 0; i < SOFTNESS_VALUES.length; i++) {
      console.log("  " + rowStrength(res[i], `soft=${SOFTNESS_VALUES[i]}`));
    }
    console.log("\n  Look for: where does gameOver% drop below 50%? That's the playability threshold.");
  }

  // ── 3. Summary: playability thresholds ────────────────────────────────────
  console.log(`\n${"═".repeat(80)}`);
  console.log(`  3. PLAYABILITY SUMMARY`);
  console.log("═".repeat(80));
  console.log("\n  AntiPair difficulty plateau (classic, lookahead1, levelsCleared):");
  for (let i = 0; i < STRENGTH_VALUES.length; i++) {
    const lvl = strengthResults[i].dists.levelsCleared.mean;
    console.log(`    str=${STRENGTH_VALUES[i].toString().padEnd(4)} → ${lvl.toFixed(1)} levels`);
  }
  console.log("\n  Adversarial gameOver% by softness:");
  for (const mode of MODES_FOR_ADV) {
    console.log(`    ${mode}:`);
    for (let i = 0; i < SOFTNESS_VALUES.length; i++) {
      const r = advResults[mode][i].terminationRates.gameOver.rate;
      const playable = r < 0.5 ? " ← playable" : r > 0.9 ? " ← broken" : "";
      console.log(`      soft=${SOFTNESS_VALUES[i].toString().padEnd(4)} → ${(r * 100).toFixed(0)}% game-over${playable}`);
    }
  }
  console.log("");

  // ── Manifest ──────────────────────────────────────────────────────────────
  const outPath = out ?? `dist/study-algo-audit.${Date.now()}.json`;
  writeJSON(outPath, {
    ...envelope({
      script: "scripts/studies/algo-audit.ts",
      schema: "harness-study-algo-audit",
      command: reconstructCommand("scripts/harness.ts study algo-audit", argv),
    }),
    args: { n: N, masterSeed },
    seedList: SEEDS,
    totalGames,
    sections: { strengthResults, advResults },
  });
  console.log(`[study] wrote ${outPath}`);
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
