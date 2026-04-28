/**
 * Power analysis. Two modes:
 *
 *   harness power --manifest a.json --metric peak --mde 5
 *     → required N to detect a 5% change in the mean of `peak` at α=0.05,
 *       80% power, given the variance observed in a.json.
 *
 *   harness power --stddev 12.5 --mean 200 --mde 10
 *     → manual: required N for a 10% MDE given σ=12.5 around mean=200.
 */

import { readFileSync } from "node:fs";
import { parseFlags, isMainModule, powerN, mean as meanOf, stddev as stddevOf } from "./_lib";

const VALID_METRICS = ["moves", "peak", "score", "levelsCleared", "modeMetric", "chainLenSum", "runtimeMs"] as const;
type Metric = (typeof VALID_METRICS)[number];

export function main(argv: string[]): void {
  const f = parseFlags(argv);
  const manifestPath = f.get("--manifest");
  const metric = f.str<Metric>("--metric", "peak", VALID_METRICS);
  const mdePct = f.num("--mde", 5, { min: 0.01 });
  const oneSample = f.has("--one-sample");

  const manualMean = f.get("--mean") !== undefined ? f.num("--mean", 0) : NaN;
  const manualStd = f.get("--stddev") !== undefined ? f.num("--stddev", 0, { min: 0 }) : NaN;

  if (manifestPath) {
    const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
    const summaries = raw.summaries ?? [];
    if (summaries.length === 0) throw new Error(`${manifestPath}: no .summaries`);
    console.log(`\n  Power analysis — metric=${metric}, MDE=${mdePct}%, ${oneSample ? "one" : "two"}-sample\n`);
    console.log(`    cell                                  mean       stddev    needed N`);
    console.log(`    ------------------------------------  ---------  --------  --------`);
    for (const s of summaries as Array<{ mode: string; algo: string; policy: string; runs: Array<Record<string, number>> }>) {
      const xs = s.runs.map((r) => r[metric]);
      const m = meanOf(xs);
      const sd = stddevOf(xs);
      const mde = Math.abs(m) * (mdePct / 100);
      const n = powerN(sd, mde, { twoSample: !oneSample });
      const label = `${s.mode}/${s.algo}/${s.policy}`.padEnd(36);
      console.log(`    ${label}  ${m.toExponential(2).padStart(9)}  ${sd.toExponential(2).padStart(8)}  ${String(n).padStart(8)}`);
    }
    console.log(`\n  needed N = sample size per group to detect a ${mdePct}% change in mean with α=0.05, 80% power.`);
    console.log("");
  } else if (Number.isFinite(manualMean) && Number.isFinite(manualStd)) {
    const mde = Math.abs(manualMean) * (mdePct / 100);
    const n = powerN(manualStd, mde, { twoSample: !oneSample });
    console.log(`\n  manual: σ=${manualStd}, mean=${manualMean}, MDE=${mdePct}% (=${mde.toExponential(2)}), ${oneSample ? "one" : "two"}-sample`);
    console.log(`  needed N per group: ${n}\n`);
  } else {
    throw new Error(
      `Usage:\n` +
      `  harness power --manifest <bench.json> --metric <name> --mde <pct>\n` +
      `  harness power --mean <m> --stddev <σ> --mde <pct>\n` +
      `Available --metric values: ${VALID_METRICS.join(", ")}\n` +
      `Add --one-sample for sizing against a fixed reference.`
    );
  }
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
