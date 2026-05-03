import type { Board, GameState } from '../game-session/index.js';

export type LifecyclePhase = 'free-play' | 'cleanup' | 'conquest';

export interface HudElements {
  turn: HTMLElement;
  phase: HTMLElement;
  maxTile: HTMLElement;
  spawnPool: HTMLElement;
  chainValue: HTMLElement;
  conquestBanner: HTMLElement;
  gameOver: HTMLElement;
  tuningToggle: HTMLButtonElement;
}

export function createHud(container: HTMLElement): HudElements {
  const topBar = document.createElement('div');
  topBar.className = 'hud-top';

  const turnEl = document.createElement('div');
  turnEl.className = 'hud-stat';
  turnEl.innerHTML = '<span class="hud-label">TURN</span><span class="hud-value" id="hud-turn">0</span>';

  const phaseEl = document.createElement('div');
  phaseEl.className = 'hud-stat';
  phaseEl.innerHTML = '<span class="hud-label">PHASE</span><span class="hud-value hud-phase" id="hud-phase" data-phase="free-play">Free Play</span>';

  const maxTileEl = document.createElement('div');
  maxTileEl.className = 'hud-stat';
  maxTileEl.innerHTML = '<span class="hud-label">BEST</span><span class="hud-value" id="hud-max">—</span>';

  const spawnPoolEl = document.createElement('div');
  spawnPoolEl.className = 'hud-stat';
  spawnPoolEl.innerHTML = '<span class="hud-label">POOL</span><span class="hud-value" id="hud-pool">2–256</span>';

  const chainValueEl = document.createElement('div');
  chainValueEl.className = 'hud-stat';
  chainValueEl.innerHTML = '<span class="hud-label">CHAIN</span><span class="hud-value" id="hud-chain">—</span>';

  const tuningToggle = document.createElement('button');
  tuningToggle.type = 'button';
  tuningToggle.className = 'hud-tuning-toggle';
  tuningToggle.setAttribute('aria-label', 'Toggle tuning panel');
  tuningToggle.textContent = '⚙';

  topBar.appendChild(turnEl);
  topBar.appendChild(chainValueEl);
  topBar.appendChild(phaseEl);
  topBar.appendChild(maxTileEl);
  topBar.appendChild(spawnPoolEl);
  topBar.appendChild(tuningToggle);
  container.appendChild(topBar);

  const conquestBannerEl = document.createElement('div');
  conquestBannerEl.className = 'conquest-banner hidden';
  conquestBannerEl.id = 'conquest-banner';
  conquestBannerEl.textContent = '🎉 TIER CONQUERED';
  container.appendChild(conquestBannerEl);

  const gameOverEl = document.createElement('div');
  gameOverEl.className = 'game-over-overlay hidden';
  gameOverEl.innerHTML = `
    <div class="game-over-box">
      <div class="game-over-title">GAME OVER</div>
      <div id="game-over-stats"></div>
      <button id="game-over-restart">Play Again</button>
    </div>
  `;
  container.appendChild(gameOverEl);

  return {
    turn: document.getElementById('hud-turn') as HTMLElement,
    phase: document.getElementById('hud-phase') as HTMLElement,
    maxTile: document.getElementById('hud-max') as HTMLElement,
    spawnPool: document.getElementById('hud-pool') as HTMLElement,
    chainValue: document.getElementById('hud-chain') as HTMLElement,
    conquestBanner: conquestBannerEl,
    gameOver: gameOverEl,
    tuningToggle,
  };
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

export function updateHud(hud: HudElements, state: GameState): void {
  hud.turn.textContent = String(state.turn);
  hud.maxTile.textContent = state.maxTileEver === 0 ? '—' : String(state.maxTileEver);
  hud.spawnPool.textContent = `${state.spawnPoolMin}–${state.spawnPoolMax}`;

  // Phase indicator. Conquest is a transient flash; the steady-state values
  // are free-play / cleanup. setPhase() handles the transient externally.
  const phase = lifecyclePhase(state);
  if (hud.phase.dataset.phase !== 'conquest') {
    hud.phase.dataset.phase = phase;
    hud.phase.textContent = phase === 'cleanup' ? 'Cleanup' : 'Free Play';
  }

  if (state.phase === 'game-over') {
    const statsEl = document.getElementById('game-over-stats');
    if (statsEl !== null) {
      statsEl.innerHTML = `
        <div>Turns: <strong>${state.turn}</strong></div>
        <div>Best tile: <strong>${state.maxTileEver}</strong></div>
      `;
    }
    hud.gameOver.classList.remove('hidden');
  }
}

export function updateChainPreview(hud: HudElements, value: number | null): void {
  hud.chainValue.textContent = value !== null ? String(value) : '—';
}

// Flash the conquest celebration. Auto-reverts to free-play after duration.
// Idempotent: calling while already in conquest extends the duration.
export function flashConquest(hud: HudElements, durationMs = 2200): void {
  hud.phase.dataset.phase = 'conquest';
  hud.phase.textContent = '🎉 Conquest!';

  hud.conquestBanner.classList.remove('hidden');
  hud.conquestBanner.classList.add('conquest-banner-active');

  window.setTimeout(() => {
    hud.conquestBanner.classList.remove('conquest-banner-active');
    hud.conquestBanner.classList.add('hidden');
    hud.phase.dataset.phase = 'free-play';
    hud.phase.textContent = 'Free Play';
  }, durationMs);
}
