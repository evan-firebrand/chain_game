import {
  computeChainResult,
  getAdjacentCells,
  validateChain,
  validateChainExtension,
} from '../../game-kernel/index.js';
import type {
  Board,
  Cell,
  CommitChainAction,
  GameState,
  Row,
  Col,
  TileValue,
} from '../../game-kernel/index.js';
import type {
  StrategyDecision,
  StrategyDiagnostics,
  StrategyIntent,
  StrategyMode,
} from '../types.js';

export interface CandidateChain {
  readonly chain: readonly Cell[];
  readonly resultValue: TileValue;
}

export type ExtensionPicker = (
  state: GameState,
  chain: readonly Cell[],
  extensions: readonly Cell[]
) => Cell | null;

export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

export function compareCell(a: Cell, b: Cell): number {
  return a.row === b.row ? a.col - b.col : a.row - b.row;
}

export function compareChains(a: readonly Cell[], b: readonly Cell[]): number {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const left = a[i];
    const right = b[i];
    if (left === undefined || right === undefined) continue;
    const byCell = compareCell(left, right);
    if (byCell !== 0) return byCell;
  }
  return a.length - b.length;
}

function asAction(chain: readonly Cell[]): CommitChainAction {
  return { kind: 'commit-chain', chain };
}

export function countLegalChainStarts(board: Board): number {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  let count = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = board[r]?.[c];
      if (tile === undefined || tile.value === 0) continue;

      const origin = { row: r as Row, col: c as Col };
      for (const neighbor of getAdjacentCells(origin, rows, cols)) {
        if (compareCell(origin, neighbor) >= 0) continue;
        const neighborTile = board[neighbor.row]?.[neighbor.col];
        if (neighborTile !== undefined && neighborTile.value === tile.value) {
          count++;
        }
      }
    }
  }

  return count;
}

export function countRetiredTiles(board: Board): number {
  let count = 0;
  for (const row of board) {
    for (const tile of row) {
      if (tile.value !== 0 && tile.retired) count++;
    }
  }
  return count;
}

export function countIsolatedRetiredTiles(board: Board): number {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  let count = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = board[r]?.[c];
      if (tile === undefined || tile.value === 0 || !tile.retired) continue;

      const hasSameNeighbor = getAdjacentCells({ row: r as Row, col: c as Col }, rows, cols)
        .some(neighbor => board[neighbor.row]?.[neighbor.col]?.value === tile.value);
      if (!hasSameNeighbor) count++;
    }
  }

  return count;
}

export function maxTileOnBoard(board: Board): TileValue {
  let max: TileValue = 0 as TileValue;
  for (const row of board) {
    for (const tile of row) {
      if (tile.value > max) max = tile.value;
    }
  }
  return max;
}

export function tilesByTier(board: Board): ReadonlyMap<TileValue, number> {
  const counts = new Map<TileValue, number>();
  for (const row of board) {
    for (const tile of row) {
      if (tile.value === 0) continue;
      counts.set(tile.value, (counts.get(tile.value) ?? 0) + 1);
    }
  }
  return counts;
}

export function isolatedTilesByTier(board: Board): ReadonlyMap<TileValue, number> {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const counts = new Map<TileValue, number>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = board[r]?.[c];
      if (tile === undefined || tile.value === 0) continue;

      const hasSameNeighbor = getAdjacentCells({ row: r as Row, col: c as Col }, rows, cols)
        .some(neighbor => board[neighbor.row]?.[neighbor.col]?.value === tile.value);
      if (!hasSameNeighbor) {
        counts.set(tile.value, (counts.get(tile.value) ?? 0) + 1);
      }
    }
  }

  return counts;
}

// Returns the longest valid chain length currently constructible on the board,
// or 0 if no chain is possible. Expensive (DFS over all start cells with full
// board depth) — call only when needed (e.g. postmortem analysis), not per turn
// in production sims.
export function largestAvailableChain(state: GameState): number {
  const rows = state.board.length;
  const cols = state.board[0]?.length ?? 0;
  const best = findBestDeepChain(state, rows * cols, c => c.chain.length);
  return best?.chain.length ?? 0;
}

export function enumerateCandidateChains(
  state: GameState,
  maxChainLength: number
): CandidateChain[] {
  const { board } = state;
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const cappedMax = Math.max(2, Math.min(maxChainLength, rows * cols));
  const candidates: CandidateChain[] = [];
  const seenCandidates = new Set<string>();

  function addCandidate(chain: readonly Cell[]): void {
    const key = chain.map(cellKey).join('|');
    if (seenCandidates.has(key)) return;
    seenCandidates.add(key);
    candidates.push({
      chain: [...chain],
      resultValue: computeChainResult(board, chain, state.config),
    });
  }

  function extend(chain: readonly Cell[], used: ReadonlySet<string>): void {
    if (chain.length >= cappedMax) return;
    const last = chain[chain.length - 1];
    if (last === undefined) return;

    const neighbors = getAdjacentCells(last, rows, cols).sort(compareCell);
    for (const neighbor of neighbors) {
      const key = cellKey(neighbor);
      if (used.has(key)) continue;
      const nextChain = [...chain, neighbor];
      if (!validateChain(board, nextChain).valid) continue;

      addCandidate(nextChain);
      const nextUsed = new Set(used);
      nextUsed.add(key);
      extend(nextChain, nextUsed);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = board[r]?.[c];
      if (tile === undefined || tile.value === 0) continue;

      const start = { row: r as Row, col: c as Col };
      for (const neighbor of getAdjacentCells(start, rows, cols).sort(compareCell)) {
        const chain = [start, neighbor];
        if (!validateChain(board, chain).valid) continue;

        addCandidate(chain);
        extend(chain, new Set(chain.map(cellKey)));
      }
    }
  }

  return candidates.sort((a, b) => compareChains(a.chain, b.chain));
}

export function findLegalChainStarts(state: GameState): readonly (readonly [Cell, Cell])[] {
  const { board } = state;
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const starts: (readonly [Cell, Cell])[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = board[r]?.[c];
      if (tile === undefined || tile.value === 0) continue;

      const start = { row: r as Row, col: c as Col };
      for (const neighbor of getAdjacentCells(start, rows, cols).sort(compareCell)) {
        const chain = [start, neighbor] as const;
        if (validateChain(board, chain).valid) {
          starts.push(chain);
        }
      }
    }
  }

  return starts;
}

export function legalExtensionsForChain(
  state: GameState,
  chain: readonly Cell[]
): readonly Cell[] {
  const last = chain[chain.length - 1];
  if (last === undefined) return [];

  const used = new Set(chain.map(cellKey));
  const rows = state.board.length;
  const cols = state.board[0]?.length ?? 0;
  return getAdjacentCells(last, rows, cols)
    .filter(cell => !used.has(cellKey(cell)))
    .filter(cell => validateChain(state.board, [...chain, cell]).valid)
    .sort(compareCell);
}

export function candidateFromChain(state: GameState, chain: readonly Cell[]): CandidateChain {
  return {
    chain: [...chain],
    resultValue: computeChainResult(state.board, chain, state.config),
  };
}

export function buildConstructiveChain(
  state: GameState,
  start: readonly [Cell, Cell],
  maxLength: number,
  picker: ExtensionPicker
): CandidateChain {
  const chain: Cell[] = [...start];
  const cappedMax = Math.max(2, Math.min(maxLength, state.board.length * (state.board[0]?.length ?? 0)));

  while (chain.length < cappedMax) {
    const extensions = legalExtensionsForChain(state, chain);
    if (extensions.length === 0) break;

    const next = picker(state, chain, extensions);
    if (next === null) break;
    chain.push(next);
  }

  return candidateFromChain(state, chain);
}

export function toCommitAction(candidate: CandidateChain): CommitChainAction {
  return asAction(candidate.chain);
}

// Memory-efficient exhaustive DFS that tracks only the running best candidate.
// O(maxDepth) memory — safe for depths up to 20 where enumerateCandidateChains
// would store millions of intermediate arrays.
//
// scoreCandidate returns a number; higher = preferred. The chain must have ≥ 2
// cells to be eligible (chain-start rule requires a same-value pair).
export function findBestDeepChain(
  state: GameState,
  maxDepth: number,
  scoreCandidate: (candidate: CandidateChain) => number
): CandidateChain | undefined {
  const { board } = state;
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const cappedMax = Math.min(maxDepth, rows * cols);

  let bestCandidate: CandidateChain | undefined;
  let bestScore = -Infinity;

  const path: Cell[] = [];
  const used = new Set<string>();

  function dfs(): void {
    if (path.length >= 2) {
      const rv = computeChainResult(board, path, state.config);
      const candidate: CandidateChain = { chain: path.slice(), resultValue: rv };
      const s = scoreCandidate(candidate);
      if (s > bestScore) {
        bestScore = s;
        bestCandidate = candidate;
      }
    }
    if (path.length >= cappedMax) return;

    const last = path[path.length - 1];
    if (last === undefined) return;
    const lastTile = board[last.row]?.[last.col];
    if (!lastTile || lastTile.value === 0) return;

    for (const neighbor of getAdjacentCells(last, rows, cols).sort(compareCell)) {
      const key = cellKey(neighbor);
      if (used.has(key)) continue;
      const neighborTile = board[neighbor.row]?.[neighbor.col];
      if (!neighborTile || neighborTile.value === 0) continue;

      // Chain start (length === 1): neighbor must have the same value.
      // Extension (length >= 2): same or double the previous tile.
      if (path.length === 1) {
        if (neighborTile.value !== lastTile.value) continue;
      } else {
        if (!validateChainExtension(lastTile, neighborTile).valid) continue;
      }

      path.push(neighbor);
      used.add(key);
      dfs();
      path.pop();
      used.delete(key);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = board[r]?.[c];
      if (!tile || tile.value === 0) continue;
      const startCell: Cell = { row: r as Row, col: c as Col };
      path.push(startCell);
      used.add(cellKey(startCell));
      dfs();
      path.pop();
      used.clear();
    }
  }

  return bestCandidate;
}

export function toDecision(
  candidate: CandidateChain | undefined,
  mode: StrategyMode,
  reasonCode: string,
  intent: StrategyIntent
): StrategyDecision {
  if (candidate === undefined) {
    return { action: null };
  }

  const diagnostics: StrategyDiagnostics = {
    mode,
    reasonCode,
    intent,
    candidateChainLength: candidate.chain.length,
    projectedResultValue: candidate.resultValue,
  };

  return {
    action: toCommitAction(candidate),
    diagnostics,
  };
}
