import {
  DEFAULT_CONFIG,
  validateChain,
  computeChainResult,
  getAdjacentCells,
  validateChainExtension,
  GameSession,
} from '../game-session/index.js';
import type { Cell, GameConfig, TileValue } from '../game-session/index.js';
import {
  boardPixelWidth,
  boardPixelHeight,
  renderBoard,
} from './board.js';
import { attachInput } from './input.js';
import type { InputCallbacks } from './input.js';
import { countRetiredTiles, createHud, flashConquest, updateChainPreview, updateHud } from './hud.js';
import { mountTuningConsole } from '../tuning-console/console.js';

function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    .hud-top {
      display: flex;
      gap: 24px;
      justify-content: center;
      align-items: center;
      padding: 12px 0 8px;
      width: 100%;
    }
    .hud-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      min-width: 64px;
    }
    .hud-label {
      font-size: 10px;
      letter-spacing: 2px;
      color: #666;
      font-weight: 600;
    }
    .hud-value {
      font-size: 22px;
      font-weight: 700;
      color: #eee;
    }
    .hud-tuning-toggle {
      background: #2a3050;
      color: #fff;
      border: 1px solid #445;
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
    }
    .hud-tuning-toggle:hover { background: #3a4060; }
    canvas {
      display: block;
      touch-action: none;
      cursor: crosshair;
    }
    .game-over-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.75);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .game-over-overlay.hidden {
      display: none;
    }
    .game-over-box {
      background: #1a1a2e;
      border: 2px solid #444;
      border-radius: 16px;
      padding: 32px 40px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .game-over-title {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 4px;
      color: #e74c3c;
    }
    #game-over-stats {
      color: #ccc;
      font-size: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    #game-over-restart {
      margin-top: 8px;
      padding: 10px 24px;
      background: #3a6fbf;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    #game-over-restart:hover {
      background: #4a7fa5;
    }
    .hud-phase {
      font-size: 16px;
      padding: 2px 10px;
      border-radius: 999px;
      transition: background 0.25s ease, color 0.25s ease;
    }
    .hud-phase[data-phase="free-play"] {
      background: rgba(76, 175, 90, 0.2);
      color: #6ddc8a;
    }
    .hud-phase[data-phase="cleanup"] {
      background: rgba(245, 165, 36, 0.22);
      color: #ffb049;
    }
    .hud-phase[data-phase="conquest"] {
      background: linear-gradient(90deg, #ffd54a, #ff9d3d);
      color: #1a1a2e;
      animation: phase-pop 0.45s ease;
    }
    @keyframes phase-pop {
      0% { transform: scale(0.85); }
      60% { transform: scale(1.12); }
      100% { transform: scale(1); }
    }
    .conquest-banner {
      position: fixed;
      top: 25%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.7);
      background: linear-gradient(135deg, #ffd54a 0%, #ff9d3d 100%);
      color: #1a1a2e;
      padding: 16px 36px;
      border-radius: 14px;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 3px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.4);
      pointer-events: none;
      opacity: 0;
      z-index: 90;
      transition: opacity 0.25s ease, transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
    }
    .conquest-banner.hidden {
      display: none;
    }
    .conquest-banner-active {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  `;
  document.head.appendChild(style);
}

function mount(): void {
  injectStyles();

  const app = document.getElementById('app');
  if (app === null) return;

  let session = new GameSession(DEFAULT_CONFIG);

  const canvas = document.createElement('canvas');
  function resizeCanvas(cfg: GameConfig): void {
    const W = boardPixelWidth(cfg.gridCols);
    const H = boardPixelHeight(cfg.gridRows);
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `min(100%, ${W}px)`;
    canvas.style.aspectRatio = `${W} / ${H}`;
    canvas.style.height = 'auto';
  }
  resizeCanvas(session.getState().config);

  const ctxOrNull = canvas.getContext('2d');
  if (ctxOrNull === null) return;
  const ctx = ctxOrNull;

  const hud = createHud(app);
  app.appendChild(canvas);

  let currentChain: readonly Cell[] = [];
  let previewValue: TileValue | null = null;
  let validExtensions: ReadonlySet<string> = new Set();

  function computeValidExtensions(chain: readonly Cell[]): ReadonlySet<string> {
    if (chain.length === 0) return new Set();
    const state = session.getState();
    const cfg = state.config;
    const last = chain[chain.length - 1];
    if (last === undefined) return new Set();
    const lastTile = state.board[last.row]?.[last.col];
    if (lastTile === undefined || lastTile.value === 0) return new Set();
    const chainKeys = new Set(chain.map(c => `${c.row},${c.col}`));
    const adj = getAdjacentCells(last, cfg.gridRows, cfg.gridCols);
    const result = new Set<string>();
    for (const neighbor of adj) {
      const key = `${neighbor.row},${neighbor.col}`;
      if (chainKeys.has(key)) continue;
      const neighborTile = state.board[neighbor.row]?.[neighbor.col];
      if (neighborTile === undefined || neighborTile.value === 0) continue;
      if (chain.length === 1) {
        const firstCell = chain[0];
        const firstTile = firstCell !== undefined ? state.board[firstCell.row]?.[firstCell.col] : undefined;
        if (firstTile !== undefined && neighborTile.value === firstTile.value) {
          result.add(key);
        }
      } else {
        const { valid } = validateChainExtension(lastTile, neighborTile);
        if (valid) result.add(key);
      }
    }
    return result;
  }

  function render(): void {
    const state = session.getState();
    renderBoard(ctx, {
      board: state.board,
      chain: currentChain,
      previewValue,
      validExtensions,
      rows: state.config.gridRows,
      cols: state.config.gridCols,
    });
    updateHud(hud, state);
  }

  function makeInputCallbacks(): InputCallbacks {
    return {
      canExtend(chain: readonly Cell[], cell: Cell): boolean {
        const state = session.getState();
        return validateChain(state.board, [...chain, cell]).valid;
      },
      onChainUpdate(chain: readonly Cell[]): void {
        currentChain = chain;
        previewValue = null;
        validExtensions = computeValidExtensions(chain);
        const state = session.getState();
        if (chain.length >= 2 && validateChain(state.board, chain).valid) {
          try { previewValue = computeChainResult(state.board, chain, state.config); }
          catch { previewValue = null; }
        }
        updateChainPreview(hud, previewValue);
        render();
      },
      onChainCommit(chain: readonly Cell[]): void {
        const state = session.getState();
        currentChain = [];
        previewValue = null;
        validExtensions = new Set();
        if (state.phase !== 'game-over' && validateChain(state.board, chain).valid) {
          session.dispatch({ kind: 'commit-chain', chain });
        } else {
          updateChainPreview(hud, null);
          render();
        }
      },
      onChainCancel(): void {
        currentChain = [];
        previewValue = null;
        validExtensions = new Set();
        updateChainPreview(hud, null);
        render();
      },
    };
  }

  // Track retired-tile count across renders so we can detect the cleanup→
  // free-play transition (= conquest) and flash the celebration.
  let prevRetiredCount = countRetiredTiles(session.getState().board);

  function makeListener(): () => void {
    return (): void => {
      const retiredCount = countRetiredTiles(session.getState().board);
      if (prevRetiredCount > 0 && retiredCount === 0) flashConquest(hud);
      prevRetiredCount = retiredCount;
      render();
    };
  }

  let unsubscribe = session.on(makeListener());
  let detach = attachInput(canvas, session.getState().config.gridRows, session.getState().config.gridCols, makeInputCallbacks());

  function rewireSession(newSession: GameSession): void {
    unsubscribe();
    detach();
    session = newSession;
    const cfg = session.getState().config;
    resizeCanvas(cfg);
    prevRetiredCount = countRetiredTiles(session.getState().board);
    unsubscribe = session.on(makeListener());
    detach = attachInput(canvas, cfg.gridRows, cfg.gridCols, makeInputCallbacks());
  }

  const tuning = mountTuningConsole({
    mountTarget: document.body,
    session,
    onRequestNewGame(cfg: GameConfig): void {
      const newSession = new GameSession(cfg);
      rewireSession(newSession);
      hud.gameOver.classList.add('hidden');
      tuning.rebindSession(newSession);
      render();
    },
  });

  hud.tuningToggle.addEventListener('click', () => {
    if (document.body.hasAttribute('data-console-open')) {
      document.body.removeAttribute('data-console-open');
    } else {
      document.body.setAttribute('data-console-open', '');
    }
  });

  const restartBtn = document.getElementById('game-over-restart');
  if (restartBtn !== null) {
    restartBtn.addEventListener('click', () => {
      hud.gameOver.classList.add('hidden');
      const currentCfg = session.getState().config;
      const newSession = new GameSession(currentCfg);
      rewireSession(newSession);
      tuning.rebindSession(newSession);
      render();
    });
  }

  render();
}

mount();
