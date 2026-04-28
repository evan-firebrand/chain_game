/**
 * Shared utilities for harness scripts. Replaces the three drifting copies of
 * parseArgs / fmt / median / table-rendering that used to live in benchmark.ts,
 * sweep-config.ts, and benchmark-wilds.ts.
 */

import { execSync } from "node:child_process";
import os from "node:os";
import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Flag parsing — shared `get(flag, fallback?)` and CSV/number list helpers.
// Throws on invalid input rather than silently producing NaN.
// ─────────────────────────────────────────────────────────────────────────────

export type Flags = {
  get: (flag: string, fallback?: string) => string | undefined;
  has: (flag: string) => boolean;
  num: (flag: string, fallback: number, opts?: { min?: number; max?: number }) => number;
  numList: (flag: string, fallback: number[]) => number[];
  str: <T extends string>(flag: string, fallback: T, allowed?: readonly T[]) => T;
  strList: <T extends string>(flag: string, fallback: T[], allowed?: readonly T[]) => T[];
};

export function parseFlags(argv: string[]): Flags {
  const get = (flag: string, fallback?: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? fallback : argv[i + 1];
  };
  const has = (flag: string) => argv.includes(flag);
  const num = (flag: string, fallback: number, opts?: { min?: number; max?: number }) => {
    const raw = get(flag);
    if (raw === undefined) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`${flag} must be a number, got ${raw}`);
    if (opts?.min !== undefined && n < opts.min) throw new Error(`${flag} must be ≥ ${opts.min}, got ${n}`);
    if (opts?.max !== undefined && n > opts.max) throw new Error(`${flag} must be ≤ ${opts.max}, got ${n}`);
    return n;
  };
  const numList = (flag: string, fallback: number[]) => {
    const raw = get(flag);
    if (raw === undefined) return fallback;
    const list = raw.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0);
    if (list.length === 0) throw new Error(`${flag} parsed to empty list (input: ${raw})`);
    return list;
  };
  const str = <T extends string>(flag: string, fallback: T, allowed?: readonly T[]): T => {
    const raw = get(flag);
    const v = (raw ?? fallback) as T;
    if (allowed && !allowed.includes(v)) {
      throw new Error(`${flag}=${v} not in [${allowed.join(", ")}]`);
    }
    return v;
  };
  const strList = <T extends string>(flag: string, fallback: T[], allowed?: readonly T[]): T[] => {
    const raw = get(flag);
    if (raw === undefined) return fallback;
    const list = raw.split(",").map((s) => s.trim()) as T[];
    if (allowed) {
      for (const v of list) if (!allowed.includes(v)) throw new Error(`${flag}: ${v} not in [${allowed.join(", ")}]`);
    }
    return list;
  };
  return { get, has, num, numList, str, strList };
}

// ─────────────────────────────────────────────────────────────────────────────
// Number formatting. Robust against the >~1e39 case where toFixed silently
// returns scientific notation (the bug that mangled the old benchmark output).
// ─────────────────────────────────────────────────────────────────────────────

export function fmtNum(n: number): string {
  if (!Number.isFinite(n) || Number.isNaN(n)) return "OVF";
  const a = Math.abs(n);
  if (a === 0) return "0";
  // For very large values, toFixed itself returns scientific notation. Just emit
  // a clean exponential form rather than the mangled "1.05e+23E" we used to.
  if (a >= 1e21) return n.toExponential(2);
  if (a >= 1e18) return (n / 1e18).toFixed(1) + "E";
  if (a >= 1e15) return (n / 1e15).toFixed(1) + "P";
  if (a >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}

export function fmtFixed(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistics. mean/median/stddev/percentile/ci95.
// ─────────────────────────────────────────────────────────────────────────────

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

export function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

// p in [0, 100]. Linear interpolation between order statistics.
export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

// 95% normal-approximation CI for the mean. Returns the half-width.
// For small N (<30) or skewed distributions, prefer `bootstrapMean` below.
export function ci95(xs: number[]): number {
  if (xs.length < 2) return 0;
  return 1.96 * (stddev(xs) / Math.sqrt(xs.length));
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap. Percentile method — simple, robust, honest for skewed data
// (peak/score distributions are very skewed in this game).
//
// Reproducibility: we seed the resampling RNG with a fixed value so identical
// samples produce identical CIs across runs. This means bootstrap CIs are
// part of the bit-exact-replay guarantee.
// ─────────────────────────────────────────────────────────────────────────────

const BOOTSTRAP_SAMPLES = 1000;
const BOOTSTRAP_SEED = 1;

// Mulberry32. Inlined to keep _lib.ts dependency-free.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generic percentile bootstrap for an arbitrary statistic of a sample.
// Returns 95% CI [low, high].
export function bootstrap<T>(
  sample: T[],
  statistic: (xs: T[]) => number,
  opts?: { samples?: number; seed?: number; alpha?: number }
): { stat: number; low: number; high: number; halfWidth: number } {
  const stat = statistic(sample);
  if (sample.length < 2) return { stat, low: stat, high: stat, halfWidth: 0 };
  const B = opts?.samples ?? BOOTSTRAP_SAMPLES;
  const alpha = opts?.alpha ?? 0.05;
  const rng = makeRng(opts?.seed ?? BOOTSTRAP_SEED);
  const N = sample.length;
  const stats = new Float64Array(B);
  const buf: T[] = new Array(N);
  for (let b = 0; b < B; b++) {
    for (let i = 0; i < N; i++) buf[i] = sample[Math.floor(rng() * N)];
    stats[b] = statistic(buf);
  }
  const sorted = Array.from(stats).sort((a, b) => a - b);
  const low = sorted[Math.floor((alpha / 2) * B)];
  const high = sorted[Math.min(B - 1, Math.floor((1 - alpha / 2) * B))];
  // Half-width of CI around the point estimate. For percentile bootstrap on
  // skewed data the CI is asymmetric; report the larger side as half-width
  // so "value ± hw" is a conservative band.
  const halfWidth = Math.max(stat - low, high - stat);
  return { stat, low, high, halfWidth };
}

// Bootstrap CI for the mean — the most common case.
export function bootstrapMean(xs: number[], opts?: { samples?: number; seed?: number }): {
  stat: number; low: number; high: number; halfWidth: number;
} {
  return bootstrap(xs, mean, opts);
}

// Bootstrap CI for the median.
export function bootstrapMedian(xs: number[], opts?: { samples?: number; seed?: number }): {
  stat: number; low: number; high: number; halfWidth: number;
} {
  return bootstrap(xs, median, opts);
}

// Paired bootstrap on a delta. Caller passes pre-aligned (a[i] - b[i]) values.
// Crucial for paired comparisons — independent CIs on each side underestimate
// confidence in the delta when the underlying samples are seed-paired.
export function bootstrapPairedMean(deltas: number[], opts?: { samples?: number; seed?: number }): {
  stat: number; low: number; high: number; halfWidth: number;
} {
  return bootstrap(deltas, mean, opts);
}

// Wilson score 95% CI for a proportion. Closed form, exact at all N.
// Better than the normal-approximation interval, especially when p is near 0/1.
export function wilsonCI(successes: number, n: number): { rate: number; low: number; high: number } {
  if (n === 0) return { rate: 0, low: 0, high: 0 };
  const z = 1.96;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { rate: p, low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Distribution stat. One per metric: mean/median/stddev + percentiles + CI.
// ─────────────────────────────────────────────────────────────────────────────

export type DistributionStat = {
  n: number;
  mean: number;
  median: number;
  stddev: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  iqr: number;
  ciLow: number;
  ciHigh: number;
  ciHalfWidth: number;
};

export function distributionStat(xs: number[], opts?: { samples?: number; seed?: number }): DistributionStat {
  const n = xs.length;
  if (n === 0) {
    return { n: 0, mean: 0, median: 0, stddev: 0, p10: 0, p25: 0, p75: 0, p90: 0, iqr: 0, ciLow: 0, ciHigh: 0, ciHalfWidth: 0 };
  }
  const m = mean(xs);
  const md = median(xs);
  const sd = stddev(xs);
  const p10 = percentile(xs, 10);
  const p25 = percentile(xs, 25);
  const p75 = percentile(xs, 75);
  const p90 = percentile(xs, 90);
  const ci = bootstrapMean(xs, opts);
  return {
    n, mean: m, median: md, stddev: sd,
    p10, p25, p75, p90, iqr: p75 - p25,
    ciLow: ci.low, ciHigh: ci.high, ciHalfWidth: ci.halfWidth,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Power analysis. Required N to detect a given MDE with 80% power at α=0.05.
// Returns ceil(N). twoSample=true (default) sizes for comparing two equal-N
// groups; twoSample=false for a one-sample test against a fixed reference.
// ─────────────────────────────────────────────────────────────────────────────

const Z_ALPHA_05 = 1.959964; // two-tailed α = 0.05
const Z_BETA_80 = 0.841621;  // power = 0.80

export function powerN(stddev: number, mde: number, opts?: { twoSample?: boolean }): number {
  if (mde <= 0 || stddev <= 0) return Infinity;
  const k = (opts?.twoSample ?? true) ? 2 : 1;
  const z = Z_ALPHA_05 + Z_BETA_80;
  return Math.ceil(k * Math.pow((z * stddev) / mde, 2));
}

// Convenience: given a sample and a desired % MDE on the mean, compute N.
export function powerNFromSample(xs: number[], mdePct: number, opts?: { twoSample?: boolean }): number {
  const m = mean(xs);
  if (m === 0) return Infinity;
  const mde = Math.abs(m) * (mdePct / 100);
  return powerN(stddev(xs), mde, opts);
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderers for "value ± halfwidth" cells.
// ─────────────────────────────────────────────────────────────────────────────

export function fmtCI(value: number, halfWidth: number, digits = 0): string {
  return `${fmtFixed(value, digits)} ± ${fmtFixed(halfWidth, digits)}`;
}

export function fmtCINum(value: number, halfWidth: number): string {
  return `${fmtNum(value)} ± ${fmtNum(halfWidth)}`;
}

// Wilson CI as `42% [38–46]` — readable for proportions in tables.
export function fmtProportionCI(rate: number, low: number, high: number): string {
  const pct = (n: number) => (n * 100).toFixed(0);
  return `${pct(rate)}% [${pct(low)}–${pct(high)}]`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Paired-comparison helpers. Detect whether two summaries share seeds (so the
// delta CI can be computed via paired bootstrap rather than independent CIs).
// ─────────────────────────────────────────────────────────────────────────────

export function seedsMatch(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Paired delta CI: bootstrap the per-seed differences. For independent samples
// (different seed lists) the half-width of (a - b) is roughly sqrt(hw_a² + hw_b²);
// this can dramatically overstate uncertainty when the underlying samples are
// actually paired. Always use this when seeds match.
export function pairedDeltaCI(
  a: number[], b: number[],
  opts?: { samples?: number; seed?: number }
): { delta: number; low: number; high: number; halfWidth: number } {
  if (a.length !== b.length) throw new Error(`paired delta requires equal-length samples (got ${a.length} vs ${b.length})`);
  const deltas = a.map((x, i) => x - b[i]);
  const { stat, low, high, halfWidth } = bootstrap(deltas, mean, opts);
  return { delta: stat, low, high, halfWidth };
}

// Independent two-sample delta CI. Use when seeds don't match. Half-width via
// quadrature on independent CIs of each mean — conservative.
export function independentDeltaCI(a: number[], b: number[]): { delta: number; halfWidth: number } {
  const ma = mean(a), mb = mean(b);
  const hwA = bootstrapMean(a).halfWidth;
  const hwB = bootstrapMean(b).halfWidth;
  return { delta: ma - mb, halfWidth: Math.sqrt(hwA * hwA + hwB * hwB) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Table rendering. Object form is friendlier than tuples under strict mode.
// ─────────────────────────────────────────────────────────────────────────────

export type TableCol<T> = {
  header: string;
  render: (row: T) => string;
  align?: "left" | "right";
};

export function printTable<T>(rows: T[], cols: ReadonlyArray<TableCol<T>>): void {
  const widths = cols.map((c) =>
    Math.max(c.header.length, ...rows.map((r) => c.render(r).length))
  );
  const pad = (s: string, w: number, a: "left" | "right" | undefined) =>
    a === "left" ? s.padEnd(w) : s.padStart(w);
  console.log(cols.map((c, i) => pad(c.header, widths[i], c.align)).join("  "));
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) {
    console.log(cols.map((c, i) => pad(c.render(r), widths[i], c.align)).join("  "));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Manifest helpers — every JSON output gets the same {gitSha, timestamp,
// nodeVersion, platform, ...} envelope, so agents can inspect any output file
// without knowing which script produced it.
// ─────────────────────────────────────────────────────────────────────────────

export function gitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

export type ManifestEnvelope = {
  schemaVersion: number;
  schema: string;
  script: string;
  command: string; // canonical CLI invocation that produced this run
  gitSha: string;
  nodeVersion: string;
  platform: string;
  cpu: string;
  cpuCount: number;
  totalMemoryMB: number;
  timestamp: string;
};

export function envelope(opts: { script: string; schema: string; command: string }): ManifestEnvelope {
  return {
    schemaVersion: 1,
    schema: opts.schema,
    script: opts.script,
    command: opts.command,
    gitSha: gitSha(),
    nodeVersion: process.version,
    platform: `${os.platform()}-${os.arch()}`,
    cpu: os.cpus()[0]?.model ?? "unknown",
    cpuCount: os.cpus().length,
    totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
    timestamp: new Date().toISOString(),
  };
}

// Reconstruct the canonical `npx tsx <script> ...args` command for replay.
export function reconstructCommand(script: string, argv: string[]): string {
  return `npx tsx ${script} ${argv.join(" ")}`.trim();
}

export function writeJSON(path: string, data: unknown): void {
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardrails — protect agents from accidentally launching huge runs.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_MAX_GAMES = 5000;

export type GuardrailOpts = {
  totalGames: number;
  maxGames?: number;        // hard cap on game count
  allowLong: boolean;       // override caps explicitly
  estimatedMs?: number;     // optional pre-run estimate (ms total)
};

export function checkGuardrails(opts: GuardrailOpts): void {
  const maxGames = opts.maxGames ?? DEFAULT_MAX_GAMES;
  if (opts.totalGames > maxGames && !opts.allowLong) {
    throw new Error(
      `Refusing to run ${opts.totalGames} games (cap: ${maxGames}). Pass --allow-long to override, or reduce --n / --seeds / sweep dimensions.`
    );
  }
  if (opts.estimatedMs !== undefined) {
    const minutes = opts.estimatedMs / 60000;
    if (minutes > 30 && !opts.allowLong) {
      throw new Error(
        `Refusing to run: estimated ${minutes.toFixed(1)} min exceeds 30 min hard cap. Pass --allow-long to override.`
      );
    }
    if (minutes > 5) {
      console.warn(`[guardrail] estimated runtime: ${minutes.toFixed(1)} min`);
    }
  }
}

// Read the most recent baseline file to estimate per-game time. Used by the
// pre-run estimator. Returns null if no baseline exists or the schema doesn't
// match. Phase 1 keeps this minimal — uses the overall games/sec, not per-mode.
export function loadBaselineGamesPerSec(): number | null {
  try {
    const dir = "baselines";
    if (!existsSync(dir)) return null;
    const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    if (files.length === 0) return null;
    const latest = files[files.length - 1];
    const data = JSON.parse(readFileSync(`${dir}/${latest}`, "utf8"));
    if (data.schema !== "harness-perf-baseline") return null;
    return typeof data.overallGamesPerSec === "number" ? data.overallGamesPerSec : null;
  } catch {
    return null;
  }
}

export function estimateRuntimeMs(totalGames: number): number | undefined {
  const gps = loadBaselineGamesPerSec();
  if (!gps || gps <= 0) return undefined;
  return (totalGames / gps) * 1000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-direct-execution check. ESM-friendly equivalent of `if (require.main
// === module)`. Returns true if the given import.meta.url corresponds to the
// process entry point, so a script can both export `main()` and self-execute
// when run directly via tsx.
// ─────────────────────────────────────────────────────────────────────────────

export function isMainModule(importMetaUrl: string): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  // tsx normalises import.meta.url to file:// URL; compare against argv[1].
  return importMetaUrl === `file://${argv1}` || importMetaUrl.endsWith(argv1);
}
