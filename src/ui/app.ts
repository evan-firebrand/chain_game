import { DEFAULT_CONFIG, validateChain, computeChainResult } from '../game-kernel/index.js';
import type { Cell, TileValue } from '../game-kernel/index.js';
import { GameSession } from '../game-session/session.js';
import {
  boardPixelWidth,
  boardPixelHeight,
  renderBoard,
} from './board.js';
import { attachInput } from './input.js';
import { createHud, updateHud, updateChainPreview } from './hud.js';

function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    .hud-top {
      display: flex;
      gap: 24px;
      justify-content: center;
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
  `;
  document.head.appendChild(style);
}

function mount(): void {
  injectStyles();

  const app = document.getElementById('app');
  if (app === null) return;

  const config = DEFAULT_CONFIG;
  let session = new GameSession(config);

  const canvas = document.createElement('canvas');
  const W = boardPixelWidth(config.gridCols);
  const H = boardPixelHeight(config.gridRows);
  canvas.width = W;
  canvas.height = H;

  // Scale canvas for display while keeping logical size
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;

  const ctxOrNull = canvas.getContext('2d');
  if (ctxOrNull === null) return;
  const ctx = ctxOrNull;

  const hud = createHud(app);
  app.appendChild(canvas);

  let currentChain: ReadonlyArray<Cell> = [];
  let previewValue: TileValue | null = null;

  function render(): void {
    const state = session.getState();
    renderBoard(ctx, {
      board: state.board,
      chain: currentChain,
      previewValue,
      rows: config.gridRows,
      cols: config.gridCols,
    });
    updateHud(hud, state);
  }

  session.on(() => render());

  const detachInput = attachInput(canvas, config.gridRows, config.gridCols, {
    onChainUpdate(chain) {
      currentChain = chain;
      previewValue = null;

      const state = session.getState();
      if (chain.length >= 2) {
        const validation = validateChain(state.board, chain);
        if (validation.valid) {
          try {
            previewValue = computeChainResult(state.board, chain, config);
          } catch {
            previewValue = null;
          }
        }
      }
      updateChainPreview(hud, previewValue);
      render();
    },

    onChainCommit(chain) {
      const state = session.getState();
      if (state.phase === 'game-over') {
        currentChain = [];
        previewValue = null;
        render();
        return;
      }

      const validation = validateChain(state.board, chain);
      if (validation.valid) {
        currentChain = [];
        previewValue = null;
        session.dispatch({ kind: 'commit-chain', chain });
      } else {
        currentChain = [];
        previewValue = null;
        updateChainPreview(hud, null);
        render();
      }
    },

    onChainCancel() {
      currentChain = [];
      previewValue = null;
      updateChainPreview(hud, null);
      render();
    },
  });

  // Restart button
  const restartBtn = document.getElementById('game-over-restart');
  if (restartBtn !== null) {
    restartBtn.addEventListener('click', () => {
      hud.gameOver.classList.add('hidden');
      detachInput();
      session = new GameSession(config);
      session.on(() => render());
      attachInput(canvas, config.gridRows, config.gridCols, {
        onChainUpdate(chain) {
          currentChain = chain;
          previewValue = null;
          const st = session.getState();
          if (chain.length >= 2) {
            const v = validateChain(st.board, chain);
            if (v.valid) {
              try { previewValue = computeChainResult(st.board, chain, config); }
              catch { previewValue = null; }
            }
          }
          updateChainPreview(hud, previewValue);
          render();
        },
        onChainCommit(chain) {
          const st = session.getState();
          if (st.phase !== 'game-over' && validateChain(st.board, chain).valid) {
            currentChain = [];
            previewValue = null;
            session.dispatch({ kind: 'commit-chain', chain });
          } else {
            currentChain = [];
            previewValue = null;
            updateChainPreview(hud, null);
            render();
          }
        },
        onChainCancel() {
          currentChain = [];
          previewValue = null;
          updateChainPreview(hud, null);
          render();
        },
      });
      render();
    });
  }

  render();
}

mount();
