import { describe, expect, it } from 'vitest';
import type { GameRunResult } from '../../src/sim-harness/index.js';
import { analyzeGames } from '../../src/sim-harness/index.js';

const BASE_GAME: Omit<GameRunResult, 'runIndex' | 'seed' | 'finalTurn' | 'deathCause' | 'maxTileReached' | 'turns'> = {
  strategyId: 'greedy',
  finalPhase: 'game-over',
  activeSpawnPoolAtDeath: [4, 512],
  events: [],
};

describe('analyzeGames', () => {
  it('computes aggregate distributions and percentiles', () => {
    const games: GameRunResult[] = [
      {
        ...BASE_GAME,
        runIndex: 0,
        seed: 1,
        finalTurn: 10,
        deathCause: 'no-legal-chain-start',
        maxTileReached: 512,
        turns: [
          {
            turn: 1,
            chain: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
            chainLength: 2,
            resultValue: 4,
            legalChainStartsBefore: 8,
            legalChainStartsAfter: 7,
            spawnPoolBefore: [2, 256],
            spawnPoolAfter: [2, 256],
            retiredTileCountBefore: 0,
            retiredTileCountAfter: 0,
            isolatedRetiredTileCountBefore: 0,
            isolatedRetiredTileCountAfter: 0,
            events: [],
          },
        ],
      },
      {
        ...BASE_GAME,
        runIndex: 1,
        seed: 2,
        finalTurn: 20,
        deathCause: 'max-turns',
        maxTileReached: 1024,
        turns: [],
      },
    ];

    const output = analyzeGames(games);
    expect(output.gameLength.median).toBe(10);
    expect(output.gameLength.p90).toBe(10);
    expect(output.maxTileDistribution[512]).toBe(1);
    expect(output.maxTileDistribution[1024]).toBe(1);
    expect(output.chainLengthDistribution[2]).toBe(1);
    expect(output.chainLengthBuckets.short2To4).toBe(1);
    expect(output.resultValueDistribution[4]).toBe(1);
    expect(output.deathCauseDistribution['no-legal-chain-start']).toBe(1);
    expect(output.deathCauseDistribution['max-turns']).toBe(1);
    expect(output.choiceRichness.legalChainStartsBefore.median).toBe(8);
    expect(output.choiceRichness.forcedTurnBuckets.fourPlusStarts).toBe(1);
  });

  it('extracts retirement trigger metrics including cascade game-over cases', () => {
    const games: GameRunResult[] = [
      {
        ...BASE_GAME,
        runIndex: 0,
        seed: 1,
        finalTurn: 1,
        deathCause: 'no-legal-chain-start',
        maxTileReached: 2048,
        turns: [
          {
            turn: 1,
            chain: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }],
            chainLength: 3,
            resultValue: 2048,
            legalChainStartsBefore: 5,
            legalChainStartsAfter: 0,
            spawnPoolBefore: [2, 256],
            spawnPoolAfter: [16, 2048],
            retiredTileCountBefore: 0,
            retiredTileCountAfter: 3,
            isolatedRetiredTileCountBefore: 0,
            isolatedRetiredTileCountAfter: 2,
            events: [
              {
                kind: 'retirement-fired',
                retiredTier: 2,
                newSpawnPoolMin: 4,
                newSpawnPoolMax: 512,
              },
              {
                kind: 'retirement-fired',
                retiredTier: 4,
                newSpawnPoolMin: 8,
                newSpawnPoolMax: 1024,
              },
              {
                kind: 'game-over',
                cause: 'no-legal-chain-start',
                finalMaxTile: 2048,
                totalTurns: 1,
              },
            ],
          },
        ],
      },
    ];

    const retirement = analyzeGames(games).retirement;
    expect(retirement.firstRetirementTurn).toBe(1);
    expect(retirement.retirementEventsPerGame).toEqual([2]);
    expect(retirement.cascadeRetirementsPerTransition).toEqual([2]);
    expect(retirement.cascadesFollowedByImmediateGameOver).toBe(1);
    expect(retirement.triggers).toHaveLength(2);
    expect(retirement.triggers[0]?.chainLength).toBe(3);
    expect(retirement.triggers[0]?.resultValue).toBe(2048);
    expect(retirement.legalChainStartDeltaAfterRetirement).toEqual([-5]);
    expect(retirement.turnsSurvivedAfterFirstRetirement).toEqual([0]);
  });

  it('aggregates strategy mode and intent diagnostics', () => {
    const output = analyzeGames([
      {
        ...BASE_GAME,
        runIndex: 0,
        seed: 1,
        finalTurn: 1,
        deathCause: 'max-turns',
        maxTileReached: 4,
        turns: [
          {
            turn: 1,
            chain: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
            chainLength: 2,
            resultValue: 4,
            legalChainStartsBefore: 1,
            legalChainStartsAfter: 2,
            spawnPoolBefore: [2, 256],
            spawnPoolAfter: [2, 256],
            retiredTileCountBefore: 0,
            retiredTileCountAfter: 0,
            isolatedRetiredTileCountBefore: 0,
            isolatedRetiredTileCountAfter: 0,
            strategyDiagnostics: {
              mode: 'cleanup',
              reasonCode: 'test',
              intent: 'cleanup',
              candidateChainLength: 2,
              projectedResultValue: 4,
            },
            events: [],
          },
        ],
      },
    ]);

    expect(output.choiceRichness.forcedTurnBuckets.oneStart).toBe(1);
    expect(output.strategyBehavior.modeDistribution.cleanup).toBe(1);
    expect(output.strategyBehavior.intentDistribution.cleanup).toBe(1);
  });
});
