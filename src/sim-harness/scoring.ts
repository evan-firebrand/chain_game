import type {
  CandidateLabel,
  GameRunResult,
  SimulationResultRow,
  TargetScore,
  TuningTarget,
} from './types.js';

export const RECOMMENDED_TUNING_TARGET: TuningTarget = {
  capTurns: 300,
  naturalDeathRateMin: 0.2,
  naturalDeathRateMax: 0.3,
  medianFinalTurnMin: 240,
  medianFinalTurnMax: 300,
  firstRetirementTurnMin: 50,
  firstRetirementTurnMax: 100,
  gamesWithRetirementMinRate: 0.8,
  cascadeImmediateGameOverMaxRate: 0.05,
};

function rate(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

function outsideRange(value: number, min: number, max: number): number {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

function firstRetirementMedian(row: SimulationResultRow): number {
  const turns = row.outputs.retirement.triggers.map(trigger => trigger.turn).sort((a, b) => a - b);
  if (turns.length === 0) return 0;
  return turns[Math.floor((turns.length - 1) / 2)] ?? 0;
}

function gamesWithRetirement(row: SimulationResultRow): number {
  return row.games.filter(game =>
    game.turns.some(turn => turn.events.some(event => event.kind === 'retirement-fired'))
  ).length;
}

function naturalDeaths(row: SimulationResultRow): number {
  return row.outputs.deathCauseDistribution['no-legal-chain-start'];
}

function cascadeImmediateGameOvers(row: SimulationResultRow): number {
  return row.outputs.retirement.cascadesFollowedByImmediateGameOver;
}

function maxChainBucketRate(row: SimulationResultRow, bucket: keyof SimulationResultRow['outputs']['chainLengthBuckets']): number {
  const buckets = row.outputs.chainLengthBuckets;
  const total = buckets.short2To4 + buckets.medium5To9 + buckets.long10Plus;
  return rate(buckets[bucket], total);
}

export function scoreAgainstTarget(
  row: SimulationResultRow,
  target: TuningTarget = RECOMMENDED_TUNING_TARGET
): TargetScore {
  const runCount = row.games.length;
  const naturalDeathRate = rate(naturalDeaths(row), runCount);
  const medianFinalTurn = row.outputs.gameLength.median;
  const firstRetirement = firstRetirementMedian(row);
  const gamesWithRetirementRate = rate(gamesWithRetirement(row), runCount);
  const cascadeImmediateRate = rate(cascadeImmediateGameOvers(row), runCount);

  const deltas = {
    naturalDeathRate: outsideRange(naturalDeathRate, target.naturalDeathRateMin, target.naturalDeathRateMax),
    medianFinalTurn: outsideRange(medianFinalTurn, target.medianFinalTurnMin, target.medianFinalTurnMax) / target.capTurns,
    firstRetirementTurn: firstRetirement === 0
      ? 1
      : outsideRange(firstRetirement, target.firstRetirementTurnMin, target.firstRetirementTurnMax) / target.capTurns,
    gamesWithRetirementRate: gamesWithRetirementRate >= target.gamesWithRetirementMinRate
      ? 0
      : target.gamesWithRetirementMinRate - gamesWithRetirementRate,
    cascadeImmediateGameOverRate: cascadeImmediateRate <= target.cascadeImmediateGameOverMaxRate
      ? 0
      : cascadeImmediateRate - target.cascadeImmediateGameOverMaxRate,
  };

  const hardFailures = Object.entries(deltas)
    .filter(([, value]) => value > 0)
    .map(([key]) => key);

  return {
    distance: Object.values(deltas).reduce((sum, value) => sum + value, 0),
    deltas,
    hardFailures,
    labels: classifyCandidate(row, target),
  };
}

export function classifyCandidate(
  row: SimulationResultRow,
  target: TuningTarget = RECOMMENDED_TUNING_TARGET
): readonly CandidateLabel[] {
  const labels = new Set<CandidateLabel>();
  const runCount = row.games.length;
  const naturalDeathRate = rate(naturalDeaths(row), runCount);
  const forcedTurns = row.outputs.choiceRichness.forcedTurnBuckets.oneStart;
  const totalTurns = row.games.reduce((sum, game) => sum + game.turns.length, 0);
  const forcedRate = rate(forcedTurns, totalTurns);
  const longChainRate = maxChainBucketRate(row, 'long10Plus');
  const cascadeImmediateRate = rate(cascadeImmediateGameOvers(row), runCount);
  const retirementDeltas = row.outputs.retirement.legalChainStartDeltaAfterRetirement;
  const medianLegalStarts = row.outputs.choiceRichness.legalChainStartsBefore.median;

  if (naturalDeathRate < target.naturalDeathRateMin && medianLegalStarts >= 4) {
    labels.add('too-forgiving');
  }
  if (naturalDeathRate > target.naturalDeathRateMax && forcedRate < 0.15) {
    labels.add('too-random');
  }
  if (forcedRate >= 0.35) {
    labels.add('too-forced');
  }
  if (longChainRate >= 0.35 && naturalDeathRate < target.naturalDeathRateMin) {
    labels.add('long-chain-dominant');
  }
  if (cascadeImmediateRate > target.cascadeImmediateGameOverMaxRate) {
    labels.add('retirement-cliff');
  }
  if (labels.size === 0 && retirementDeltas.some(delta => delta < 0)) {
    labels.add('promising');
  }
  if (labels.size === 0) {
    labels.add('too-forgiving');
  }

  return [...labels];
}

export function findNotableSeedBy(
  games: readonly GameRunResult[],
  score: (game: GameRunResult) => number
): number | undefined {
  return [...games].sort((a, b) => score(b) - score(a))[0]?.seed;
}
