import {
  DEFAULT_CONFIG,
  validateChain,
  computeChainResult,
  getAdjacentCells,
  validateChainExtension,
  GameSession,
} from '../game-session/index.js';
import type { Cell, GameConfig, TileValue, Board, GameEvent, GameState } from '../game-session/index.js';
import {
  boardPixelWidth,
  boardPixelHeight,
  renderBoard,
} from './board.js';
import { attachInput } from './input.js';
import type { InputCallbacks } from './input.js';
import {
  createHud, updateHud, updateChainPreview, flashBanner, clearGameOver,
  countRetiredTiles, flashConquest,
  deriveTierStatuses, renderTierBadges, resetTierBadgeCache,
} from './hud.js';
import { mountTuningConsole } from '../tuning-console/console.js';
import { tileTheme } from './theme.js';
import { PlaylogRecorder } from '../game-session/playlog.js';
import { mountPlaylogControls } from './playlog-controls.js';
import {
  EffectQueue,
  spawnTileSpawn,
  spawnTilePop,
  spawnFlash,
  spawnParticleBurst,
  spawnShockwave,
  spawnScreenPulse,
  spawnRetirementSweep,
  spawnConquestConfetti,
} from './effects.js';

function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    .hud-root {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 18px 4px 10px;
    }
    .hud-branding {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      width: 100%;
      gap: 12px;
    }
    .hud-toolbar {
      display: flex;
      gap: 8px;
      justify-self: end;
      align-items: center;
    }
    .hud-phase {
      justify-self: center;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 999px;
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      border: 1px solid var(--line);
      background: rgba(20, 24, 48, 0.55);
      color: var(--ink-mid);
      transition: border-color 240ms ease, color 240ms ease, box-shadow 320ms ease, background 240ms ease, transform 240ms ease;
    }
    .hud-phase-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 12px currentColor;
      transition: background 240ms ease, box-shadow 240ms ease;
    }
    .hud-phase[data-phase="free-play"] {
      color: #5ee2a0;
      border-color: rgba(94, 226, 160, 0.4);
      box-shadow: 0 0 18px rgba(94, 226, 160, 0.12);
    }
    .hud-phase[data-phase="cleanup"] {
      color: #ffb573;
      border-color: rgba(255, 181, 115, 0.45);
      background: rgba(60, 30, 12, 0.5);
      box-shadow: 0 0 22px rgba(255, 181, 115, 0.18);
    }
    .hud-phase[data-phase="conquest"] {
      color: #ffe07a;
      border-color: rgba(255, 224, 122, 0.7);
      background: linear-gradient(180deg, rgba(80, 60, 0, 0.6), rgba(40, 20, 0, 0.6));
      box-shadow: 0 0 30px rgba(255, 224, 122, 0.45), inset 0 0 18px rgba(255, 224, 122, 0.18);
      animation: phase-conquest-pulse 1100ms ease-in-out infinite alternate;
    }
    @keyframes phase-conquest-pulse {
      from { transform: scale(1); }
      to   { transform: scale(1.04); }
    }
    .hud-playlog-download {
      background: rgba(20, 24, 48, 0.6);
      color: var(--ink-mid);
      border: 1px solid var(--line);
      backdrop-filter: blur(10px);
      border-radius: 999px;
      padding: 7px 14px;
      cursor: pointer;
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.18em;
      transition: all 160ms ease;
    }
    .hud-playlog-download:hover {
      color: var(--ink-strong);
      border-color: rgba(125, 211, 252, 0.5);
      box-shadow: 0 0 24px rgba(125, 211, 252, 0.2);
    }
    .hud-mark {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }
    .hud-mark-glyph {
      font-family: 'Unbounded', system-ui, sans-serif;
      font-size: 28px;
      color: var(--accent-cool);
      text-shadow: 0 0 22px rgba(125, 211, 252, 0.6);
      transform: translateY(2px);
    }
    .hud-mark-word {
      font-family: 'Unbounded', system-ui, sans-serif;
      font-weight: 800;
      font-size: 22px;
      letter-spacing: 0.18em;
      color: var(--ink-strong);
    }
    .hud-tuning-toggle {
      background: rgba(20, 24, 48, 0.6);
      color: var(--ink-mid);
      border: 1px solid var(--line);
      backdrop-filter: blur(10px);
      border-radius: 999px;
      padding: 7px 14px 7px 11px;
      cursor: pointer;
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.18em;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 160ms ease;
    }
    .hud-tuning-toggle:hover {
      color: var(--ink-strong);
      border-color: rgba(125, 211, 252, 0.5);
      box-shadow: 0 0 24px rgba(125, 211, 252, 0.2);
    }
    .hud-tuning-icon { font-size: 14px; line-height: 1; }
    .hud-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      width: 100%;
    }
    .hud-stat {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      padding: 12px 14px;
      background: linear-gradient(180deg, rgba(18, 22, 44, 0.7), rgba(10, 12, 28, 0.55));
      border: 1px solid var(--line);
      border-radius: 14px;
      min-height: 64px;
      min-width: 0;
      overflow: hidden;
      transition: border-color 220ms ease, box-shadow 220ms ease;
    }
    .hud-stat::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(60% 100% at 50% 0%, rgba(125, 211, 252, 0.08), transparent 70%);
      opacity: 0;
      transition: opacity 220ms ease;
    }
    .hud-stat--armed {
      border-color: rgba(125, 211, 252, 0.45);
      box-shadow: 0 0 28px rgba(125, 211, 252, 0.15), inset 0 0 18px rgba(125, 211, 252, 0.08);
    }
    .hud-stat--armed::before { opacity: 1; }
    .hud-label {
      font-family: 'DM Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.28em;
      color: var(--ink-soft);
      text-transform: uppercase;
    }
    .hud-value {
      font-family: 'Unbounded', system-ui, sans-serif;
      font-weight: 700;
      font-size: 22px;
      color: var(--ink-strong);
      line-height: 1;
      transition: color 220ms ease, text-shadow 220ms ease, transform 220ms ease;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .hud-value--big { font-size: 26px; }
    .hud-value--accent { color: var(--accent-cool); }
    .hud-value--mono {
      font-family: 'DM Mono', monospace;
      font-weight: 500;
      font-size: 15px;
      letter-spacing: 0.04em;
    }
    @keyframes hud-flash {
      0%   { transform: translateY(-4px) scale(1.05); }
      100% { transform: translateY(0)    scale(1);    }
    }
    @keyframes hud-flash-big {
      0%   { transform: translateY(-6px) scale(1.18); filter: brightness(1.4); }
      60%  { transform: translateY(0)    scale(1.05); filter: brightness(1.15); }
      100% { transform: translateY(0)    scale(1);    filter: brightness(1);    }
    }
    .hud-value--flash { animation: hud-flash 280ms cubic-bezier(.2,.8,.3,1.4); }
    .hud-value--big-flash { animation: hud-flash-big 720ms cubic-bezier(.2,.8,.3,1.4); }

    .tier-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: center;
      align-items: center;
      width: 100%;
    }
    .tier-badges:empty {
      display: none;
    }
    .tier-badge {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.18em;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(20, 24, 48, 0.55);
      color: var(--ink-mid);
      transition: color 220ms ease, border-color 220ms ease, box-shadow 320ms ease, transform 220ms ease;
      animation: tier-badge-pop 360ms cubic-bezier(.2,.8,.3,1.4);
    }
    .tier-badge[data-state="in-progress"] {
      color: #ffb573;
      border-color: rgba(255, 181, 115, 0.45);
      background: rgba(60, 30, 12, 0.45);
    }
    .tier-badge[data-state="conquered"] {
      /* color/borderColor/boxShadow set inline per-tier from tileTheme. */
      background: rgba(20, 24, 48, 0.7);
    }
    @keyframes tier-badge-pop {
      0%   { transform: scale(0.6); opacity: 0; }
      60%  { transform: scale(1.12); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }

    .hud-banner {
      width: 100%;
      min-height: 24px;
      text-align: center;
      font-family: 'Unbounded', system-ui, sans-serif;
      font-weight: 800;
      font-size: 14px;
      letter-spacing: 0.32em;
      color: var(--accent-cool);
      opacity: 0;
      transform: translateY(-4px);
      pointer-events: none;
      transition: opacity 280ms ease, transform 280ms ease;
    }
    .hud-banner--show {
      opacity: 1;
      transform: translateY(0);
    }

    .board-frame {
      position: relative;
      padding: 14px;
      border-radius: 22px;
      background:
        radial-gradient(120% 70% at 50% -20%, rgba(125,211,252,0.08), transparent 70%),
        linear-gradient(180deg, rgba(20,24,48,0.85), rgba(10,12,28,0.75));
      border: 1px solid var(--line);
      box-shadow:
        0 30px 80px rgba(0, 0, 0, 0.55),
        0 0 0 1px rgba(255, 255, 255, 0.02) inset;
      width: 100%;
      max-width: 520px;
      display: flex;
      justify-content: center;
    }
    canvas {
      display: block;
      touch-action: none;
      cursor: crosshair;
      filter: drop-shadow(0 8px 24px rgba(0,0,0,0.5));
    }

    .game-over {
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at 50% 40%, rgba(15, 8, 35, 0.78), rgba(2, 3, 10, 0.92));
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      opacity: 0;
      transition: opacity 380ms ease;
    }
    .game-over--show { opacity: 1; }
    .game-over.hidden { display: none; }
    .game-over-card {
      background: linear-gradient(180deg, rgba(28, 28, 60, 0.95), rgba(12, 14, 38, 0.95));
      border: 1px solid rgba(255, 100, 120, 0.35);
      box-shadow:
        0 40px 120px rgba(0, 0, 0, 0.75),
        0 0 80px rgba(255, 100, 120, 0.18);
      border-radius: 20px;
      padding: 36px 44px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      align-items: center;
      max-width: 380px;
      width: calc(100% - 32px);
      transform: translateY(20px) scale(0.96);
      transition: transform 480ms cubic-bezier(.2,.9,.3,1.2);
    }
    .game-over--show .game-over-card { transform: translateY(0) scale(1); }
    .game-over-eyebrow {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.5em;
      color: var(--ink-soft);
    }
    .game-over-title {
      font-family: 'Unbounded', system-ui, sans-serif;
      font-weight: 800;
      font-size: 26px;
      letter-spacing: 0.04em;
      color: #ff8a8a;
      text-align: center;
      text-shadow: 0 0 30px rgba(255, 138, 138, 0.4);
    }
    .game-over-stats {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 0;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }
    .game-over-stat {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .game-over-stat-k {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      letter-spacing: 0.22em;
      color: var(--ink-soft);
      text-transform: uppercase;
    }
    .game-over-stat-v {
      font-family: 'Unbounded', system-ui, sans-serif;
      font-weight: 700;
      font-size: 18px;
      color: var(--ink-strong);
    }
    .game-over-cta {
      margin-top: 4px;
      padding: 12px 22px;
      background: linear-gradient(180deg, #2c5acc, #1a3a90);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 999px;
      font-family: 'Unbounded', system-ui, sans-serif;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.28em;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 12px 32px rgba(44, 90, 204, 0.45), inset 0 1px 0 rgba(255,255,255,0.18);
      transition: transform 180ms ease, box-shadow 220ms ease;
    }
    .game-over-cta:hover {
      transform: translateY(-1px);
      box-shadow: 0 18px 40px rgba(44, 90, 204, 0.55), inset 0 1px 0 rgba(255,255,255,0.25);
    }
  `;
  document.head.appendChild(style);
}

function mount(): void {
  injectStyles();

  const app = document.getElementById('app');
  if (app === null) return;

  let session = new GameSession(DEFAULT_CONFIG);

  // Track previous board for diffing (used to detect tier conquest)
  let previousBoard: Board = session.getState().board;

  const effects = new EffectQueue();

  const hud = createHud(app);

  const boardFrame = document.createElement('div');
  boardFrame.className = 'board-frame';
  app.appendChild(boardFrame);

  const canvas = document.createElement('canvas');
  function resizeCanvas(cfg: GameConfig): void {
    const W = boardPixelWidth(cfg.gridCols);
    const H = boardPixelHeight(cfg.gridRows);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `min(100%, ${W}px)`;
    canvas.style.aspectRatio = `${W} / ${H}`;
    canvas.style.height = 'auto';
    const c = canvas.getContext('2d');
    if (c !== null) c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas(session.getState().config);
  boardFrame.appendChild(canvas);

  const ctxOrNull = canvas.getContext('2d');
  if (ctxOrNull === null) return;
  const ctx = ctxOrNull;

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

  function renderFrame(now: number): void {
    const state = session.getState();
    effects.prune(now);
    renderBoard(ctx, {
      board: state.board,
      chain: currentChain,
      previewValue,
      validExtensions,
      rows: state.config.gridRows,
      cols: state.config.gridCols,
      effects,
      now,
    });
  }

  // RAF loop runs continuously — animations are time-based.
  let rafId = 0;
  function loop(now: number): void {
    renderFrame(now);
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

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
        }
      },
      onChainCancel(): void {
        currentChain = [];
        previewValue = null;
        validExtensions = new Set();
        updateChainPreview(hud, null);
      },
    };
  }

  function handleKernelEvents(state: GameState, kernelEvents: readonly GameEvent[]): void {
    const W = boardPixelWidth(state.config.gridCols);
    const H = boardPixelHeight(state.config.gridRows);

    for (const e of kernelEvents) {
      if (e.kind === 'chain-resolved') {
        // Burst at each source tile (skip last — that's the result cell)
        for (let i = 0; i < e.chain.length - 1; i++) {
          const src = e.chain[i];
          if (src === undefined) continue;
          const sourceTile = previousBoard[src.row]?.[src.col];
          const v = sourceTile?.value ?? e.resultValue;
          effects.push(spawnParticleBurst(src, v, 8));
        }
        // Result tile: pop + flash + shockwave + screen pulse
        effects.push(spawnTilePop(e.resultCell, e.resultValue));
        effects.push(spawnFlash(e.resultCell, e.resultValue));
        effects.push(spawnShockwave(e.resultCell, e.resultValue));
        // Big merges (length 4+) get a screen pulse
        if (e.chain.length >= 4) effects.push(spawnScreenPulse(e.resultValue));
        // Banner for milestone result values
        if (e.resultValue >= 256) {
          const theme = tileTheme(e.resultValue);
          flashBanner(hud, e.resultValue >= 1024 ? `LEGENDARY · ${e.resultValue}` : `${e.resultValue} forged`, { color: theme.aura, glow: theme.glow });
        }
      } else if (e.kind === 'tiles-spawned') {
        for (const sp of e.spawned) {
          effects.push(spawnTileSpawn(sp.cell, sp.value));
        }
      } else if (e.kind === 'retirement-fired') {
        effects.push(spawnRetirementSweep(e.retiredTier));
        effects.push(spawnScreenPulse(e.retiredTier));
        const theme = tileTheme(e.retiredTier);
        flashBanner(hud, `${e.retiredTier} retired · cleanup`, { color: '#ff8a8a', glow: theme.glow });
      }
      // game-over event: handled by updateHud → showGameOver
    }

    // Tier conquest detection: tiers that had retired tiles previously and now don't
    detectAndCelebrateConquest(state, W, H);

    previousBoard = state.board;
  }

  const conquestedTiers = new Set<TileValue>();
  let prevRetiredCount = countRetiredTiles(session.getState().board);

  function detectAndCelebrateConquest(state: GameState, W: number, H: number): void {
    const prevRetiredTiers = new Set<TileValue>();
    const currRetiredTiers = new Set<TileValue>();
    for (const row of previousBoard) for (const t of row) if (t.retired && t.value > 0) prevRetiredTiers.add(t.value);
    for (const row of state.board)   for (const t of row) if (t.retired && t.value > 0) currRetiredTiers.add(t.value);
    for (const tier of prevRetiredTiers) {
      if (!currRetiredTiers.has(tier) && !conquestedTiers.has(tier)) {
        conquestedTiers.add(tier);
        effects.push(spawnConquestConfetti(W, H, tier));
        effects.push(spawnScreenPulse(tier));
        const theme = tileTheme(tier);
        flashBanner(hud, `CONQUEST · ${tier}`, { color: theme.aura, glow: theme.glow });
      }
    }

    // Phase chip flash: triggered when ALL retired tiles get cleared
    // (a "fully clean" board moment, distinct from per-tier celebration above).
    const retiredCount = countRetiredTiles(state.board);
    if (prevRetiredCount > 0 && retiredCount === 0) flashConquest(hud);
    prevRetiredCount = retiredCount;
  }

  function refreshTierBadges(state: GameState): void {
    renderTierBadges(hud, deriveTierStatuses(state.board, conquestedTiers));
  }

  let unsubscribe = session.on(event => {
    handleKernelEvents(event.state, event.kernelEvents);
    updateHud(hud, event.state);
    refreshTierBadges(event.state);
  });
  refreshTierBadges(session.getState());
  let detach = attachInput(canvas, session.getState().config.gridRows, session.getState().config.gridCols, makeInputCallbacks());

  // Per-turn play recorder. Survives session restarts via attachSession.
  const playlog = new PlaylogRecorder(session);
  mountPlaylogControls(hud.toolbar, playlog);

  function rewireSession(newSession: GameSession): void {
    unsubscribe();
    detach();
    effects.clear();
    conquestedTiers.clear();
    resetTierBadgeCache();
    session = newSession;
    previousBoard = session.getState().board;
    prevRetiredCount = countRetiredTiles(session.getState().board);
    const cfg = session.getState().config;
    resizeCanvas(cfg);
    unsubscribe = session.on(event => {
      handleKernelEvents(event.state, event.kernelEvents);
      updateHud(hud, event.state);
      refreshTierBadges(event.state);
    });
    refreshTierBadges(session.getState());
    detach = attachInput(canvas, cfg.gridRows, cfg.gridCols, makeInputCallbacks());
    playlog.attachSession(newSession);
  }

  const tuning = mountTuningConsole({
    mountTarget: document.body,
    session,
    onRequestNewGame(cfg: GameConfig): void {
      const newSession = new GameSession(cfg);
      rewireSession(newSession);
      clearGameOver(hud);
      tuning.rebindSession(newSession);
      updateHud(hud, newSession.getState());
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
      clearGameOver(hud);
      const currentCfg = session.getState().config;
      const newSession = new GameSession(currentCfg);
      rewireSession(newSession);
      tuning.rebindSession(newSession);
      updateHud(hud, newSession.getState());
    });
  }

  updateHud(hud, session.getState());

  // Branch badge — bottom-left, build-time injected
  const badge = Object.assign(document.createElement('div'), { textContent: __GIT_BRANCH__ });
  Object.assign(badge.style, {
    position: 'fixed', bottom: '8px', left: '10px',
    font: '10px/1 "DM Mono", monospace', color: 'rgba(180,190,255,0.35)',
    pointerEvents: 'none', zIndex: '9999', userSelect: 'none',
  });
  document.body.appendChild(badge);

  // Cleanup on unload (defensive)
  window.addEventListener('beforeunload', () => { cancelAnimationFrame(rafId); });
}

declare const __GIT_BRANCH__: string;

mount();
