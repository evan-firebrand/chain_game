import {
  type Board,
  type Cell,
  type CommitChainAction,
  type GameConfig,
  type GameState,
  type Row,
  type Col,
  applyAction,
  createGame,
  validateChain,
  DEFAULT_CONFIG,
} from '../src/game-kernel/index.js';

// ─── Bench-local PRNG ────────────────────────────────────────────────────────
// Independent from the kernel's PRNG so move-picker variance doesn't perturb
// the kernel's deterministic spawn sequence.

interface BenchRng {
  next(): number;
  int(maxExclusive: number): number;
}

export function makeBenchRng(seed: number): BenchRng {
  let state = (seed >>> 0) || 1;
  const next = (): number => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  return {
    next,
    int(maxExclusive: number): number {
      return Math.floor(next() * maxExclusive);
    },
  };
}

// ─── Configs ─────────────────────────────────────────────────────────────────

export const BENCH_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  prngSeed: 42,
};

export function configWithSeed(seed: number): GameConfig {
  return { ...DEFAULT_CONFIG, prngSeed: seed };
}

// ─── Move enumeration ────────────────────────────────────────────────────────

/**
 * Returns every adjacent same-value pair on the board, encoded as a 2-cell chain.
 * The list is the universe of legal 2-cell chain starts.
 */
export function enumerateLegalPairs(board: Board): Cell[][] {
  const rows = board.length;
  const cols = (board[0] as readonly unknown[] | undefined)?.length ?? 0;
  const pairs: Cell[][] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = (board[r] as readonly { value: number }[])[c];
      if (tile === undefined || tile.value === 0) continue;
      const v = tile.value;

      // Only enumerate forward neighbors (down/right/down-left/down-right) to
      // avoid double-counting unordered pairs. We still emit each pair as an
      // ordered chain in one direction; for benches that's enough variety.
      for (const [dr, dc] of [
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const nt = (board[nr] as readonly { value: number }[])[nc];
        if (nt !== undefined && nt.value === v) {
          pairs.push([
            { row: r as Row, col: c as Col },
            { row: nr as Row, col: nc as Col },
          ]);
        }
      }
    }
  }
  return pairs;
}

// ─── Random-legal-move walker ────────────────────────────────────────────────

export interface PlayResult {
  finalState: GameState;
  turns: number;
  reachedGameOver: boolean;
}

/**
 * Plays a game by picking a uniformly-random legal 2-cell chain each turn,
 * until game-over or `maxTurns` is reached.
 *
 * Bench workload: deterministic for a given (config.prngSeed, walkerSeed) pair.
 */
export function playRandomGame(
  config: GameConfig,
  walkerSeed: number,
  maxTurns = 10_000,
): PlayResult {
  const rng = makeBenchRng(walkerSeed);
  let state = createGame(config);
  let turns = 0;

  while (state.phase === 'playing' && turns < maxTurns) {
    const pairs = enumerateLegalPairs(state.board);
    if (pairs.length === 0) break;
    const pickedRaw = pairs[rng.int(pairs.length)];
    if (pickedRaw === undefined) break;
    const picked: Cell[] = pickedRaw;
    const action: CommitChainAction = { kind: 'commit-chain', chain: picked };
    // Cheap sanity check — guards against any bug in enumerateLegalPairs.
    if (!validateChain(state.board, picked).valid) break;
    state = applyAction(state, action);
    turns++;
  }

  return {
    finalState: state,
    turns,
    reachedGameOver: state.phase === 'game-over',
  };
}
