import type {
  Cell,
  CommitChainAction,
  GameConfig,
  GameEvent,
  GamePhase,
  GameState,
  TileValue,
} from '../game-kernel/index.js';

export type StrategyId = 'random' | 'greedy' | 'heuristic';

export type RetirementModeLabel = 'cascade';

export interface StrategyContext {
  readonly maxChainLength: number;
  readonly random: () => number;
}

export interface SimStrategy {
  readonly id: StrategyId;
  chooseAction(state: GameState, context: StrategyContext): CommitChainAction | null;
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
  readonly triggers: readonly RetirementTriggerSummary[];
}

export interface SimulationOutputs {
  readonly gameLength: {
    readonly p10: number;
    readonly median: number;
    readonly p90: number;
  };
  readonly maxTileDistribution: Readonly<Record<number, number>>;
  readonly chainLengthDistribution: Readonly<Record<number, number>>;
  readonly resultValueDistribution: Readonly<Record<number, number>>;
  readonly deathCauseDistribution: Readonly<Record<GameRunResult['deathCause'], number>>;
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
