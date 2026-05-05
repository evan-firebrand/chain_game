import { DEFAULT_CONFIG, forEachTileValueInRange } from '../game-kernel/index.js';
import type { GameConfig, TileValue } from '../game-kernel/index.js';
import type { ExperimentProfile } from './types.js';

function weightsForPool(
  min: TileValue,
  max: TileValue,
  weightFor: (value: TileValue, index: number) => number
): Partial<Record<TileValue, number>> {
  const weights: Partial<Record<TileValue, number>> = {};
  let index = 0;
  forEachTileValueInRange(min, max, value => {
    weights[value] = weightFor(value, index);
    index++;
  });
  return weights;
}

export function baselinePowerLaw(config: GameConfig = DEFAULT_CONFIG): GameConfig {
  return {
    ...config,
    spawnWeights: weightsForPool(config.spawnPoolMin, config.spawnPoolMax, (_value, index) =>
      Math.pow(2, Math.max(0, 7 - index))
    ),
  };
}

export function flat(config: GameConfig = DEFAULT_CONFIG): GameConfig {
  return {
    ...config,
    spawnWeights: weightsForPool(config.spawnPoolMin, config.spawnPoolMax, () => 1),
  };
}

export function steepPowerLaw(config: GameConfig = DEFAULT_CONFIG): GameConfig {
  return {
    ...config,
    spawnWeights: weightsForPool(config.spawnPoolMin, config.spawnPoolMax, (_value, index) =>
      Math.pow(3, Math.max(0, 7 - index))
    ),
  };
}

export function volatile(config: GameConfig = DEFAULT_CONFIG): GameConfig {
  return {
    ...config,
    spawnWeights: weightsForPool(config.spawnPoolMin, config.spawnPoolMax, (_value, index) =>
      index >= 5 ? 4 : Math.pow(2, Math.max(0, 6 - index))
    ),
  };
}

export function narrowPool(config: GameConfig = DEFAULT_CONFIG): GameConfig {
  return {
    ...config,
    spawnPoolMin: 2,
    spawnPoolMax: 64,
    spawnWeights: weightsForPool(2, 64, (_value, index) => Math.pow(2, Math.max(0, 5 - index))),
  };
}

export function createExperimentProfiles(baseConfig: GameConfig = DEFAULT_CONFIG): ExperimentProfile[] {
  const baseline = baselinePowerLaw(baseConfig);
  return [
    {
      id: 'baseline-6x7-k2-power',
      label: 'Baseline 6x7 k2 power',
      designQuestion: 'Does the current Endless baseline create recoverable retirement pressure?',
      config: baseline,
    },
    {
      id: 'tight-5x6-k2-power',
      label: 'Tight 5x6 k2 power',
      designQuestion: 'Does less board space create pressure without forcing turns?',
      config: { ...baseline, gridRows: 6, gridCols: 5 },
    },
    {
      id: 'baseline-6x7-k3-power',
      label: 'Baseline 6x7 k3 power',
      designQuestion: 'Does slower same-value reward reduce long-chain dominance?',
      config: { ...baseline, ruleK: 3 },
    },
    {
      id: 'baseline-6x7-k1-power',
      label: 'Baseline 6x7 k1 power',
      designQuestion: 'Does full length reward collapse play into length hunting?',
      config: { ...baseline, ruleK: 1 },
    },
    {
      id: 'baseline-6x7-k2-flat',
      label: 'Baseline 6x7 k2 flat',
      designQuestion: 'Does flatter spawning reduce compatible tile abundance?',
      config: flat(baseline),
    },
    {
      id: 'baseline-6x7-k2-steep',
      label: 'Baseline 6x7 k2 steep',
      designQuestion: 'Does steeper spawning make the board too forgiving?',
      config: steepPowerLaw(baseline),
    },
    {
      id: 'baseline-6x7-k2-volatile',
      label: 'Baseline 6x7 k2 volatile',
      designQuestion: 'Do upper-tier spikes create exciting or unfair progression?',
      config: volatile(baseline),
    },
    {
      id: 'baseline-6x7-k2-narrow',
      label: 'Baseline 6x7 k2 narrow pool',
      designQuestion: 'Does a narrower pool improve readability or flatten choices?',
      config: narrowPool(baseline),
    },
    {
      id: 'tight-5x6-k3-flat',
      label: 'Tight 5x6 k3 flat',
      designQuestion: 'Does combining tighter space and slower reward create healthy pressure?',
      config: { ...flat(baseline), gridRows: 6, gridCols: 5, ruleK: 3 },
    },
    {
      id: 'tight-5x6-k2-volatile',
      label: 'Tight 5x6 k2 volatile',
      designQuestion: 'Does volatility become unfair on a tighter board?',
      config: { ...volatile(baseline), gridRows: 6, gridCols: 5 },
    },
    {
      id: 'wide-7x8-k2-flat',
      label: 'Wide 7x8 k2 flat',
      designQuestion: 'Does more space keep long chains expressive but endless?',
      config: { ...flat(baseline), gridRows: 8, gridCols: 7 },
    },
    {
      id: 'wide-7x8-k3-steep',
      label: 'Wide 7x8 k3 steep',
      designQuestion: 'Can more space and slower reward preserve expressive play under pressure?',
      config: { ...steepPowerLaw(baseline), gridRows: 8, gridCols: 7, ruleK: 3 },
    },
  ];
}
