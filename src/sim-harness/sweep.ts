import type { SimulationResultRow, SweepOptions } from './types.js';
import { runSimulation } from './runner.js';

export function runSweep<T>(options: SweepOptions<T>): SimulationResultRow[] {
  return options.values.map(entry => {
    const runOptions = {
      config: options.applyValue(options.baseConfig, entry.value),
      strategy: options.strategy,
      runs: options.runs,
      seed: options.seed,
      ...(options.maxTurns === undefined ? {} : { maxTurns: options.maxTurns }),
      ...(options.maxChainLength === undefined ? {} : { maxChainLength: options.maxChainLength }),
    };

    return runSimulation(runOptions);
  });
}
