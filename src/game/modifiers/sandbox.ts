import type { Tile, TileModifier, Grid } from "../types";
import { rngStep } from "../rng";

// Dev-only modifier sandbox. A module-level rate that engine consults during
// spawn decoration. UI sets it via setSandboxRate; engine reads via maybeRoll.
// Not persisted — resets to 0 on reload to avoid surprising fresh sessions.

let sandboxRate = 0;

export function setSandboxRate(rate: number): void {
  sandboxRate = Math.max(0, Math.min(1, rate));
}
export function getSandboxRate(): number {
  return sandboxRate;
}

const KINDS: TileModifier["kind"][] = [
  "wildcard",
  "lock",
  "bomb",
  "ice",
  "anchor",
  "splitter",
  "multiplier",
];

// Lock/ice/multiplier disable chaining on the tile they're attached to. If we
// stamp them too densely the board becomes unplayable. The weighted picker
// favors chain-friendly modifiers (bomb, anchor, splitter, wildcard) so even at
// high stamp ratios there's still a path through.
const KIND_WEIGHTS: Record<TileModifier["kind"], number> = {
  wildcard: 4,
  bomb: 4,
  anchor: 3,
  splitter: 3,
  multiplier: 2,
  lock: 1,
  ice: 1,
};

function pickKind(rand: number): TileModifier["kind"] {
  const total = KINDS.reduce((sum, k) => sum + KIND_WEIGHTS[k], 0);
  let r = rand * total;
  for (const k of KINDS) {
    r -= KIND_WEIGHTS[k];
    if (r < 0) return k;
  }
  return KINDS[0];
}

function makeModifier(kind: TileModifier["kind"]): TileModifier {
  switch (kind) {
    case "wildcard":
      return { kind: "wildcard" };
    case "lock":
      return { kind: "lock", clearsRemaining: 3 };
    case "bomb":
      return { kind: "bomb", radius: 1 };
    case "ice":
      return { kind: "ice", thawIn: 5 };
    case "anchor":
      return { kind: "anchor" };
    case "splitter":
      return { kind: "splitter" };
    case "multiplier":
      return { kind: "multiplier", factor: 2 };
  }
}

// Rolls against sandboxRate. Returns a modifier flag patch + advanced rngState,
// or { flags: {}, rngState } when no modifier should attach.
export function maybeRollSandboxModifier(rngState: number): {
  flags: Partial<Tile>;
  rngState: number;
} {
  if (sandboxRate <= 0) return { flags: {}, rngState };
  const a = rngStep(rngState);
  if (a.value >= sandboxRate) return { flags: {}, rngState: a.state };
  const b = rngStep(a.state);
  return {
    flags: { modifier: makeModifier(pickKind(b.value)) },
    rngState: b.state,
  };
}

// Instantly stamp ~ratio of board tiles with random modifiers. Used by the dev
// "Stamp board" button so the user can test mechanics without grinding spawns.
export function stampRandomModifiers(grid: Grid, ratio = 0.4): Grid {
  return grid.map((row) =>
    row.map((t) => {
      if (!t || t.modifier || t.boost || t.wild || t.beast) return t;
      if (Math.random() >= ratio) return t;
      return { ...t, modifier: makeModifier(pickKind(Math.random())) };
    })
  );
}
