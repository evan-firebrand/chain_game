import type {
  Cell,
  CommitChainAction,
  GameConfig,
  GameEvent,
  GamePhase,
  GameState,
  TileValue,
} from '../game-kernel/index.js';

export type StrategyId =
  | 'random'
  | 'greedy'
  | 'heuristic'
  | 'longRandomWalk'
  | 'longGreedyWalk'
  | 'milestonePush'
  | 'preRetirementCleanup'
  | 'strategicHumanLike'
  | 'casual'
  | 'engaged'
  | 'skilled'
  | 'speedrunner';

export type RetirementModeLabel = 'cascade';

export interface StrategyContext {
  readonly maxChainLength: number;
  readonly random: () => number;
}

export type StrategyMode =
  | 'random'
  | 'greedy'
  | 'heuristic'
  | 'long-random-walk'
  | 'long-greedy-walk'
  | 'cleanup'
  | 'setup'
  | 'build'
  | 'milestone'
  | 'recovery';

export type StrategyIntent = 'cleanup' | 'setup' | 'push' | 'milestone' | 'recovery';

export interface StrategyDiagnostics {
  readonly mode: StrategyMode;
  readonly reasonCode: string;
  readonly intent: StrategyIntent;
  readonly candidateChainLength: number;
  readonly projectedResultValue: TileValue;
}

export interface StrategyDecision {
  readonly action: CommitChainAction | null;
  readonly diagnostics?: StrategyDiagnostics;
}

export interface SimStrategy {
  readonly id: StrategyId;
  chooseAction(state: GameState, context: StrategyContext): StrategyDecision;
}

export interface SimulationInputs {
  readonly config: GameConfig;
  readonly strategyId: StrategyId;
  readonly runCount: number;
  readonly baseSeed: number;
  readonly maxTurns: number;
  readonly maxChainLength: number;
  readonly retirementMode: RetirementModeLabel;
}

export interface TurnRecord {
  readonly turn: number;
  readonly chain: readonly Cell[];
  readonly chainLength: number;
  readonly resultValue: TileValue;
  readonly legalChainStartsBefore: number;
  readonly legalChainStartsAfter: number;
  readonly spawnPoolBefore: readonly [TileValue, TileValue];
  readonly spawnPoolAfter: readonly [TileValue, TileValue];
  readonly retiredTileCountBefore: number;
  readonly retiredTileCountAfter: number;
  readonly isolatedRetiredTileCountBefore: number;
  readonly isolatedRetiredTileCountAfter: number;
  readonly strategyDiagnostics?: StrategyDiagnostics;
  readonly events: readonly GameEvent[];
}

export interface GameRunResult {
  readonly runIndex: number;
  readonly seed: number;
  readonly strategyId: StrategyId;
  readonly finalTurn: number;
  readonly finalPhase: GamePhase;
  readonly deathCause: 'no-legal-chain-start' | 'strategy-null' | 'max-turns';
  readonly maxTileReached: TileValue;
  readonly activeSpawnPoolAtDeath: readonly [TileValue, TileValue];
  readonly events: readonly GameEvent[];
  readonly turns: readonly TurnRecord[];
}

export interface RetirementTriggerSummary {
  readonly turn: number;
  readonly retiredTier: TileValue;
  readonly newSpawnPoolMin: TileValue;
  readonly newSpawnPoolMax: TileValue;
  readonly cascadeCountThisTurn: number;
  readonly followedByImmediateGameOver: boolean;
  readonly chainLength: number;
  readonly resultValue: TileValue;
  readonly legalChainStartsBefore: number;
  readonly legalChainStartsAfter: number;
  readonly retiredTileCountBefore: number;
  readonly retiredTileCountAfter: number;
  readonly isolatedRetiredTileCountBefore: number;
  readonly isolatedRetiredTileCountAfter: number;
}

export interface RetirementMetrics {
  readonly firstRetirementTurn: number | null;
  readonly retirementTurns: readonly number[];
  readonly retirementEventsPerGame: readonly number[];
  readonly cascadeRetirementsPerTransition: readonly number[];
  readonly cascadesFollowedByImmediateGameOver: number;
  readonly activeSpawnPoolAtDeath: readonly (readonly [TileValue, TileValue])[];
  readonly retiredTileCountOverTime: readonly number[];
  readonly isolatedRetiredTileCountOverTime: readonly number[];
  readonly legalChainStartDeltaAfterRetirement: readonly number[];
  readonly turnsSurvivedAfterFirstRetirement: readonly number[];
  readonly turnsSurvivedAfterSecondRetirement: readonly number[];
  readonly triggers: readonly RetirementTriggerSummary[];
}

export interface ChoiceRichnessMetrics {
  readonly legalChainStartsBefore: {
    readonly p10: number;
    readonly median: number;
    readonly p90: number;
  };
  readonly legalChainStartsAfter: {
    readonly p10: number;
    readonly median: number;
    readonly p90: number;
  };
  readonly forcedTurnBuckets: {
    readonly oneStart: number;
    readonly twoToThreeStarts: number;
    readonly fourPlusStarts: number;
  };
}

export interface ChainLengthBucketMetrics {
  readonly short2To4: number;
  readonly medium5To9: number;
  readonly long10Plus: number;
}

export interface StrategyBehaviorMetrics {
  readonly modeDistribution: Readonly<Record<string, number>>;
  readonly intentDistribution: Readonly<Record<string, number>>;
}

export interface SimulationOutputs {
  readonly gameLength: {
    readonly p10: number;
    readonly median: number;
    readonly p90: number;
  };
  readonly maxTileDistribution: Readonly<Record<number, number>>;
  readonly chainLengthDistribution: Readonly<Record<number, number>>;
  readonly chainLengthBuckets: ChainLengthBucketMetrics;
  readonly resultValueDistribution: Readonly<Record<number, number>>;
  readonly deathCauseDistribution: Readonly<Record<GameRunResult['deathCause'], number>>;
  readonly choiceRichness: ChoiceRichnessMetrics;
  readonly strategyBehavior: StrategyBehaviorMetrics;
  readonly retirement: RetirementMetrics;
}

export interface SimulationResultRow {
  readonly inputs: SimulationInputs;
  readonly outputs: SimulationOutputs;
  readonly games: readonly GameRunResult[];
}

export interface RunSimulationOptions {
  readonly config: GameConfig;
  readonly strategy: SimStrategy;
  readonly runs: number;
  readonly seed: number;
  readonly maxTurns?: number;
  readonly maxChainLength?: number;
}

export interface SweepValue<T> {
  readonly label: string;
  readonly value: T;
}

export interface SweepOptions<T> extends Omit<RunSimulationOptions, 'config'> {
  readonly baseConfig: GameConfig;
  readonly values: readonly SweepValue<T>[];
  readonly applyValue: (config: GameConfig, value: T) => GameConfig;
}

export interface ExperimentProfile {
  readonly id: string;
  readonly label: string;
  readonly designQuestion: string;
  readonly config: GameConfig;
}

export interface TuningTarget {
  readonly capTurns: number;
  readonly naturalDeathRateMin: number;
  readonly naturalDeathRateMax: number;
  readonly medianFinalTurnMin: number;
  readonly medianFinalTurnMax: number;
  readonly firstRetirementTurnMin: number;
  readonly firstRetirementTurnMax: number;
  readonly gamesWithRetirementMinRate: number;
  readonly cascadeImmediateGameOverMaxRate: number;
}

export type CandidateLabel =
  | 'too-forgiving'
  | 'too-random'
  | 'too-forced'
  | 'long-chain-dominant'
  | 'retirement-cliff'
  | 'promising';

export interface TargetScore {
  readonly distance: number;
  readonly deltas: Readonly<Record<string, number>>;
  readonly hardFailures: readonly string[];
  readonly labels: readonly CandidateLabel[];
}

export interface NotableSeeds {
  readonly shortestNaturalDeath?: number;
  readonly longestCappedSurvival?: number;
  readonly largestCascade?: number;
  readonly largestOvershoot?: number;
  readonly mostIsolatedRetiredTiles?: number;
  readonly strongestRecovery?: number;
}

export interface BatchResultRow {
  readonly profile: ExperimentProfile;
  readonly result: SimulationResultRow;
  readonly score: TargetScore;
  readonly notableSeeds: NotableSeeds;
}
