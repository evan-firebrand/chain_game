/**
 * Fit weightedHeuristic weights to recorded human playlogs.
 *
 *   npx tsx scripts/fit-weights.ts [--playlogs <dir>] [--out <file>] [--top-k <k>]
 *
 * Loads all *.jsonl files in <dir> (default: playlogs/), reads PlaylogRecords,
 * and finds the 5 HeuristicWeights that maximise top-K accuracy: how often the
 * weighted scorer ranks the human's actual chain in the top K candidates on
 * that turn.
 *
 * Optimisation: coordinate descent over each weight independently, repeated
 * until convergence. Grid-search range [-10, 10] with step 0.5 per weight.
 * Simple and interpretable — no ML needed for 5 parameters.
 *
 * Writes the fitted weights to <out> (default: dist/fitted-weights.json).
 * Also prints per-feature diagnostics showing which weights moved the most.
 *
 * Usage after collecting playlogs:
 *   npx tsx scripts/fit-weights.ts
 *   # then update weighted-heuristic.ts DEFAULT_UNIT_WEIGHTS with the result
 *   # or pass the JSON directly to makeWeightedHeuristic()
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

import {
  DEFAULT_CONFIG,
  applyAction,
  computeChainResult,
  getAdjacentCells,
  validateChainExtension,
} from '../src/game-kernel/index.js';
import type {
  Board,
  Cell,
  Col,
  GameConfig,
  GameEvent,
  GameState,
  Row,
  TileValue,
} from '../src/game-kernel/index.js';

import type { HeuristicWeights } from '../src/sim-harness/strategies/weighted-heuristic.js';
import {
  countIsolatedRetiredTiles,
  countLegalChainStarts,
  countRetiredTiles,
  maxTileOnBoard,
} from '../src/sim-harness/strategies/common.js';

// ── CLI ───────────────────────────────────────────────────────────────────

interface CliArgs {
  readonly plogsDir: string;
  readonly out: string;
  readonly topK: number;
  readonly verbose: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    return i >= 0 ? (argv[i + 1] ?? fallback) : fallback;
  };
  return {
    plogsDir: get('--playlogs', 'playlogs'),
    out: get('--out', 'dist/fitted-weights.json'),
    topK: Number(get('--top-k', '3')),
    verbose: argv.includes('--verbose'),
  };
}

// ── Playlog loading ───────────────────────────────────────────────────────

interface PlaylogRecord {
  readonly turn: number;
  readonly boardBefore: Board;
  readonly chainPlayed: readonly Cell[];
  readonly resultValue: TileValue;
  readonly boardAfter: Board;
  readonly kernelEvents: readonly GameEvent[];
  readonly spawnPoolMinBefore: TileValue;
  readonly spawnPoolMaxBefore: TileValue;
  readonly maxTileEverBefore: TileValue;
}

function loadRecords(dir: string): PlaylogRecord[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.jsonl'));
  } catch {
    console.error(`Directory not found: ${dir}`);
    console.error('Drop your *.jsonl playlog files there and re-run.');
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`No *.jsonl files found in ${dir}`);
    console.error('Play some games, click "Download playlog" in the HUD, and save the files there.');
    process.exit(1);
  }

  const records: PlaylogRecord[] = [];
  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf-8').trim().split('\n');
    for (const line of lines) {
      if (line.trim() === '') continue;
      records.push(JSON.parse(line) as PlaylogRecord);
    }
    console.log(`  ${file}: ${lines.filter(l => l.trim()).length} turns`);
  }
  return records;
}

// ── Feature extraction ────────────────────────────────────────────────────

interface FeatureVector {
  readonly isolatedRetiredAfter: number;
  readonly legalChainStartsAfter: number;
  readonly maxTileVsSpawnPool: number;
  readonly retiredClearedByThisChain: number;
  readonly triggersNextRetirement: number;
}

function log2Safe(v: number): number {
  return v <= 0 ? 0 : Math.log2(v);
}

function extractFeatures(
  boardBefore: Board,
  chain: readonly Cell[],
  spawnPoolMax: TileValue,
  config: GameConfig
): FeatureVector {
  // Reconstruct a minimal GameState for applyAction.
  // We only need board + config + events for feature extraction.
  const stateBefore: GameState = {
    board: boardBefore,
    config,
    events: [],
    turn: 0,
    spawnPoolMin: 2 as TileValue,
    spawnPoolMax,
    maxTileEver: 0 as TileValue,
    isGameOver: false,
  };

  const prevRetiredCount = countRetiredTiles(boardBefore);
  const stateAfter = applyAction(stateBefore, { kind: 'commit-chain', chain });

  const isolatedRetiredAfter = countIsolatedRetiredTiles(stateAfter.board);
  const legalChainStartsAfter = countLegalChainStarts(stateAfter.board);
  const maxTile = maxTileOnBoard(stateAfter.board);
  const maxTileVsSpawnPool = maxTile === 0 ? 0 : log2Safe(maxTile) - log2Safe(stateAfter.spawnPoolMax);
  const retiredClearedByThisChain = prevRetiredCount - countRetiredTiles(stateAfter.board);
  const triggersNextRetirement = stateAfter.events.some(e => e.kind === 'retirement-fired') ? 1 : 0;

  return {
    isolatedRetiredAfter,
    legalChainStartsAfter,
    maxTileVsSpawnPool,
    retiredClearedByThisChain,
    triggersNextRetirement,
  };
}

function score(features: FeatureVector, weights: HeuristicWeights): number {
  return (
    features.isolatedRetiredAfter * weights.isolatedRetiredAfter +
    features.legalChainStartsAfter * weights.legalChainStartsAfter +
    features.maxTileVsSpawnPool * weights.maxTileVsSpawnPool +
    features.retiredClearedByThisChain * weights.retiredClearedByThisChain +
    features.triggersNextRetirement * weights.triggersNextRetirement
  );
}

// ── Candidate enumeration (streaming DFS) ────────────────────────────────
//
// Visits every legal chain up to maxLen tiles, calling onCandidate for each.
// Uses a mutable path + boolean-array visited set — O(maxLen) memory per
// recursive frame. Never accumulates chains, so late-game boards with many
// matching tiles don't OOM.

function cellKey(c: Cell): string {
  return `${c.row},${c.col}`;
}

function streamCandidates(
  board: Board,
  maxLen: number,
  maxCandidates: number,
  onCandidate: (chain: readonly Cell[]) => void,
): void {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const total = rows * cols;
  const path: Cell[] = [];
  const used = new Uint8Array(total);
  let count = 0;

  function idx(r: number, c: number): number { return r * cols + c; }

  function dfs(): void {
    if (count >= maxCandidates) return;
    if (path.length >= 2) { onCandidate(path); count++; }
    if (path.length >= maxLen) return;
    const last = path[path.length - 1]!;
    const lastTile = board[last.row]?.[last.col];
    if (!lastTile) return;
    for (const nb of getAdjacentCells(last, rows, cols)) {
      if (count >= maxCandidates) return;
      if (used[idx(nb.row, nb.col)]) continue;
      const nbTile = board[nb.row]?.[nb.col];
      if (!nbTile || nbTile.value === 0) continue;
      if (!validateChainExtension(lastTile, nbTile).valid) continue;
      path.push(nb);
      used[idx(nb.row, nb.col)] = 1;
      dfs();
      path.pop();
      used[idx(nb.row, nb.col)] = 0;
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (count >= maxCandidates) return;
      const tile = board[r]?.[c];
      if (!tile || tile.value === 0) continue;
      const start: Cell = { row: r as Row, col: c as Col };
      for (const nb of getAdjacentCells(start, rows, cols)) {
        if (count >= maxCandidates) break;
        const nbTile = board[nb.row]?.[nb.col];
        if (!nbTile || nbTile.value === 0) continue;
        if (!validateChainExtension(tile, nbTile).valid) continue;
        path.push(start, nb);
        used[idx(start.row, start.col)] = 1;
        used[idx(nb.row, nb.col)] = 1;
        dfs();
        path.pop(); path.pop();
        used[idx(start.row, start.col)] = 0;
        used[idx(nb.row, nb.col)] = 0;
      }
    }
  }
}

// ── Turn sample preparation ───────────────────────────────────────────────

// Store only feature vectors per candidate — never the Cell[] chains —
// so memory is O(candidates × 5 floats) not O(candidates × chain-length).
interface TurnSample {
  readonly humanFeatures: FeatureVector;
  readonly allFeatures: readonly FeatureVector[]; // includes humanFeatures
  readonly humanIdx: number;
}

// DFS depth cap. Real play averages 10–20 tiles; 14 covers the bulk without
// the combinatorial explosion that OOMs on early-game boards full of same-value tiles.
const ENUM_DEPTH = 14;
// Per-turn candidate cap. Prevents early-game turns (many identical tiles, huge search
// tree) from dominating memory. Human's chain is always added directly if not found.
const MAX_CANDIDATES_PER_TURN = 8_000;

function prepareSamples(records: PlaylogRecord[], config: GameConfig, verbose: boolean): TurnSample[] {
  const samples: TurnSample[] = [];
  let skipped = 0;

  for (const rec of records) {
    const humanKey = rec.chainPlayed.map(cellKey).join('|');
    const allFeatures: FeatureVector[] = [];
    let humanIdx = -1;

    streamCandidates(rec.boardBefore, ENUM_DEPTH, MAX_CANDIDATES_PER_TURN, chain => {
      const key = chain.map(cellKey).join('|');
      try {
        const features = extractFeatures(rec.boardBefore, chain, rec.spawnPoolMaxBefore, config);
        if (key === humanKey) humanIdx = allFeatures.length;
        allFeatures.push(features);
      } catch {
        // applyAction may reject a chain from an older playlog format — skip.
      }
    });

    // If depth cap missed the human's chain, add it directly.
    if (humanIdx === -1) {
      try {
        const features = extractFeatures(rec.boardBefore, rec.chainPlayed, rec.spawnPoolMaxBefore, config);
        humanIdx = allFeatures.length;
        allFeatures.push(features);
      } catch {
        skipped++;
        if (verbose) console.warn(`  turn ${rec.turn}: human chain not reconstructible, skipping`);
        continue;
      }
    }

    if (allFeatures.length < 2) { skipped++; continue; }

    const humanFeatures = allFeatures[humanIdx]!;
    samples.push({ humanFeatures, allFeatures, humanIdx });
  }

  if (skipped > 0) console.log(`  Skipped ${skipped} turns (chain not reconstructible or trivial)`);
  return samples;
}

// ── Objective: top-K accuracy ─────────────────────────────────────────────

function topKAccuracy(samples: readonly TurnSample[], weights: HeuristicWeights, k: number): number {
  let hits = 0;
  for (const { humanFeatures, allFeatures } of samples) {
    const humanScore = score(humanFeatures, weights);
    // Pessimistic rank: count candidates scoring >= human (human is in top-k only if this <= k).
    // This prevents the degenerate all-zero-weights solution where every candidate ties and
    // betterCount=0 < k trivially passes. With pessimistic rank, ties count against the human.
    let betterOrEqual = 0;
    for (const feat of allFeatures) {
      if (score(feat, weights) >= humanScore) betterOrEqual++;
    }
    if (betterOrEqual <= k) hits++;
  }
  return hits / samples.length;
}

// ── Coordinate descent ────────────────────────────────────────────────────

type WeightKey = keyof HeuristicWeights;
const WEIGHT_KEYS: WeightKey[] = [
  'isolatedRetiredAfter',
  'legalChainStartsAfter',
  'maxTileVsSpawnPool',
  'retiredClearedByThisChain',
  'triggersNextRetirement',
];

const GRID_VALUES = Array.from({ length: 41 }, (_, i) => -10 + i * 0.5); // -10 to +10 step 0.5

function coordinateDescent(
  samples: readonly TurnSample[],
  topK: number,
  verbose: boolean
): { weights: HeuristicWeights; accuracy: number } {
  let weights: HeuristicWeights = {
    isolatedRetiredAfter: -1,
    legalChainStartsAfter: 1,
    maxTileVsSpawnPool: -1,
    retiredClearedByThisChain: 1,
    triggersNextRetirement: -1,
  };

  let bestAccuracy = topKAccuracy(samples, weights, topK);
  let improved = true;
  let round = 0;

  while (improved) {
    improved = false;
    round++;
    if (verbose) console.log(`\nRound ${round} — current accuracy: ${(bestAccuracy * 100).toFixed(1)}%`);

    for (const key of WEIGHT_KEYS) {
      let bestVal = weights[key];
      let bestForKey = bestAccuracy;

      for (const v of GRID_VALUES) {
        const candidate: HeuristicWeights = { ...weights, [key]: v };
        const acc = topKAccuracy(samples, candidate, topK);
        if (acc > bestForKey) {
          bestForKey = acc;
          bestVal = v;
        }
      }

      if (bestVal !== weights[key]) {
        if (verbose) console.log(`  ${key}: ${weights[key]} → ${bestVal} (+${((bestForKey - bestAccuracy) * 100).toFixed(1)}%)`);
        weights = { ...weights, [key]: bestVal };
        bestAccuracy = bestForKey;
        improved = true;
      }
    }
  }

  return { weights, accuracy: bestAccuracy };
}

// ── Main ──────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  console.log(`\nfit-weights — loading playlogs from ${args.plogsDir}/`);
  const records = loadRecords(args.plogsDir);
  console.log(`  ${records.length} total turns loaded`);

  const config = DEFAULT_CONFIG;

  console.log('\nPreparing turn samples (enumerating candidate chains)...');
  const samples = prepareSamples(records, config, args.verbose);
  console.log(`  ${samples.length} usable turns`);

  if (samples.length < 10) {
    console.warn('\nWarning: fewer than 10 usable turns. Fitted weights will not generalise well.');
    console.warn('Play more games and collect more playlogs before acting on these results.');
  }

  console.log(`\nRunning coordinate descent (top-${args.topK} accuracy)...`);
  const { weights, accuracy } = coordinateDescent(samples, args.topK, args.verbose);

  console.log('\n── Fitted weights ────────────────────────────────────────');
  for (const key of WEIGHT_KEYS) {
    console.log(`  ${key}: ${weights[key]}`);
  }
  console.log(`\nTop-${args.topK} accuracy: ${(accuracy * 100).toFixed(1)}% (${Math.round(accuracy * samples.length)}/${samples.length} turns)`);
  console.log(`Baseline (unit weights, top-${args.topK}): ${(topKAccuracy(samples, { isolatedRetiredAfter: -1, legalChainStartsAfter: 1, maxTileVsSpawnPool: -1, retiredClearedByThisChain: 1, triggersNextRetirement: -1 }, args.topK) * 100).toFixed(1)}%`);

  const out = { weights, accuracy, turnsUsed: samples.length, topK: args.topK, fittedAt: new Date().toISOString() };
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${args.out}`);
  console.log('\nNext: pass the fitted weights to makeWeightedHeuristic() and re-run the death-mechanism study.');
}

main();
