import type { Board, Cell, TileValue } from '../game-session/index.js';
import {
  TILE, GAP, RADIUS,
  tileOriginX, tileOriginY,
  boardPixelWidth, boardPixelHeight,
  pixelToCell, roundRectPath,
} from './geometry.js';
import {
  tileTheme, formatTileValue, fitFontSize,
  EMPTY_CELL_FILL, EMPTY_CELL_BORDER,
  BOARD_VIGNETTE_INNER, BOARD_VIGNETTE_OUTER,
  RETIRED_CUT, RETIRED_FILM,
  VALID_NEXT_GLOW,
  CHAIN_TRAIL_HEAD, CHAIN_TRAIL_TAIL,
  FONT_DISPLAY,
} from './theme.js';
import { renderEffect, sampleTileAnim, tileCenter } from './effects.js';
import type { EffectQueue } from './effects.js';

export { TILE, GAP, RADIUS, boardPixelWidth, boardPixelHeight, pixelToCell };

export interface RenderState {
  board: Board;
  chain: readonly Cell[];
  previewValue: TileValue | null;
  validExtensions: ReadonlySet<string>;
  rows: number;
  cols: number;
  effects: EffectQueue;
  now: number;
}

export function renderBoard(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const { board, chain, previewValue, validExtensions, rows, cols, effects, now } = s;
  const W = boardPixelWidth(cols);
  const H = boardPixelHeight(rows);
  ctx.clearRect(0, 0, W, H);

  drawBoardBackdrop(ctx, W, H);

  const chainSet = new Set(chain.map(c => `${c.row},${c.col}`));
  const lastCell = chain[chain.length - 1];
  const hasActiveChain = chain.length > 0;
  const activeEffects = effects.active();

  // Pass 1: empty cells (drawn behind everything else)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = board[r]?.[c];
      if (tile === undefined || tile.value !== 0) continue;
      drawEmptyCell(ctx, c, r);
    }
  }

  // Pass 2: tile auras (so they layer below tile bodies but above empty cells)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = board[r]?.[c];
      if (tile === undefined || tile.value === 0) continue;
      const key = `${r},${c}`;
      const inChain = chainSet.has(key);
      const isLast = lastCell !== undefined && lastCell.row === r && lastCell.col === c;
      const isValidNext = validExtensions.has(key);
      const anim = sampleTileAnim(activeEffects, { row: r as Cell['row'], col: c as Cell['col'] }, now);
      drawTileAura(ctx, c, r, tile.value, {
        inChain, isLast, isValidNext, hasActiveChain,
        anim,
        retired: tile.retired,
        now,
      });
    }
  }

  // Pass 3: tile bodies + text
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = board[r]?.[c];
      if (tile === undefined || tile.value === 0) continue;
      const key = `${r},${c}`;
      const inChain = chainSet.has(key);
      const isLast = lastCell !== undefined && lastCell.row === r && lastCell.col === c;
      const isValidNext = validExtensions.has(key);
      const anim = sampleTileAnim(activeEffects, { row: r as Cell['row'], col: c as Cell['col'] }, now);
      drawTileBody(ctx, c, r, tile.value, tile.retired, {
        inChain, isLast, isValidNext, hasActiveChain,
        anim,
        now,
      });
    }
  }

  // Pass 4: chain trail above tiles
  if (chain.length >= 2) drawChainTrail(ctx, chain, now);

  // Pass 5: preview badge above everything
  if (lastCell !== undefined && previewValue !== null && chain.length >= 2) {
    drawPreviewBadge(ctx, lastCell, previewValue, now);
  }

  // Pass 6: effects (particles, flashes, confetti, sweeps)
  for (const e of activeEffects) {
    renderEffect(e, { ctx, now, boardW: W, boardH: H });
  }
}

function drawBoardBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  // Subtle radial vignette behind tiles
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
  grad.addColorStop(0, BOARD_VIGNETTE_INNER);
  grad.addColorStop(1, BOARD_VIGNETTE_OUTER);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawEmptyCell(ctx: CanvasRenderingContext2D, col: number, row: number): void {
  const x = tileOriginX(col);
  const y = tileOriginY(row);
  ctx.save();
  roundRectPath(ctx, x, y, TILE, TILE, RADIUS);
  ctx.fillStyle = EMPTY_CELL_FILL;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = EMPTY_CELL_BORDER;
  ctx.stroke();
  ctx.restore();
}

interface DrawOpts {
  inChain: boolean;
  isLast: boolean;
  isValidNext: boolean;
  hasActiveChain: boolean;
  anim: ReturnType<typeof sampleTileAnim>;
  now: number;
}

function drawTileAura(
  ctx: CanvasRenderingContext2D,
  col: number, row: number,
  value: TileValue,
  opts: DrawOpts & { retired: boolean },
): void {
  const x = tileOriginX(col);
  const y = tileOriginY(row);
  const cx = x + TILE / 2;
  const cy = y + TILE / 2 + opts.anim.yOffset;
  const theme = tileTheme(value);

  // Base aura — quiet for non-chain tiles, brighter for chain & last cell & valid next
  let auraStrength = 0.32;
  let auraRadius = TILE * 0.85;
  if (opts.inChain) { auraStrength = 0.85; auraRadius = TILE * 1.05; }
  if (opts.isLast) { auraStrength = 1.05; auraRadius = TILE * 1.2; }
  if (opts.isValidNext) {
    const pulse = 0.5 + 0.5 * Math.sin(opts.now / 220);
    auraStrength = 0.7 + pulse * 0.35;
    auraRadius = TILE * (1.0 + pulse * 0.1);
  }
  // Dim non-eligible tiles when chain is active
  if (opts.hasActiveChain && !opts.inChain && !opts.isValidNext) auraStrength *= 0.45;
  if (opts.retired) auraStrength *= 0.6;
  auraStrength += opts.anim.glowBoost;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(cx, cy, TILE * 0.15, cx, cy, auraRadius);
  grad.addColorStop(0, theme.glow);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.globalAlpha = Math.min(1, auraStrength);
  ctx.fillRect(cx - auraRadius, cy - auraRadius, auraRadius * 2, auraRadius * 2);
  ctx.restore();
}

function drawTileBody(
  ctx: CanvasRenderingContext2D,
  col: number, row: number,
  value: TileValue,
  retired: boolean,
  opts: DrawOpts,
): void {
  const x = tileOriginX(col);
  const y = tileOriginY(row);
  const cx = x + TILE / 2;
  const cy = y + TILE / 2 + opts.anim.yOffset;
  const theme = tileTheme(value);
  const scale = opts.anim.scale;

  ctx.save();
  ctx.globalAlpha = opts.anim.alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-TILE / 2, -TILE / 2);

  // Inactive dimming when chain active (lighten non-eligible)
  let bodyAlpha = 1;
  if (opts.hasActiveChain && !opts.inChain && !opts.isValidNext) bodyAlpha = 0.42;

  // Layered fill: vertical gradient from shine → fill
  const grad = ctx.createLinearGradient(0, 0, 0, TILE);
  grad.addColorStop(0, mixColor(theme.shine, theme.fill, 0.55));
  grad.addColorStop(0.55, theme.fill);
  grad.addColorStop(1, mixColor(theme.fill, '#000000', 0.35));

  ctx.save();
  ctx.globalAlpha = bodyAlpha;
  roundRectPath(ctx, 0, 0, TILE, TILE, RADIUS);
  ctx.fillStyle = grad;
  ctx.fill();

  // Inner top highlight — narrow band of shine across the top
  ctx.save();
  roundRectPath(ctx, 0, 0, TILE, TILE, RADIUS);
  ctx.clip();
  const shineGrad = ctx.createLinearGradient(0, 0, 0, TILE * 0.45);
  shineGrad.addColorStop(0, hexToRgba(theme.shine, 0.45));
  shineGrad.addColorStop(1, hexToRgba(theme.shine, 0));
  ctx.fillStyle = shineGrad;
  ctx.fillRect(0, 0, TILE, TILE * 0.45);
  ctx.restore();

  // Subtle inner shadow at bottom
  ctx.save();
  roundRectPath(ctx, 0, 0, TILE, TILE, RADIUS);
  ctx.clip();
  const shadowGrad = ctx.createLinearGradient(0, TILE * 0.5, 0, TILE);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = shadowGrad;
  ctx.fillRect(0, TILE * 0.5, TILE, TILE * 0.5);
  ctx.restore();

  // Hairline outer border
  roundRectPath(ctx, 0.5, 0.5, TILE - 1, TILE - 1, RADIUS);
  ctx.strokeStyle = hexToRgba(theme.shine, 0.35);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Retired film + cuts
  if (retired) {
    ctx.save();
    roundRectPath(ctx, 0, 0, TILE, TILE, RADIUS);
    ctx.fillStyle = RETIRED_FILM;
    ctx.fill();

    // Cross-hatch warning marks
    ctx.strokeStyle = RETIRED_CUT;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const inset = 14;
    ctx.beginPath();
    ctx.moveTo(inset, inset);
    ctx.lineTo(TILE - inset, TILE - inset);
    ctx.moveTo(TILE - inset, inset);
    ctx.lineTo(inset, TILE - inset);
    ctx.stroke();
    ctx.restore();
  }

  // Chain selection ring
  if (opts.inChain) {
    const ringStrength = opts.isLast ? 1 : 0.65;
    ctx.save();
    roundRectPath(ctx, 1.5, 1.5, TILE - 3, TILE - 3, RADIUS - 1);
    ctx.strokeStyle = `rgba(255,255,255,${ringStrength})`;
    ctx.lineWidth = opts.isLast ? 3 : 2;
    ctx.stroke();
    ctx.restore();
  } else if (opts.isValidNext) {
    const pulse = 0.55 + 0.45 * Math.sin(opts.now / 200);
    ctx.save();
    roundRectPath(ctx, 1.5, 1.5, TILE - 3, TILE - 3, RADIUS - 1);
    ctx.strokeStyle = VALID_NEXT_GLOW;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55 + pulse * 0.4;
    ctx.stroke();
    ctx.restore();
  }

  // Value text — auto-fit to tile width using compact-format
  const label = formatTileValue(value);
  const fz = fitFontSize(ctx, label, TILE - 16, FONT_DISPLAY);
  ctx.fillStyle = theme.text;
  ctx.font = `700 ${fz}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = retired ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.fillText(label, TILE / 2, TILE / 2 + 1);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.restore();
}

function drawChainTrail(
  ctx: CanvasRenderingContext2D,
  chain: readonly Cell[],
  now: number,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';

  // Outer soft trail
  ctx.strokeStyle = CHAIN_TRAIL_TAIL;
  ctx.lineWidth = 14;
  ctx.beginPath();
  for (let i = 0; i < chain.length; i++) {
    const cell = chain[i];
    if (cell === undefined) continue;
    const { cx, cy } = tileCenter(cell);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();

  // Inner bright core with animated dash
  const dashOffset = (now / 30) % 24;
  ctx.strokeStyle = CHAIN_TRAIL_HEAD;
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 14]);
  ctx.lineDashOffset = -dashOffset;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  for (let i = 0; i < chain.length; i++) {
    const cell = chain[i];
    if (cell === undefined) continue;
    const { cx, cy } = tileCenter(cell);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Bright nodes at each chain cell
  for (let i = 0; i < chain.length; i++) {
    const cell = chain[i];
    if (cell === undefined) continue;
    const { cx, cy } = tileCenter(cell);
    const r = i === chain.length - 1 ? 5 : 3;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8);
  }

  ctx.restore();
}

function drawPreviewBadge(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  value: TileValue,
  now: number,
): void {
  const x = tileOriginX(cell.col);
  const y = tileOriginY(cell.row);
  const theme = tileTheme(value);
  const text = `→ ${formatTileValue(value)}`;
  ctx.save();
  ctx.font = `700 12px ${FONT_DISPLAY}`;
  const metrics = ctx.measureText(text);
  const padX = 8;
  const w = Math.ceil(metrics.width) + padX * 2;
  const h = 22;
  const bx = x + TILE - w + 6;
  const by = y - h / 2;
  const bob = Math.sin(now / 200) * 1.5;

  // Soft drop shadow
  ctx.save();
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = 16;
  roundRectPath(ctx, bx, by + bob, w, h, 11);
  ctx.fillStyle = '#0a0c1a';
  ctx.fill();
  ctx.restore();

  // Border outline using tier glow color
  roundRectPath(ctx, bx, by + bob, w, h, 11);
  ctx.strokeStyle = theme.aura;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = theme.aura;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + w / 2, by + h / 2 + bob + 1);
  ctx.restore();
}

// ─── Color utilities ─────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (!hex.startsWith('#')) return { r: 128, g: 128, b: 128 }; // non-hex fallback (stale cache guard)
  const h = hex.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function hexToRgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function mixColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const mix = (x: number, y: number): number => Math.round(x + (y - x) * t);
  return `rgb(${mix(ca.r, cb.r)},${mix(ca.g, cb.g)},${mix(ca.b, cb.b)})`;
}
