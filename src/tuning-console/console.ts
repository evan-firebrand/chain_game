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
}

const STYLES = `
.tc-panel {
  background: #181828;
  color: #e8e8f0;
  border-left: 1px solid #333;
  width: 320px;
  height: 100dvh;
  overflow-y: auto;
  padding: 16px;
  font-family: system-ui, sans-serif;
  font-size: 13px;
  display: none;
  flex-shrink: 0;
}
body[data-console-open] .tc-panel {
  display: block;
}
.tc-panel h2 {
  font-size: 14px;
  letter-spacing: 2px;
  color: #888;
  margin: 16px 0 8px;
  text-transform: uppercase;
}
.tc-panel h2:first-of-type { margin-top: 0; }
.tc-slider, .tc-number {
  display: block;
  margin: 8px 0;
}
.tc-slider-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 2px;
}
.tc-slider-label { color: #ccc; }
.tc-slider-readout { color: #88c; font-variant-numeric: tabular-nums; }
.tc-slider input[type=range] {
  width: 100%;
  accent-color: #88c;
}
.tc-number {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.tc-number input[type=number] {
  background: #222;
  color: #eee;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 4px 6px;
  width: 80px;
  font-size: 12px;
}
.tc-button {
  background: #2a3050;
  color: #fff;
  border: 1px solid #445;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  margin: 4px 4px 4px 0;
}
.tc-button:hover { background: #3a4060; }
.tc-textarea {
  width: 100%;
  height: 160px;
  background: #0e0e18;
  color: #cfcfd8;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 6px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  resize: vertical;
  box-sizing: border-box;
}
.tc-textarea.tc-error { border-color: #c0392b; }
.tc-message { font-size: 11px; margin-top: 4px; min-height: 1em; }
.tc-message.tc-error { color: #e57b7b; }
.tc-message.tc-success { color: #7fc97f; }
.tc-advanced-toggle {
  background: none;
  border: none;
  color: #88c;
  cursor: pointer;
  padding: 4px 0;
  font-size: 12px;
  text-decoration: underline;
}
.tc-advanced { display: none; }
.tc-advanced[data-open] { display: block; }
.tc-percent { color: #666; font-size: 10px; margin-left: 6px; }
.tc-warning {
  background: #4a2a2a;
  color: #ffb;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  margin: 4px 0;
  display: none;
}
.tc-warning[data-show] { display: block; }
.tc-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
}
.tc-title {
  font-size: 16px;
  letter-spacing: 4px;
  font-weight: 700;
  color: #eef;
}
.tc-close {
  background: none;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}
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

  const initialConfig = opts.session.getState().config;

  const ruleKSlider = makeSlider({
    id: 'tc-rulek',
    label: 'Rule D · k',
    min: 0,
    max: 8,
    step: 1,
    value: initialConfig.ruleK,
  });
  ruleKSlider.onChange(v => { opts.session.updateConfig({ ruleK: v }); });
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
      opts.session.updateConfig({ spawnWeights: newWeights });
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
    opts.session.updateConfig({
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
    const current = opts.session.getState().config;
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
    const json = exportConfig(opts.session.getState().config);
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

    const current = opts.session.getState().config;
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
      opts.session.updateConfig({
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

  const unsubscribe = opts.session.on(ev => {
    setConfig(ev.config);
  });

  return {
    destroy(): void {
      unsubscribe();
      panel.remove();
    },
    setConfig,
  };
}

// Silence unused-import lint warnings — these are kept for type re-export clarity.
export type { SliderControl, NumberControl };
