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

// ─── A.5b grid sweep mode ────────────────────────────────────────────────────

const GRID_GAMES = 50;
const GRID_KERNEL_SEED_BASE = 3000;
const GRID_STRATEGY_SEED_BASE = 0;

function buildGrid(): StudyCell[] {
  const out: StudyCell[] = [];
  const ruleKs = [1, 2, 3] as const;
  const boards = [
    [6, 5],
    [7, 6],
    [9, 8],
  ] as const;
  const shapes: readonly WeightShape[] = ['flat', 'default', 'steep'];
  const pools = [8, 12] as const;
  for (const ruleK of ruleKs) {
    for (const [r, c] of boards) {
      for (const ws of shapes) {
        for (const pc of pools) {
          out.push({
            id: cellIdOf({ ruleK, gridRows: r, gridCols: c, weightShape: ws, poolCount: pc }),
            ruleK,
            gridRows: r,
            gridCols: c,
            weightShape: ws,
            poolCount: pc,
          });
        }
      }
    }
  }
  return out;
}

interface CellPairedResult {
  readonly cell: StudyCell;
  readonly random: readonly GameResult[];
  readonly d1: readonly GameResult[];
  readonly wallClockMs: number;
}

function runCellPaired(cell: StudyCell, n: number): CellPairedResult {
  const cfg = cellConfig(cell);
  const t0 = Date.now();
  const random: GameResult[] = [];
  const d1: GameResult[] = [];
  for (let i = 0; i < n; i++) {
    const cfgI: GameConfig = { ...cfg, prngSeed: GRID_KERNEL_SEED_BASE + i };
    random.push(playOneGame(cfgI, 'random', GRID_STRATEGY_SEED_BASE + i, { maxTurns: MAX_TURNS }));
    d1.push(playOneGame(cfgI, 'search-d1', GRID_STRATEGY_SEED_BASE + i, { maxTurns: MAX_TURNS }));
  }
  return { cell, random, d1, wallClockMs: Date.now() - t0 };
}

interface CellSummary {
  readonly cell: StudyCell;
  readonly tierGap: PairedDiff;
  readonly cplGap: PairedDiff;
  readonly aclGap: PairedDiff;
  readonly capRandom: number;
  readonly capD1: number;
  readonly wallClockMs: number;
}

function summarize(r: CellPairedResult): CellSummary {
  const tierR = extract(r.random, (g) => tier(g.outputs.maxTile));
  const tierD = extract(r.d1, (g) => tier(g.outputs.maxTile));
  const cplR = extract(r.random, (g) => g.outputs.chainsPerLevel);
  const cplD = extract(r.d1, (g) => g.outputs.chainsPerLevel);
  const aclR = extract(r.random, (g) => g.outputs.avgChainLength);
  const aclD = extract(r.d1, (g) => g.outputs.avgChainLength);
  const capR = r.random.filter((g) => g.outputs.endedByTurnCap).length / r.random.length;
  const capD = r.d1.filter((g) => g.outputs.endedByTurnCap).length / r.d1.length;
  return {
    cell: r.cell,
    tierGap: pairedDiff(tierD, tierR),
    cplGap: pairedDiff(cplD, cplR),
    aclGap: pairedDiff(aclD, aclR),
    capRandom: capR,
    capD1: capD,
    wallClockMs: r.wallClockMs,
  };
}

function modeGrid(): void {
  const cells = buildGrid();
  console.log(`A.5b grid: ${cells.length} cells × ${GRID_GAMES} paired games × {random, d1}, ${MAX_TURNS}-turn cap`);
  const summaries: CellSummary[] = [];
  let grandMs = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const r = runCellPaired(cell, GRID_GAMES);
    grandMs += r.wallClockMs;
    summaries.push(summarize(r));
    if ((i + 1) % 10 === 0 || i === cells.length - 1) {
      console.log(`  [${i + 1}/${cells.length}] ${cell.id}: ${(r.wallClockMs / 1000).toFixed(2)}s (grand ${(grandMs / 1000).toFixed(0)}s)`);
    }
  }
  appendFileSync(STUDY_PATH, renderGridReport(summaries, grandMs));
  console.log(`Appended grid report to ${STUDY_PATH}`);
  console.log(`Total wall-clock: ${(grandMs / 1000).toFixed(1)}s (${cells.length} cells × ${GRID_GAMES} paired games)`);
}

function renderGridReport(summaries: readonly CellSummary[], grandMs: number): string {
  const lines: string[] = [];
  lines.push('\n---\n');
  lines.push('## A.5b — Random + d1 grid sweep\n');
  lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`**Inputs:** ${summaries.length} cells × ${GRID_GAMES} paired games × {random, search-d1}, ${MAX_TURNS}-turn cap, kernel seed ${GRID_KERNEL_SEED_BASE}+i.`);
  lines.push(`**Wall-clock:** ${(grandMs / 1000).toFixed(1)}s.\n`);

  // Per-cell table
  lines.push('### Per-cell paired spreads (d1 − random)\n');
  lines.push('| cell | k | board | weights | pool | Δ tier ± CI | Δ CPL ± CI | Δ ACL ± CI | %cap r→d1 |');
  lines.push('|---|---:|---|---|---:|---:|---:|---:|---:|');
  const sorted = [...summaries].sort((a, b) => b.tierGap.mean - a.tierGap.mean);
  for (const s of sorted) {
    lines.push(
      `| \`${s.cell.id}\` | ${s.cell.ruleK} | ${s.cell.gridRows}×${s.cell.gridCols} | ${s.cell.weightShape} | ${s.cell.poolCount} ` +
        `| ${s.tierGap.mean.toFixed(2)} ± ${s.tierGap.ci95.toFixed(2)} ` +
        `| ${s.cplGap.mean.toFixed(2)} ± ${s.cplGap.ci95.toFixed(2)} ` +
        `| ${s.aclGap.mean.toFixed(2)} ± ${s.aclGap.ci95.toFixed(2)} ` +
        `| ${(s.capRandom * 100).toFixed(0)}%→${(s.capD1 * 100).toFixed(0)}% |`,
    );
  }
  lines.push('');

  // Marginal tables on tier gap
  lines.push('### Marginal effects on Δ tier (mean across the other 3 axes)\n');
  const renderMarginal = (
    axis: string,
    groups: ReadonlyArray<{ label: string; cells: readonly CellSummary[] }>,
  ): void => {
    lines.push(`#### Marginal: ${axis}\n`);
    lines.push(`| ${axis} | mean Δ tier | mean Δ CPL | mean Δ ACL | n cells |`);
    lines.push('|---|---:|---:|---:|---:|');
    for (const g of groups) {
      const tiers = g.cells.map((c) => c.tierGap.mean);
      const cpls = g.cells.map((c) => c.cplGap.mean);
      const acls = g.cells.map((c) => c.aclGap.mean);
      lines.push(
        `| ${g.label} | ${mean(tiers).toFixed(2)} | ${mean(cpls).toFixed(2)} | ${mean(acls).toFixed(2)} | ${g.cells.length} |`,
      );
    }
    lines.push('');
  };

  renderMarginal('ruleK', [
    { label: '1', cells: summaries.filter((s) => s.cell.ruleK === 1) },
    { label: '2', cells: summaries.filter((s) => s.cell.ruleK === 2) },
    { label: '3', cells: summaries.filter((s) => s.cell.ruleK === 3) },
  ]);
  renderMarginal('board', [
    { label: '6×5', cells: summaries.filter((s) => s.cell.gridRows === 6) },
    { label: '7×6', cells: summaries.filter((s) => s.cell.gridRows === 7) },
    { label: '9×8', cells: summaries.filter((s) => s.cell.gridRows === 9) },
  ]);
  renderMarginal('spawnWeights', [
    { label: 'flat', cells: summaries.filter((s) => s.cell.weightShape === 'flat') },
    { label: 'default', cells: summaries.filter((s) => s.cell.weightShape === 'default') },
    { label: 'steep', cells: summaries.filter((s) => s.cell.weightShape === 'steep') },
  ]);
  renderMarginal('poolCount', [
    { label: '8 (max=256)', cells: summaries.filter((s) => s.cell.poolCount === 8) },
    { label: '12 (max=4096)', cells: summaries.filter((s) => s.cell.poolCount === 12) },
  ]);

  // Top/bottom cells by tier gap
  lines.push('### Top-5 cells by Δ tier (d1 most beats random)\n');
  lines.push('| rank | cell | Δ tier ± CI |');
  lines.push('|---:|---|---:|');
  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const s = sorted[i]!;
    lines.push(`| ${i + 1} | \`${s.cell.id}\` | ${s.tierGap.mean.toFixed(2)} ± ${s.tierGap.ci95.toFixed(2)} |`);
  }
  lines.push('');
  lines.push('### Bottom-5 cells by Δ tier (d1 barely beats random)\n');
  lines.push('| rank | cell | Δ tier ± CI |');
  lines.push('|---:|---|---:|');
  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const s = sorted[sorted.length - 1 - i]!;
    lines.push(`| ${i + 1} | \`${s.cell.id}\` | ${s.tierGap.mean.toFixed(2)} ± ${s.tierGap.ci95.toFixed(2)} |`);
  }
  lines.push('');

  // Cap-rate scan
  const allCap = summaries.every((s) => s.capRandom >= 0.99 && s.capD1 >= 0.99);
  lines.push('### Cap-rate scan\n');
  lines.push(`- Cells where 100% of both random and d1 games hit the 50-turn cap: ${summaries.filter((s) => s.capRandom >= 0.99 && s.capD1 >= 0.99).length} of ${summaries.length}`);
  lines.push(`- Cells where neither strategy hit the cap: ${summaries.filter((s) => s.capRandom < 0.5 && s.capD1 < 0.5).length} of ${summaries.length}`);
  if (allCap) lines.push('- ⚠️ All 54 cells fully cap-truncated. The 50-turn cap is binding everywhere; Phase 1.5 cap-extension is now essentially required to characterize natural game length.');
  lines.push('');

  return lines.join('\n');
}

// ─── A.5d full d3 sweep mode (Path C) ────────────────────────────────────────

interface CellTripleResult {
  readonly cell: StudyCell;
  readonly random: readonly GameResult[];
  readonly d1: readonly GameResult[];
  readonly d3: readonly GameResult[];
  readonly wallClockMs: number;
}

function runCellTriple(cell: StudyCell, n: number): CellTripleResult {
  const cfg = cellConfig(cell);
  const t0 = Date.now();
  const random: GameResult[] = [];
  const d1: GameResult[] = [];
  const d3: GameResult[] = [];
  for (let i = 0; i < n; i++) {
    const cfgI: GameConfig = { ...cfg, prngSeed: GRID_KERNEL_SEED_BASE + i };
    random.push(playOneGame(cfgI, 'random', GRID_STRATEGY_SEED_BASE + i, { maxTurns: MAX_TURNS }));
    d1.push(playOneGame(cfgI, 'search-d1', GRID_STRATEGY_SEED_BASE + i, { maxTurns: MAX_TURNS }));
    d3.push(playOneGame(cfgI, 'search-d3', GRID_STRATEGY_SEED_BASE + i, { maxTurns: MAX_TURNS }));
  }
  return { cell, random, d1, d3, wallClockMs: Date.now() - t0 };
}

interface CellTripleSummary {
  readonly cell: StudyCell;
  readonly d3RTier: PairedDiff;
  readonly d1RTier: PairedDiff;
  readonly d3D1Tier: PairedDiff;
  readonly d3RCpl: PairedDiff;
  readonly d3RAcl: PairedDiff;
  readonly capRandom: number;
  readonly capD1: number;
  readonly capD3: number;
  readonly wallClockMs: number;
}

function summarizeTriple(r: CellTripleResult): CellTripleSummary {
  const tierR = extract(r.random, (g) => tier(g.outputs.maxTile));
  const tierD1 = extract(r.d1, (g) => tier(g.outputs.maxTile));
  const tierD3 = extract(r.d3, (g) => tier(g.outputs.maxTile));
  const cplR = extract(r.random, (g) => g.outputs.chainsPerLevel);
  const cplD3 = extract(r.d3, (g) => g.outputs.chainsPerLevel);
  const aclR = extract(r.random, (g) => g.outputs.avgChainLength);
  const aclD3 = extract(r.d3, (g) => g.outputs.avgChainLength);
  return {
    cell: r.cell,
    d3RTier: pairedDiff(tierD3, tierR),
    d1RTier: pairedDiff(tierD1, tierR),
    d3D1Tier: pairedDiff(tierD3, tierD1),
    d3RCpl: pairedDiff(cplD3, cplR),
    d3RAcl: pairedDiff(aclD3, aclR),
    capRandom: r.random.filter((g) => g.outputs.endedByTurnCap).length / r.random.length,
    capD1: r.d1.filter((g) => g.outputs.endedByTurnCap).length / r.d1.length,
    capD3: r.d3.filter((g) => g.outputs.endedByTurnCap).length / r.d3.length,
    wallClockMs: r.wallClockMs,
  };
}

function modeD3Selective(): void {
  // First, append the A.5c triage decision.
  const triage: string[] = [];
  triage.push('\n---\n');
  triage.push('## A.5c — Triage decision\n');
  triage.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
  triage.push('');
  triage.push('**Path chosen: C (full 54-cell d3 grid).**');
  triage.push('');
  triage.push('Rationale: A.5a calibration measured mean d3 wall-clock at 187 ms/game (worst cell 489 ms). A full 54-cell × 50-game d3 grid projects to ~8 min at mean rate / ~22 min worst-case — both comfortably inside the 3 CPU-hr budget. Triage gating was designed to skip d3 in cells where d1≈random; given the actual cost, that economy is unnecessary.');
  triage.push('');
  triage.push('A.5b also surfaced wide spread variation across cells (0.14 to 2.70 tier on d1−random). Running d3 on the full grid lets us see whether the d1 ranking holds at d3, and where mastery headroom (d3−d1) actually appears.');
  triage.push('');
  appendFileSync(STUDY_PATH, triage.join('\n'));

  const cells = buildGrid();
  console.log(`A.5d full d3 sweep (Path C): ${cells.length} cells × ${GRID_GAMES} paired games × {random, d1, d3}, ${MAX_TURNS}-turn cap`);
  const summaries: CellTripleSummary[] = [];
  let grandMs = 0;
  let lastFlushMs = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const r = runCellTriple(cell, GRID_GAMES);
    grandMs += r.wallClockMs;
    summaries.push(summarizeTriple(r));
    if ((i + 1) % 5 === 0 || i === cells.length - 1 || (grandMs - lastFlushMs) > 60_000) {
      console.log(`  [${i + 1}/${cells.length}] ${cell.id}: ${(r.wallClockMs / 1000).toFixed(2)}s (grand ${(grandMs / 1000).toFixed(0)}s)`);
      lastFlushMs = grandMs;
    }
  }
  appendFileSync(STUDY_PATH, renderD3Report(summaries, grandMs));
  console.log(`Appended d3 report to ${STUDY_PATH}`);
  console.log(`Total wall-clock: ${(grandMs / 1000).toFixed(1)}s`);
}

function renderD3Report(summaries: readonly CellTripleSummary[], grandMs: number): string {
  const lines: string[] = [];
  lines.push('\n---\n');
  lines.push('## A.5d — Full d3 sweep (Path C)\n');
  lines.push(`**Generated:** ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`**Inputs:** 54 cells × ${GRID_GAMES} paired games × {random, d1, d3}, ${MAX_TURNS}-turn cap, kernel seed ${GRID_KERNEL_SEED_BASE}+i.`);
  lines.push(`**Wall-clock:** ${(grandMs / 1000 / 60).toFixed(1)} min (${(grandMs / 1000).toFixed(1)}s).\n`);

  const sorted = [...summaries].sort((a, b) => b.d3RTier.mean - a.d3RTier.mean);

  lines.push('### Per-cell paired tier spreads\n');
  lines.push('| cell | k | board | weights | pool | Δ tier d3−r | Δ tier d1−r | Δ tier d3−d1 (headroom) | %cap r→d1→d3 |');
  lines.push('|---|---:|---|---|---:|---:|---:|---:|---:|');
  for (const s of sorted) {
    lines.push(
      `| \`${s.cell.id}\` | ${s.cell.ruleK} | ${s.cell.gridRows}×${s.cell.gridCols} | ${s.cell.weightShape} | ${s.cell.poolCount} ` +
        `| ${s.d3RTier.mean.toFixed(2)} ± ${s.d3RTier.ci95.toFixed(2)} ` +
        `| ${s.d1RTier.mean.toFixed(2)} ± ${s.d1RTier.ci95.toFixed(2)} ` +
        `| ${s.d3D1Tier.mean.toFixed(2)} ± ${s.d3D1Tier.ci95.toFixed(2)} ` +
        `| ${(s.capRandom * 100).toFixed(0)}%→${(s.capD1 * 100).toFixed(0)}%→${(s.capD3 * 100).toFixed(0)}% |`,
    );
  }
  lines.push('');

  // Marginal: d3−random (total depth)
  const marginal = (
    label: string,
    groups: ReadonlyArray<{ label: string; cells: readonly CellTripleSummary[] }>,
    extractFn: (s: CellTripleSummary) => number,
  ): void => {
    lines.push(`#### ${label}\n`);
    lines.push(`| value | mean Δ | min cell Δ | max cell Δ | n cells |`);
    lines.push('|---|---:|---:|---:|---:|');
    for (const g of groups) {
      const xs = g.cells.map(extractFn);
      const minVal = xs.length > 0 ? Math.min(...xs) : 0;
      const maxVal = xs.length > 0 ? Math.max(...xs) : 0;
      lines.push(`| ${g.label} | ${mean(xs).toFixed(2)} | ${minVal.toFixed(2)} | ${maxVal.toFixed(2)} | ${xs.length} |`);
    }
    lines.push('');
  };

  lines.push('### Marginal effects on Δ tier (d3 − random)\n');
  marginal(
    'Marginal: ruleK',
    [
      { label: '1', cells: summaries.filter((s) => s.cell.ruleK === 1) },
      { label: '2', cells: summaries.filter((s) => s.cell.ruleK === 2) },
      { label: '3', cells: summaries.filter((s) => s.cell.ruleK === 3) },
    ],
    (s) => s.d3RTier.mean,
  );
  marginal(
    'Marginal: board',
    [
      { label: '6×5', cells: summaries.filter((s) => s.cell.gridRows === 6) },
      { label: '7×6', cells: summaries.filter((s) => s.cell.gridRows === 7) },
      { label: '9×8', cells: summaries.filter((s) => s.cell.gridRows === 9) },
    ],
    (s) => s.d3RTier.mean,
  );
  marginal(
    'Marginal: spawnWeights',
    [
      { label: 'flat', cells: summaries.filter((s) => s.cell.weightShape === 'flat') },
      { label: 'default', cells: summaries.filter((s) => s.cell.weightShape === 'default') },
      { label: 'steep', cells: summaries.filter((s) => s.cell.weightShape === 'steep') },
    ],
    (s) => s.d3RTier.mean,
  );
  marginal(
    'Marginal: poolCount',
    [
      { label: '8 (max=256)', cells: summaries.filter((s) => s.cell.poolCount === 8) },
      { label: '12 (max=4096)', cells: summaries.filter((s) => s.cell.poolCount === 12) },
    ],
    (s) => s.d3RTier.mean,
  );

  lines.push('### Marginal effects on Δ tier (d3 − d1: mastery headroom)\n');
  marginal(
    'Marginal: ruleK',
    [
      { label: '1', cells: summaries.filter((s) => s.cell.ruleK === 1) },
      { label: '2', cells: summaries.filter((s) => s.cell.ruleK === 2) },
      { label: '3', cells: summaries.filter((s) => s.cell.ruleK === 3) },
    ],
    (s) => s.d3D1Tier.mean,
  );
  marginal(
    'Marginal: board',
    [
      { label: '6×5', cells: summaries.filter((s) => s.cell.gridRows === 6) },
      { label: '7×6', cells: summaries.filter((s) => s.cell.gridRows === 7) },
      { label: '9×8', cells: summaries.filter((s) => s.cell.gridRows === 9) },
    ],
    (s) => s.d3D1Tier.mean,
  );
  marginal(
    'Marginal: spawnWeights',
    [
      { label: 'flat', cells: summaries.filter((s) => s.cell.weightShape === 'flat') },
      { label: 'default', cells: summaries.filter((s) => s.cell.weightShape === 'default') },
      { label: 'steep', cells: summaries.filter((s) => s.cell.weightShape === 'steep') },
    ],
    (s) => s.d3D1Tier.mean,
  );
  marginal(
    'Marginal: poolCount',
    [
      { label: '8 (max=256)', cells: summaries.filter((s) => s.cell.poolCount === 8) },
      { label: '12 (max=4096)', cells: summaries.filter((s) => s.cell.poolCount === 12) },
    ],
    (s) => s.d3D1Tier.mean,
  );

  // Top-5 / bottom-5 by d3-random
  lines.push('### Top-5 cells by Δ tier (d3 − random)\n');
  lines.push('| rank | cell | Δ d3−r | Δ d1−r | Δ d3−d1 |');
  lines.push('|---:|---|---:|---:|---:|');
  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const s = sorted[i]!;
    lines.push(`| ${i + 1} | \`${s.cell.id}\` | ${s.d3RTier.mean.toFixed(2)} ± ${s.d3RTier.ci95.toFixed(2)} | ${s.d1RTier.mean.toFixed(2)} ± ${s.d1RTier.ci95.toFixed(2)} | ${s.d3D1Tier.mean.toFixed(2)} ± ${s.d3D1Tier.ci95.toFixed(2)} |`);
  }
  lines.push('');
  lines.push('### Bottom-5 cells by Δ tier (d3 − random)\n');
  lines.push('| rank | cell | Δ d3−r | Δ d1−r | Δ d3−d1 |');
  lines.push('|---:|---|---:|---:|---:|');
  for (let i = 0; i < Math.min(5, sorted.length); i++) {
    const s = sorted[sorted.length - 1 - i]!;
    lines.push(`| ${i + 1} | \`${s.cell.id}\` | ${s.d3RTier.mean.toFixed(2)} ± ${s.d3RTier.ci95.toFixed(2)} | ${s.d1RTier.mean.toFixed(2)} ± ${s.d1RTier.ci95.toFixed(2)} | ${s.d3D1Tier.mean.toFixed(2)} ± ${s.d3D1Tier.ci95.toFixed(2)} |`);
  }
  lines.push('');

  // Mastery-headroom cells (d3 > d1)
  const headroomSorted = [...summaries].sort((a, b) => b.d3D1Tier.mean - a.d3D1Tier.mean);
  lines.push('### Top-10 cells by mastery headroom (d3 − d1)\n');
  lines.push('Largest gaps between d3 and d1 — cells where look-ahead beyond depth-1 actually helps.');
  lines.push('');
  lines.push('| rank | cell | Δ d3−d1 ± CI | Δ d3−r | %cap d1→d3 |');
  lines.push('|---:|---|---:|---:|---:|');
  for (let i = 0; i < Math.min(10, headroomSorted.length); i++) {
    const s = headroomSorted[i]!;
    lines.push(`| ${i + 1} | \`${s.cell.id}\` | ${s.d3D1Tier.mean.toFixed(2)} ± ${s.d3D1Tier.ci95.toFixed(2)} | ${s.d3RTier.mean.toFixed(2)} ± ${s.d3RTier.ci95.toFixed(2)} | ${(s.capD1 * 100).toFixed(0)}%→${(s.capD3 * 100).toFixed(0)}% |`);
  }
  lines.push('');

  // Headline summary
  const allD3RTier = summaries.map((s) => s.d3RTier.mean);
  const allD3D1Tier = summaries.map((s) => s.d3D1Tier.mean);
  const allCapBound = summaries.filter((s) => s.capRandom >= 0.99 && s.capD1 >= 0.99 && s.capD3 >= 0.99).length;
  lines.push('### Headline summary\n');
  lines.push(`- Mean Δ tier (d3 − random) across the 54-cell scoped world: **${mean(allD3RTier).toFixed(2)}** (range ${Math.min(...allD3RTier).toFixed(2)} to ${Math.max(...allD3RTier).toFixed(2)}).`);
  lines.push(`- Mean Δ tier (d3 − d1) across the scoped world: **${mean(allD3D1Tier).toFixed(2)}** (range ${Math.min(...allD3D1Tier).toFixed(2)} to ${Math.max(...allD3D1Tier).toFixed(2)}).`);
  lines.push(`- ${allCapBound}/${summaries.length} cells fully cap-truncated for all 3 strategies.`);
  lines.push('');

  return lines.join('\n');
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
