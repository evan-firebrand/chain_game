/**
 * Paired comparison between two benchmark manifests.
 *
 *   harness compare a.json b.json
 *   harness compare a.json b.json --metrics moves,peak,score,levelsCleared
 *
 * Matches summaries by (mode, algo, policy). For each matched pair, computes
 * paired-bootstrap CI on per-seed deltas if seeds match, independent CI
 * otherwise (with a warning — independent CIs overstate uncertainty when the
 * underlying samples were really paired).
 */

import { readFileSync } from "node:fs";
import {
  parseFlags, fmtNum, fmtFixed, fmtCI, fmtCINum, isMainModule,
  seedsMatch, pairedDeltaCI, independentDeltaCI, mean as meanOf, printTable,
} from "./_lib";

type Manifest = {
  manifest?: { schema?: string };
  summaries?: any[];
  // Studies wrap differently; we'll just look for `summaries` for now.
};

type Cell = {
  mode: string;
  algo: string;
  policy: string;
  runs: Array<{ seed: number; moves: number; peak: number; score: number; levelsCleared: number; modeMetric: number; chainLenSum: number }>;
  seedList?: number[];
};

function loadCells(path: string): Cell[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Manifest;
  if (!raw.summaries) throw new Error(`${path}: no .summaries (only benchmark manifests are supported by compare for now).`);
  return raw.summaries.map((s: any) => ({
    mode: s.mode, algo: s.algo, policy: s.policy,
    runs: s.runs,
    seedList: s.seedList ?? s.runs?.map((r: any) => r.seed),
  }));
}

const DEFAULT_METRICS = ["moves", "peak", "score", "levelsCleared"] as const;
type Metric = (typeof DEFAULT_METRICS)[number] | "modeMetric" | "chainLenSum";

const FMT: Record<Metric, "num" | "fixed0" | "fixed1" | "fixed2"> = {
  moves: "fixed0",
  peak: "num",
  score: "num",
  levelsCleared: "fixed1",
  modeMetric: "fixed1",
  chainLenSum: "fixed0",
};

function fmtVal(metric: Metric, v: number): string {
  return FMT[metric] === "num" ? fmtNum(v)
    : FMT[metric] === "fixed0" ? fmtFixed(v, 0)
    : FMT[metric] === "fixed1" ? fmtFixed(v, 1)
    : fmtFixed(v, 2);
}

function fmtDelta(metric: Metric, v: number, hw: number): string {
  return FMT[metric] === "num" ? fmtCINum(v, hw)
    : FMT[metric] === "fixed0" ? fmtCI(v, hw, 0)
    : FMT[metric] === "fixed1" ? fmtCI(v, hw, 1)
    : fmtCI(v, hw, 2);
}

export function main(argv: string[]): void {
  const f = parseFlags(argv);
  const positional = argv.filter((a) => !a.startsWith("--"));
  const aPath = positional[0];
  const bPath = positional[1];
  if (!aPath || !bPath) throw new Error(`Usage: harness compare <a.json> <b.json> [--metrics ...]`);
  const metrics = f.strList<Metric>("--metrics", [...DEFAULT_METRICS], [...DEFAULT_METRICS, "modeMetric", "chainLenSum"]);
  // --ignore-policy: match cells by (mode, algo) only, dropping policy from the
  // key. Lets you compare runs that used different policies (e.g. greedy vs lookahead1).
  const ignorePolicy = f.has("--ignore-policy");

  const aCells = loadCells(aPath);
  const bCells = loadCells(bPath);

  console.log(`\n  Compare`);
  console.log(`    a = ${aPath}  (${aCells.length} cells)`);
  console.log(`    b = ${bPath}  (${bCells.length} cells)`);
  if (ignorePolicy) console.log(`    match key: (mode, algo) — policy ignored`);

  type Row = {
    label: string;
    pairing: "paired" | "independent";
    metric: Metric;
    aMean: number;
    bMean: number;
    delta: number;
    halfWidth: number;
    significant: boolean; // CI excludes zero
  };

  const rows: Row[] = [];
  let unpairedCount = 0;
  for (const a of aCells) {
    const b = ignorePolicy
      ? bCells.find((c) => c.mode === a.mode && c.algo === a.algo)
      : bCells.find((c) => c.mode === a.mode && c.algo === a.algo && c.policy === a.policy);
    if (!b) {
      console.warn(`  [warn] no matching cell in b for (${a.mode}, ${a.algo}, ${a.policy})`);
      continue;
    }
    const aSeeds = a.seedList ?? a.runs.map((r) => r.seed);
    const bSeeds = b.seedList ?? b.runs.map((r) => r.seed);
    const paired = seedsMatch(aSeeds, bSeeds);
    if (!paired) unpairedCount++;
    for (const m of metrics) {
      const aVals = a.runs.map((r) => (r as any)[m] as number);
      const bVals = b.runs.map((r) => (r as any)[m] as number);
      let delta: number, halfWidth: number, low: number, high: number;
      if (paired) {
        const r = pairedDeltaCI(aVals, bVals);
        delta = r.delta; halfWidth = r.halfWidth; low = r.low; high = r.high;
      } else {
        const r = independentDeltaCI(aVals, bVals);
        delta = r.delta; halfWidth = r.halfWidth;
        low = delta - halfWidth; high = delta + halfWidth;
      }
      const bPolicy = b.policy !== a.policy ? `→${b.policy}` : `/${a.policy}`;
      rows.push({
        label: ignorePolicy ? `${a.mode}/${a.algo}/${a.policy}${bPolicy}` : `${a.mode}/${a.algo}/${a.policy}`,
        pairing: paired ? "paired" : "independent",
        metric: m,
        aMean: meanOf(aVals),
        bMean: meanOf(bVals),
        delta, halfWidth,
        significant: low > 0 || high < 0,
      });
    }
  }

  if (unpairedCount > 0) {
    console.warn(
      `\n  [warn] ${unpairedCount} cell(s) have differing seed lists between a and b. ` +
      `Their deltas are computed with INDEPENDENT CIs, which overstate uncertainty ` +
      `compared to paired bootstrap. To pair, regenerate one of the runs with the ` +
      `same --seed master (or replay the original).`
    );
  }

  console.log(``);
  printTable<Row>(rows, [
    { header: "cell", render: (r) => r.label, align: "left" },
    { header: "metric", render: (r) => r.metric, align: "left" },
    { header: "a", render: (r) => fmtVal(r.metric, r.aMean) },
    { header: "b", render: (r) => fmtVal(r.metric, r.bMean) },
    { header: "Δ (b−a)", render: (r) => `${r.delta >= 0 ? "+" : ""}${fmtDelta(r.metric, r.delta, r.halfWidth)}` },
    { header: "sig?", render: (r) => r.significant ? "yes" : "no" },
    { header: "pairing", render: (r) => r.pairing, align: "left" },
  ]);
  console.log(`\n  values: mean ± 95% bootstrap CI half-width.  sig? = CI excludes 0.`);
  console.log("");
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
