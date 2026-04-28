import type {
  GameRunResult,
  RetirementMetrics,
  RetirementTriggerSummary,
  SimulationOutputs,
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
  let cascadesFollowedByImmediateGameOver = 0;

  for (const game of games) {
    let eventsThisGame = 0;
    activeSpawnPoolAtDeath.push(game.activeSpawnPoolAtDeath);

    for (const turn of game.turns) {
      retiredTileCountOverTime.push(turn.retiredTileCountAfter);
      isolatedRetiredTileCountOverTime.push(turn.isolatedRetiredTileCountAfter);

      const retirementEvents = turn.events.filter(event => event.kind === 'retirement-fired');
      if (retirementEvents.length === 0) continue;

      const followedByGameOver = turn.events.some(event => event.kind === 'game-over');
      eventsThisGame += retirementEvents.length;
      retirementTurns.push(turn.turn);
      cascadeRetirementsPerTransition.push(retirementEvents.length);
      if (retirementEvents.length > 1 && followedByGameOver) {
        cascadesFollowedByImmediateGameOver++;
      }

      for (const event of retirementEvents) {
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
    triggers,
  };
}

export function analyzeGames(games: readonly GameRunResult[]): SimulationOutputs {
  const maxTileDistribution: Record<number, number> = {};
  const chainLengthDistribution: Record<number, number> = {};
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
    resultValueDistribution,
    deathCauseDistribution,
    retirement: analyzeRetirement(games),
  };
}
