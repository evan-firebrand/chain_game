import type { Tile, TileModifier, GameState, Coord } from "../types";

// Strategy interface for tile modifiers. Mirrors ModeBehavior but per-tile.
// All hooks are optional — the registry returns defaults that preserve current
// engine behavior when a modifier doesn't override.
export type ModifierBehavior = {
  kind: TileModifier["kind"];

  // Chain participation. Default true for both.
  canChainStart?: (tile: Tile) => boolean;
  canChainThrough?: (tile: Tile) => boolean;

  // Override the value the tile contributes to the merge sum.
  effectiveValue?: (tile: Tile, neighbors: { prev?: Tile; next?: Tile }) => number;

  // Fired when this tile is the chain's landing endpoint after a merge resolves.
  onMergeAsEndpoint?: (
    tile: Tile,
    landing: Coord,
    state: GameState
  ) => Partial<GameState>;

  // Fired when an adjacent merge happened (for lock countdown, ice thaw, etc.).
  onAdjacentMerge?: (tile: Tile, state: GameState) => Tile | null;

  // Per-move tick (ice thaw countdown, etc.).
  onMoveTick?: (tile: Tile, state: GameState) => Tile | null;

  // True if gravity should skip this tile (anchor).
  ignoresGravity?: (tile: Tile) => boolean;

  // Transform the merge result tile (splitter halves; etc.).
  transformResult?: (
    tile: Tile,
    resultValue: number,
    landing: Coord,
    state: GameState
  ) => { resultValue: number; sideEffects?: Partial<GameState> };

  // Multiplier applied to chain score when this tile sits adjacent (multiplier tile)
  // or participates in the chain.
  chainScoreMultiplier?: (tile: Tile, chain: Tile[]) => number;

  // Classification badge for tileClassification.
  classify?: (tile: Tile) => "frozen" | "locked" | "anchored" | "bomb" | null;
};
