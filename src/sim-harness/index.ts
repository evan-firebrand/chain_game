export { analyzeGames } from './analyzer.js';
export { runSimulation } from './runner.js';
export { runSweep } from './sweep.js';
export { randomStrategy } from './strategies/random.js';
export { greedyStrategy } from './strategies/greedy.js';
export { heuristicStrategy } from './strategies/heuristic.js';
export {
  countIsolatedRetiredTiles,
  countLegalChainStarts,
  countRetiredTiles,
  enumerateCandidateChains,
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
  StrategyId,
  SweepOptions,
  SweepValue,
  TurnRecord,
} from './types.js';
