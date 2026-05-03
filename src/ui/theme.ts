import type { TileValue } from '../game-session/index.js';

export const FONT_DISPLAY = "'Unbounded', 'Inter', system-ui, sans-serif";
export const FONT_MONO = "'DM Mono', 'JetBrains Mono', ui-monospace, monospace";

export interface TileTheme {
  readonly fill: string;
  readonly shine: string;
  readonly glow: string;
  readonly text: string;
  readonly aura: string;
}

const TIER_THEMES: Readonly<Partial<Record<TileValue, TileTheme>>> = {
  2:    { fill: '#3b6ea5', shine: '#7eb6e8', glow: 'rgba(126,182,232,0.55)', text: '#f3f9ff', aura: '#7eb6e8' },
  4:    { fill: '#2c4dab', shine: '#6e89f0', glow: 'rgba(110,137,240,0.55)', text: '#f4f6ff', aura: '#6e89f0' },
  8:    { fill: '#1c8f56', shine: '#5ee2a0', glow: 'rgba(94,226,160,0.55)',  text: '#f0fff5', aura: '#5ee2a0' },
  16:   { fill: '#83c63a', shine: '#d4f291', glow: 'rgba(212,242,145,0.6)',  text: '#1c2200', aura: '#cfee8c' },
  32:   { fill: '#e8b500', shine: '#fff09e', glow: 'rgba(255,224,90,0.7)',   text: '#241a00', aura: '#ffe05a' },
  64:   { fill: '#e07520', shine: '#ffb573', glow: 'rgba(255,160,80,0.7)',   text: '#fff7ee', aura: '#ffa050' },
  128:  { fill: '#d63b3a', shine: '#ff8a86', glow: 'rgba(255,90,80,0.75)',   text: '#fff5f4', aura: '#ff5a50' },
  256:  { fill: '#b32325', shine: '#ff5b6c', glow: 'rgba(255,75,90,0.8)',    text: '#fff2f3', aura: '#ff4b5a' },
  512:  { fill: '#8a3fb0', shine: '#cf83ee', glow: 'rgba(207,131,238,0.75)', text: '#faf3ff', aura: '#cf83ee' },
  1024: { fill: '#5a1f7a', shine: '#a866d6', glow: 'rgba(168,102,214,0.85)', text: '#f7eeff', aura: '#a866d6' },
  2048: { fill: '#e89a08', shine: '#ffd86b', glow: 'rgba(255,200,60,0.95)',  text: '#241a00', aura: '#ffc83c' },
  4096: { fill: '#c79006', shine: '#ffe079', glow: 'rgba(255,205,80,0.95)',  text: '#241a00', aura: '#ffcd50' },
  8192: { fill: '#dfb787', shine: '#fff2dd', glow: 'rgba(255,235,200,1)',    text: '#1c1408', aura: '#fff2dd' },
};

export const EMPTY_CELL_FILL = 'rgba(18, 22, 38, 0.55)';
export const EMPTY_CELL_BORDER = 'rgba(110, 130, 180, 0.08)';
export const BOARD_VIGNETTE_INNER = 'rgba(40, 50, 90, 0.18)';
export const BOARD_VIGNETTE_OUTER = 'rgba(0, 0, 0, 0)';
export const RETIRED_CUT = 'rgba(255, 90, 90, 0.85)';
export const RETIRED_FILM = 'rgba(8, 10, 22, 0.55)';
export const VALID_NEXT_GLOW = 'rgba(180, 255, 200, 0.95)';
export const CHAIN_TRAIL_HEAD = 'rgba(255, 255, 255, 1)';
export const CHAIN_TRAIL_TAIL = 'rgba(180, 220, 255, 0.15)';

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * sl;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const toHex = (v: number): string => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Procedural palette for high tiers (>8192). Cycles hue, brightness ramps deeper
// so successive tier conquests feel distinct without inventing 30+ hand-tuned colors.
function highTierTheme(value: TileValue): TileTheme {
  const log = Math.log2(value);
  const tierIndex = Math.floor(log) - 13;
  const family = tierIndex % 4;
  const hue = (tierIndex * 47) % 360;
  const sat = 70;
  const light = 52 - Math.min(20, tierIndex * 1.6);
  const shineH = (hue + 18) % 360;
  const fillL = Math.max(28, light);
  const shineL = Math.min(78, light + 30);
  const auraL = Math.min(72, light + 22);
  const fill = hslToHex(hue, sat, fillL);
  const shine = hslToHex(shineH, sat, shineL);
  const aura = hslToHex(shineH, sat, auraL);
  const { r, g, b } = hexToRgbComponents(aura);
  const glow = `rgba(${r},${g},${b},0.7)`;
  const text = family === 0 || family === 2 ? '#0c0814' : '#fff7e8';
  return { fill, shine, glow, text, aura };
}

function hexToRgbComponents(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function tileTheme(value: TileValue): TileTheme {
  const known = TIER_THEMES[value];
  if (known !== undefined) return known;
  if (value > 8192) return highTierTheme(value);
  return {
    fill: '#3a3f55',
    shine: '#6a7090',
    glow: 'rgba(120,130,170,0.4)',
    text: '#eef0fa',
    aura: '#6a7090',
  };
}

/**
 * Compact-format a tile value for display:
 *   < 10000  → as-is ("8192")
 *   < 1e6    → "16K", "131K"
 *   < 1e9    → "1.0M", "131M"
 *   < 1e12   → "2.1B"
 *   else     → "1.2T" / "4.5Q"
 * Prevents 8+ digit numbers from bleeding across tiles.
 */
export function formatTileValue(value: TileValue): string {
  if (value < 10000) return String(value);
  if (value < 1_000_000) return `${Math.round(value / 1000)}K`;
  if (value < 1_000_000_000) return formatWithUnit(value, 1_000_000, 'M');
  if (value < 1_000_000_000_000) return formatWithUnit(value, 1_000_000_000, 'B');
  if (value < 1_000_000_000_000_000) return formatWithUnit(value, 1_000_000_000_000, 'T');
  return formatWithUnit(value, 1_000_000_000_000_000, 'Q');
}

function formatWithUnit(value: number, unit: number, suffix: string): string {
  const v = value / unit;
  if (v >= 100) return `${Math.round(v)}${suffix}`;
  if (v >= 10) return `${v.toFixed(1).replace(/\.0$/, '')}${suffix}`;
  return `${v.toFixed(2).replace(/\.?0+$/, '')}${suffix}`;
}

/**
 * Pick a font size that lets `text` fit in the tile width.
 * Caller passes the canvas ctx so we can measure with the active font family.
 */
export function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontFamily: string,
  weight = 700,
  ceil = 28,
  floor = 11,
): number {
  for (let size = ceil; size >= floor; size -= 1) {
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  return floor;
}

export const EASE = {
  outCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  outQuint: (t: number): number => 1 - Math.pow(1 - t, 5),
  inCubic: (t: number): number => t * t * t,
  inOutCubic: (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number, k = 1.70158): number => {
    const c3 = k + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2);
  },
  outElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
} as const;

export const DURATION = {
  spawn: 360,
  pop: 420,
  burst: 540,
  flash: 240,
  shimmer: 900,
  retirementPulse: 900,
  conquest: 1800,
  hudCount: 380,
} as const;
