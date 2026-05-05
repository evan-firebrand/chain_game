import type {
  BatchResultRow,
  ExperimentProfile,
  GameRunResult,
  NotableSeeds,
  SimStrategy,
  TuningTarget,
} from './types.js';
import { runSimulation } from './runner.js';
import { RECOMMENDED_TUNING_TARGET, findNotableSeedBy, scoreAgainstTarget } from './scoring.js';

export interface BatchRunOptions {
  readonly profiles: readonly ExperimentProfile[];
  readonly strategies: readonly SimStrategy[];
  readonly runs: number;
  readonly seed: number;
  readonly maxTurns: number;
  readonly maxChainLength?: number;
  readonly target?: TuningTarget;
}

function largestCascade(game: GameRunResult): number {
  return Math.max(
    0,
    ...game.turns.map(turn => turn.events.filter(event => event.kind === 'retirement-fired').length)
  );
}

function largestOvershoot(game: GameRunResult): number {
  return Math.max(
    0,
    ...game.turns.map(turn => {
      const retirementCount = turn.events.filter(event => event.kind === 'retirement-fired').length;
      return retirementCount > 1 ? retirementCount - 1 : 0;
    })
  );
}

function mostIsolatedRetiredTiles(game: GameRunResult): number {
  return Math.max(0, ...game.turns.map(turn => turn.isolatedRetiredTileCountAfter));
}

function strongestRecovery(game: GameRunResult): number {
  return Math.max(
    0,
    ...game.turns.map(turn => turn.legalChainStartsAfter - turn.legalChainStartsBefore)
  );
}

export function collectNotableSeeds(games: readonly GameRunResult[]): NotableSeeds {
  const shortestNaturalDeath = [...games]
    .filter(game => game.deathCause === 'no-legal-chain-start')
    .sort((a, b) => a.finalTurn - b.finalTurn)[0]?.seed;
  const longestCappedSurvival = [...games]
    .filter(game => game.deathCause === 'max-turns')
    .sort((a, b) => b.finalTurn - a.finalTurn)[0]?.seed;
  const seeds: Partial<Record<keyof NotableSeeds, number>> = {};
  if (shortestNaturalDeath !== undefined) seeds.shortestNaturalDeath = shortestNaturalDeath;
  if (longestCappedSurvival !== undefined) seeds.longestCappedSurvival = longestCappedSurvival;

  const largestCascadeSeed = findNotableSeedBy(games, largestCascade);
  const largestOvershootSeed = findNotableSeedBy(games, largestOvershoot);
  const mostIsolatedRetiredTilesSeed = findNotableSeedBy(games, mostIsolatedRetiredTiles);
  const strongestRecoverySeed = findNotableSeedBy(games, strongestRecovery);
  if (largestCascadeSeed !== undefined) seeds.largestCascade = largestCascadeSeed;
  if (largestOvershootSeed !== undefined) seeds.largestOvershoot = largestOvershootSeed;
  if (mostIsolatedRetiredTilesSeed !== undefined) seeds.mostIsolatedRetiredTiles = mostIsolatedRetiredTilesSeed;
  if (strongestRecoverySeed !== undefined) seeds.strongestRecovery = strongestRecoverySeed;
  return seeds;
}

export function runExperimentBatch(options: BatchRunOptions): BatchResultRow[] {
  const target = options.target ?? RECOMMENDED_TUNING_TARGET;
  const rows: BatchResultRow[] = [];

  for (const profile of options.profiles) {
    for (const strategy of options.strategies) {
      const result = runSimulation({
        config: profile.config,
        strategy,
        runs: options.runs,
        seed: options.seed,
        maxTurns: options.maxTurns,
        ...(options.maxChainLength === undefined ? {} : { maxChainLength: options.maxChainLength }),
      });
      rows.push({
        profile,
        result,
        score: scoreAgainstTarget(result, target),
        notableSeeds: collectNotableSeeds(result.games),
      });
    }
  }

  return rows.sort((a, b) => a.score.distance - b.score.distance);
}

export function formatBatchTable(rows: readonly BatchResultRow[]): string {
  const lines = [
    'profile\tstrategy\truns\tdeathRate\tmedianTurn\tfirstRetirement\tscore\tlabels',
  ];

  for (const row of rows) {
    const naturalDeaths = row.result.outputs.deathCauseDistribution['no-legal-chain-start'];
    const deathRate = row.result.games.length === 0 ? 0 : naturalDeaths / row.result.games.length;
    const firstRetirement = row.result.outputs.retirement.firstRetirementTurn ?? 0;
    lines.push([
      row.profile.id,
      row.result.inputs.strategyId,
      String(row.result.inputs.runCount),
      deathRate.toFixed(2),
      String(row.result.outputs.gameLength.median),
      String(firstRetirement),
      row.score.distance.toFixed(3),
      row.score.labels.join(','),
    ].join('\t'));
  }

  return lines.join('\n');
}
