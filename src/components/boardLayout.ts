import { COLS, ROWS } from "../game/types";

export const CELL_SIZE = 64;
export const GAP = 8;

// Functions (not constants) so they re-read the live ROWS/COLS bindings
// every time the board re-renders. The board size is a runtime config.
export function boardWidth(): number {
  return COLS * CELL_SIZE + (COLS + 1) * GAP;
}

export function boardHeight(): number {
  return ROWS * CELL_SIZE + (ROWS + 1) * GAP;
}

export function cellOrigin(r: number, c: number): { x: number; y: number } {
  return {
    x: GAP + c * (CELL_SIZE + GAP),
    y: GAP + r * (CELL_SIZE + GAP),
  };
}

export function cellCenter(r: number, c: number): { x: number; y: number } {
  const o = cellOrigin(r, c);
  return { x: o.x + CELL_SIZE / 2, y: o.y + CELL_SIZE / 2 };
}
