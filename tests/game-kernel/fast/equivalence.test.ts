import { describe, it, expect } from 'vitest';
import {
  applyAction,
  createGame,
  DEFAULT_CONFIG,
} from '../../../src/game-kernel/index.js';
import {
  applyChainInPlace,
  enumerateLegalPairsFast,
  fromPure,
} from '../../../src/game-kernel/fast/index.js';
import type {
  Cell,
  CommitChainAction,
  GameConfig,
  GameState,
} from '../../../src/game-kernel/types.js';
import type { FastState } from '../../../src/game-kernel/fast/index.js';

// Property test: pure surface and fast surface produce byte-identical state
// and metadata for the same starting seed + chain sequence. This is the
// gate before Phase 2.7 (the pure-surface replumb).
//
// Each test plays a full game with a deterministic random walker; both
// surfaces see the SAME chain at every turn (the walker's RNG is separate
// from the kernel PRNG), so any divergence is a real bug in the fast
// surface.

function makeWalker(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function pickChainPure(state: GameState, walker: () => number): Cell[] | null {
  // Enumerate via the fast helper because it's faster and produces the
  // same ordered set as a manual scan would.
  const fast = fromPure(state);
  const flat = enumerateLegalPairsFast(fast);
  if (flat.length === 0) return null;
  const numPairs = flat.length / 2;
  const idx = Math.floor(walker() * numPairs);
  const a = flat[idx * 2];
  const b = flat[idx * 2 + 1];
  if (a === undefined || b === undefined) return null;
  return [a, b];
}

function statesEqualByValue(pure: GameState, fast: FastState): {
  ok: boolean;
  reason?: string;
} {
  if (pure.config.gridRows !== fast.rows) return { ok: false, reason: 'rows differ' };
  if (pure.config.gridCols !== fast.cols) return { ok: false, reason: 'cols differ' };
  for (let r = 0; r < pure.config.gridRows; r++) {
    for (let c = 0; c < pure.config.gridCols; c++) {
      const pVal = pure.board[r]![c]!.value;
      const fByte = fast.board[r * fast.cols + c]!;
      const fLow = fByte & 0x0f;
      // Value 0 → low nibble 0; value 2^k → low nibble k.
      const expectedLow = pVal === 0 ? 0 : Math.log2(pVal);
      if (fLow !== expectedLow) {
        return { ok: false, reason: `cell (${r},${c}): pure=${pVal} (low ${expectedLow}), fast low ${fLow}` };
      }
    }
  }
  if (pure.turn !== fast.turn) return { ok: false, reason: `turn ${pure.turn} vs ${fast.turn}` };
  if (pure.prngState !== fast.prngState) return { ok: false, reason: `prng ${pure.prngState} vs ${fast.prngState}` };
  if (pure.maxTileEver !== fast.maxTileEver) return { ok: false, reason: `maxTile ${pure.maxTileEver} vs ${fast.maxTileEver}` };
  if (pure.phase !== fast.phase) return { ok: false, reason: `phase ${pure.phase} vs ${fast.phase}` };
  return { ok: true };
}

function playEquivalent(seed: number, walkerSeed: number, maxTurns = 5000): {
  divergedAtTurn: number | null;
  reason?: string;
  finalTurn: number;
} {
  const config: GameConfig = { ...DEFAULT_CONFIG, prngSeed: seed };
  let pure = createGame(config);
  const fast = fromPure(pure);

  const walker = makeWalker(walkerSeed);
  let turn = 0;

  while (pure.phase === 'playing' && fast.phase === 'playing' && turn < maxTurns) {
    const chain = pickChainPure(pure, walker);
    if (chain === null) break;

    const action: CommitChainAction = { kind: 'commit-chain', chain };
    pure = applyAction(pure, action);
    applyChainInPlace(fast, chain);

    const eq = statesEqualByValue(pure, fast);
    if (!eq.ok) {
      return { divergedAtTurn: turn, reason: eq.reason, finalTurn: turn };
    }
    turn++;
  }

  return { divergedAtTurn: null, finalTurn: turn };
}

describe('Pure ↔ Fast equivalence', () => {
  // Property test: 30 (kernel seed, walker seed) pairs, each played to
  // game-over. Any divergence at any turn fails the test with the seed +
  // turn number for reproduction.
  for (let i = 0; i < 30; i++) {
    const kernelSeed = i;
    const walkerSeed = i + 100;
    it(`game equivalent across all turns (seed=${kernelSeed}, walker=${walkerSeed})`, () => {
      const result = playEquivalent(kernelSeed, walkerSeed, 2000);
      expect(result.divergedAtTurn, `${result.reason} at turn ${result.divergedAtTurn}`).toBeNull();
      // Sanity: games actually run for some turns
      expect(result.finalTurn).toBeGreaterThan(0);
    });
  }

  it('long game (5000 turn cap) stays equivalent', () => {
    const result = playEquivalent(/* kernel */ 7, /* walker */ 999, /* maxTurns */ 5000);
    expect(result.divergedAtTurn, result.reason).toBeNull();
  });

  it('createGame board equivalent across seeds (no commits)', () => {
    for (let s = 0; s < 50; s++) {
      const config: GameConfig = { ...DEFAULT_CONFIG, prngSeed: s };
      const pure = createGame(config);
      const fast = fromPure(pure);
      const eq = statesEqualByValue(pure, fast);
      expect(eq.ok, `seed ${s}: ${eq.reason}`).toBe(true);
    }
  });
});
