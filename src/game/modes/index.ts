import type { GameMode } from "../types";
import type { ModeBehavior } from "./types";
import { classic } from "./classic";
import { risingFloor } from "./risingFloor";
import { boost } from "./boost";
import { movesLimited } from "./movesLimited";
import { wilds } from "./wilds";

const REGISTRY: Record<GameMode, ModeBehavior> = {
  classic,
  risingFloor,
  boost,
  movesLimited,
  wilds,
};

export function getMode(id: GameMode): ModeBehavior {
  return REGISTRY[id];
}

export type { ModeBehavior };
