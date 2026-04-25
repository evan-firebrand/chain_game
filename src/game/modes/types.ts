import type { GameMode, GameState, Grid, ModeState, Tile } from "../types";

export type DecorateSpawnCtx = {
  r: number;
  c: number;
  value: number;
  rngState: number;
};

export type DecorateSpawnResult = {
  flags: Partial<Tile>;
  rngState: number;
};

export type InjectSpawnsResult = {
  spawns: Array<{ col: number; value: number; flags: Partial<Tile> }>;
  rngState: number;
  nextState: Partial<GameState>;
};

export type CommitValidation = { valid: boolean; reason?: string };

export type ModeBehavior = {
  id: GameMode;
  label: string;
  initState(): ModeState;
  onMoveComplete?(state: GameState): Partial<GameState>;
  spawnFloor?(state: GameState): number;
  // If the mode's spawn floor will rise at a knowable point, return the value
  // the floor will take at the next rise. Used to flag fragile tiles — ones that
  // will be invalidated when the floor moves past them. Return null/undefined if
  // no rise is scheduled (Classic, Boost).
  nextFloor?(state: GameState): number | null;
  chainMultiplier?(chain: Tile[], state: GameState): number;
  // Per-tile spawn decoration: lets a mode flag fresh spawns (boost, wild, …).
  // Replaces the older `boostProbability` hook.
  decorateSpawn?(state: GameState, ctx: DecorateSpawnCtx): DecorateSpawnResult;
  // Off-queue spawn injection (e.g., Wilds beasts). Runs after gravity and
  // before the normal queue refill. Returned spawns are placed at the top of
  // the requested column.
  injectSpawns?(
    state: GameState,
    grid: Grid,
    rngState: number,
    nextTileId: number
  ): InjectSpawnsResult;
  // Fired after a chain merges, before onMoveComplete. Mode reads the chain
  // tiles to update internal state (spirit, trophy stats).
  onChainResolved?(state: GameState, chainTiles: Tile[], result: number): Partial<GameState>;
  // Pre-commit gate. Lets a mode reject a chain (e.g., beast must be in a 3+ chain).
  validateCommit?(state: GameState, chainTiles: Tile[]): CommitValidation;
  // Fired when the player crosses a target threshold. Mode-state side-effects
  // (e.g. movesLimited grants extra moves on level-up).
  onLevelUp?(state: GameState): Partial<GameState>;
  hudLabel?(state: GameState): string;
};
