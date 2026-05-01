export { analyzeGames } from './analyzer.js';
export { runSimulation } from './runner.js';
export { runSweep } from './sweep.js';
export { collectNotableSeeds, formatBatchTable, runExperimentBatch } from './batch.js';
export {
  baselinePowerLaw,
  createExperimentProfiles,
  flat,
  narrowPool,
  steepPowerLaw,
  volatile,
} from './profiles.js';
export {
  RECOMMENDED_TUNING_TARGET,
  classifyCandidate,
  findNotableSeedBy,
  scoreAgainstTarget,
} from './scoring.js';
export { randomStrategy } from './strategies/random.js';
export { greedyStrategy } from './strategies/greedy.js';
export { heuristicStrategy } from './strategies/heuristic.js';
export {
  longGreedyWalkStrategy,
  longRandomWalkStrategy,
  milestonePushStrategy,
  preRetirementCleanupStrategy,
  strategicHumanLikeStrategy,
} from './strategies/long-chain.js';
export {
  casualStrategy,
  cleanupPrioritizerStrategy,
  engagedStrategy,
  retirementAvoiderStrategy,
  skilledStrategy,
  speedrunnerStrategy,
  sweeperStrategy,
} from './strategies/archetypes.js';
export {
  buildConstructiveChain,
  candidateFromChain,
  countIsolatedRetiredTiles,
  countLegalChainStarts,
  countRetiredTiles,
  enumerateCandidateChains,
  findBestDeepChain,
  findLegalChainStarts,
  isolatedTilesByTier,
  largestAvailableChain,
  legalExtensionsForChain,
  maxTileOnBoard,
  tilesByTier,
  toDecision,
} from './strategies/common.js';
export type {
  GameRunResult,
  BatchResultRow,
  CandidateLabel,
  ExperimentProfile,
  RetirementMetrics,
  RetirementModeLabel,
  RetirementTriggerSummary,
  RunSimulationOptions,
  SimStrategy,
  SimulationInputs,
  SimulationOutputs,
  SimulationResultRow,
  StrategyContext,
  StrategyDecision,
  StrategyDiagnostics,
  StrategyIntent,
  StrategyId,
  StrategyMode,
  SweepOptions,
  SweepValue,
  TargetScore,
  TuningTarget,
  TurnRecord,
} from './types.js';
export type { BatchRunOptions } from './batch.js';
