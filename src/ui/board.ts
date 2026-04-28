import type { Board, Cell, TileValue } from '../game-session/index.js';

export const TILE = 76;
export const GAP = 4;
export const RADIUS = 8;

function tileOffset(index: number): number {
  return index * (TILE + GAP);
}

export function boardPixelWidth(cols: number): number {
  return cols * TILE + (cols - 1) * GAP;
}

export function boardPixelHeight(rows: number): number {
  return rows * TILE + (rows - 1) * GAP;
}

// Nearest-center hit detection: always returns the tile whose center is closest.
// This makes diagonal movement reliable — gaps are never "dead zones."
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
      const cx = tileOffset(c) + TILE / 2;
      const cy = tileOffset(r) + TILE / 2;
      const dist = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { row: r as Cell['row'], col: c as Cell['col'] };
      }
    }
  }
  return best;
}

// Hue wheel: low values → cool blues, higher → warm reds/golds
const TILE_COLORS: Readonly<Partial<Record<TileValue, string>>> = {
  2:    '#4a7fa5',
  4:    '#3a6fbf',
  8:    '#27ae60',
  16:   '#8bc34a',
  32:   '#f1c40f',
  64:   '#e67e22',
  128:  '#e74c3c',
  256:  '#c0392b',
  512:  '#9b59b6',
  1024: '#6c3483',
  2048: '#f39c12',
  4096: '#d4ac0d',
  8192: '#f5cba7',
};

function tileColor(value: TileValue): string {
  return TILE_COLORS[value] ?? '#555';
}

function textColor(value: TileValue): string {
  // Dark text on bright tiles
  if (value === 32 || value === 16 || value === 2048 || value === 4096 || value === 8192) {
    return '#222';
  }
  return '#fff';
}

function fontSize(value: TileValue): number {
  if (value >= 1000) return 18;
  if (value >= 100) return 22;
  return 26;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export interface RenderState {
  board: Board;
  chain: readonly Cell[];
  previewValue: TileValue | null;
  /** Cells that could validly extend the current chain (highlighted for player). */
  validExtensions: ReadonlySet<string>;
  rows: number;
  cols: number;
}

export function renderBoard(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { board, chain, previewValue, validExtensions, rows, cols } = s;

  const chainSet = new Set(chain.map(c => `${c.row},${c.col}`));
  const lastCell = chain[chain.length - 1];

  ctx.clearRect(0, 0, boardPixelWidth(cols), boardPixelHeight(rows));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = board[r]?.[c];
      if (tile === undefined) continue;

      const x = tileOffset(c);
      const y = tileOffset(r);
      const key = `${r},${c}`;
      const inChain = chainSet.has(key);
      const isLast = lastCell !== undefined && lastCell.row === r && lastCell.col === c;
      const isValidNext = validExtensions.has(key);

      if (tile.value === 0) {
        // Empty cell
        ctx.fillStyle = '#1a1a2e';
        roundRect(ctx, x, y, TILE, TILE, RADIUS);
        ctx.fill();
        continue;
      }

      // Tile background — dim tiles that can't extend the active chain
      const hasActiveChain = chainSet.size > 0;
      const color = tileColor(tile.value);
      let fillColor = color;
      if (inChain) fillColor = lighten(color, 0.35);
      else if (hasActiveChain && !isValidNext) fillColor = darken(color, 0.5);
      else if (tile.retired) fillColor = darken(color, 0.35);
      ctx.fillStyle = fillColor;
      roundRect(ctx, x, y, TILE, TILE, RADIUS);
      ctx.fill();

      if (tile.retired) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 14, y + TILE - 14);
        ctx.lineTo(x + TILE - 14, y + 14);
        ctx.moveTo(x + 24, y + TILE - 10);
        ctx.lineTo(x + TILE - 10, y + 24);
        ctx.stroke();
        ctx.restore();
      }

      // Chain highlight border; green pulse on valid-next tiles
      if (inChain) {
        ctx.strokeStyle = isLast ? '#ffffff' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = isLast ? 3 : 2;
        roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, RADIUS - 1);
        ctx.stroke();
      } else if (isValidNext) {
        ctx.strokeStyle = 'rgba(120,255,120,0.8)';
        ctx.lineWidth = 2;
        roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, RADIUS - 1);
        ctx.stroke();
      }

      // Value text
      ctx.fillStyle = textColor(tile.value);
      ctx.font = `bold ${fontSize(tile.value)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(tile.value), x + TILE / 2, y + TILE / 2);

      // Preview result badge on last chain cell
      if (isLast && previewValue !== null) {
        const bx = x + TILE - 28;
        const by = y + 4;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        roundRect(ctx, bx, by, 28, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`→${previewValue}`, bx + 14, by + 10);
      }
    }
  }

  // Draw chain path lines
  if (chain.length >= 2) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < chain.length; i++) {
      const cell = chain[i];
      if (cell === undefined) continue;
      const cx = tileOffset(cell.col) + TILE / 2;
      const cy = tileOffset(cell.row) + TILE / 2;
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
}

function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (v: number): number => Math.max(0, Math.round(v * (1 - amount)));
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

// Simple brightness boost without external deps
function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (v: number): number => Math.min(255, Math.round(v + (255 - v) * amount));
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}
