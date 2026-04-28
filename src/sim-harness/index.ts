export { analyzeGames } from './analyzer.js';
export { runSimulation } from './runner.js';
export { runSweep } from './sweep.js';
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
  buildConstructiveChain,
  candidateFromChain,
  countIsolatedRetiredTiles,
  countLegalChainStarts,
  countRetiredTiles,
  enumerateCandidateChains,
  findLegalChainStarts,
  legalExtensionsForChain,
  toDecision,
} from './strategies/common.js';
export type {
  GameRunResult,
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
  TurnRecord,
} from './types.js';
