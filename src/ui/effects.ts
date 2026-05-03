import type { Cell, TileValue } from '../game-session/index.js';
import { EASE, DURATION, tileTheme } from './theme.js';
import { TILE, GAP } from './geometry.js';

export type Effect =
  | { type: 'tile-spawn'; cell: Cell; value: TileValue; start: number; duration: number }
  | { type: 'tile-pop'; cell: Cell; value: TileValue; start: number; duration: number }
  | { type: 'particle-burst'; cx: number; cy: number; color: string; count: number; start: number; duration: number; spread: number }
  | { type: 'shockwave'; cx: number; cy: number; color: string; maxRadius: number; start: number; duration: number }
  | { type: 'flash'; rect: Rect; color: string; start: number; duration: number }
  | { type: 'screen-pulse'; color: string; start: number; duration: number }
  | { type: 'retirement-sweep'; tier: TileValue; start: number; duration: number }
  | { type: 'conquest-confetti'; tier: TileValue; start: number; duration: number; pieces: ConfettiPiece[] };

export interface Rect { x: number; y: number; w: number; h: number }

export interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  color: string;
  size: number;
}

export function tileCenter(cell: Cell): { cx: number; cy: number } {
  const cx = cell.col * (TILE + GAP) + TILE / 2;
  const cy = cell.row * (TILE + GAP) + TILE / 2;
  return { cx, cy };
}

export class EffectQueue {
  private effects: Effect[] = [];

  push(effect: Effect): void {
    this.effects.push(effect);
  }

  prune(now: number): void {
    this.effects = this.effects.filter(e => now - e.start < e.duration);
  }

  active(): readonly Effect[] {
    return this.effects;
  }

  hasActive(): boolean {
    return this.effects.length > 0;
  }

  clear(): void {
    this.effects = [];
  }
}

export function spawnParticleBurst(cell: Cell, value: TileValue, count = 14): Effect {
  const { cx, cy } = tileCenter(cell);
  return {
    type: 'particle-burst',
    cx, cy,
    color: tileTheme(value).aura,
    count,
    spread: TILE * 1.4,
    start: performance.now(),
    duration: DURATION.burst,
  };
}

export function spawnShockwave(cell: Cell, value: TileValue): Effect {
  const { cx, cy } = tileCenter(cell);
  return {
    type: 'shockwave',
    cx, cy,
    color: tileTheme(value).aura,
    maxRadius: TILE * 1.9,
    start: performance.now(),
    duration: DURATION.burst,
  };
}

export function spawnFlash(cell: Cell, value: TileValue): Effect {
  const { cx, cy } = tileCenter(cell);
  return {
    type: 'flash',
    rect: { x: cx - TILE / 2 - 6, y: cy - TILE / 2 - 6, w: TILE + 12, h: TILE + 12 },
    color: tileTheme(value).shine,
    start: performance.now(),
    duration: DURATION.flash,
  };
}

export function spawnTileSpawn(cell: Cell, value: TileValue): Effect {
  return {
    type: 'tile-spawn',
    cell,
    value,
    start: performance.now(),
    duration: DURATION.spawn,
  };
}

export function spawnTilePop(cell: Cell, value: TileValue): Effect {
  return {
    type: 'tile-pop',
    cell,
    value,
    start: performance.now(),
    duration: DURATION.pop,
  };
}

export function spawnScreenPulse(value: TileValue): Effect {
  return {
    type: 'screen-pulse',
    color: tileTheme(value).aura,
    start: performance.now(),
    duration: DURATION.shimmer,
  };
}

export function spawnRetirementSweep(tier: TileValue): Effect {
  return {
    type: 'retirement-sweep',
    tier,
    start: performance.now(),
    duration: DURATION.retirementPulse,
  };
}

export function spawnConquestConfetti(boardW: number, boardH: number, tier: TileValue): Effect {
  const theme = tileTheme(tier);
  const palette = [theme.aura, theme.shine, '#fff7d6', '#ffffff', theme.fill];
  const pieces: ConfettiPiece[] = [];
  const count = 80;
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
    const speed = 320 + Math.random() * 460;
    pieces.push({
      x: boardW / 2 + (Math.random() - 0.5) * boardW * 0.6,
      y: boardH * 0.55,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 12,
      color: palette[Math.floor(Math.random() * palette.length)] ?? '#fff',
      size: 4 + Math.random() * 8,
    });
  }
  return {
    type: 'conquest-confetti',
    tier,
    start: performance.now(),
    duration: DURATION.conquest,
    pieces,
  };
}

// ─── Effect rendering ─────────────────────────────────────────────────────

export interface EffectRenderCtx {
  ctx: CanvasRenderingContext2D;
  now: number;
  boardW: number;
  boardH: number;
}

export function renderEffect(effect: Effect, r: EffectRenderCtx): void {
  const t = (r.now - effect.start) / effect.duration;
  if (t < 0 || t > 1) return;

  switch (effect.type) {
    case 'particle-burst':
      renderParticleBurst(effect, t, r.ctx);
      break;
    case 'shockwave':
      renderShockwave(effect, t, r.ctx);
      break;
    case 'flash':
      renderFlash(effect, t, r.ctx);
      break;
    case 'screen-pulse':
      renderScreenPulse(effect, t, r);
      break;
    case 'retirement-sweep':
      renderRetirementSweep(effect, t, r);
      break;
    case 'conquest-confetti':
      renderConfetti(effect, t, r);
      break;
    case 'tile-spawn':
    case 'tile-pop':
      // Handled inline in board renderer (transform during tile draw)
      break;
  }
}

function renderParticleBurst(effect: Extract<Effect, { type: 'particle-burst' }>, t: number, ctx: CanvasRenderingContext2D): void {
  const eased = EASE.outCubic(t);
  const fade = 1 - t;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < effect.count; i++) {
    const angle = (i / effect.count) * Math.PI * 2 + effect.start * 0.01;
    const dist = effect.spread * eased;
    const x = effect.cx + Math.cos(angle) * dist;
    const y = effect.cy + Math.sin(angle) * dist;
    const r = 4 * (1 - t * 0.5);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    grad.addColorStop(0, effect.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.arc(x, y, r * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderShockwave(effect: Extract<Effect, { type: 'shockwave' }>, t: number, ctx: CanvasRenderingContext2D): void {
  const eased = EASE.outQuint(t);
  const r = effect.maxRadius * eased;
  const fade = 1 - t;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = effect.color;
  ctx.globalAlpha = fade * 0.85;
  ctx.lineWidth = 4 * (1 - t * 0.6);
  ctx.beginPath();
  ctx.arc(effect.cx, effect.cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderFlash(effect: Extract<Effect, { type: 'flash' }>, t: number, ctx: CanvasRenderingContext2D): void {
  const fade = 1 - t;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const cx = effect.rect.x + effect.rect.w / 2;
  const cy = effect.rect.y + effect.rect.h / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, effect.rect.w * 0.85);
  grad.addColorStop(0, effect.color);
  grad.addColorStop(0.6, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.globalAlpha = fade;
  ctx.fillRect(effect.rect.x - 30, effect.rect.y - 30, effect.rect.w + 60, effect.rect.h + 60);
  ctx.restore();
}

function renderScreenPulse(effect: Extract<Effect, { type: 'screen-pulse' }>, t: number, r: EffectRenderCtx): void {
  const fade = 1 - t;
  const ctx = r.ctx;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(r.boardW / 2, r.boardH / 2, 0, r.boardW / 2, r.boardH / 2, Math.max(r.boardW, r.boardH));
  grad.addColorStop(0, effect.color);
  grad.addColorStop(0.4, 'rgba(255,255,255,0.04)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.globalAlpha = fade * 0.5;
  ctx.fillRect(0, 0, r.boardW, r.boardH);
  ctx.restore();
}

function renderRetirementSweep(effect: Extract<Effect, { type: 'retirement-sweep' }>, t: number, r: EffectRenderCtx): void {
  const ctx = r.ctx;
  const theme = tileTheme(effect.tier);
  const fade = 1 - EASE.outCubic(t);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createLinearGradient(0, 0, 0, r.boardH);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, theme.aura);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.globalAlpha = fade * 0.35;
  ctx.fillRect(0, 0, r.boardW, r.boardH);
  ctx.restore();
}

function renderConfetti(effect: Extract<Effect, { type: 'conquest-confetti' }>, t: number, r: EffectRenderCtx): void {
  const ctx = r.ctx;
  const elapsed = (r.now - effect.start) / 1000;
  const gravity = 720;
  const fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
  ctx.save();
  for (const p of effect.pieces) {
    const x = p.x + p.vx * elapsed;
    const y = p.y + p.vy * elapsed + 0.5 * gravity * elapsed * elapsed;
    if (y > r.boardH + 40) continue;
    const rot = p.rot + p.vrot * elapsed;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = fade;
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
  ctx.restore();
}

// ─── Tile-anim helpers (sampled by board renderer per-frame) ─────────────

export interface TileAnimState {
  scale: number;
  alpha: number;
  yOffset: number;
  glowBoost: number;
}

export function sampleTileAnim(
  effects: readonly Effect[],
  cell: Cell,
  now: number,
): TileAnimState {
  let scale = 1;
  let alpha = 1;
  let yOffset = 0;
  let glowBoost = 0;
  for (const e of effects) {
    if (e.type !== 'tile-spawn' && e.type !== 'tile-pop') continue;
    if (e.cell.row !== cell.row || e.cell.col !== cell.col) continue;
    const t = (now - e.start) / e.duration;
    if (t < 0 || t > 1) continue;
    if (e.type === 'tile-spawn') {
      const eased = EASE.outBack(t, 1.4);
      scale = 0.4 + eased * 0.6;
      alpha = Math.min(1, t * 2);
      yOffset = -TILE * 0.7 * (1 - eased);
      glowBoost = (1 - t) * 0.6;
    } else {
      // tile-pop: punch up then settle
      const peak = 0.35;
      if (t < peak) {
        scale = 1 + (t / peak) * 0.18;
        glowBoost = t / peak;
      } else {
        const k = (t - peak) / (1 - peak);
        scale = 1.18 - EASE.outCubic(k) * 0.18;
        glowBoost = (1 - k) * 0.9;
      }
    }
  }
  return { scale, alpha, yOffset, glowBoost };
}
