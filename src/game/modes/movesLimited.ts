import type { GameState, ModeState } from "../types";
import type { ModeBehavior } from "./types";

const INITIAL_MOVES = 50;
const MOVES_PER_LEVEL = 15;

function ms(state: GameState) {
  return state.modeState as Extract<ModeState, { kind: "movesLimited" }>;
}

export const movesLimited: ModeBehavior = {
  id: "movesLimited",
  label: "Moves Limited",
  initState: () => ({ kind: "movesLimited", movesRemaining: INITIAL_MOVES }),
  onMoveComplete: (state) => {
    const cur = ms(state);
    const next = cur.movesRemaining - 1;
    // Game ends on 0 moves remaining OR if the board already locked (falls
    // through to the default `state.gameOver` set upstream).
    const gameOver = next <= 0 ? true : state.gameOver;
    return {
      modeState: { kind: "movesLimited", movesRemaining: Math.max(0, next) },
      gameOver,
    };
  },
  onLevelUp: (state) => {
    const cur = ms(state);
    return {
      modeState: {
        kind: "movesLimited",
        movesRemaining: cur.movesRemaining + MOVES_PER_LEVEL,
      },
    };
  },
  hudLabel: (state) => {
    const cur = ms(state);
    return `Moves left: ${cur.movesRemaining}`;
  },
};
