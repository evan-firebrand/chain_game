import type { GameConfig, TileValue } from '../game-session/index.js';
import { isPlayableTileValue, nextTileValue } from '../game-session/index.js';

export class ConfigImportError extends Error {
  readonly field: string | undefined;
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ConfigImportError';
    this.field = field;
  }
}

export function exportConfig(config: GameConfig): string {
  return JSON.stringify(config, null, 2);
}

export function importConfig(json: string): GameConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new ConfigImportError(`Invalid JSON: ${(err as Error).message}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ConfigImportError('Config must be a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  const ruleK = expectInt(obj, 'ruleK', 0, 8);
  const gridRows = expectInt(obj, 'gridRows', 4, 9);
  const gridCols = expectInt(obj, 'gridCols', 4, 9);
  const spawnPoolMin = expectTileValue(obj, 'spawnPoolMin');
  const spawnPoolMax = expectTileValue(obj, 'spawnPoolMax');
  if (spawnPoolMin > spawnPoolMax) {
    throw new ConfigImportError(
      `spawnPoolMin (${spawnPoolMin}) must be <= spawnPoolMax (${spawnPoolMax})`,
      'spawnPoolMin'
    );
  }
  const prngSeed = expectFiniteNumber(obj, 'prngSeed');
  const spawnWeights = expectSpawnWeights(obj, spawnPoolMin, spawnPoolMax);

  const config: GameConfig = {
    gridRows,
    gridCols,
    ruleK,
    spawnPoolMin,
    spawnPoolMax,
    spawnWeights,
    prngSeed,
  };
  return config;
}

function expectInt(
  obj: Record<string, unknown>,
  field: string,
  min: number,
  max: number
): number {
  const v = obj[field];
  if (typeof v !== 'number' || !Number.isInteger(v)) {
    throw new ConfigImportError(`Field "${field}" must be an integer`, field);
  }
  if (v < min || v > max) {
    throw new ConfigImportError(`Field "${field}" must be in [${min}, ${max}]`, field);
  }
  return v;
}

function expectFiniteNumber(obj: Record<string, unknown>, field: string): number {
  const v = obj[field];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ConfigImportError(`Field "${field}" must be a finite number`, field);
  }
  return v;
}

function expectTileValue(obj: Record<string, unknown>, field: string): TileValue {
  const v = obj[field];
  if (typeof v !== 'number' || !isPlayableTileValue(v)) {
    throw new ConfigImportError(
      `Field "${field}" must be a valid TileValue (power of 2 >= 2)`,
      field
    );
  }
  return v;
}

function expectSpawnWeights(
  obj: Record<string, unknown>,
  min: TileValue,
  max: TileValue
): GameConfig['spawnWeights'] {
  const raw = obj.spawnWeights;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ConfigImportError('Field "spawnWeights" must be an object', 'spawnWeights');
  }
  const weights = raw as Record<string, unknown>;
  const result: Partial<Record<TileValue, number>> = {};

  // Every power-of-2 in [min, max] must have a non-negative numeric weight.
  for (let v: TileValue | null = min; v !== null && v <= max; v = nextTileValue(v)) {
    const w = weights[String(v)];
    if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) {
      throw new ConfigImportError(
        `spawnWeights["${v}"] must be a non-negative finite number`,
        'spawnWeights'
      );
    }
    result[v] = w;
  }
  // Extras outside [min, max] are allowed (preserved if numeric and >= 0).
  for (const [k, w] of Object.entries(weights)) {
    const tv = Number(k);
    if (!isPlayableTileValue(tv)) continue;
    if (tv < min || tv > max) {
      if (typeof w === 'number' && Number.isFinite(w) && w >= 0) {
        result[tv] = w;
      }
    }
  }
  return result;
}
