import type { GameState, ModeState, WildsStats } from "./types";

const KEY = "2248.trophyWall";

export type TrophyWall = WildsStats & {
  bestScore: number;
  bestPeak: number;
  updatedAt: number;
};

const EMPTY: TrophyWall = {
  beastsDefeated: 0,
  maxBeastValueDefeated: 0,
  wildsConsumed: 0,
  frenziesActivated: 0,
  bestScore: 0,
  bestPeak: 0,
  updatedAt: 0,
};

export function readTrophyWall(): TrophyWall {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch {
    return { ...EMPTY };
  }
}

// Best-ever semantics: each field stores the max across runs.
export function recordRun(state: GameState): TrophyWall {
  const cur = readTrophyWall();
  if (state.mode !== "wilds" || state.modeState.kind !== "wilds") return cur;
  const ms = state.modeState as Extract<ModeState, { kind: "wilds" }>;
  const next: TrophyWall = {
    beastsDefeated: Math.max(cur.beastsDefeated, ms.stats.beastsDefeated),
    maxBeastValueDefeated: Math.max(cur.maxBeastValueDefeated, ms.stats.maxBeastValueDefeated),
    wildsConsumed: Math.max(cur.wildsConsumed, ms.stats.wildsConsumed),
    frenziesActivated: Math.max(cur.frenziesActivated, ms.stats.frenziesActivated),
    bestScore: Math.max(cur.bestScore, state.score),
    bestPeak: Math.max(cur.bestPeak, state.peak),
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function clearTrophyWall(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
