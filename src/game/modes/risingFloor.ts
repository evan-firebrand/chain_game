import { makeSpawnQueue } from "../spawn";
import type { GameState, ModeState } from "../types";
import { COLS, ROWS, queueLenFor } from "../types";
import type { ModeBehavior } from "./types";

export const RAISE_INTERVAL = 10;
const INITIAL_FLOOR = 2;

function ms(state: GameState) {
  return state.modeState as Extract<ModeState, { kind: "risingFloor" }>;
}

export const risingFloor: ModeBehavior = {
  id: "risingFloor",
  label: "Rising Floor",
  initState: () => ({
    kind: "risingFloor",
    floor: INITIAL_FLOOR,
    movesToRaise: RAISE_INTERVAL,
  }),
  spawnFloor: (state) => ms(state).floor,
  nextFloor: (state) => ms(state).floor * 2,
  onMoveComplete: (state) => {
    const cur = ms(state);
    const next = cur.movesToRaise - 1;
    if (next <= 0) {
      const newFloor = cur.floor * 2;
      const { queue, rngState } = makeSpawnQueue(
        COLS,
        queueLenFor(state.algo),
        state.peak,
        state.rngState,
        state.algo,
        state.grid,
        state.strength,
        state.softness,
        newFloor
      );
      // Collect IDs of tiles now below the new floor — they're stranded and get
      // a brief visual flash so the player can see what the rise just orphaned.
      const lastStrandedIds: number[] = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const t = state.grid[r][c];
          if (t && t.value < newFloor) lastStrandedIds.push(t.id);
        }
      }
      return {
        modeState: {
          kind: "risingFloor",
          floor: newFloor,
          movesToRaise: RAISE_INTERVAL,
          lastStrandedIds,
        },
        spawnQueue: queue,
        rngState,
      };
    }
    return {
      modeState: { kind: "risingFloor", floor: cur.floor, movesToRaise: next },
    };
  },
  hudLabel: (state) => {
    const cur = ms(state);
    return `Floor ${cur.floor} · raises in ${cur.movesToRaise}`;
  },
};
