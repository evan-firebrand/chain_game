import type { GameState } from '../game-session/index.js';

export interface HudElements {
  turn: HTMLElement;
  maxTile: HTMLElement;
  spawnPool: HTMLElement;
  chainValue: HTMLElement;
  gameOver: HTMLElement;
  tuningToggle: HTMLButtonElement;
}

export function createHud(container: HTMLElement): HudElements {
  const topBar = document.createElement('div');
  topBar.className = 'hud-top';

  const turnEl = document.createElement('div');
  turnEl.className = 'hud-stat';
  turnEl.innerHTML = '<span class="hud-label">TURN</span><span class="hud-value" id="hud-turn">0</span>';

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
  topBar.appendChild(maxTileEl);
  topBar.appendChild(spawnPoolEl);
  topBar.appendChild(tuningToggle);
  container.appendChild(topBar);

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
    maxTile: document.getElementById('hud-max') as HTMLElement,
    spawnPool: document.getElementById('hud-pool') as HTMLElement,
    chainValue: document.getElementById('hud-chain') as HTMLElement,
    gameOver: gameOverEl,
    tuningToggle,
  };
}

export function updateHud(hud: HudElements, state: GameState): void {
  hud.turn.textContent = String(state.turn);
  hud.maxTile.textContent = state.maxTileEver === 0 ? '—' : String(state.maxTileEver);
  hud.spawnPool.textContent = `${state.spawnPoolMin}–${state.spawnPoolMax}`;

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
