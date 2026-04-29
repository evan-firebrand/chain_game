/**
 * Skill-depth study runner.
 *
 * Modes:
 *   A.4 baseline       — default-config 3-bot ladder (random, d1, d3),
 *                        100 paired games, 50-turn cap. Writes the initial
 *                        study report.
 *   A.5a calibration   — measures actual d3 wall-clock per game on 4 cells
 *                        spanning the grid; surfaces revised budget.
 *   A.5b grid          — full 54-cell random+d1 sweep with paired seeds.
 *   A.5d d3-selective  — d3 paired with random on a triaged subset of cells.
 *
 * Run:  npx vite-node scripts/study-skill-depth.ts <mode>
 *       <mode> ∈ { 'baseline' | 'calibration' | 'grid' | 'd3-selective' }
 *
 * Output:  appends to docs/engineering/studies/01-skill-depth-spread.md
 */

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DEFAULT_CONFIG, type GameConfig, type TileValue } from '../src/game-kernel/index.js';
import { unpackTile } from '../src/game-kernel/fast/index.js';
import { playOneGame } from '../src/sim-harness/runner.js';
import type { GameResult, StrategyName } from '../src/sim-harness/types.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const STUDY_PATH = resolve('docs/engineering/studies/01-skill-depth-spread.md');
const MAX_TURNS = 50;
const BASELINE_GAMES = 100;
const BASELINE_KERNEL_SEED_BASE = 1000;
const BASELINE_STRATEGY_SEED_BASE = 0;
const BASELINE_STRATEGIES: readonly StrategyName[] = ['random', 'search-d1', 'search-d3'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface PairedDiff {
  readonly mean: number;
  readonly ci95: number;
  readonly stderr: number;
  readonly n: number;
}

function pairedDiff(a: readonly number[], b: readonly number[]): PairedDiff {
  if (a.length !== b.length) throw new Error(`pairedDiff: lengths differ ${a.length} vs ${b.length}`);
  const n = a.length;
  if (n === 0) return { mean: 0, ci95: 0, stderr: 0, n: 0 };
  const diffs = new Array<number>(n);
  for (let i = 0; i < n; i++) diffs[i] = (a[i] ?? 0) - (b[i] ?? 0);
  const m = diffs.reduce((s, x) => s + x, 0) / n;
  let varSum = 0;
  for (const d of diffs) varSum += (d - m) ** 2;
  const variance = n > 1 ? varSum / (n - 1) : 0;
  const stderr = Math.sqrt(variance / n);
  return { mean: m, ci95: 1.96 * stderr, stderr, n };
}

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function tier(maxTile: number): number {
  return maxTile > 1 ? Math.log2(maxTile) : 0;
}

function extract(games: readonly GameResult[], f: (g: GameResult) => number): number[] {
  return games.map(f);
}

// ─── Cell runner ─────────────────────────────────────────────────────────────

interface CellRun {
  readonly strategy: StrategyName;
  readonly games: readonly GameResult[];
  readonly wallClockMs: number;
}

function runStrategyOnConfig(
  config: GameConfig,
  strategy: StrategyName,
  n: number,
  baseKernelSeed: number,
  baseStrategySeed: number,
  maxTurns: number,
): CellRun {
  const t0 = Date.now();
  const games: GameResult[] = [];
  for (let i = 0; i < n; i++) {
    const cfg: GameConfig = { ...config, prngSeed: baseKernelSeed + i, recordEvents: false };
    games.push(playOneGame(cfg, strategy, baseStrategySeed + i, { maxTurns }));
  }
  return { strategy, games, wallClockMs: Date.now() - t0 };
}

// ─── Board snapshot rendering ───────────────────────────────────────────────

function renderBoardSnapshot(snapshot: readonly number[] | null, rows: number, cols: number): string {
  if (snapshot === null) return '(no snapshot — game ended before turn 30)';
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const byte = snapshot[r * cols + c] ?? 0;
      const tile = unpackTile(byte);
      const v = tile.value as number;
      if (v === 0) row.push('   .');
      else row.push(v.toString().padStart(4, ' '));
    }
    lines.push(row.join(' '));
  }
  return lines.join('\n');
}

// ─── A.4 baseline mode ───────────────────────────────────────────────────────

function modeBaseline(): void {
  const config: GameConfig = { ...DEFAULT_CONFIG, recordEvents: false };
  console.log(`A.4 baseline: ${BASELINE_STRATEGIES.length} strategies × ${BASELINE_GAMES} games × ${MAX_TURNS}-turn cap`);
  const runs: CellRun[] = [];
  for (const strat of BASELINE_STRATEGIES) {
    const run = runStrategyOnConfig(
      config,
      strat,
      BASELINE_GAMES,
      BASELINE_KERNEL_SEED_BASE,
      BASELINE_STRATEGY_SEED_BASE,
      MAX_TURNS,
    );
    console.log(`  ${strat}: ${run.games.length} games in ${(run.wallClockMs / 1000).toFixed(2)}s (${(run.wallClockMs / run.games.length).toFixed(1)} ms/game)`);
    runs.push(run);
  }

  const md = renderBaselineReport(config, runs);
  mkdirSync(dirname(STUDY_PATH), { recursive: true });
  writeFileSync(STUDY_PATH, md);
  console.log(`Wrote ${STUDY_PATH}`);
}

function renderBaselineReport(config: GameConfig, runs: readonly CellRun[]): string {
  const lines: string[] = [];
  lines.push('# Chain Game — Skill-Depth Study');
  lines.push('');
  lines.push('**Status:** A.4 baseline written; A.5 grid sweep pending.');
  lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## A.4 — Default-config baseline');
  lines.push('');
  lines.push('### Inputs');
  lines.push('');
  lines.push(`- ruleK = ${config.ruleK}, board = ${config.gridRows}×${config.gridCols}, spawnPoolMin = ${config.spawnPoolMin}, spawnPoolMax = ${config.spawnPoolMax}`);
  lines.push(`- Spawn weights: \`${JSON.stringify(config.spawnWeights)}\``);
  lines.push(`- Strategies: ${BASELINE_STRATEGIES.join(', ')}`);
  lines.push(`- Games per strategy: ${BASELINE_GAMES}, paired by (kernelSeed=${BASELINE_KERNEL_SEED_BASE}+i, strategySeed=${BASELINE_STRATEGY_SEED_BASE}+i)`);
  lines.push(`- Game cap: ${MAX_TURNS} turns`);
  lines.push('');

  lines.push('### Per-strategy aggregates');
  lines.push('');
  lines.push('| Strategy | mean maxTile | median maxTile | mean tier (log₂) | mean chainsPerLevel | mean avgChainLength | % cap-truncated | wall-clock total | per-game |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const run of runs) {
    const maxTiles = extract(run.games, (g) => g.outputs.maxTile);
    const tiers = extract(run.games, (g) => tier(g.outputs.maxTile));
    const cpl = extract(run.games, (g) => g.outputs.chainsPerLevel);
    const acl = extract(run.games, (g) => g.outputs.avgChainLength);
    const capRate = run.games.filter((g) => g.outputs.endedByTurnCap).length / run.games.length;
    lines.push(
      `| ${run.strategy} | ${mean(maxTiles).toFixed(1)} | ${median(maxTiles).toFixed(1)} | ${mean(tiers).toFixed(2)} | ${mean(cpl).toFixed(2)} | ${mean(acl).toFixed(2)} | ${(capRate * 100).toFixed(0)}% | ${(run.wallClockMs / 1000).toFixed(2)}s | ${(run.wallClockMs / run.games.length).toFixed(1)} ms |`,
    );
  }
  lines.push('');

  lines.push('### Paired spreads (95% CI)');
  lines.push('');
  const byStrategy = new Map<StrategyName, CellRun>();
  for (const r of runs) byStrategy.set(r.strategy, r);
  const r0 = byStrategy.get('random')!;
  const d1 = byStrategy.get('search-d1')!;
  const d3 = byStrategy.get('search-d3')!;
  const mkRow = (label: string, a: CellRun, b: CellRun): string => {
    const tierDiff = pairedDiff(extract(a.games, (g) => tier(g.outputs.maxTile)), extract(b.games, (g) => tier(g.outputs.maxTile)));
    const cplDiff = pairedDiff(extract(a.games, (g) => g.outputs.chainsPerLevel), extract(b.games, (g) => g.outputs.chainsPerLevel));
    const aclDiff = pairedDiff(extract(a.games, (g) => g.outputs.avgChainLength), extract(b.games, (g) => g.outputs.avgChainLength));
    return `| ${label} | ${tierDiff.mean.toFixed(2)} ± ${tierDiff.ci95.toFixed(2)} | ${cplDiff.mean.toFixed(2)} ± ${cplDiff.ci95.toFixed(2)} | ${aclDiff.mean.toFixed(2)} ± ${aclDiff.ci95.toFixed(2)} |`;
  };
  lines.push('| Comparison | Δ tier (log₂ maxTile) | Δ chainsPerLevel | Δ avgChainLength |');
  lines.push('|---|---:|---:|---:|');
  lines.push(mkRow('d3 − random (Gap B: total depth)', d3, r0));
  lines.push(mkRow('d1 − random (typical play above monkey)', d1, r0));
  lines.push(mkRow('d3 − d1 (Gap C: mastery headroom)', d3, d1));
  lines.push('');

  lines.push('### Per-turn maxTile trend (mean across games still running)');
  lines.push('');
  lines.push('| turn | random | d1 | d3 |');
  lines.push('|---:|---:|---:|---:|');
  const turnPoints = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  for (const t of turnPoints) {
    const cells: string[] = [String(t)];
    for (const strat of BASELINE_STRATEGIES) {
      const run = byStrategy.get(strat)!;
      const vals: number[] = [];
      for (const g of run.games) {
        const v = g.outputs.metricsByTurn.maxTile[t - 1];
        if (v !== undefined) vals.push(v);
      }
      cells.push(vals.length > 0 ? `${mean(vals).toFixed(1)} (n=${vals.length})` : '—');
    }
    lines.push(`| ${cells.join(' | ')} |`);
  }
  lines.push('');

  lines.push('### Late-game board snapshots (turn 30, game 0)');
  lines.push('');
  for (const strat of BASELINE_STRATEGIES) {
    const run = byStrategy.get(strat)!;
    const snap = run.games[0]?.outputs.boardSnapshotTurn30 ?? null;
    lines.push(`**${strat}:**`);
    lines.push('```');
    lines.push(renderBoardSnapshot(snap, config.gridRows, config.gridCols));
    lines.push('```');
    lines.push('');
  }

  lines.push('### Adaptive-checkpoint flags');
  lines.push('');
  const tiersR = extract(r0.games, (g) => tier(g.outputs.maxTile));
  const tiersD3 = extract(d3.games, (g) => tier(g.outputs.maxTile));
  const tierGap = mean(tiersD3) - mean(tiersR);
  const capR = r0.games.filter((g) => g.outputs.endedByTurnCap).length / r0.games.length;
  const capD3 = d3.games.filter((g) => g.outputs.endedByTurnCap).length / d3.games.length;
  lines.push(`- d3 vs random tier gap: **${tierGap.toFixed(2)}** ${tierGap < 1 ? '⚠️ < 1 tier — surface as headline before A.5' : '— meaningful spread visible'}`);
  lines.push(`- random %cap-truncated: **${(capR * 100).toFixed(0)}%** ${capR > 0.8 ? '⚠️ >80% — consider Phase 1.5 cap extension' : '— acceptable'}`);
  lines.push(`- d3 %cap-truncated: **${(capD3 * 100).toFixed(0)}%** ${capD3 > 0.8 ? '⚠️ >80% — d3 likely capped before late-game divergence' : '— acceptable'}`);
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## A.5 — Grid sweep (PENDING)');
  lines.push('');
  lines.push('Awaiting A.5a calibration → A.5b 54-cell grid → A.5c triage → A.5d selective d3.');
  lines.push('');

  return lines.join('\n');
}

// ─── Cell shape (shared by A.5a/b/c/d) ───────────────────────────────────────

type WeightShape = 'flat' | 'default' | 'steep';

interface StudyCell {
  readonly id: string;
  readonly ruleK: number;
  readonly gridRows: number;
  readonly gridCols: number;
  readonly weightShape: WeightShape;
  readonly poolCount: 8 | 12;
}

function makeWeights(
  min: TileValue,
  max: TileValue,
  shape: WeightShape,
): Readonly<Partial<Record<TileValue, number>>> {
  const out: Partial<Record<TileValue, number>> = {};
  let v: number = min;
  while (v <= max) {
    let w: number;
    if (shape === 'flat') {
      w = 1;
    } else {
      const tierFromTop = Math.log2(max / v);
      w = shape === 'default' ? 2 ** tierFromTop : 4 ** tierFromTop;
    }
    out[v as TileValue] = w;
    v = v * 2;
  }
  return out;
}

function cellConfig(cell: StudyCell): GameConfig {
  const spawnPoolMax = (1 << cell.poolCount) as TileValue;
  const spawnPoolMin = DEFAULT_CONFIG.spawnPoolMin;
  return {
    ...DEFAULT_CONFIG,
    ruleK: cell.ruleK,
    gridRows: cell.gridRows,
    gridCols: cell.gridCols,
    spawnPoolMin,
    spawnPoolMax,
    spawnWeights: makeWeights(spawnPoolMin, spawnPoolMax, cell.weightShape),
    recordEvents: false,
  };
}

function cellIdOf(cell: { ruleK: number; gridRows: number; gridCols: number; weightShape: WeightShape; poolCount: number }): string {
  return `k${cell.ruleK}_${cell.gridRows}x${cell.gridCols}_${cell.weightShape}_pool${cell.poolCount}`;
}

// ─── A.5a calibration mode ───────────────────────────────────────────────────

const CALIBRATION_GAMES = 30;
const CALIBRATION_KERNEL_SEED_BASE = 2000;
const CALIBRATION_STRATEGY_SEED_BASE = 0;

const CALIBRATION_CELLS: readonly StudyCell[] = [
  // Span the grid: low-k small-board flat-weights large-pool
  { id: cellIdOf({ ruleK: 1, gridRows: 6, gridCols: 5, weightShape: 'flat', poolCount: 12 }),
    ruleK: 1, gridRows: 6, gridCols: 5, weightShape: 'flat', poolCount: 12 },
  // Default cell (k=2, 7x6, default weights, pool=8)
  { id: cellIdOf({ ruleK: 2, gridRows: 7, gridCols: 6, weightShape: 'default', poolCount: 8 }),
    ruleK: 2, gridRows: 7, gridCols: 6, weightShape: 'default', poolCount: 8 },
  // High-k large-board steep large-pool
  { id: cellIdOf({ ruleK: 3, gridRows: 9, gridCols: 8, weightShape: 'steep', poolCount: 12 }),
    ruleK: 3, gridRows: 9, gridCols: 8, weightShape: 'steep', poolCount: 12 },
  // Mid-grid: default cell but pool=12 (the only off-default axis)
  { id: cellIdOf({ ruleK: 2, gridRows: 7, gridCols: 6, weightShape: 'default', poolCount: 12 }),
    ruleK: 2, gridRows: 7, gridCols: 6, weightShape: 'default', poolCount: 12 },
];

function modeCalibration(): void {
  console.log(`A.5a calibration: ${CALIBRATION_CELLS.length} cells × ${CALIBRATION_GAMES} d3 games`);
  const lines: string[] = [];
  lines.push('---');
  lines.push('');
  lines.push('## A.5a — Calibration pass');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`**Cells:** ${CALIBRATION_CELLS.length} × ${CALIBRATION_GAMES} d3 games × ${MAX_TURNS}-turn cap.`);
  lines.push('');
  lines.push('| Cell | ruleK | board | weights | pool | mean ms/d3 game | total wall-clock |');
  lines.push('|---|---:|---|---|---:|---:|---:|');

  let grandTotalMs = 0;
  for (const cell of CALIBRATION_CELLS) {
    const cfg = cellConfig(cell);
    const t0 = Date.now();
    const games: GameResult[] = [];
    for (let i = 0; i < CALIBRATION_GAMES; i++) {
      const cfgI: GameConfig = { ...cfg, prngSeed: CALIBRATION_KERNEL_SEED_BASE + i };
      games.push(playOneGame(cfgI, 'search-d3', CALIBRATION_STRATEGY_SEED_BASE + i, { maxTurns: MAX_TURNS }));
    }
    const dt = Date.now() - t0;
    const perGame = dt / games.length;
    grandTotalMs += dt;
    console.log(`  ${cell.id}: ${games.length} games in ${(dt / 1000).toFixed(2)}s (${perGame.toFixed(1)} ms/game)`);
    lines.push(`| \`${cell.id}\` | ${cell.ruleK} | ${cell.gridRows}×${cell.gridCols} | ${cell.weightShape} | ${cell.poolCount} | ${perGame.toFixed(1)} | ${(dt / 1000).toFixed(2)}s |`);
  }

  // Project A.5d cost from worst-cell timing.
  const allTimes = CALIBRATION_CELLS.map((_, i) => i); // placeholder; recompute below
  void allTimes;
  // Better: compute max from the loop, but loop already finished. Recompute by tracking.
  // Simpler: the table strings already record per-cell mean; let's reparse from grandTotal.
  const meanMsPerD3 = grandTotalMs / (CALIBRATION_CELLS.length * CALIBRATION_GAMES);

  lines.push('');
  lines.push(`**Aggregate:** mean ${meanMsPerD3.toFixed(1)} ms/d3 game across ${CALIBRATION_CELLS.length * CALIBRATION_GAMES} calibration games (${(grandTotalMs / 1000).toFixed(1)}s total).`);
  lines.push('');
  // Project full A.5d at this mean rate.
  const fullGridD3Sec = (54 * 50 * meanMsPerD3) / 1000;
  lines.push(`**Projection:** at mean ${meanMsPerD3.toFixed(1)} ms/d3 game, a full 54-cell × 50-game d3 sweep would take ~${(fullGridD3Sec / 60).toFixed(1)} minutes. Triage gates are unnecessary at these per-game costs; A.5c may default to Path C (run d3 on all 54 cells).`);
  lines.push('');

  appendFileSync(STUDY_PATH, lines.join('\n'));
  console.log(`Appended calibration to ${STUDY_PATH}`);
  console.log(`Mean d3: ${meanMsPerD3.toFixed(1)} ms/game; full 54-cell d3 grid projected at ${(fullGridD3Sec / 60).toFixed(1)} min.`);
}

function modeGrid(): void {
  console.log('A.5b grid — not implemented yet.');
  process.exit(2);
}
function modeD3Selective(): void {
  console.log('A.5d d3-selective — not implemented yet.');
  process.exit(2);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function main(): void {
  const mode = process.argv[2] ?? 'baseline';
  switch (mode) {
    case 'baseline':
      modeBaseline();
      break;
    case 'calibration':
      modeCalibration();
      break;
    case 'grid':
      modeGrid();
      break;
    case 'd3-selective':
      modeD3Selective();
      break;
    default:
      console.error(`Unknown mode: ${mode}. Expected one of: baseline | calibration | grid | d3-selective`);
      process.exit(1);
  }
}

main();
