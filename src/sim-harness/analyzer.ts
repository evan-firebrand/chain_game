import type {
  ChainLengthBucketMetrics,
  ChoiceRichnessMetrics,
  GameRunResult,
  RetirementMetrics,
  RetirementTriggerSummary,
  SimulationOutputs,
  StrategyBehaviorMetrics,
} from './types.js';

function increment(distribution: Record<number, number>, key: number): void {
  distribution[key] = (distribution[key] ?? 0) + 1;
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index] ?? 0;
}

function analyzeRetirement(games: readonly GameRunResult[]): RetirementMetrics {
  const retirementTurns: number[] = [];
  const retirementEventsPerGame: number[] = [];
  const cascadeRetirementsPerTransition: number[] = [];
  const activeSpawnPoolAtDeath: GameRunResult['activeSpawnPoolAtDeath'][] = [];
  const retiredTileCountOverTime: number[] = [];
  const isolatedRetiredTileCountOverTime: number[] = [];
  const triggers: RetirementTriggerSummary[] = [];
  const legalChainStartDeltaAfterRetirement: number[] = [];
  const turnsSurvivedAfterFirstRetirement: number[] = [];
  const turnsSurvivedAfterSecondRetirement: number[] = [];
  let cascadesFollowedByImmediateGameOver = 0;

  for (const game of games) {
    let eventsThisGame = 0;
    const retirementEventTurns: number[] = [];
    activeSpawnPoolAtDeath.push(game.activeSpawnPoolAtDeath);

    for (const turn of game.turns) {
      retiredTileCountOverTime.push(turn.retiredTileCountAfter);
      isolatedRetiredTileCountOverTime.push(turn.isolatedRetiredTileCountAfter);

      const retirementEvents = turn.events.filter(event => event.kind === 'retirement-fired');
      if (retirementEvents.length === 0) continue;

      const followedByGameOver = turn.events.some(event => event.kind === 'game-over');
      eventsThisGame += retirementEvents.length;
      retirementTurns.push(turn.turn);
      legalChainStartDeltaAfterRetirement.push(turn.legalChainStartsAfter - turn.legalChainStartsBefore);
      cascadeRetirementsPerTransition.push(retirementEvents.length);
      if (retirementEvents.length > 1 && followedByGameOver) {
        cascadesFollowedByImmediateGameOver++;
      }

      for (const event of retirementEvents) {
        retirementEventTurns.push(turn.turn);
        triggers.push({
          turn: turn.turn,
          retiredTier: event.retiredTier,
          newSpawnPoolMin: event.newSpawnPoolMin,
          newSpawnPoolMax: event.newSpawnPoolMax,
          cascadeCountThisTurn: retirementEvents.length,
          followedByImmediateGameOver: followedByGameOver,
          chainLength: turn.chainLength,
          resultValue: turn.resultValue,
          legalChainStartsBefore: turn.legalChainStartsBefore,
          legalChainStartsAfter: turn.legalChainStartsAfter,
          retiredTileCountBefore: turn.retiredTileCountBefore,
          retiredTileCountAfter: turn.retiredTileCountAfter,
          isolatedRetiredTileCountBefore: turn.isolatedRetiredTileCountBefore,
          isolatedRetiredTileCountAfter: turn.isolatedRetiredTileCountAfter,
        });
      }
    }

    retirementEventsPerGame.push(eventsThisGame);
    const firstRetirementTurn = retirementEventTurns[0];
    if (firstRetirementTurn !== undefined) {
      turnsSurvivedAfterFirstRetirement.push(game.finalTurn - firstRetirementTurn);
    }
    const secondRetirementTurn = retirementEventTurns[1];
    if (secondRetirementTurn !== undefined) {
      turnsSurvivedAfterSecondRetirement.push(game.finalTurn - secondRetirementTurn);
    }
  }

  return {
    firstRetirementTurn: retirementTurns.length === 0 ? null : Math.min(...retirementTurns),
    retirementTurns,
    retirementEventsPerGame,
    cascadeRetirementsPerTransition,
    cascadesFollowedByImmediateGameOver,
    activeSpawnPoolAtDeath,
    retiredTileCountOverTime,
    isolatedRetiredTileCountOverTime,
    legalChainStartDeltaAfterRetirement,
    turnsSurvivedAfterFirstRetirement,
    turnsSurvivedAfterSecondRetirement,
    triggers,
  };
}

function bucketChainLength(length: number, buckets: Record<keyof ChainLengthBucketMetrics, number>): void {
  if (length <= 4) {
    buckets.short2To4++;
  } else if (length <= 9) {
    buckets.medium5To9++;
  } else {
    buckets.long10Plus++;
  }
}

function analyzeChoiceRichness(games: readonly GameRunResult[]): ChoiceRichnessMetrics {
  const startsBefore: number[] = [];
  const startsAfter: number[] = [];
  const forcedTurnBuckets = {
    oneStart: 0,
    twoToThreeStarts: 0,
    fourPlusStarts: 0,
  };

  for (const game of games) {
    for (const turn of game.turns) {
      startsBefore.push(turn.legalChainStartsBefore);
      startsAfter.push(turn.legalChainStartsAfter);
      if (turn.legalChainStartsBefore <= 1) {
        forcedTurnBuckets.oneStart++;
      } else if (turn.legalChainStartsBefore <= 3) {
        forcedTurnBuckets.twoToThreeStarts++;
      } else {
        forcedTurnBuckets.fourPlusStarts++;
      }
    }
  }

  return {
    legalChainStartsBefore: {
      p10: percentile(startsBefore, 0.1),
      median: percentile(startsBefore, 0.5),
      p90: percentile(startsBefore, 0.9),
    },
    legalChainStartsAfter: {
      p10: percentile(startsAfter, 0.1),
      median: percentile(startsAfter, 0.5),
      p90: percentile(startsAfter, 0.9),
    },
    forcedTurnBuckets,
  };
}

function analyzeStrategyBehavior(games: readonly GameRunResult[]): StrategyBehaviorMetrics {
  const modeDistribution: Record<string, number> = {};
  const intentDistribution: Record<string, number> = {};

  for (const game of games) {
    for (const turn of game.turns) {
      const diagnostics = turn.strategyDiagnostics;
      if (diagnostics === undefined) continue;
      modeDistribution[diagnostics.mode] = (modeDistribution[diagnostics.mode] ?? 0) + 1;
      intentDistribution[diagnostics.intent] = (intentDistribution[diagnostics.intent] ?? 0) + 1;
    }
  }

  return { modeDistribution, intentDistribution };
}

export function analyzeGames(games: readonly GameRunResult[]): SimulationOutputs {
  const maxTileDistribution: Record<number, number> = {};
  const chainLengthDistribution: Record<number, number> = {};
  const chainLengthBuckets = {
    short2To4: 0,
    medium5To9: 0,
    long10Plus: 0,
  };
  const resultValueDistribution: Record<number, number> = {};
  const deathCauseDistribution: Record<GameRunResult['deathCause'], number> = {
    'no-legal-chain-start': 0,
    'strategy-null': 0,
    'max-turns': 0,
  };

  for (const game of games) {
    increment(maxTileDistribution, game.maxTileReached);
    deathCauseDistribution[game.deathCause]++;

    for (const turn of game.turns) {
      increment(chainLengthDistribution, turn.chainLength);
      bucketChainLength(turn.chainLength, chainLengthBuckets);
      increment(resultValueDistribution, turn.resultValue);
    }
  }

  const lengths = games.map(game => game.finalTurn);
  return {
    gameLength: {
      p10: percentile(lengths, 0.1),
      median: percentile(lengths, 0.5),
      p90: percentile(lengths, 0.9),
    },
    maxTileDistribution,
    chainLengthDistribution,
    chainLengthBuckets,
    resultValueDistribution,
    deathCauseDistribution,
    choiceRichness: analyzeChoiceRichness(games),
    strategyBehavior: analyzeStrategyBehavior(games),
    retirement: analyzeRetirement(games),
  };
}
