import { describe, it, expect } from 'vitest';
import { exportConfig, importConfig, ConfigImportError } from '../../src/tuning-console/config-export.js';
import { DEFAULT_CONFIG } from '../../src/game-session/index.js';
import type { GameConfig } from '../../src/game-session/index.js';

describe('exportConfig', () => {
  it('produces valid JSON', () => {
    const json = exportConfig(DEFAULT_CONFIG);
    expect(() => { JSON.parse(json); }).not.toThrow();
  });

  it('round-trips DEFAULT_CONFIG via importConfig', () => {
    const json = exportConfig(DEFAULT_CONFIG);
    const parsed = importConfig(json);
    expect(parsed).toEqual(DEFAULT_CONFIG);
  });

  it('round-trips a non-default config', () => {
    const cfg: GameConfig = {
      ...DEFAULT_CONFIG,
      ruleK: 5,
      gridRows: 5,
      gridCols: 5,
      prngSeed: 42,
      spawnWeights: { 2: 10, 4: 20, 8: 30, 16: 40, 32: 1, 64: 1, 128: 1, 256: 1 },
    };
    expect(importConfig(exportConfig(cfg))).toEqual(cfg);
  });
});

describe('importConfig — JSON parsing', () => {
  it('throws on malformed JSON', () => {
    expect(() => importConfig('{')).toThrow(ConfigImportError);
    expect(() => importConfig('{')).toThrow(/Invalid JSON/);
  });

  it('throws when top-level is not an object', () => {
    expect(() => importConfig('[]')).toThrow(/must be a JSON object/);
    expect(() => importConfig('"foo"')).toThrow(/must be a JSON object/);
    expect(() => importConfig('null')).toThrow(/must be a JSON object/);
  });
});

describe('importConfig — field validation', () => {
  function withField(field: string, value: unknown): string {
    return JSON.stringify({ ...DEFAULT_CONFIG, [field]: value });
  }

  it('throws when ruleK is missing', () => {
    const partial = { ...DEFAULT_CONFIG } as Partial<GameConfig>;
    delete partial.ruleK;
    expect(() => importConfig(JSON.stringify(partial))).toThrow(/ruleK/);
  });

  it('throws on ruleK out of range', () => {
    expect(() => importConfig(withField('ruleK', -1))).toThrow(/ruleK/);
    expect(() => importConfig(withField('ruleK', 9))).toThrow(/ruleK/);
  });

  it('throws on non-integer ruleK', () => {
    expect(() => importConfig(withField('ruleK', 2.5))).toThrow(/ruleK/);
  });

  it('throws on gridRows/gridCols out of range', () => {
    expect(() => importConfig(withField('gridRows', 3))).toThrow(/gridRows/);
    expect(() => importConfig(withField('gridRows', 10))).toThrow(/gridRows/);
    expect(() => importConfig(withField('gridCols', 3))).toThrow(/gridCols/);
    expect(() => importConfig(withField('gridCols', 10))).toThrow(/gridCols/);
  });

  it('throws on invalid spawnPoolMin/Max (not power of 2)', () => {
    expect(() => importConfig(withField('spawnPoolMin', 3))).toThrow(/spawnPoolMin/);
    expect(() => importConfig(withField('spawnPoolMax', 100))).toThrow(/spawnPoolMax/);
  });

  it('throws when spawnPoolMin > spawnPoolMax', () => {
    expect(() =>
      importConfig(JSON.stringify({ ...DEFAULT_CONFIG, spawnPoolMin: 256, spawnPoolMax: 4 }))
    ).toThrow(/spawnPoolMin/);
  });

  it('throws when spawnWeights missing a power-of-2 in [min,max]', () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      spawnWeights: { 2: 1, 4: 1, 8: 1, 16: 1, 32: 1, 64: 1, 128: 1 },
      // missing "256"
    };
    expect(() => importConfig(JSON.stringify(cfg))).toThrow(/spawnWeights/);
  });

  it('throws when a spawnWeights entry is negative', () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      spawnWeights: { ...DEFAULT_CONFIG.spawnWeights, 4: -1 },
    };
    expect(() => importConfig(JSON.stringify(cfg))).toThrow(/spawnWeights/);
  });

  it('throws when spawnWeights is not an object', () => {
    expect(() => importConfig(withField('spawnWeights', [1, 2, 3]))).toThrow(/spawnWeights/);
    expect(() => importConfig(withField('spawnWeights', 5))).toThrow(/spawnWeights/);
  });

  it('throws on non-finite prngSeed', () => {
    expect(() => importConfig(withField('prngSeed', null))).toThrow(/prngSeed/);
  });

  it('accepts extra spawnWeights entries outside [min,max]', () => {
    const cfg = {
      ...DEFAULT_CONFIG,
      spawnPoolMin: 2,
      spawnPoolMax: 8,
      spawnWeights: { 2: 1, 4: 1, 8: 1, 16: 99, 32: 99 },
    };
    const parsed = importConfig(JSON.stringify(cfg));
    expect(parsed.spawnPoolMax).toBe(8);
    expect(parsed.spawnWeights[16]).toBe(99);
    expect(parsed.spawnWeights[32]).toBe(99);
  });

  it('attaches the offending field to the thrown ConfigImportError', () => {
    try {
      importConfig(withField('ruleK', 99));
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigImportError);
      expect((err as ConfigImportError).field).toBe('ruleK');
    }
  });
});
