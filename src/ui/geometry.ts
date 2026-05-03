import type { Cell } from '../game-session/index.js';

export const TILE = 76;
export const GAP = 6;
export const RADIUS = 14;

export function tileOriginX(col: number): number {
  return col * (TILE + GAP);
}

export function tileOriginY(row: number): number {
  return row * (TILE + GAP);
}

export function boardPixelWidth(cols: number): number {
  return cols * TILE + (cols - 1) * GAP;
}

export function boardPixelHeight(rows: number): number {
  return rows * TILE + (rows - 1) * GAP;
}

export function pixelToCell(
  x: number,
  y: number,
  rows: number,
  cols: number,
): Cell | null {
  if (rows === 0 || cols === 0) return null;
  let best: Cell | null = null;
  let bestDist = Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = tileOriginX(c) + TILE / 2;
      const cy = tileOriginY(r) + TILE / 2;
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d < bestDist) {
        bestDist = d;
        best = { row: r as Cell['row'], col: c as Cell['col'] };
      }
    }
  }
  return best;
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
