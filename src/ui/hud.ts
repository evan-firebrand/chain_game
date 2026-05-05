import type { Board, GameState, TileValue } from '../game-session/index.js';
import { tileTheme, formatTileValue } from './theme.js';

export type LifecyclePhase = 'free-play' | 'cleanup' | 'conquest';
export type TierState = 'in-progress' | 'conquered';

export interface TierStatus {
  readonly value: TileValue;
  readonly state: TierState;
}

export interface HudElements {
  root: HTMLElement;
  title: HTMLElement;
  turn: HTMLElement;
  maxTile: HTMLElement;
  spawnPool: HTMLElement;
  chainValue: HTMLElement;
  chainStat: HTMLElement;
  phase: HTMLElement;
  toolbar: HTMLElement;
  tierBadges: HTMLElement;
  gameOver: HTMLElement;
  tuningToggle: HTMLButtonElement;
  banner: HTMLElement;
}

interface HudCache {
  turn: number;
  max: TileValue;
  pool: string;
  chain: number | null;
}

const cache = new WeakMap<HudElements, HudCache>();

export function createHud(container: HTMLElement): HudElements {
  const root = document.createElement('header');
  root.className = 'hud-root';

  const branding = document.createElement('div');
  branding.className = 'hud-branding';
  branding.innerHTML = `
    <div class="hud-mark">
      <span class="hud-mark-glyph">⌬</span>
      <span class="hud-mark-word">CHAIN</span>
    </div>
    <div class="hud-phase" id="hud-phase" data-phase="free-play">
      <span class="hud-phase-dot" aria-hidden="true"></span>
      <span class="hud-phase-label">Free Play</span>
    </div>
    <div class="hud-toolbar">
      <button type="button" class="hud-tuning-toggle" aria-label="Toggle tuning panel">
        <span class="hud-tuning-icon">⚙</span>
        <span class="hud-tuning-label">TUNING</span>
      </button>
    </div>
  `;
  root.appendChild(branding);

  const stats = document.createElement('div');
  stats.className = 'hud-stats';
  stats.innerHTML = `
    <div class="hud-stat" data-stat="turn">
      <span class="hud-label">turn</span>
      <span class="hud-value" id="hud-turn">0</span>
    </div>
    <div class="hud-stat" data-stat="chain" id="hud-chain-stat">
      <span class="hud-label">chain</span>
      <span class="hud-value hud-value--accent" id="hud-chain">—</span>
    </div>
    <div class="hud-stat" data-stat="max">
      <span class="hud-label">best tile</span>
      <span class="hud-value hud-value--big" id="hud-max">—</span>
    </div>
    <div class="hud-stat" data-stat="pool">
      <span class="hud-label">pool</span>
      <span class="hud-value hud-value--mono" id="hud-pool">2 / 256</span>
    </div>
  `;
  root.appendChild(stats);

  // Tier-conquest progress: a horizontal row of chips, one per tier the
  // player has touched. Hidden via :empty CSS rule until the first tier is
  // retired. Lives inside hud-root so it scrolls with the HUD on small
  // screens.
  const tierBadges = document.createElement('div');
  tierBadges.className = 'tier-badges';
  tierBadges.id = 'tier-badges';
  tierBadges.setAttribute('role', 'list');
  tierBadges.setAttribute('aria-label', 'Tier progress');
  root.appendChild(tierBadges);

  container.appendChild(root);

  const banner = document.createElement('div');
  banner.className = 'hud-banner';
  banner.setAttribute('aria-live', 'polite');
  container.appendChild(banner);

  const gameOver = document.createElement('div');
  gameOver.className = 'game-over hidden';
  gameOver.innerHTML = `
    <div class="game-over-card">
      <div class="game-over-eyebrow">RUN COMPLETE</div>
      <div class="game-over-title">no chain remains</div>
      <div class="game-over-stats" id="game-over-stats"></div>
      <button id="game-over-restart" class="game-over-cta">
        <span>BEGIN ANEW</span>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  `;
  container.appendChild(gameOver);

  const elements: HudElements = {
    root,
    title: branding.querySelector('.hud-mark') as HTMLElement,
    turn: stats.querySelector('#hud-turn') as HTMLElement,
    maxTile: stats.querySelector('#hud-max') as HTMLElement,
    spawnPool: stats.querySelector('#hud-pool') as HTMLElement,
    chainValue: stats.querySelector('#hud-chain') as HTMLElement,
    chainStat: stats.querySelector('#hud-chain-stat') as HTMLElement,
    phase: branding.querySelector('#hud-phase') as HTMLElement,
    toolbar: branding.querySelector('.hud-toolbar') as HTMLElement,
    tierBadges,
    gameOver,
    tuningToggle: branding.querySelector('.hud-tuning-toggle') as HTMLButtonElement,
    banner,
  };
  cache.set(elements, { turn: 0, max: 0, pool: '', chain: null });
  return elements;
}

export function countRetiredTiles(board: Board): number {
  let count = 0;
  for (const row of board) {
    for (const tile of row) {
      if (tile.value !== 0 && tile.retired) count++;
    }
  }
  return count;
}

export function lifecyclePhase(state: GameState): 'free-play' | 'cleanup' {
  return countRetiredTiles(state.board) > 0 ? 'cleanup' : 'free-play';
}

const PHASE_LABEL: Record<LifecyclePhase, string> = {
  'free-play': 'Free Play',
  'cleanup': 'Cleanup',
  'conquest': '🎉 Conquest',
};

function setPhase(hud: HudElements, phase: LifecyclePhase): void {
  if (hud.phase.dataset.phase === phase) return;
  hud.phase.dataset.phase = phase;
  const labelEl = hud.phase.querySelector('.hud-phase-label');
  if (labelEl !== null) labelEl.textContent = PHASE_LABEL[phase];
}

/**
 * Flash the conquest pill. Auto-reverts to free-play after duration.
 * The full-screen confetti is handled separately via EffectQueue.
 */
export function flashConquest(hud: HudElements, durationMs = 2200): void {
  setPhase(hud, 'conquest');
  window.setTimeout(() => { setPhase(hud, 'free-play'); }, durationMs);
}

export function updateHud(hud: HudElements, state: GameState): void {
  const prev = cache.get(hud) ?? { turn: 0, max: 0 as TileValue, pool: '', chain: null as number | null };

  // Phase indicator. Conquest is a transient state; only update when not
  // currently flashing it.
  if (hud.phase.dataset.phase !== 'conquest') {
    setPhase(hud, lifecyclePhase(state));
  }

  if (state.turn !== prev.turn) {
    hud.turn.textContent = String(state.turn);
    flashStat(hud.turn);
  }

  if (state.maxTileEver !== prev.max) {
    const old = prev.max;
    hud.maxTile.textContent = state.maxTileEver === 0 ? '—' : formatTileValue(state.maxTileEver);
    hud.maxTile.title = state.maxTileEver === 0 ? '' : String(state.maxTileEver);
    if (state.maxTileEver > 0) {
      const theme = tileTheme(state.maxTileEver);
      hud.maxTile.style.color = theme.aura;
      hud.maxTile.style.textShadow = `0 0 18px ${theme.glow}`;
    }
    if (state.maxTileEver > old) flashStat(hud.maxTile, true);
  }

  const poolText = `${formatTileValue(state.spawnPoolMin)} / ${formatTileValue(state.spawnPoolMax)}`;
  hud.spawnPool.title = `${state.spawnPoolMin} → ${state.spawnPoolMax}`;
  if (poolText !== prev.pool) {
    hud.spawnPool.textContent = poolText;
    flashStat(hud.spawnPool);
  }

  cache.set(hud, { turn: state.turn, max: state.maxTileEver, pool: poolText, chain: prev.chain });

  if (state.phase === 'game-over') {
    showGameOver(hud, state);
  }
}

export function updateChainPreview(hud: HudElements, value: number | null): void {
  const prev = cache.get(hud) ?? { turn: 0, max: 0 as TileValue, pool: '', chain: null as number | null };
  if (prev.chain === value) return;
  hud.chainValue.textContent = value !== null ? formatTileValue(value) : '—';
  hud.chainValue.title = value !== null ? String(value) : '';
  if (value !== null && value > 0) {
    const theme = tileTheme(value);
    hud.chainValue.style.color = theme.aura;
    hud.chainValue.style.textShadow = `0 0 14px ${theme.glow}`;
    hud.chainStat.classList.add('hud-stat--armed');
  } else {
    hud.chainValue.style.color = '';
    hud.chainValue.style.textShadow = '';
    hud.chainStat.classList.remove('hud-stat--armed');
  }
  cache.set(hud, { ...prev, chain: value });
}

export function flashBanner(hud: HudElements, text: string, theme?: { color: string; glow: string }): void {
  hud.banner.textContent = text;
  hud.banner.classList.remove('hud-banner--show');
  void hud.banner.offsetWidth;
  hud.banner.classList.add('hud-banner--show');
  if (theme !== undefined) {
    hud.banner.style.color = theme.color;
    hud.banner.style.textShadow = `0 0 22px ${theme.glow}`;
  }
  window.setTimeout(() => { hud.banner.classList.remove('hud-banner--show'); }, 2200);
}

export function clearGameOver(hud: HudElements): void {
  hud.gameOver.classList.add('hidden');
  hud.gameOver.classList.remove('game-over--show');
}

function showGameOver(hud: HudElements, state: GameState): void {
  const statsEl = hud.gameOver.querySelector('#game-over-stats');
  if (statsEl !== null) {
    statsEl.innerHTML = `
      <div class="game-over-stat"><span class="game-over-stat-k">turns</span><span class="game-over-stat-v">${state.turn}</span></div>
      <div class="game-over-stat"><span class="game-over-stat-k">best tile</span><span class="game-over-stat-v" title="${state.maxTileEver}">${formatTileValue(state.maxTileEver)}</span></div>
      <div class="game-over-stat"><span class="game-over-stat-k">pool reached</span><span class="game-over-stat-v" title="${state.spawnPoolMin} / ${state.spawnPoolMax}">${formatTileValue(state.spawnPoolMin)} / ${formatTileValue(state.spawnPoolMax)}</span></div>
    `;
  }
  hud.gameOver.classList.remove('hidden');
  // Force reflow then add show class for transition
  void hud.gameOver.offsetWidth;
  hud.gameOver.classList.add('game-over--show');
}

function flashStat(el: HTMLElement, big = false): void {
  el.classList.remove('hud-value--flash', 'hud-value--big-flash');
  void el.offsetWidth;
  el.classList.add(big ? 'hud-value--big-flash' : 'hud-value--flash');
}

// ─── Tier-conquest progress ────────────────────────────────────────────────

export function countRetiredTilesByTier(board: Board): ReadonlyMap<TileValue, number> {
  const counts = new Map<TileValue, number>();
  for (const row of board) {
    for (const tile of row) {
      if (tile.value !== 0 && tile.retired) {
        counts.set(tile.value, (counts.get(tile.value) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/**
 * Derive per-tier statuses from the current board + the set of already-
 * conquered tiers. The conquered set is owned by the caller (app.ts)
 * because PR #32's per-tier conquest detection already maintains it for
 * confetti + banner triggers; this function reuses that source of truth.
 *
 * A tier appears as a badge if it's currently retired OR has been
 * conquered. Tiers never retired are not shown (no spoilers).
 */
export function deriveTierStatuses(
  board: Board,
  conquered: ReadonlySet<TileValue>
): readonly TierStatus[] {
  const inProgress = new Set<TileValue>();
  for (const value of countRetiredTilesByTier(board).keys()) {
    inProgress.add(value);
  }
  const all = new Set<TileValue>([...conquered, ...inProgress]);
  return [...all]
    .sort((a, b) => a - b)
    .map(value => ({
      value,
      state: conquered.has(value) ? 'conquered' : 'in-progress' as const,
    }));
}

let lastBadgeKey = '';

export function renderTierBadges(hud: HudElements, statuses: readonly TierStatus[]): void {
  // Skip work if nothing changed. N is small, so a string key is cheap.
  const key = statuses.map(s => `${s.value}:${s.state}`).join('|');
  if (key === lastBadgeKey) return;
  lastBadgeKey = key;

  hud.tierBadges.innerHTML = '';
  for (const { value, state } of statuses) {
    const badge = document.createElement('span');
    badge.className = 'tier-badge';
    badge.dataset.state = state;
    badge.setAttribute('role', 'listitem');
    const labelText = state === 'conquered'
      ? `${formatTileValue(value)} ✓`
      : formatTileValue(value);
    badge.textContent = labelText;
    badge.title = state === 'conquered'
      ? `Tier ${value} conquered`
      : `Tier ${value} — clean up retired tiles`;
    if (state === 'conquered') {
      const theme = tileTheme(value);
      badge.style.color = theme.aura;
      badge.style.borderColor = theme.glow;
      badge.style.boxShadow = `0 0 14px ${theme.glow}`;
    }
    hud.tierBadges.appendChild(badge);
  }
}

// Reset the badge cache. Call on new game so the next render forces a paint.
export function resetTierBadgeCache(): void {
  lastBadgeKey = '';
}
