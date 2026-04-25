import { effectiveChainValues, mergeValue } from "./chain";
import { applyGravity, cloneGrid, computePeak, makeInitialGrid, refillFromQueue } from "./grid";
import type { SpawnRecord } from "./grid";
import { randomSeed } from "./rng";
import { hasAnyValidMove, countPairs } from "./rules";
import { DEFAULT_SOFTNESS, DEFAULT_STRENGTH, makeSpawnQueue } from "./spawn";
import { COLS, ROWS, INITIAL_TARGET, RATCHET_INITIAL_FLOOR, RATCHET_DEFAULT_INTERVAL, TARGET_PROGRESSION, UNDO_INITIAL_CHARGES, UNDO_MAX_CHARGES, UNDO_STACK_SIZE, queueLenFor } from "./types";
import type { Coord, GameMode, GameState, Grid, LevelGoal, SpawnAlgo, Tile, UndoSnapshot } from "./types";
import { getMode } from "./modes";
import type { ModeBehavior } from "./modes/types";
import { getModifier, chainModifierScore } from "./modifiers";
import { maybeRollSandboxModifier } from "./modifiers/sandbox";
import { neighbors8 } from "./chain";

// Long-chain combo: chains of COMBO_MIN_CHAIN+ tiles earn a COMBO_BONUS_RATE
// bonus on top of the merge result. Tile value stays a power of 2.
const COMBO_MIN_CHAIN = 5;
const COMBO_BONUS_RATE = 0.25;
const LEVELUP_SWEEP_COUNT = 3;

function resolveMerge(state: GameState, chainTiles: Tile[], path: Coord[], landing: Coord) {
  const values = effectiveChainValues(chainTiles);
  const rawResult = mergeValue(values);
  const multiplier = getMode(state.mode).chainMultiplier?.(chainTiles, state) ?? 1;
  let resultValue = rawResult * multiplier;
  // Splitter / other transformResult hooks fire on chain endpoint.
  const endpoint = chainTiles[chainTiles.length - 1];
  const endpointMod = getModifier(endpoint);
  if (endpointMod?.transformResult) {
    const t = endpointMod.transformResult(endpoint, resultValue, landing, state);
    resultValue = t.resultValue;
  }
  const combo = path.length >= COMBO_MIN_CHAIN;
  const comboBonus = combo ? Math.floor(resultValue * COMBO_BONUS_RATE) : 0;
  // Adjacent multiplier tiles boost the chain's score.
  let adjacentMultiplier = 1;
  for (const { r, c } of path) {
    for (const [nr, nc] of neighbors8(r, c, ROWS, COLS)) {
      const nt = state.grid[nr][nc];
      if (!nt) continue;
      const m = getModifier(nt);
      if (m?.chainScoreMultiplier) adjacentMultiplier *= m.chainScoreMultiplier(nt, chainTiles);
    }
  }
  const chainModScore = chainModifierScore(chainTiles);
  const scoreDelta = Math.floor((resultValue + comboBonus) * adjacentMultiplier * chainModScore);
  return { values, resultValue, combo, comboBonus, scoreDelta };
}

function buildAnimationGrids(
  grid: Grid,
  path: Coord[],
  landing: Coord,
  resultId: number,
  resultValue: number
) {
  const duringFlight = cloneGrid(grid);
  for (let i = 0; i < path.length - 1; i++) {
    duringFlight[path[i].r][path[i].c] = null;
  }

  const afterMerge = cloneGrid(grid);
  for (const { r, c } of path) afterMerge[r][c] = null;
  afterMerge[landing.r][landing.c] = { id: resultId, value: resultValue };

  const preGravityPositions = new Map<number, Coord>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = afterMerge[r][c];
      if (t !== null) preGravityPositions.set(t.id, { r, c });
    }
  }

  const afterGravity = applyGravity(afterMerge);

  const moves: Array<{ id: number; from: Coord; to: Coord }> = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = afterGravity[r][c];
      if (t === null) continue;
      const from = preGravityPositions.get(t.id);
      if (!from) continue;
      if (from.r !== r || from.c !== c) {
        moves.push({ id: t.id, from, to: { r, c } });
      }
    }
  }

  return { duringFlight, afterMerge, afterGravity, moves };
}

function levelPairingStrength(levelsCleared: number): number {
  if (levelsCleared <= 2) return 2.0;
  if (levelsCleared <= 4) return 1.0;
  if (levelsCleared <= 6) return 0.5;
  return 0;
}

// Effective spawn floor = max of the mode's floor (if any) and the ratchet
// floor (if active). Ratchet raises the floor one power of 2 per target
// cleared; the mode-provided floor is independent.
export function resolveFloor(state: GameState, modeBehavior: ModeBehavior): number | undefined {
  const modeFloor = modeBehavior.spawnFloor?.(state);
  return state.ratchetEnabled ? Math.max(modeFloor ?? 2, state.ratchetFloor) : modeFloor;
}

function generateGoalForLevel(levelsCleared: number): LevelGoal | null {
  if (levelsCleared === 0) return null;
  const cycle = (levelsCleared - 1) % 4;
  const tier = Math.floor((levelsCleared - 1) / 4);
  if (cycle === 0) return { kind: "chain-length", target: 4 + tier, best: 0 };
  if (cycle === 1) return { kind: "produce-value", target: 32 * Math.pow(2, tier), met: false };
  if (cycle === 2) return { kind: "chain-length", target: 5 + tier, best: 0 };
  return { kind: "produce-value", target: 64 * Math.pow(2, tier), met: false };
}

function targetForLevel(levelsCleared: number): number {
  if (levelsCleared < TARGET_PROGRESSION.length) return TARGET_PROGRESSION[levelsCleared];
  // Fallback for levels beyond the curated table: 1.5x the previous, rounded to a multiple of 256.
  const prev = TARGET_PROGRESSION[TARGET_PROGRESSION.length - 1];
  const overflow = levelsCleared - TARGET_PROGRESSION.length + 1;
  return Math.round((prev * Math.pow(1.5, overflow)) / 256) * 256;
}

function processTargets(state: GameState, peakAfter: number) {
  let nextTarget = state.currentTarget;
  let nextLevels = state.levelsCleared;
  let levelUpFlag: { level: number; target: number } | null = null;
  let nextRatchetFloor = state.ratchetFloor;
  if (state.targetsEnabled) {
    while (peakAfter >= nextTarget) {
      nextLevels++;
      levelUpFlag = { level: nextLevels, target: nextTarget };
      nextTarget = targetForLevel(nextLevels);
      if (state.ratchetEnabled && nextLevels % state.ratchetInterval === 0) {
        nextRatchetFloor *= 2;
      }
    }
  }
  return { nextTarget, nextLevels, levelUpFlag, nextRatchetFloor };
}

// Off-queue spawn injection (e.g., Wilds beasts). Beast lands at the topmost
// empty cell of the requested column; gravity has already settled the grid.
function injectModeSpawns(
  state: GameState,
  modeBehavior: ModeBehavior,
  grid: Grid,
  rngState: number,
  startingTileId: number
): {
  grid: Grid;
  rngState: number;
  nextTileId: number;
  spawns: SpawnRecord[];
  modeStatePatch: Partial<GameState>;
} {
  if (!modeBehavior.injectSpawns) {
    return { grid, rngState, nextTileId: startingTileId, spawns: [], modeStatePatch: {} };
  }
  const result = modeBehavior.injectSpawns(state, grid, rngState, startingTileId);
  if (result.spawns.length === 0) {
    return {
      grid,
      rngState: result.rngState,
      nextTileId: startingTileId,
      spawns: [],
      modeStatePatch: result.nextState,
    };
  }
  const next = cloneGrid(grid);
  let nextId = startingTileId;
  const spawns: SpawnRecord[] = [];
  for (const sp of result.spawns) {
    let landRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (next[r][sp.col] === null) {
        landRow = r;
        break;
      }
    }
    if (landRow < 0) continue;
    const id = nextId++;
    const tile: Tile = { id, value: sp.value, ...sp.flags };
    next[landRow][sp.col] = tile;
    spawns.push({ id, value: sp.value, r: landRow, c: sp.col, flags: sp.flags });
  }
  return {
    grid: next,
    rngState: result.rngState,
    nextTileId: nextId,
    spawns,
    modeStatePatch: result.nextState,
  };
}

type BuildFinalStateCtx = {
  modeBehavior: ModeBehavior;
  afterRefill: Grid;
  spawnQueue: number[][];
  rngState: number;
  nextTileId: number;
  peakAfter: number;
  validAfter: boolean;
  trajectory: number[];
  scoreDelta: number;
  landing: Coord;
  resultValue: number;
  chainValues: number[];
  chainTiles: Tile[];
  combo: boolean;
  comboBonus: number;
  targets: ReturnType<typeof processTargets>;
  modeStatePatch: Partial<GameState>;
};

const GOAL_BONUS_CAP = UNDO_MAX_CHARGES + 1;

function updateGoalProgress(goal: LevelGoal, chainLength: number, peakAfter: number): LevelGoal {
  if (goal.kind === "chain-length") {
    return chainLength > goal.best ? { ...goal, best: chainLength } : goal;
  }
  if (goal.kind === "produce-value") {
    return !goal.met && peakAfter >= goal.target ? { ...goal, met: true } : goal;
  }
  return goal;
}

function isGoalMet(goal: LevelGoal): boolean {
  if (goal.kind === "chain-length") return goal.best >= goal.target;
  return goal.met;
}

function buildFinalState(state: GameState, ctx: BuildFinalStateCtx): GameState {
  const { undoStack: _prevStack, undoCharges: _prevCharges, ...preCommitSnapshot } = state;
  const newUndoStack: UndoSnapshot[] = [...state.undoStack, preCommitSnapshot].slice(-UNDO_STACK_SIZE);
  const leveledUp = ctx.targets.nextLevels > state.levelsCleared;

  const updatedGoal = state.levelGoal
    ? updateGoalProgress(state.levelGoal, ctx.chainTiles.length, ctx.peakAfter)
    : null;
  const updatedGoalMet = state.levelGoalMet || (updatedGoal ? isGoalMet(updatedGoal) : false);

  const baseUndoIncrease = leveledUp ? 1 : 0;
  const goalBonusIncrease = leveledUp && updatedGoalMet ? 1 : 0;
  const nextUndoCharges = Math.min(
    GOAL_BONUS_CAP,
    state.undoCharges + baseUndoIncrease + goalBonusIncrease
  );

  const nextGoal: LevelGoal | null = leveledUp
    ? generateGoalForLevel(ctx.targets.nextLevels)
    : updatedGoal;
  const nextGoalMet = leveledUp ? false : updatedGoalMet;

  const merged: GameState = {
    ...state,
    grid: ctx.afterRefill,
    spawnQueue: ctx.spawnQueue,
    rngState: ctx.rngState,
    score: state.score + ctx.scoreDelta,
    moves: state.moves + 1,
    merges: state.merges + 1,
    peak: ctx.peakAfter,
    gameOver: !ctx.validAfter,
    lastMerge: {
      chainValues: ctx.chainValues,
      sum: ctx.chainValues.reduce((a, b) => a + b, 0),
      result: ctx.resultValue,
      landing: ctx.landing,
      combo: ctx.combo,
      comboBonus: ctx.comboBonus,
    },
    recentStartCounts: ctx.trajectory,
    nextTileId: ctx.nextTileId,
    currentTarget: ctx.targets.nextTarget,
    levelsCleared: ctx.targets.nextLevels,
    lastLevelUp: ctx.targets.levelUpFlag,
    ratchetFloor: ctx.targets.nextRatchetFloor,
    undoStack: newUndoStack,
    undoCharges: nextUndoCharges,
    levelGoal: nextGoal,
    levelGoalMet: nextGoalMet,
    ...ctx.modeStatePatch,
  };

  // Level-up mode hook (e.g. movesLimited grants extra moves).
  const levelUpPatch = leveledUp
    ? ctx.modeBehavior.onLevelUp?.(merged) ?? {}
    : {};
  const afterLevelUp = leveledUp ? { ...merged, ...levelUpPatch } : merged;

  const chainResolved = ctx.modeBehavior.onChainResolved?.(afterLevelUp, ctx.chainTiles, ctx.resultValue) ?? {};
  const afterChainResolved = { ...afterLevelUp, ...chainResolved };

  const tickUpdates = ctx.modeBehavior.onMoveComplete?.(afterChainResolved) ?? {};
  const afterTick = { ...afterChainResolved, ...tickUpdates };

  // Per-move modifier ticks (ice thaw, etc.). Run after mode tick so mode
  // logic isn't re-entrant on a half-updated grid.
  let modifierChanged = false;
  const tickedGrid = afterTick.grid.map((row) =>
    row.map((t) => {
      if (!t) return t;
      const m = getModifier(t);
      if (!m?.onMoveTick) return t;
      const next = m.onMoveTick(t, afterTick);
      if (next !== t) modifierChanged = true;
      return next;
    })
  );
  return modifierChanged ? { ...afterTick, grid: tickedGrid } : afterTick;
}

export function newGame(
  seedArg?: number,
  algo: SpawnAlgo = "weighted",
  strength: number = DEFAULT_STRENGTH,
  softness: number = DEFAULT_SOFTNESS,
  mode: GameMode = "classic",
  targetsEnabled: boolean = true,
  ratchetEnabled: boolean = false,
  ratchetInterval: number = RATCHET_DEFAULT_INTERVAL
): GameState {
  const seed = seedArg ?? randomSeed();
  const modeBehavior = getMode(mode);
  const modeState = modeBehavior.initState();

  const { grid: initialGrid, rngState: s1, nextTileId } = makeInitialGrid(seed, 1);
  const peak = computePeak(initialGrid);

  const stubState = { modeState } as unknown as GameState;
  const floor = modeBehavior.spawnFloor?.(stubState);

  const { queue, rngState: s2 } = makeSpawnQueue(
    COLS,
    queueLenFor(algo),
    peak,
    s1,
    algo,
    initialGrid,
    strength,
    softness,
    floor,
    levelPairingStrength(0)
  );
  const validMoves = hasAnyValidMove(initialGrid);
  const { starts } = countPairs(initialGrid);
  return {
    grid: initialGrid,
    spawnQueue: queue,
    score: 0,
    moves: 0,
    merges: 0,
    peak,
    seed,
    rngState: s2,
    gameOver: !validMoves,
    startedAt: Date.now(),
    lastMerge: null,
    recentStartCounts: [starts],
    nextTileId,
    algo,
    strength,
    softness,
    mode,
    modeState,
    currentTarget: INITIAL_TARGET,
    levelsCleared: 0,
    lastLevelUp: null,
    targetsEnabled,
    ratchetEnabled,
    ratchetFloor: ratchetEnabled ? RATCHET_INITIAL_FLOOR : 0,
    ratchetInterval: Math.max(1, ratchetInterval),
    undoStack: [],
    undoCharges: UNDO_INITIAL_CHARGES,
    levelGoal: null,
    levelGoalMet: false,
  };
}

export function undoLast(state: GameState): GameState {
  if (state.undoStack.length === 0 || state.undoCharges <= 0) return state;
  const snapshot = state.undoStack[state.undoStack.length - 1];
  // Constrained undo: revert merge consequences (grid, score, level/target,
  // peak, mode-state) but keep spawn-side state advanced. The queue and RNG
  // stay where they are, so undoing doesn't grant a free spawn re-roll.
  return {
    ...snapshot,
    spawnQueue: state.spawnQueue,
    rngState: state.rngState,
    nextTileId: state.nextTileId,
    undoStack: state.undoStack.slice(0, -1),
    undoCharges: state.undoCharges - 1,
  };
}

export type CommitPlan = {
  path: Coord[];
  chainIds: number[];
  chainValues: number[];
  landing: Coord;
  resultValue: number;
  resultId: number;
  duringFlight: Grid;
  afterMerge: Grid;
  afterGravity: Grid;
  afterRefill: Grid;
  moves: Array<{ id: number; from: Coord; to: Coord }>;
  spawns: SpawnRecord[];
  finalState: GameState;
} | null;

export function planCommit(state: GameState, path: Coord[]): CommitPlan {
  if (path.length < 2) return null;

  const tiles = path.map(({ r, c }) => state.grid[r][c]);
  if (tiles.some((t) => t === null)) return null;
  const chainTiles = tiles as Tile[];
  const chainIds = chainTiles.map((t) => t.id);

  const modeBehavior = getMode(state.mode);
  const validation = modeBehavior.validateCommit?.(state, chainTiles);
  if (validation && !validation.valid) return null;

  // Single-wild rule: if a path somehow contains 2+ wilds (shouldn't happen via
  // normal drag, but guard at commit time for safety).
  const wildCount = chainTiles.filter((t) => t.wild).length;
  if (wildCount > 1) return null;

  const landing = path[path.length - 1];
  const { values, resultValue, combo, comboBonus, scoreDelta } = resolveMerge(state, chainTiles, path, landing);

  let nextId = state.nextTileId;
  const resultId = nextId++;

  const animation = buildAnimationGrids(
    state.grid,
    path,
    landing,
    resultId,
    resultValue
  );
  const duringFlight = animation.duringFlight;
  let afterMerge = animation.afterMerge;

  // Apply endpoint-modifier effects (bomb radius clear, etc.) to afterMerge
  // before gravity runs.
  const endpointTile = chainTiles[chainTiles.length - 1];
  const endpointMod = getModifier(endpointTile);
  if (endpointMod?.onMergeAsEndpoint) {
    const patch = endpointMod.onMergeAsEndpoint(endpointTile, landing, {
      ...state,
      grid: afterMerge,
    });
    if (patch.grid) {
      // Preserve the merge-result tile at landing; bomb cleared neighbors.
      const merged = patch.grid.map((row) => row.slice());
      merged[landing.r][landing.c] = afterMerge[landing.r][landing.c];
      afterMerge = merged;
    }
  }

  // Adjacent-merge reactions: lock countdown, ice thaw, etc.
  const pathSet = new Set(path.map((p) => `${p.r},${p.c}`));
  const adjacentVisited = new Set<string>();
  for (const { r, c } of path) {
    for (const [nr, nc] of neighbors8(r, c, ROWS, COLS)) {
      const k = `${nr},${nc}`;
      if (pathSet.has(k) || adjacentVisited.has(k)) continue;
      adjacentVisited.add(k);
      const t = afterMerge[nr][nc];
      if (!t) continue;
      const m = getModifier(t);
      if (!m?.onAdjacentMerge) continue;
      afterMerge[nr][nc] = m.onAdjacentMerge(t, state);
    }
  }

  let postGravity = applyGravity(afterMerge);
  const moves = animation.moves;

  let newPeak = Math.max(computePeak(postGravity), state.peak);

  // Level-up board clear: if this commit will cross a target, sweep the N=3
  // lowest-value tiles to give the player breathing room. Skip the result tile,
  // anchored tiles (ignore gravity), locks, and ice (would feel cheap to clear
  // those as a bonus). Cross-tests Wave 2H modifier hooks.
  const willLevelUp = state.targetsEnabled && newPeak >= state.currentTarget;
  if (willLevelUp) {
    const candidates: Array<{ r: number; c: number; value: number }> = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = postGravity[r][c];
        if (!t) continue;
        if (t.id === resultId) continue;
        const mod = getModifier(t);
        if (mod?.ignoresGravity?.(t)) continue;
        if (t.modifier?.kind === "lock" || t.modifier?.kind === "ice") continue;
        candidates.push({ r, c, value: t.value });
      }
    }
    candidates.sort((a, b) => a.value - b.value || a.r - b.r || a.c - b.c);
    const sweep = candidates.slice(0, LEVELUP_SWEEP_COUNT);
    if (sweep.length > 0) {
      const swept = postGravity.map((row) => row.slice());
      for (const { r, c } of sweep) swept[r][c] = null;
      postGravity = applyGravity(swept);
      newPeak = Math.max(computePeak(postGravity), state.peak);
    }
  }
  const afterGravity = postGravity;

  const inject = injectModeSpawns(state, modeBehavior, afterGravity, state.rngState, nextId);

  const floor = resolveFloor(state, modeBehavior);
  const decorate = (ctx: { r: number; c: number; value: number; rngState: number }) => {
    let flags: Partial<Tile> = {};
    let rngState = ctx.rngState;
    if (modeBehavior.decorateSpawn) {
      const r = modeBehavior.decorateSpawn(state, { ...ctx, rngState });
      flags = { ...flags, ...r.flags };
      rngState = r.rngState;
    }
    if (!flags.modifier && !flags.boost && !flags.wild && !flags.beast) {
      const sb = maybeRollSandboxModifier(rngState);
      flags = { ...flags, ...sb.flags };
      rngState = sb.rngState;
    }
    return { flags, rngState };
  };

  const { grid: afterRefill, queue, rngState, nextTileId: afterSpawnNextId, spawns: refillSpawns } =
    refillFromQueue(
      inject.grid,
      state.spawnQueue,
      newPeak,
      inject.rngState,
      inject.nextTileId,
      state.algo,
      state.strength,
      state.softness,
      floor,
      decorate,
      levelPairingStrength(state.levelsCleared)
    );

  const allSpawns = [...inject.spawns, ...refillSpawns];

  const peakAfter = Math.max(newPeak, computePeak(afterRefill));
  const validAfter = hasAnyValidMove(afterRefill);
  const { starts } = countPairs(afterRefill);
  const trajectory = [...state.recentStartCounts, starts].slice(-12);

  const targets = processTargets(state, peakAfter);

  const finalState = buildFinalState(state, {
    modeBehavior,
    afterRefill,
    spawnQueue: queue,
    rngState,
    nextTileId: afterSpawnNextId,
    peakAfter,
    validAfter,
    trajectory,
    scoreDelta,
    landing,
    resultValue,
    chainValues: values,
    chainTiles,
    combo,
    comboBonus,
    targets,
    modeStatePatch: inject.modeStatePatch,
  });

  return {
    path,
    chainIds,
    chainValues: values,
    landing,
    resultValue,
    resultId,
    duringFlight,
    afterMerge,
    afterGravity,
    afterRefill,
    moves,
    spawns: allSpawns,
    finalState,
  };
}

export function commitChain(state: GameState, path: Coord[]): GameState {
  const plan = planCommit(state, path);
  return plan ? plan.finalState : state;
}
