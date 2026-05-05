import { DEFAULT_CONFIG } from '../game-session/index.js';
import type { GameConfig, GameSession, TileValue } from '../game-session/index.js';
import { makeSlider, makeNumberInput, makeButton } from './controls.js';
import type { SliderControl, NumberControl } from './controls.js';
import { exportConfig, importConfig, ConfigImportError } from './config-export.js';

const TIER1_WEIGHT_VALUES: readonly TileValue[] = [2, 4, 8, 16, 32, 64, 128, 256];

export interface TuningConsoleOpts {
  readonly mountTarget: HTMLElement;
  readonly session: GameSession;
  /** Called when [New Game with these settings] is clicked. UI re-mounts canvas. */
  readonly onRequestNewGame: (config: GameConfig) => void;
}

export interface TuningConsoleHandle {
  destroy(): void;
  setConfig(config: GameConfig): void;
  /** Re-bind the console to a new session (e.g. after a new-game restart). */
  rebindSession(session: GameSession): void;
}

const STYLES = `
.tc-panel {
  background:
    radial-gradient(120% 60% at 50% 0%, rgba(125, 211, 252, 0.07), transparent 60%),
    linear-gradient(180deg, rgba(18, 20, 40, 0.96), rgba(8, 9, 22, 0.98));
  color: var(--ink-strong, #f4f5ff);
  border-left: 1px solid rgba(140, 160, 220, 0.12);
  width: 340px;
  height: 100dvh;
  overflow-y: auto;
  padding: 22px 22px 32px;
  font-family: 'DM Mono', ui-monospace, monospace;
  font-size: 12px;
  display: none;
  flex-shrink: 0;
  position: fixed;
  top: 0;
  right: 0;
  z-index: 50;
  box-shadow: -20px 0 60px rgba(0,0,0,0.55);
  backdrop-filter: blur(14px);
  box-sizing: border-box;
  transform: translateX(8px);
  opacity: 0;
  transition: transform 280ms cubic-bezier(.2,.8,.3,1), opacity 220ms ease;
}
body[data-console-open] .tc-panel {
  display: block;
  transform: translateX(0);
  opacity: 1;
}
.tc-panel::-webkit-scrollbar { width: 6px; }
.tc-panel::-webkit-scrollbar-thumb { background: rgba(125, 211, 252, 0.18); border-radius: 3px; }
.tc-panel h2 {
  font-family: 'Unbounded', system-ui, sans-serif;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.32em;
  color: rgba(220, 224, 255, 0.42);
  margin: 22px 0 12px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 12px;
}
.tc-panel h2::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(140, 160, 220, 0.18), transparent);
}
.tc-panel h2:first-of-type { margin-top: 0; }
.tc-slider, .tc-number {
  display: block;
  margin: 10px 0;
}
.tc-slider-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin-bottom: 4px;
  align-items: baseline;
}
.tc-slider-label { color: rgba(225, 230, 255, 0.72); letter-spacing: 0.08em; }
.tc-slider-readout {
  color: var(--accent-cool, #7dd3fc);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.tc-slider input[type=range] {
  width: 100%;
  accent-color: var(--accent-cool, #7dd3fc);
  height: 4px;
}
.tc-number {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.tc-number input[type=number] {
  background: rgba(8, 10, 22, 0.6);
  color: var(--ink-strong, #f4f5ff);
  border: 1px solid rgba(140, 160, 220, 0.18);
  border-radius: 8px;
  padding: 6px 10px;
  width: 110px;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.tc-number input[type=number]:focus {
  border-color: rgba(125, 211, 252, 0.55);
  box-shadow: 0 0 0 3px rgba(125, 211, 252, 0.12);
}
.tc-button {
  background: linear-gradient(180deg, rgba(40, 56, 110, 0.85), rgba(20, 30, 70, 0.85));
  color: #fff;
  border: 1px solid rgba(125, 211, 252, 0.22);
  border-radius: 999px;
  padding: 7px 14px;
  cursor: pointer;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin: 6px 6px 6px 0;
  transition: all 160ms ease;
}
.tc-button:hover {
  background: linear-gradient(180deg, rgba(60, 90, 170, 0.95), rgba(30, 50, 110, 0.95));
  box-shadow: 0 6px 24px rgba(125, 211, 252, 0.18);
  transform: translateY(-1px);
}
.tc-textarea {
  width: 100%;
  height: 160px;
  background: rgba(4, 6, 16, 0.7);
  color: rgba(220, 224, 255, 0.85);
  border: 1px solid rgba(140, 160, 220, 0.18);
  border-radius: 10px;
  padding: 10px 12px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  resize: vertical;
  box-sizing: border-box;
  outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.tc-textarea:focus {
  border-color: rgba(125, 211, 252, 0.45);
  box-shadow: 0 0 0 3px rgba(125, 211, 252, 0.1);
}
.tc-textarea.tc-error { border-color: rgba(255, 100, 120, 0.6); box-shadow: 0 0 0 3px rgba(255, 100, 120, 0.12); }
.tc-message { font-size: 11px; margin-top: 6px; min-height: 1em; letter-spacing: 0.04em; }
.tc-message.tc-error { color: #ff8a8a; }
.tc-message.tc-success { color: #5ee2a0; }
.tc-advanced-toggle {
  background: none;
  border: none;
  color: var(--accent-cool, #7dd3fc);
  cursor: pointer;
  padding: 6px 0;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin-top: 6px;
}
.tc-advanced-toggle:hover { color: #fff; }
.tc-advanced { display: none; }
.tc-advanced[data-open] { display: block; }
.tc-percent { color: rgba(220, 224, 255, 0.4); font-size: 10px; margin-left: 8px; font-variant-numeric: tabular-nums; }
.tc-warning {
  background: rgba(110, 30, 30, 0.55);
  color: #ffd2c2;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 120, 100, 0.35);
  font-size: 11px;
  margin: 8px 0;
  display: none;
}
.tc-warning[data-show] { display: block; }
.tc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(140, 160, 220, 0.12);
}
.tc-title {
  font-family: 'Unbounded', system-ui, sans-serif;
  font-size: 14px;
  letter-spacing: 0.36em;
  font-weight: 800;
  color: var(--ink-strong, #f4f5ff);
}
.tc-close {
  background: rgba(20, 24, 48, 0.6);
  border: 1px solid rgba(140, 160, 220, 0.18);
  color: rgba(220, 224, 255, 0.62);
  font-size: 16px;
  cursor: pointer;
  padding: 2px 10px;
  border-radius: 999px;
  line-height: 1.2;
  transition: all 160ms ease;
}
.tc-close:hover { color: #fff; border-color: rgba(255, 138, 138, 0.5); }
`;

let stylesInjected = false;
function injectStyles(): void {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);
  stylesInjected = true;
}

export function mountTuningConsole(opts: TuningConsoleOpts): TuningConsoleHandle {
  injectStyles();

  // Mutable session ref — rebound by rebindSession() after new-game restarts.
  let activeSession: GameSession = opts.session;

  const panel = document.createElement('aside');
  panel.className = 'tc-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'tc-header';
  const title = document.createElement('div');
  title.className = 'tc-title';
  title.textContent = 'TUNING';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tc-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close tuning panel');
  closeBtn.addEventListener('click', () => {
    document.body.removeAttribute('data-console-open');
  });
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // ── Tier 1: Live ───────────────────────────────────────────────────────
  const liveHeading = document.createElement('h2');
  liveHeading.textContent = 'Live (Tier 1)';
  panel.appendChild(liveHeading);

  const initialConfig = activeSession.getState().config;

  const ruleKSlider = makeSlider({
    id: 'tc-rulek',
    label: 'Rule D · k',
    min: 0,
    max: 8,
    step: 1,
    value: initialConfig.ruleK,
  });
  ruleKSlider.onChange(v => { activeSession.updateConfig({ ruleK: v }); });
  panel.appendChild(ruleKSlider.element);

  const weightSliders = new Map<TileValue, SliderControl>();
  const percentSpans = new Map<TileValue, HTMLSpanElement>();
  const allZeroWarning = document.createElement('div');
  allZeroWarning.className = 'tc-warning';
  allZeroWarning.textContent = 'All spawn weights are 0 — kernel falls back to spawnPoolMin.';

  for (const v of TIER1_WEIGHT_VALUES) {
    const w = initialConfig.spawnWeights[v] ?? 0;
    const slider = makeSlider({
      id: `tc-weight-${v}`,
      label: `weight[${v}]`,
      min: 0,
      max: 256,
      step: 1,
      value: w,
    });
    const pct = document.createElement('span');
    pct.className = 'tc-percent';
    slider.element.querySelector('.tc-slider-row')?.appendChild(pct);
    percentSpans.set(v, pct);

    slider.onChange(() => {
      const newWeights: Partial<Record<TileValue, number>> = {};
      for (const tv of TIER1_WEIGHT_VALUES) {
        newWeights[tv] = weightSliders.get(tv)?.getValue() ?? 0;
      }
      activeSession.updateConfig({ spawnWeights: newWeights });
      refreshPercents(newWeights);
    });
    weightSliders.set(v, slider);
    panel.appendChild(slider.element);
  }
  panel.appendChild(allZeroWarning);

  function refreshPercents(weights: Partial<Record<TileValue, number>>): void {
    let total = 0;
    for (const v of TIER1_WEIGHT_VALUES) total += weights[v] ?? 0;
    for (const v of TIER1_WEIGHT_VALUES) {
      const w = weights[v] ?? 0;
      const pct = total > 0 ? Math.round((w / total) * 100) : 0;
      const el = percentSpans.get(v);
      if (el !== undefined) el.textContent = total > 0 ? `(${pct}%)` : '';
    }
    if (total === 0) allZeroWarning.setAttribute('data-show', '');
    else allZeroWarning.removeAttribute('data-show');
  }
  refreshPercents(initialConfig.spawnWeights);

  const resetBtn = makeButton('Reset Tier 1 to defaults', () => {
    activeSession.updateConfig({
      ruleK: DEFAULT_CONFIG.ruleK,
      spawnWeights: DEFAULT_CONFIG.spawnWeights,
    });
  });
  panel.appendChild(resetBtn);

  // ── Tier 2: Restart-required (advanced) ────────────────────────────────
  const advToggle = document.createElement('button');
  advToggle.type = 'button';
  advToggle.className = 'tc-advanced-toggle';
  advToggle.textContent = 'Show advanced (Tier 2)';
  panel.appendChild(advToggle);

  const advSection = document.createElement('div');
  advSection.className = 'tc-advanced';

  const advHeading = document.createElement('h2');
  advHeading.textContent = 'Restart required (Tier 2)';
  advSection.appendChild(advHeading);

  const gridRowsInput = makeNumberInput({
    id: 'tc-rows', label: 'gridRows', min: 4, max: 7, step: 1, value: initialConfig.gridRows,
  });
  const gridColsInput = makeNumberInput({
    id: 'tc-cols', label: 'gridCols', min: 4, max: 6, step: 1, value: initialConfig.gridCols,
  });
  const seedInput = makeNumberInput({
    id: 'tc-seed', label: 'prngSeed', min: 0, max: 2147483647, step: 1, value: initialConfig.prngSeed,
  });
  advSection.appendChild(gridRowsInput.element);
  advSection.appendChild(gridColsInput.element);
  advSection.appendChild(seedInput.element);

  const randomizeBtn = makeButton('Randomize seed', () => {
    seedInput.setValue(Math.floor(Math.random() * 0x7fffffff));
  });
  advSection.appendChild(randomizeBtn);

  const newGameBtn = makeButton('New Game with these settings', () => {
    const current = activeSession.getState().config;
    const cfg: GameConfig = {
      ...current,
      gridRows: gridRowsInput.getValue(),
      gridCols: gridColsInput.getValue(),
      prngSeed: seedInput.getValue(),
    };
    opts.onRequestNewGame(cfg);
  });
  advSection.appendChild(newGameBtn);
  panel.appendChild(advSection);

  advToggle.addEventListener('click', () => {
    if (advSection.hasAttribute('data-open')) {
      advSection.removeAttribute('data-open');
      advToggle.textContent = 'Show advanced (Tier 2)';
    } else {
      advSection.setAttribute('data-open', '');
      advToggle.textContent = 'Hide advanced (Tier 2)';
    }
  });

  // ── Config JSON ────────────────────────────────────────────────────────
  const jsonHeading = document.createElement('h2');
  jsonHeading.textContent = 'Config JSON';
  panel.appendChild(jsonHeading);

  const textarea = document.createElement('textarea');
  textarea.className = 'tc-textarea';
  textarea.spellcheck = false;
  textarea.value = exportConfig(initialConfig);
  panel.appendChild(textarea);

  const jsonMessage = document.createElement('div');
  jsonMessage.className = 'tc-message';
  panel.appendChild(jsonMessage);

  function setMessage(text: string, kind: 'success' | 'error' | ''): void {
    jsonMessage.textContent = text;
    jsonMessage.classList.remove('tc-success', 'tc-error');
    if (kind === 'success') jsonMessage.classList.add('tc-success');
    if (kind === 'error') jsonMessage.classList.add('tc-error');
  }

  const exportBtn = makeButton('Export', () => {
    const json = exportConfig(activeSession.getState().config);
    textarea.value = json;
    textarea.classList.remove('tc-error');
    if (typeof navigator.clipboard !== 'undefined' && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(json).then(
        () => { setMessage('Copied to clipboard.', 'success'); },
        () => { setMessage('Copy failed — select textarea manually.', 'error'); }
      );
    } else {
      setMessage('Clipboard unavailable — select textarea manually.', 'error');
    }
  });
  const applyBtn = makeButton('Apply from textarea', () => {
    let parsed: GameConfig;
    try {
      parsed = importConfig(textarea.value);
    } catch (err) {
      textarea.classList.add('tc-error');
      const msg = err instanceof ConfigImportError ? err.message : (err as Error).message;
      setMessage(msg, 'error');
      return;
    }
    textarea.classList.remove('tc-error');

    const current = activeSession.getState().config;
    const tier2Differs =
      parsed.gridRows !== current.gridRows ||
      parsed.gridCols !== current.gridCols ||
      parsed.spawnPoolMin !== current.spawnPoolMin ||
      parsed.spawnPoolMax !== current.spawnPoolMax ||
      parsed.prngSeed !== current.prngSeed;

    if (tier2Differs) {
      const ok = window.confirm(
        'This config changes Tier 2 fields (grid / pool / seed) and requires a NEW GAME. Continue?'
      );
      if (!ok) {
        setMessage('Apply cancelled.', '');
        return;
      }
      opts.onRequestNewGame(parsed);
      setMessage('New game started with imported config.', 'success');
    } else {
      activeSession.updateConfig({
        ruleK: parsed.ruleK,
        spawnWeights: parsed.spawnWeights,
      });
      setMessage('Tier 1 fields applied.', 'success');
    }
  });
  panel.appendChild(exportBtn);
  panel.appendChild(applyBtn);

  opts.mountTarget.appendChild(panel);

  function setConfig(cfg: GameConfig): void {
    ruleKSlider.setValue(cfg.ruleK);
    for (const v of TIER1_WEIGHT_VALUES) {
      const slider = weightSliders.get(v);
      if (slider !== undefined) slider.setValue(cfg.spawnWeights[v] ?? 0);
    }
    refreshPercents(cfg.spawnWeights);
    gridRowsInput.setValue(cfg.gridRows);
    gridColsInput.setValue(cfg.gridCols);
    seedInput.setValue(cfg.prngSeed);
    textarea.value = exportConfig(cfg);
    textarea.classList.remove('tc-error');
  }

  let unsubscribe = activeSession.on(ev => { setConfig(ev.config); });

  function rebindSession(next: GameSession): void {
    unsubscribe();
    activeSession = next;
    unsubscribe = activeSession.on(ev => { setConfig(ev.config); });
    setConfig(activeSession.getState().config);
  }

  return {
    destroy(): void {
      unsubscribe();
      panel.remove();
    },
    setConfig,
    rebindSession,
  };
}

// Silence unused-import lint warnings — these are kept for type re-export clarity.
export type { SliderControl, NumberControl };
